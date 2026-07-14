import {
  LiquidiumClient,
  type Pool,
  type UserPositionSummary,
  type UserReserve,
} from "@liquidium/client";
import { mapLiquidiumError } from "./errors";
import {
  applyRatio,
  atomicToUsd,
  divideAmounts,
  rescaleBigInt,
  subtractAmounts,
  sumAmounts,
  toSafeDecimals,
  USD_DECIMALS,
} from "./math";
import { validateProfileId } from "./profile";
import type {
  LiquidiumAppError,
  MarketSnapshot,
  NormalizedMarket,
  NormalizedPortfolio,
  NormalizedPosition,
  PortfolioRiskState,
  ScaledAmount,
  ScaledRatio,
} from "./sdk.types";

const SDK_USD_DECIMALS = 27;

export interface LiquidiumReadAdapter {
  getMarkets(): Promise<MarketSnapshot>;
  getPortfolio(profileId: string): Promise<NormalizedPortfolio>;
}

export class SdkLiquidiumReadAdapter implements LiquidiumReadAdapter {
  private readonly client: LiquidiumClient;

  constructor(client = new LiquidiumClient({ timeoutMs: 30_000 })) {
    this.client = client;
  }

  async getMarkets(): Promise<MarketSnapshot> {
    try {
      const [pools, prices] = await Promise.all([
        this.client.market.listPools(),
        this.client.market.getAssetPrices(),
      ]);
      const fetchedAt = new Date().toISOString();
      const markets = pools.map((pool) => normalizeMarket(pool, prices[pool.asset]));
      const pricedMarkets = markets.filter(hasMarketUsdValues);
      const pricesComplete = pricedMarkets.length === markets.length;
      const suppliedValues = pricedMarkets.map((market) => market.totalSuppliedUsd);
      const borrowedValues = pricedMarkets.map((market) => market.totalBorrowedUsd);
      const liquidityValues = pricedMarkets.map(
        (market) => market.availableLiquidityUsd
      );
      const totalSuppliedUsd = sumAmounts(suppliedValues);
      const totalBorrowedUsd = sumAmounts(borrowedValues);
      const availableLiquidityUsd = sumAmounts(liquidityValues);

      return {
        markets,
        totalSuppliedUsd: pricedMarkets.length ? totalSuppliedUsd : undefined,
        totalBorrowedUsd: pricedMarkets.length ? totalBorrowedUsd : undefined,
        availableLiquidityUsd: pricedMarkets.length ? availableLiquidityUsd : undefined,
        aggregateUtilization: divideAmounts(totalBorrowedUsd, totalSuppliedUsd),
        activeMarketCount: markets.filter((market) => !market.frozen).length,
        pricesComplete,
        fetchedAt,
      };
    } catch (error) {
      throw mapLiquidiumError(error);
    }
  }

  async getPortfolio(profileInput: string): Promise<NormalizedPortfolio> {
    const validation = validateProfileId(profileInput);
    if (!validation.ok) {
      throw validation.error;
    }

    try {
      const [summary, reserves] = await Promise.all([
        this.client.positions.getUserPositionSummary(validation.profileId),
        this.client.positions.getUserReserves(validation.profileId),
      ]);

      return normalizePortfolio(validation.profileId, summary, reserves);
    } catch (error) {
      if (isLiquidiumAppError(error)) {
        throw error;
      }
      throw mapLiquidiumError(error);
    }
  }
}

export const liquidiumAdapter: LiquidiumReadAdapter = new SdkLiquidiumReadAdapter();

