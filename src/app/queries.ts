import type { MarketSnapshot, NormalizedPortfolio } from "../liquidium/sdk.types";

export async function fetchMarkets(): Promise<MarketSnapshot> {
  const { liquidiumAdapter } = await import("../liquidium/adapter");
  return liquidiumAdapter.getMarkets();
}

export async function fetchPortfolio(profileId: string): Promise<NormalizedPortfolio> {
  const { liquidiumAdapter } = await import("../liquidium/adapter");
  return liquidiumAdapter.getPortfolio(profileId);
}
