import type { NormalizedPortfolio, NormalizedPosition } from "../liquidium/sdk.types";

const usd = (value: bigint) => ({ value: value * 1_000_000_000_000n, decimals: 12 });
const ratio = (basisPoints: bigint) => ({
  value: basisPoints * 100_000_000n,
  decimals: 12,
});
const token = (value: bigint, decimals: number) => ({ value, decimals });

export function demoPortfolioSnapshot(profileId: string): NormalizedPortfolio {
  return {
    profileId,
    totalSuppliedUsd: usd(125_430n),
    totalBorrowedUsd: usd(32_100n),
    netPositionUsd: usd(93_330n),
    availableToBorrowUsd: usd(20_480n),
    collateralUsd: usd(125_430n),
    debtUsd: usd(32_100n),
    weightedSupplyApr: ratio(412n),
    weightedBorrowApr: ratio(845n),
    estimatedNetApr: ratio(263n),
    healthFactor: { value: 1_730_000n, decimals: 6 },
    healthFactorInfinite: false,
    currentLtvBps: 2_559n,
    weightedMaxLtvBps: 6_500n,
    liquidationThresholdBps: 7_400n,
    riskState: "above-threshold",
    positions: [
      position({
        id: "demo-btc",
        symbol: "BTC",
        chain: "BTC",
        supplied: token(180_000_000n, 8),
        borrowed: token(0n, 8),
        suppliedUsd: usd(115_200n),
        borrowedUsd: usd(0n),
        priceUsd: 64_000,
        supplyApr: ratio(9n),
        borrowApr: ratio(101n),
      }),
      position({
        id: "demo-usdt",
        symbol: "USDT",
        chain: "ETH",
        supplied: token(10_230_000_000n, 6),
        borrowed: token(32_100_000_000n, 6),
        suppliedUsd: usd(10_230n),
        borrowedUsd: usd(32_100n),
        priceUsd: 1,
        supplyApr: ratio(129n),
        borrowApr: ratio(845n),
      }),
    ],
    pricesComplete: true,
    fetchedAt: new Date().toISOString(),
  };
}

function position(
  values: Pick<
    NormalizedPosition,
    | "id"
    | "symbol"
    | "chain"
    | "supplied"
    | "borrowed"
    | "suppliedUsd"
    | "borrowedUsd"
    | "priceUsd"
    | "supplyApr"
    | "borrowApr"
  >
): NormalizedPosition {
  return {
    ...values,
    marketId: values.id,
    earnedInterest: token(0n, values.supplied.decimals),
    debtInterest: token(0n, values.borrowed.decimals),
    lastUpdated: new Date().toISOString(),
  };
}
