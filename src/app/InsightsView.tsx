import { useQuery } from "@tanstack/react-query";
import type {
  NormalizedMarket,
  ScaledAmount,
  ScaledRatio,
} from "../liquidium/sdk.types";
import { MarketValueChart } from "./DitherCharts";
import { formatAge, formatApr, formatPrice } from "./format";
import { fetchMarkets } from "./queries";

export function InsightsView({
  panelOpen,
  refreshIntervalSeconds,
}: {
  panelOpen: boolean;
  refreshIntervalSeconds: number;
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

      <MarketValueChart markets={snapshot.markets} />

      <div className="list-heading insights-list-heading">
        <span>All assets</span>
        <span>
          {query.isFetching
            ? "Refreshing…"
            : `Updated ${formatAge(snapshot.fetchedAt)}`}
        </span>
      </div>
      <div className="insight-market-list">
        {snapshot.markets.map((market) => (
          <InsightMarketRow key={market.id} market={market} />
        ))}
      </div>

      {!snapshot.pricesComplete ? (
        <p className="data-note">
          USD totals exclude assets without a current SDK price.
        </p>
      ) : null}
      <p className="insights-disclosure">
        Live snapshot only. RC.1 does not expose protocol history or period-over-period
        change.
      </p>
    </section>
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

function InsightMarketRow({ market }: { market: NormalizedMarket }) {
  return (
    <article className="insight-market-row">
      <div className="insight-market-header">
        <div className="insight-market-identity">
          <span className="asset-avatar" aria-hidden="true">
            {market.symbol.slice(0, 1)}
          </span>
          <span>
            <strong>{market.symbol}</strong>
            <small>{market.chain}</small>
          </span>
        </div>
        <span className="insight-market-deposits">
          <small>Deposits</small>
          <strong>{formatCompactUsd(market.totalSuppliedUsd)}</strong>
        </span>
      </div>
      <div className="insight-market-data">
        <InsightDatum label="Price" value={formatPrice(market.priceUsd)} />
        <InsightDatum label="Supply APR" value={formatApr(market.supplyApr)} />
        <InsightDatum label="Utilization" value={formatApr(market.utilization)} />
        <InsightDatum label="Optimal" value={formatApr(market.optimalUtilization)} />
      </div>
    </article>
  );
}

function InsightDatum({ label, value }: { label: string; value: string }) {
  return (
    <span className="insight-datum">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
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
