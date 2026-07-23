import type { Pool, UserPositionSummary, UserReserve } from "@liquidium/client";
import { normalizeMarket, normalizePortfolio } from "../liquidium/adapter";
import type {
  MarketSnapshot,
  NormalizedPortfolio,
  ProtocolActivitySnapshot,
} from "../liquidium/sdk.types";

export const poolFixture: Pool = {
  id: "hkmli-faaaa-aaaar-qb4ba-cai",
  asset: "BTC",
  displayName: "Bitcoin",
  chain: "BTC",
  decimals: 8n,
  frozen: false,
  totalSupply: 200_000_000n,
  totalDebt: 50_000_000n,
  availableLiquidity: 150_000_000n,
  supplyCap: 1_000_000_000n,
  borrowCap: 500_000_000n,
  maxLtv: 6_500n,
  liquidationThreshold: 7_400n,
  liquidationBonus: 500n,
  protocolLiquidationFee: 500n,
  reserveFactor: 1_500n,
  rateDecimals: 27n,
  lendingRate: 50_000_000_000_000_000_000_000_000n,
  estimatedLendingApy: 51_271_096_376_024_039_697_517_637n,
  borrowingRate: 100_000_000_000_000_000_000_000_000n,
  estimatedBorrowingApy: 105_155_781_616_227_756_968_930_795n,
  utilizationRate: 250_000_000_000_000_000_000_000_000n,
  baseRate: 10_000_000_000_000_000_000_000_000n,
  optimalUtilizationRate: 800_000_000_000_000_000_000_000_000n,
  rateSlopeBefore: 40_000_000_000_000_000_000_000_000n,
  rateSlopeAfter: 600_000_000_000_000_000_000_000_000n,
  lendingIndex: 0n,
  borrowIndex: 0n,
  sameAssetBorrowing: false,
  sameAssetBorrowingDustThreshold: 5_000n,
  lastUpdated: 1_720_000_000n,
};

export const summaryFixture: UserPositionSummary = {
  totalCollateralUsd: 200_000_000n,
  totalDebtUsd: 50_000_000n,
  availableBorrowsUsd: 80_000_000n,
  netWorthUsd: 150_000_000n,
  usdDecimals: 6n,
  currentLtvBps: 2_500n,
  weightedMaxLtvBps: 6_500n,
  weightedLiquidationThresholdBps: 7_400n,
  healthFactor: 999_999_999n,
  healthFactorDecimals: 3n,
};

export const reserveFixture: UserReserve = {
  position: {
    poolId: poolFixture.id,
    asset: "BTC",
    deposited: 200_000_000n,
    depositedDecimals: 8n,
    borrowed: 49_000_000n,
    borrowedDecimals: 8n,
    earnedInterest: 2_000_000n,
    debtInterest: 1_000_000n,
    lastUpdate: 1_720_000_000n,
  },
  pool: poolFixture,
  priceUsd: 100,
  suppliedUsd: 200_000_000n,
  borrowedUsd: 50_000_000n,
  usdDecimals: 6n,
};

export function marketSnapshotFixture(
  overrides: Partial<MarketSnapshot> = {}
): MarketSnapshot {
  const market = normalizeMarket(poolFixture, 100);
  return {
    markets: [market],
    totalSuppliedUsd: market.totalSuppliedUsd,
    totalBorrowedUsd: market.totalBorrowedUsd,
    availableLiquidityUsd: market.availableLiquidityUsd,
    aggregateUtilization: market.utilization,
    activeMarketCount: 1,
    pricesComplete: true,
    fetchedAt: "2026-07-14T12:00:00.000Z",
    ...overrides,
  };
}

export function protocolActivityFixture(
  overrides: Partial<ProtocolActivitySnapshot> = {}
): ProtocolActivitySnapshot {
  return {
    entries: [
      {
        id: "outflow:withdraw-1",
        operation: "withdrawal",
        marketId: poolFixture.id,
        symbol: "BTC",
        amount: { value: 2_014_000_000n, decimals: 8 },
        timestamp: new Date(Date.now() - 19 * 60_000).toISOString(),
        txids: ["3755.9187"],
      },
      {
        id: "inflow:repay-1",
        operation: "repayment",
        marketId: "usdc-pool",
        symbol: "USDC",
        amount: { value: 38_500_000n, decimals: 6 },
        timestamp: new Date(Date.now() - 20 * 60_000).toISOString(),
        txids: ["0xb55f0c1a4e2d9f8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f78"],
      },
      {
        id: "inflow:supply-1",
        operation: "deposit",
        marketId: poolFixture.id,
        symbol: "BTC",
        amount: { value: 990_000_000_000n, decimals: 8 },
        timestamp: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        txids: [],
      },
    ],
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function portfolioFixture(
  overrides: Partial<NormalizedPortfolio> = {}
): NormalizedPortfolio {
  return {
    ...normalizePortfolio("aaaaa-aa", summaryFixture, [reserveFixture]),
    fetchedAt: "2026-07-14T12:00:00.000Z",
    ...overrides,
  };
}
