import { invoke, isTauri } from "@tauri-apps/api/core";
import { liquidiumAdapter } from "./adapter";

export interface CompatibilityReport {
  runtime: {
    tauri: boolean;
    fetch: boolean;
    bigint: boolean;
    webCrypto: boolean;
    esm: boolean;
  };
  markets:
    | { ok: true; count: number; symbols: string[] }
    | { ok: false; error: string };
  portfolio:
    | { ok: true; profileId: string; positionCount: number }
    | { ok: false; error: string };
  observedOrigins: string[];
  completedAt: string;
}

let compatibilitySpike: Promise<CompatibilityReport> | undefined;

export function runCompatibilitySpike(): Promise<CompatibilityReport> {
  compatibilitySpike ??= executeCompatibilitySpike();
  return compatibilitySpike;
}

async function executeCompatibilitySpike(): Promise<CompatibilityReport> {
  const [markets, portfolio] = await Promise.allSettled([
    liquidiumAdapter.getMarkets(),
    liquidiumAdapter.getPortfolio("aaaaa-aa"),
  ]);

  const report: CompatibilityReport = {
    runtime: {
      tauri: isTauri(),
      fetch: typeof globalThis.fetch === "function",
      bigint: typeof BigInt === "function",
      webCrypto: Boolean(globalThis.crypto?.subtle),
      esm: true,
    },
    markets:
      markets.status === "fulfilled"
        ? {
            ok: true,
            count: markets.value.markets.length,
            symbols: markets.value.markets.map((market) => market.symbol),
          }
        : { ok: false, error: readableError(markets.reason) },
    portfolio:
      portfolio.status === "fulfilled"
        ? {
            ok: true,
            profileId: portfolio.value.profileId,
            positionCount: portfolio.value.positions.length,
          }
        : { ok: false, error: readableError(portfolio.reason) },
    observedOrigins: getObservedOrigins(),
    completedAt: new Date().toISOString(),
  };

  if (isTauri()) {
    await invoke("log_compatibility", {
      report: {
        runtimeReady: Object.values(report.runtime).every(Boolean),
        marketsOk: report.markets.ok,
        marketCount: report.markets.ok ? report.markets.count : 0,
        portfolioOk: report.portfolio.ok,
        positionCount: report.portfolio.ok ? report.portfolio.positionCount : 0,
        observedOrigins: report.observedOrigins,
      },
    });
  }

  return report;
}

function getObservedOrigins(): string[] {
  const origins = new Set<string>();
  for (const entry of performance.getEntriesByType("resource")) {
    try {
      origins.add(new URL(entry.name).origin);
    } catch {
      // Ignore non-URL performance entries.
    }
  }
  return [...origins].sort();
}

function readableError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Unknown compatibility error";
}
