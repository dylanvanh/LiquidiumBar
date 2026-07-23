export interface ScaledAmount {
  value: bigint;
  decimals: number;
}

export interface ScaledRatio {
  value: bigint;
  decimals: number;
}

export type PortfolioRiskState = "no-debt" | "above-threshold" | "at-risk" | "unknown";

export interface NormalizedMarket {
  id: string;
  symbol: string;
  chain: string;
  decimals: number;
  frozen: boolean;
  totalSupplied: ScaledAmount;
  totalBorrowed: ScaledAmount;
  availableLiquidity: ScaledAmount;
  totalSuppliedUsd?: ScaledAmount;
  totalBorrowedUsd?: ScaledAmount;
  availableLiquidityUsd?: ScaledAmount;
  priceUsd?: number;
  supplyApr: ScaledRatio;
  borrowApr: ScaledRatio;
  utilization: ScaledRatio;
  maxLtv: ScaledRatio;
  liquidationThreshold: ScaledRatio;
  liquidationBonus: ScaledRatio;
  protocolLiquidationFee: ScaledRatio;
  reserveFactor: ScaledRatio;
  baseRate: ScaledRatio;
  optimalUtilization: ScaledRatio;
  rateSlopeBefore: ScaledRatio;
  rateSlopeAfter: ScaledRatio;
  supplyCap?: ScaledAmount;
  borrowCap?: ScaledAmount;
  sameAssetBorrowing: boolean;
  sameAssetBorrowingDustThreshold: ScaledAmount;
  lastUpdated?: string;
}

export interface MarketSnapshot {
  markets: NormalizedMarket[];
  totalSuppliedUsd?: ScaledAmount;
  totalBorrowedUsd?: ScaledAmount;
  availableLiquidityUsd?: ScaledAmount;
  aggregateUtilization?: ScaledRatio;
  activeMarketCount: number;
  pricesComplete: boolean;
  fetchedAt: string;
}

export interface NormalizedPosition {
  id: string;
  marketId: string;
  symbol: string;
  chain: string;
  supplied: ScaledAmount;
  borrowed: ScaledAmount;
  earnedInterest: ScaledAmount;
  debtInterest: ScaledAmount;
  suppliedUsd?: ScaledAmount;
  borrowedUsd?: ScaledAmount;
  priceUsd?: number;
  supplyApr: ScaledRatio;
  borrowApr: ScaledRatio;
  lastUpdated: string;
}

export interface NormalizedPortfolio {
  profileId: string;
  totalSuppliedUsd?: ScaledAmount;
  totalBorrowedUsd?: ScaledAmount;
  netPositionUsd?: ScaledAmount;
  availableToBorrowUsd?: ScaledAmount;
  collateralUsd?: ScaledAmount;
  debtUsd?: ScaledAmount;
  weightedSupplyApr?: ScaledRatio;
  weightedBorrowApr?: ScaledRatio;
  estimatedNetApr?: ScaledRatio;
  healthFactor?: ScaledRatio;
  healthFactorInfinite: boolean;
  currentLtvBps?: bigint;
  weightedMaxLtvBps?: bigint;
  liquidationThresholdBps?: bigint;
  riskState: PortfolioRiskState;
  positions: NormalizedPosition[];
  pricesComplete: boolean;
  fetchedAt: string;
}

export type ProtocolActivityOperation =
  | "deposit"
  | "borrow"
  | "repayment"
  | "withdrawal"
  | "liquidation";

export interface NormalizedProtocolActivityEntry {
  id: string;
  operation: ProtocolActivityOperation;
  marketId: string;
  symbol: string;
  amount: ScaledAmount;
  timestamp: string;
  txids: string[];
}

export interface ProtocolActivitySnapshot {
  entries: NormalizedProtocolActivityEntry[];
  fetchedAt: string;
}

export type LiquidiumAppError =
  | { type: "invalid-profile"; message: string; cause?: unknown }
  | { type: "network"; message: string; cause?: unknown }
  | { type: "sdk"; message: string; cause?: unknown }
  | { type: "unsupported-runtime"; message: string; cause?: unknown }
  | { type: "normalization"; message: string; cause?: unknown };