function normalizeMarket(pool: Pool, priceUsd?: number): NormalizedMarket {
  const decimals = toSafeDecimals(pool.decimals, `${pool.asset} amount`);
  const rateDecimals = toSafeDecimals(pool.rateDecimals, `${pool.asset} rate`);
  const totalSupplied = amount(pool.totalSupply, decimals);
  const totalBorrowed = amount(pool.totalDebt, decimals);
  const availableLiquidity = amount(pool.availableLiquidity, decimals);

  return {
    id: pool.id,
    symbol: pool.asset,
    chain: pool.chain,
    decimals,
    frozen: pool.frozen,
    totalSupplied,
    totalBorrowed,
    availableLiquidity,
    totalSuppliedUsd: priceUsd ? atomicToUsd(totalSupplied, priceUsd) : undefined,
    totalBorrowedUsd: priceUsd ? atomicToUsd(totalBorrowed, priceUsd) : undefined,
    availableLiquidityUsd: priceUsd
      ? atomicToUsd(availableLiquidity, priceUsd)
      : undefined,
    priceUsd: validPrice(priceUsd),
    supplyApr: ratio(pool.lendingRate, rateDecimals),
    borrowApr: ratio(pool.borrowingRate, rateDecimals),
    utilization: ratio(pool.utilizationRate, rateDecimals),
    maxLtv: ratio(pool.maxLtv, rateDecimals),
    liquidationThreshold: ratio(pool.liquidationThreshold, rateDecimals),
    liquidationBonus: ratio(pool.liquidationBonus, rateDecimals),
    protocolLiquidationFee: ratio(pool.protocolLiquidationFee, rateDecimals),
    reserveFactor: ratio(pool.reserveFactor, rateDecimals),
    baseRate: ratio(pool.baseRate, rateDecimals),
    optimalUtilization: ratio(pool.optimalUtilizationRate, rateDecimals),
    rateSlopeBefore: ratio(pool.rateSlopeBefore, rateDecimals),
    rateSlopeAfter: ratio(pool.rateSlopeAfter, rateDecimals),
    supplyCap:
      pool.supplyCap === undefined ? undefined : amount(pool.supplyCap, decimals),
    borrowCap:
      pool.borrowCap === undefined ? undefined : amount(pool.borrowCap, decimals),
    sameAssetBorrowing: pool.sameAssetBorrowing,
    sameAssetBorrowingDustThreshold: amount(
      pool.sameAssetBorrowingDustThreshold,
      decimals
    ),
    lastUpdated: pool.lastUpdated
      ? new Date(Number(pool.lastUpdated) * 1_000).toISOString()
      : undefined,
  };
}

function normalizePortfolio(
  profileId: string,
  summary: UserPositionSummary,
  reserves: UserReserve[]
): NormalizedPortfolio {
  const fetchedAt = new Date().toISOString();
  const positions = reserves.map(normalizePosition);
  const pricedPositions = positions.filter(hasPositionUsdValues);
  const pricesComplete = pricedPositions.length === positions.length;
  const totalSuppliedUsd = sumAmounts(
    pricedPositions.map((position) => position.suppliedUsd)
  );
  const totalBorrowedUsd = sumAmounts(
    pricedPositions.map((position) => position.borrowedUsd)
  );
  const netPositionUsd = subtractAmounts(totalSuppliedUsd, totalBorrowedUsd);
  const annualSupply = sumAmounts(
    pricedPositions.map((position) =>
      applyRatio(position.suppliedUsd, position.supplyApr)
    )
  );
  const annualBorrow = sumAmounts(
    pricedPositions.map((position) =>
      applyRatio(position.borrowedUsd, position.borrowApr)
    )
  );
  const annualNet = subtractAmounts(annualSupply, annualBorrow);
  const weightedSupplyApr = pricesComplete
    ? divideAmounts(annualSupply, totalSuppliedUsd)
    : undefined;
  const weightedBorrowApr = pricesComplete
    ? divideAmounts(annualBorrow, totalBorrowedUsd)
    : undefined;
  const estimatedNetApr =
    pricesComplete && netPositionUsd.value > 0n
      ? divideAmounts(annualNet, netPositionUsd)
      : undefined;
  const health = deriveHealth(summary);

  return {
    profileId,
    totalSuppliedUsd: pricedPositions.length ? totalSuppliedUsd : undefined,
    totalBorrowedUsd: pricedPositions.length ? totalBorrowedUsd : undefined,
    netPositionUsd: pricedPositions.length ? netPositionUsd : undefined,
    availableToBorrowUsd: sdkUsd(summary.availableBorrowsUsd),
    collateralUsd: sdkUsd(summary.totalCollateralUsd),
    debtUsd: sdkUsd(summary.totalDebtUsd),
    weightedSupplyApr,
    weightedBorrowApr,
    estimatedNetApr,
    healthFactor: health.factor,
    healthFactorInfinite: health.infinite,
    currentLtvBps: summary.currentLtvBps,
    weightedMaxLtvBps: summary.weightedMaxLtvBps,
    liquidationThresholdBps: summary.weightedLiquidationThresholdBps,
    riskState: health.riskState,
    positions,
    pricesComplete,
    fetchedAt,
  };
}

