import { useQuery } from "@tanstack/react-query";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import type { MarketSnapshot, ScaledAmount } from "../liquidium/sdk.types";
import { fetchMarkets } from "./queries";
import type { MenuBarMetric } from "./storage";

export function useTrayMarketTotal(
  enabled: boolean,
  refreshIntervalSeconds: number,
  metric: MenuBarMetric
): void {
  const runningInTauri = isTauri();
  const showsValue = metric !== "none";
  const query = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    enabled: enabled && runningInTauri && showsValue,
    refetchInterval:
      enabled && runningInTauri && showsValue ? refreshIntervalSeconds * 1_000 : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!runningInTauri) return;
    if (!showsValue) {
      void invoke("set_tray_market_title", { title: null }).catch(() => undefined);
      return;
    }
    if (!query.data) return;
    void invoke("set_tray_market_title", {
      title: formatTrayValue(selectMenuBarAmount(query.data, metric)),
    }).catch(() => undefined);
  }, [metric, query.data, runningInTauri, showsValue]);
}

export function selectMenuBarAmount(
  snapshot: MarketSnapshot,
  metric: MenuBarMetric
): ScaledAmount | undefined {
  if (metric === "none") return undefined;
  if (metric === "supplied") return snapshot.totalSuppliedUsd;
  if (metric === "available") return snapshot.availableLiquidityUsd;
  return snapshot.totalBorrowedUsd;
}

export function formatTrayValue(value: ScaledAmount | undefined): string {
  if (!value) return "—";
  const amount = Number(value.value) / 10 ** value.decimals;
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}
