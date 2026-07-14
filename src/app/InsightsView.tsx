import { useQuery } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type {
  NormalizedMarket,
  ScaledAmount,
  ScaledRatio,
} from "../liquidium/sdk.types";
import { AssetIcon } from "./AssetIcon";
import { DisplayModeSwitcher } from "./DisplayModeSwitcher";
import { MarketCompositionChart, MarketValueChart } from "./DitherCharts";
import { formatAge } from "./format";
import { fetchMarkets } from "./queries";
import type { DisplayMode } from "./storage";

export function InsightsView({
  panelOpen,
  refreshIntervalSeconds,
  displayMode,
  onDisplayModeChange,
}: {
  panelOpen: boolean;
  refreshIntervalSeconds: number;
  displayMode: DisplayMode;
  onDisplayModeChange(value: DisplayMode): void;
}) {
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
          <h1 id="insights-title">Insights</h1>
        </div>
        <div className="view-actions">
          <DisplayModeSwitcher value={displayMode} onChange={onDisplayModeChange} />
          <button
            type="button"
            className="icon-button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            aria-label="Refresh insights"
            title="Refresh insights"
          >
            <span
              className={query.isFetching ? "refresh-icon spinning" : "refresh-icon"}
            >
              ↻
            </span>
          </button>
        </div>
      </div>

      {query.error ? (
        <div className="inline-alert" role="status">
          Refresh failed. Showing data from {formatAge(snapshot.fetchedAt)}.
        </div>
      ) : null}

      {displayMode === "graphs" && panelOpen ? (
        <InsightsGraphs
          markets={snapshot.markets}
          supplied={snapshot.totalSuppliedUsd}
          borrowed={snapshot.totalBorrowedUsd}
          available={snapshot.availableLiquidityUsd}
        />
      ) : (
        <InsightsNumbers
          markets={snapshot.markets}
          supplied={snapshot.totalSuppliedUsd}
          borrowed={snapshot.totalBorrowedUsd}
          available={snapshot.availableLiquidityUsd}
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

function InsightsGraphs({
  markets,
  supplied,
  borrowed,
  available,
}: {
  markets: NormalizedMarket[];
  supplied: ScaledAmount | undefined;
  borrowed: ScaledAmount | undefined;
  available: ScaledAmount | undefined;
}) {
  return (
    <div className="insights-graphs">
      <ProtocolTotals supplied={supplied} borrowed={borrowed} available={available} />
      <MarketCompositionChart markets={markets} />
      <MarketValueChart markets={markets} />
    </div>
  );
}

function InsightsNumbers({
  markets,
  supplied,
  borrowed,
  available,
}: {
  markets: NormalizedMarket[];
  supplied: ScaledAmount | undefined;
  borrowed: ScaledAmount | undefined;
  available: ScaledAmount | undefined;
}) {
  return (
    <div className="insights-numbers">
      <ProtocolTotals supplied={supplied} borrowed={borrowed} available={available} />
      <div className="list-heading">
        <span>{markets.length} pools</span>
        <span>USD snapshot</span>
      </div>
      <section className="market-list" aria-label="Pool totals">
        {markets.map((market) => (
          <div className="insight-number-row" key={market.id}>
            <AssetIcon symbol={market.symbol} />
            <span className="market-identity">
              <strong>{market.symbol}</strong>
              <small>{market.chain}</small>
            </span>
            <NumberValue label="Supplied" value={market.totalSuppliedUsd} />
            <NumberValue label="Borrowed" value={market.totalBorrowedUsd} />
          </div>
        ))}
      </section>
    </div>
  );
}

function ProtocolTotals({
  supplied,
  borrowed,
  available,
}: {
  supplied: ScaledAmount | undefined;
  borrowed: ScaledAmount | undefined;
  available: ScaledAmount | undefined;
}) {
  return (
    <section className="insight-totals" aria-label="Protocol totals">
      <InsightTotal label="Total supplied" value={formatCompactUsd(supplied)} />
      <InsightTotal label="Total borrowed" value={formatCompactUsd(borrowed)} />
      <InsightTotal label="Total available" value={formatCompactUsd(available)} />
    </section>
  );
}

function NumberValue({
  label,
  value,
}: {
  label: string;
  value: ScaledAmount | undefined;
}) {
  return (
    <span className="market-rate">
      <small>{label}</small>
      <strong>{formatCompactUsd(value)}</strong>
    </span>
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