function normalizePosition(reserve: UserReserve): NormalizedPosition {
  const depositedDecimals = toSafeDecimals(
    reserve.position.depositedDecimals,
    `${reserve.position.asset} supplied amount`
  );
  const borrowedDecimals = toSafeDecimals(
    reserve.position.borrowedDecimals,
    `${reserve.position.asset} borrowed amount`
  );
  const rateDecimals = toSafeDecimals(
    reserve.pool.rateDecimals,
    `${reserve.position.asset} rate`
  );

  return {
    id: reserve.position.poolId,
    marketId: reserve.position.poolId,
    symbol: reserve.position.asset,
    chain: reserve.pool.chain,
    supplied: amount(reserve.position.deposited, depositedDecimals),
    borrowed: amount(
      reserve.position.borrowed + reserve.position.debtInterest,
      borrowedDecimals
    ),
    earnedInterest: amount(reserve.position.earnedInterest, depositedDecimals),
    debtInterest: amount(reserve.position.debtInterest, borrowedDecimals),
    suppliedUsd: validPrice(reserve.priceUsd) ? sdkUsd(reserve.suppliedUsd) : undefined,
    borrowedUsd: validPrice(reserve.priceUsd) ? sdkUsd(reserve.borrowedUsd) : undefined,
    priceUsd: validPrice(reserve.priceUsd),
    supplyApr: ratio(reserve.pool.lendingRate, rateDecimals),
    borrowApr: ratio(reserve.pool.borrowingRate, rateDecimals),
    lastUpdated: new Date(Number(reserve.position.lastUpdate) * 1_000).toISOString(),
  };
}

function deriveHealth(summary: UserPositionSummary): {
  factor?: ScaledRatio;
  infinite: boolean;
  riskState: PortfolioRiskState;
} {
  if (summary.totalDebtUsd === 0n) {
    return { infinite: true, riskState: "no-debt" };
  }

  if (summary.currentLtvBps <= 0n || summary.weightedLiquidationThresholdBps <= 0n) {
    return { infinite: false, riskState: "unknown" };
  }

  const factorDecimals = 6;
  return {
    factor: {
      value:
        (summary.weightedLiquidationThresholdBps * 10n ** BigInt(factorDecimals)) /
        summary.currentLtvBps,
      decimals: factorDecimals,
    },
    infinite: false,
    riskState:
      summary.currentLtvBps >= summary.weightedLiquidationThresholdBps
        ? "at-risk"
        : "above-threshold",
  };
}

function sdkUsd(value: bigint): ScaledAmount {
  return {
    value: rescaleBigInt(value, SDK_USD_DECIMALS, USD_DECIMALS),
    decimals: USD_DECIMALS,
  };
}

function amount(value: bigint, decimals: number): ScaledAmount {
  return { value, decimals };
}

function ratio(value: bigint, decimals: number): ScaledRatio {
  return { value, decimals };
}

function validPrice(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}

function hasMarketUsdValues(market: NormalizedMarket): market is NormalizedMarket & {
  totalSuppliedUsd: ScaledAmount;
  totalBorrowedUsd: ScaledAmount;
  availableLiquidityUsd: ScaledAmount;
} {
  return Boolean(
    market.totalSuppliedUsd && market.totalBorrowedUsd && market.availableLiquidityUsd
  );
}

function hasPositionUsdValues(
  position: NormalizedPosition
): position is NormalizedPosition & {
  suppliedUsd: ScaledAmount;
  borrowedUsd: ScaledAmount;
} {
  return Boolean(position.suppliedUsd && position.borrowedUsd);
}

function isLiquidiumAppError(error: unknown): error is LiquidiumAppError {
  return (
    typeof error === "object" && error !== null && "type" in error && "message" in error
  );
}
