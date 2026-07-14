import { useQuery } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import type { ScaledAmount, ScaledRatio } from "../liquidium/sdk.types";
import { MarketCompositionChart, MarketValueChart } from "./DitherCharts";
import { formatAge } from "./format";
import { fetchMarkets } from "./queries";

export function InsightsView({
  panelOpen,
  refreshIntervalSeconds,
}: {
  panelOpen: boolean;
  refreshIntervalSeconds: number;
}) {
  const [chartMode, setChartMode] = useState<"composition" | "capital">("composition");
  const query = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    enabled: panelOpen,
    refetchInterval: panelOpen ? refreshIntervalSeconds * 1_000 : false,
  });
  const snapshot = query.data;

  if (!snapshot && query.isPending) {
    return <InsightsSkeleton />;
  }

  if (!snapshot) {
    return (
      <section className="state-panel" role="alert">
        <span className="state-symbol" aria-hidden="true">
          !
        </span>
        <h1>Insights unavailable</h1>
        <p>{errorMessage(query.error)}</p>
        <button
          type="button"
          className="primary-button"
          onClick={() => query.refetch()}
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="view insights-view" aria-labelledby="insights-title">
      <div className="view-heading insights-heading">
        <div>
          <p className="eyebrow">Protocol pulse</p>
          <h1 id="insights-title">Insights</h1>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          aria-label="Refresh insights"
          title="Refresh insights"
        >
          <span className={query.isFetching ? "refresh-icon spinning" : "refresh-icon"}>
            ↻
          </span>
        </button>
      </div>

      {query.error ? (
        <div className="inline-alert" role="status">
          Refresh failed. Showing data from {formatAge(snapshot.fetchedAt)}.
        </div>
      ) : null}

      <section className="insight-totals" aria-label="Protocol totals">
        <InsightTotal
          label="Total supplied"
          value={formatCompactUsd(snapshot.totalSuppliedUsd)}
        />
        <InsightTotal
          label="Active loans"
          value={formatCompactUsd(snapshot.totalBorrowedUsd)}
        />
        <InsightTotal
          label="Available"
          value={formatCompactUsd(snapshot.availableLiquidityUsd)}
        />
      </section>

      {chartMode === "composition" ? (
        <MarketCompositionChart
          markets={snapshot.markets}
          action={<InsightChartSwitcher value={chartMode} onChange={setChartMode} />}
        />
      ) : (
        <MarketValueChart
          markets={snapshot.markets}
          action={<InsightChartSwitcher value={chartMode} onChange={setChartMode} />}
        />
      )}

      {!snapshot.pricesComplete ? (
        <p className="data-note">
          USD totals exclude assets without a current SDK price.
        </p>
      ) : null}
      <div className="insights-footer">
        <p>
          Live snapshot · Updated {formatAge(snapshot.fetchedAt)}. RC.1 does not expose
          protocol history.
        </p>
        <button type="button" onClick={openOfficialInsights}>
          View full breakdown <span aria-hidden="true">↗</span>
        </button>
      </div>
    </section>
  );
}

function InsightChartSwitcher({
  value,
  onChange,
}: {
  value: "composition" | "capital";
  onChange(value: "composition" | "capital"): void;
}) {
  return (
    <fieldset className="insight-chart-switcher">
      <legend className="sr-only">Insights chart</legend>
      <button
        type="button"
        aria-pressed={value === "composition"}
        onClick={() => onChange("composition")}
      >
        Share
      </button>
      <button
        type="button"
        aria-pressed={value === "capital"}
        onClick={() => onChange("capital")}
      >
        Capital
      </button>
    </fieldset>
  );
}

function InsightTotal({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>Live pool sum</small>
    </article>
  );
}

function formatCompactUsd(value: ScaledAmount | undefined): string {
  if (!value) return "—";
  const amount = scaledToNumber(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(amount)
    : "—";
}

function openOfficialInsights() {
  const url = "https://app.liquidium.fi/insights";
  if (isTauri()) void openUrl(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

function scaledToNumber(value: ScaledAmount | ScaledRatio): number {
  return Number(value.value) / 10 ** value.decimals;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Liquidium could not be reached.";
}

function InsightsSkeleton() {
  return (
    <section className="view" aria-busy="true" aria-label="Loading insights">
      <div className="skeleton skeleton-title" />
      <div className="insight-totals skeleton-insight-totals">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
      <div className="skeleton skeleton-chart" />
    </section>
  );
}
