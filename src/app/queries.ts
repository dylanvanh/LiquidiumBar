import type {
  MarketSnapshot,
  NormalizedPortfolio,
  ProtocolActivitySnapshot,
} from "../liquidium/sdk.types";
import { saveMarketSnapshot, savePortfolioSnapshot } from "./storage";

export async function fetchMarkets(): Promise<MarketSnapshot> {
  const { liquidiumAdapter } = await import("../liquidium/adapter");
  const snapshot = await liquidiumAdapter.getMarkets();
  void saveMarketSnapshot(snapshot).catch(() => undefined);
  return snapshot;
}

export async function fetchPortfolio(profileId: string): Promise<NormalizedPortfolio> {
  const demo = new URLSearchParams(window.location.search).get("demo");
  if (import.meta.env.DEV && (demo === "portfolio" || demo === "all")) {
    const { demoPortfolioSnapshot } = await import("./screenshotDemo");
    return demoPortfolioSnapshot(profileId);
  }
  const { liquidiumAdapter } = await import("../liquidium/adapter");
  const snapshot = await liquidiumAdapter.getPortfolio(profileId);
  void savePortfolioSnapshot(profileId, snapshot).catch(() => undefined);
  return snapshot;
}

export async function fetchProtocolActivity(): Promise<ProtocolActivitySnapshot> {
  const { liquidiumAdapter } = await import("../liquidium/adapter");
  return liquidiumAdapter.getProtocolActivity();
}

export async function resolveProfileInput(input: string): Promise<string> {
  const { liquidiumAdapter } = await import("../liquidium/adapter");
  return liquidiumAdapter.resolveProfileId(input);
}
