import { useQuery } from "@tanstack/react-query";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import type {
  MarketSnapshot,
  NormalizedProtocolActivityEntry,
  ProtocolActivityOperation,
  ScaledAmount,
} from "../liquidium/sdk.types";
import { AssetIcon } from "./AssetIcon";
import { formatAge, formatScaled } from "./format";
import { fetchMarkets, fetchProtocolActivity } from "./queries";

const ACTIVITY_FILTERS: ReadonlyArray<{
  id: ProtocolActivityOperation | "all";
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "deposit", label: "Supply" },
  { id: "borrow", label: "Borrow" },
  { id: "repayment", label: "Repay" },
  { id: "withdrawal", label: "Withdraw" },
  { id: "liquidation", label: "Liquidation" },
];

const OPERATION_PRESENTATION: Record<
  ProtocolActivityOperation,
  { verb: string; tone: "supply" | "borrow" | "repay" | "withdraw" | "alert" }
> = {
  deposit: { verb: "Supplied", tone: "supply" },
  repayment: { verb: "Repaid", tone: "repay" },
  borrow: { verb: "Borrowed", tone: "borrow" },
  withdrawal: { verb: "Withdrawn", tone: "withdraw" },
  liquidation: { verb: "Liquidated", tone: "alert" },
};

const ICP_LEDGER_TRANSACTION_ID_PATTERN = /^\d+$/;
const EVM_TRANSACTION_ID_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const TXID_DISPLAY_PREFIX_LENGTH = 4;
const TXID_DISPLAY_SUFFIX_LENGTH = 4;

export function ActivityView({
  panelOpen,
  refreshIntervalSeconds,
}: {
  panelOpen: boolean;
  refreshIntervalSeconds: number;
}) {
  const [activeFilter, setActiveFilter] = useState<ProtocolActivityOperation | "all">(
    "all"
  );
  const query = useQuery({
    queryKey: ["protocol-activity"],
    queryFn: fetchProtocolActivity,
    enabled: panelOpen,
    refetchInterval: panelOpen ? refreshIntervalSeconds * 1_000 : false,
  });
  const marketsQuery = useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    enabled: panelOpen,
    refetchInterval: panelOpen ? refreshIntervalSeconds * 1_000 : false,
  });
  const snapshot = query.data;

  if (!snapshot && query.isPending) {
    return <ActivitySkeleton />;
  }

  if (!snapshot) {
    return (
      <section className="state-panel" role="alert">
        <span className="state-symbol" aria-hidden="true">
          !
        </span>
        <h1>Activity unavailable</h1>
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

  const chainByMarketId = buildChainLookup(marketsQuery.data);
  const entries =
    activeFilter === "all"
      ? snapshot.entries
      : snapshot.entries.filter((entry) => entry.operation === activeFilter);

  return (
    <section className="view activity-view" aria-labelledby="activity-title">
      <div className="view-heading insights-heading">
        <div>
          <h1 id="activity-title">Activity</h1>
        </div>
        <div className="view-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            aria-label="Refresh activity"
            title="Refresh activity"
          >
            <RefreshCw
              aria-hidden="true"
              size={14}
              strokeWidth={1.8}
              className={query.isFetching ? "refresh-icon spinning" : "refresh-icon"}
            />
          </button>
        </div>
      </div>

      {query.error ? (
        <div className="inline-alert" role="status">
          Refresh failed. Showing data from {formatAge(snapshot.fetchedAt)}.
        </div>
      ) : null}

      <fieldset className="activity-filters" aria-label="Filter activity">
        {ACTIVITY_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={
              activeFilter === id ? "activity-filter active" : "activity-filter"
            }
            aria-pressed={activeFilter === id}
            onClick={() => setActiveFilter(id)}
          >
            {label}
          </button>
        ))}
      </fieldset>

      {entries.length === 0 ? (
        <p className="data-note">No recent protocol activity for this filter.</p>
      ) : (
        <section className="market-list" aria-label="Recent protocol activity">
          {entries.map((entry) => (
            <ActivityRow
              key={entry.id}
              entry={entry}
              chain={chainByMarketId.get(entry.marketId)}
            />
          ))}
        </section>
      )}

      <p className="data-note">Live feed · Updated {formatAge(snapshot.fetchedAt)}.</p>
    </section>
  );
}

function ActivityRow({
  entry,
  chain,
}: {
  entry: NormalizedProtocolActivityEntry;
  chain: string | undefined;
}) {
  const presentation = OPERATION_PRESENTATION[entry.operation];
  const txid = entry.txids[0];

  return (
    <div className="activity-row">
      <span
        className={`activity-icon activity-icon-${presentation.tone}`}
        aria-hidden="true"
      >
        {presentation.tone === "alert" ? (
          <ShieldAlert size={13} strokeWidth={1.8} />
        ) : presentation.tone === "supply" || presentation.tone === "repay" ? (
          <ArrowDownLeft size={13} strokeWidth={1.8} />
        ) : (
          <ArrowUpRight size={13} strokeWidth={1.8} />
        )}
      </span>
      <span className="activity-summary">
        <strong>
          {presentation.verb} {formatActivityAmount(entry.amount)} {entry.symbol}
        </strong>
        <small>{formatAge(entry.timestamp)}</small>
      </span>
      {txid ? (
        <button
          type="button"
          className="activity-txid"
          title={txid}
          onClick={() => openExplorer(transactionExplorerUrl(txid, chain))}
        >
          {truncateTxid(txid)}
          <ExternalLink aria-hidden="true" size={11} />
        </button>
      ) : (
        <span className="activity-txid-placeholder" aria-hidden="true" />
      )}
      <AssetIcon symbol={entry.symbol} />
    </div>
  );
}

function buildChainLookup(snapshot: MarketSnapshot | undefined): Map<string, string> {
  return new Map((snapshot?.markets ?? []).map((market) => [market.id, market.chain]));
}

function transactionExplorerUrl(txid: string, chain: string | undefined): string {
  if (ICP_LEDGER_TRANSACTION_ID_PATTERN.test(txid) || chain === "ICP") {
    return `https://dashboard.internetcomputer.org/transaction/${txid}`;
  }
  if (chain === "ETH" || EVM_TRANSACTION_ID_PATTERN.test(txid)) {
    return `https://etherscan.io/tx/${txid}`;
  }
  return `https://mempool.space/tx/${txid}`;
}

function openExplorer(url: string) {
  if (isTauri()) void openUrl(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

function truncateTxid(txid: string): string {
  const maxLength = TXID_DISPLAY_PREFIX_LENGTH + TXID_DISPLAY_SUFFIX_LENGTH + 1;
  if (txid.length <= maxLength) return txid;
  return `${txid.slice(0, TXID_DISPLAY_PREFIX_LENGTH)}…${txid.slice(
    -TXID_DISPLAY_SUFFIX_LENGTH
  )}`;
}

function formatActivityAmount(amount: ScaledAmount): string {
  return formatScaled(amount, 4).replace(/\.?0+$/, "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Liquidium could not be reached.";
}

function ActivitySkeleton() {
  return (
    <section className="view" aria-busy="true" aria-label="Loading activity">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-chart" />
    </section>
  );
}
