import type { MarketSnapshot, NormalizedPortfolio } from "../liquidium/sdk.types";
import { saveMarketSnapshot, savePortfolioSnapshot } from "./storage";

export async function fetchMarkets(): Promise<MarketSnapshot> {
  const { liquidiumAdapter } = await import("../liquidium/adapter");
  const snapshot = await liquidiumAdapter.getMarkets();
  void saveMarketSnapshot(snapshot).catch(() => undefined);
  return snapshot;
}

export async function fetchPortfolio(profileId: string): Promise<NormalizedPortfolio> {
  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("demo") === "portfolio"
  ) {
    const { demoPortfolioSnapshot } = await import("./screenshotDemo");
    return demoPortfolioSnapshot(profileId);
  }
  const { liquidiumAdapter } = await import("../liquidium/adapter");
  const snapshot = await liquidiumAdapter.getPortfolio(profileId);
  void savePortfolioSnapshot(profileId, snapshot).catch(() => undefined);
  return snapshot;
}
