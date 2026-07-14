import { useQuery } from "@tanstack/react-query";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import type { ScaledAmount } from "../liquidium/sdk.types";
import { fetchMarkets } from "./queries";

export function useTrayBorrowedTotal(
  enabled: boolean,
  refreshIntervalSeconds: number
): void {
  const runningInTauri = isTauri();
  const query = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    enabled: enabled && runningInTauri,
    refetchInterval: enabled && runningInTauri ? refreshIntervalSeconds * 1_000 : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!runningInTauri || !query.data?.totalBorrowedUsd) return;
    void invoke("set_tray_borrowed_title", {
      title: formatTrayBorrowed(query.data.totalBorrowedUsd),
    }).catch(() => undefined);
  }, [query.data?.totalBorrowedUsd, runningInTauri]);
}

export function formatTrayBorrowed(value: ScaledAmount): string {
  const amount = Number(value.value) / 10 ** value.decimals;
  if (!Number.isFinite(amount)) return "Borrowed —";
  const compact = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
  return `${compact} borrowed`;
}
