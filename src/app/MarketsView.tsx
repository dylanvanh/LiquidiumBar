import { useQuery } from "@tanstack/react-query";
import type { NormalizedMarket, ScaledAmount } from "../liquidium/sdk.types";
import {
  formatAge,
  formatApr,
  formatDateTime,
  formatPrice,
  formatToken,
  formatUsd,
} from "./format";
import { fetchMarkets } from "./queries";

export function MarketsView({
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
    return <MarketsSkeleton />;
  }

  if (!snapshot) {
    return (
      <section className="state-panel" role="alert">
        <span className="state-symbol" aria-hidden="true">
          !
        </span>
        <h1>Markets unavailable</h1>
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
    <section className="view" aria-labelledby="markets-title">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Liquidium protocol</p>
          <h1 id="markets-title">Markets</h1>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          aria-label="Refresh markets"
          title="Refresh markets"
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

      <section className="metric-grid" aria-label="Protocol totals">
        <Metric label="Supplied" value={formatUsd(snapshot.totalSuppliedUsd)} />
        <Metric label="Borrowed" value={formatUsd(snapshot.totalBorrowedUsd)} />
        <Metric label="Available" value={formatUsd(snapshot.availableLiquidityUsd)} />
        <Metric label="Utilization" value={formatApr(snapshot.aggregateUtilization)} />
      </section>

      <div className="list-heading">
        <span>{snapshot.markets.length} pools</span>
        <span>
          {query.isFetching
            ? "Refreshing…"
            : `Updated ${formatAge(snapshot.fetchedAt)}`}
        </span>
      </div>

      <div className="market-list">
        {snapshot.markets.map((market) => (
          <MarketRow key={market.id} market={market} />
        ))}
      </div>

      {!snapshot.pricesComplete ? (
        <p className="data-note">Totals exclude pools without a current USD price.</p>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MarketRow({ market }: { market: NormalizedMarket }) {
  return (
    <details className="market-row">
      <summary>
        <span className="asset-avatar" aria-hidden="true">
          {market.symbol.slice(0, 1)}
        </span>
        <span className="market-identity">
          <strong>{market.symbol}</strong>
          <small>{market.chain}</small>
        </span>
        <Rate label="Supply" value={formatApr(market.supplyApr)} />
        <Rate label="Borrow" value={formatApr(market.borrowApr)} />
        <span className="disclosure" aria-hidden="true">
          ›
        </span>
      </summary>
      <div className="market-details">
        <DetailGroup label="Liquidity">
          <Detail label="Supplied" value={formatUsd(market.totalSuppliedUsd)} />
          <Detail label="Borrowed" value={formatUsd(market.totalBorrowedUsd)} />
          <Detail label="Available" value={formatUsd(market.availableLiquidityUsd)} />
          <Detail label="Utilization" value={formatApr(market.utilization)} />
          <Detail label="Price" value={formatPrice(market.priceUsd)} />
        </DetailGroup>
        <DetailGroup label="Rates & curve">
          <Detail label="Base APR" value={formatApr(market.baseRate)} />
          <Detail label="Supply APR" value={formatApr(market.supplyApr)} />
          <Detail label="Borrow APR" value={formatApr(market.borrowApr)} />
          <Detail
            label="Optimal utilization"
            value={formatApr(market.optimalUtilization)}
          />
          <Detail label="Slope before" value={formatApr(market.rateSlopeBefore)} />
          <Detail label="Slope after" value={formatApr(market.rateSlopeAfter)} />
          <Detail label="Reserve factor" value={formatApr(market.reserveFactor)} />
        </DetailGroup>
        <DetailGroup label="Risk & limits">
          <Detail label="Maximum LTV" value={formatApr(market.maxLtv)} />
          <Detail
            label="Liquidation threshold"
            value={formatApr(market.liquidationThreshold)}
          />
          <Detail
            label="Liquidation bonus"
            value={formatApr(market.liquidationBonus)}
          />
          <Detail
            label="Protocol liquidation fee"
            value={formatApr(market.protocolLiquidationFee)}
          />
          <Detail
            label="Supply cap"
            value={formatOptionalToken(market.supplyCap, market.symbol)}
          />
          <Detail
            label="Borrow cap"
            value={formatOptionalToken(market.borrowCap, market.symbol)}
          />
        </DetailGroup>
        <DetailGroup label="Pool status">
          <Detail label="State" value={market.frozen ? "Frozen" : "Active"} />
          <Detail
            label="Same-asset borrowing"
            value={market.sameAssetBorrowing ? "Enabled" : "Disabled"}
          />
          <Detail
            label="Same-asset dust"
            value={formatToken(market.sameAssetBorrowingDustThreshold, market.symbol)}
          />
          <Detail label="Pool timestamp" value={formatDateTime(market.lastUpdated)} />
        </DetailGroup>
      </div>
    </details>
  );
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <span className="market-rate">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function DetailGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="detail-group">
      <h2>{label}</h2>
      <dl>{children}</dl>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatOptionalToken(value: ScaledAmount | undefined, symbol: string) {
  return value ? formatToken(value, symbol) : "No cap reported";
}

function MarketsSkeleton() {
  return (
    <section className="view" aria-busy="true" aria-label="Loading markets">
      <div className="view-heading">
        <div>
          <p className="eyebrow">Liquidium protocol</p>
          <h1>Markets</h1>
        </div>
      </div>
      <div className="metric-grid skeleton-grid">
        {["supplied", "borrowed", "available", "utilization"].map((key) => (
          <span key={key} className="skeleton-block" />
        ))}
      </div>
      <div className="market-list skeleton-list">
        {["one", "two", "three", "four"].map((key) => (
          <span key={key} className="skeleton-row" />
        ))}
      </div>
    </section>
  );
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return "Liquidium could not be reached. Check your connection and try again.";
}
