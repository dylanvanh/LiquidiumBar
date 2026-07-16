import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  RefreshCw,
  UserRoundPlus,
  WalletCards,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import type {
  LiquidiumAppError,
  NormalizedPortfolio,
  NormalizedPosition,
} from "../liquidium/sdk.types";
import { AssetIcon } from "./AssetIcon";
import { DisplayModeSwitcher } from "./DisplayModeSwitcher";
import { PortfolioCompositionChart } from "./DitherCharts";
import {
  formatAge,
  formatApr,
  formatBps,
  formatDateTime,
  formatPrice,
  formatPrivate,
  formatRatio,
  formatToken,
  formatUsd,
  truncateProfile,
} from "./format";
import { fetchPortfolio, resolveProfileInput } from "./queries";
import type { DisplayMode, ProfileRecord } from "./storage";

interface PortfolioViewProps {
  panelOpen: boolean;
  refreshIntervalSeconds: number;
  profiles: ProfileRecord[];
  selectedProfileId?: string;
  hideBalances: boolean;
  displayMode: DisplayMode;
  onAddProfile(profile: ProfileRecord): void;
  onSelectProfile(profileId: string): void;
  onRenameProfile(profileId: string, label: string): void;
  onRemoveProfile(profileId: string): void;
  onTogglePrivacy(): void;
  onDisplayModeChange(value: DisplayMode): void;
}

export function PortfolioView(props: PortfolioViewProps) {
  const profile =
    props.profiles.find((candidate) => candidate.id === props.selectedProfileId) ??
    props.profiles[0];

  if (!profile) {
    return (
      <ProfileOnboarding
        profileCount={props.profiles.length}
        onAdd={props.onAddProfile}
      />
    );
  }

  return <PortfolioMonitor {...props} profile={profile} />;
}

function ProfileOnboarding({
  profileCount,
  onAdd,
}: {
  profileCount: number;
  onAdd(profile: ProfileRecord): void;
}) {
  const [profileInput, setProfileInput] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string>();
  const [resolving, setResolving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setResolving(true);

    try {
      const profileId = await resolveProfileInput(profileInput);
      onAdd({
        id: profileId,
        label: label.trim() || `Profile ${profileCount + 1}`,
      });
    } catch (cause) {
      setError(profileInputError(cause));
    } finally {
      setResolving(false);
    }
  };

  return (
    <section className="onboarding view" aria-labelledby="profile-title">
      <div className="onboarding-icon" aria-hidden="true">
        <UserRoundPlus size={23} strokeWidth={1.7} />
      </div>
      <p className="eyebrow">Read-only monitoring</p>
      <h1 id="profile-title">Add a Liquidium profile</h1>
      <p className="onboarding-copy">
        Enter a profile principal or a linked wallet address. Wallet lookup is read-only
        and never requests a signature.
      </p>
      <form className="profile-form" onSubmit={submit} noValidate>
        <label htmlFor="profile-id">Profile principal or wallet address</label>
        <input
          id="profile-id"
          className="mono-input"
          value={profileInput}
          onChange={(event) => {
            setProfileInput(event.target.value);
            setError(undefined);
          }}
          placeholder="aaaaa-aa, 0x…, or bc1…"
          autoComplete="off"
          spellCheck={false}
          disabled={resolving}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "profile-error" : "profile-help"}
        />
        {error ? (
          <p id="profile-error" className="field-error" role="alert">
            {error}
          </p>
        ) : (
          <p id="profile-help" className="field-help">
            Supports Liquidium profile principals and linked Ethereum or Bitcoin
            addresses.
          </p>
        )}
        <label htmlFor="profile-label">
          Local label <span>Optional</span>
        </label>
        <input
          id="profile-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Main profile"
          maxLength={40}
          disabled={resolving}
        />
        <button
          type="submit"
          className="primary-button wide-button"
          disabled={resolving}
          aria-busy={resolving}
        >
          {resolving ? "Looking up profile…" : "Add profile"}
        </button>
      </form>
    </section>
  );
}

function profileInputError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as LiquidiumAppError).message === "string"
  ) {
    return (error as LiquidiumAppError).message;
  }

  return "Liquidium could not look up this profile. Try again.";
}

function PortfolioMonitor({
  profile,
  panelOpen,
  refreshIntervalSeconds,
  profiles,
  selectedProfileId,
  hideBalances,
  onAddProfile,
  onSelectProfile,
  onRenameProfile,
  onRemoveProfile,
  onTogglePrivacy,
  displayMode,
  onDisplayModeChange,
}: PortfolioViewProps & { profile: ProfileRecord }) {
  const [managing, setManaging] = useState<"add" | "rename">();
  const demoState = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get("demo")
    : null;
  const query = useQuery({
    queryKey: demoState
      ? ["portfolio", profile.id, demoState]
      : ["portfolio", profile.id],
    queryFn: () => fetchPortfolio(profile.id),
    enabled: panelOpen,
    refetchInterval: panelOpen ? refreshIntervalSeconds * 1_000 : false,
  });

  if (managing === "add") {
    return (
      <ProfileOnboarding
        profileCount={profiles.length}
        onAdd={(nextProfile) => {
          onAddProfile(nextProfile);
          setManaging(undefined);
        }}
      />
    );
  }

  return (
    <section className="view" aria-labelledby="portfolio-title">
      <div className="portfolio-toolbar">
        <label className="sr-only" htmlFor="profile-selector">
          Selected profile
        </label>
        <select
          id="profile-selector"
          value={selectedProfileId ?? profile.id}
          onChange={(event) => {
            setManaging(undefined);
            onSelectProfile(event.target.value);
          }}
          className="profile-selector"
        >
          {profiles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <ToolbarButton label="Add profile" onClick={() => setManaging("add")}>
          <Plus size={17} />
        </ToolbarButton>
        <ToolbarButton
          label="Copy profile principal"
          onClick={() => void navigator.clipboard.writeText(profile.id)}
        >
          <Copy size={16} />
        </ToolbarButton>
        <ToolbarButton
          label={hideBalances ? "Show balances" : "Hide balances"}
          onClick={onTogglePrivacy}
        >
          {hideBalances ? <Eye size={17} /> : <EyeOff size={17} />}
        </ToolbarButton>
        <ToolbarButton
          label="More profile actions"
          onClick={() => setManaging(managing === "rename" ? undefined : "rename")}
        >
          <MoreHorizontal size={18} />
        </ToolbarButton>
      </div>

      {managing === "rename" ? (
        <ProfileActions
          profile={profile}
          onRename={(label) => {
            onRenameProfile(profile.id, label);
            setManaging(undefined);
          }}
          onRemove={() => {
            onRemoveProfile(profile.id);
            setManaging(undefined);
          }}
        />
      ) : null}

      <div className="view-heading portfolio-heading">
        <div>
          <p className="eyebrow mono-text" title={profile.id}>
            {truncateProfile(profile.id)}
          </p>
          <h1 id="portfolio-title">{profile.label}</h1>
        </div>
        <div className="view-actions">
          <DisplayModeSwitcher value={displayMode} onChange={onDisplayModeChange} />
          <button
            type="button"
            className="icon-button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            aria-label="Refresh portfolio"
          >
            <RefreshCw
              aria-hidden="true"
              size={18}
              strokeWidth={1.8}
              className={query.isFetching ? "refresh-icon spinning" : "refresh-icon"}
            />
          </button>
        </div>
      </div>

      {!query.data && query.isPending ? <PortfolioSkeleton /> : null}
      {!query.data && query.isError ? (
        <PortfolioError error={query.error} onRetry={() => query.refetch()} />
      ) : null}
      {query.data ? (
        <PortfolioSnapshotView
          portfolio={query.data}
          hideBalances={hideBalances}
          refreshError={query.error}
          refreshing={query.isFetching}
          displayMode={displayMode}
          panelOpen={panelOpen}
        />
      ) : null}
    </section>
  );
}

function ProfileActions({
  profile,
  onRename,
  onRemove,
}: {
  profile: ProfileRecord;
  onRename(label: string): void;
  onRemove(): void;
}) {
  const [label, setLabel] = useState(profile.label);
  return (
    <div className="profile-actions">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = label.trim();
          if (next) onRename(next);
        }}
      >
        <label htmlFor="rename-profile">Profile label</label>
        <div className="inline-form">
          <input
            id="rename-profile"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={40}
          />
          <button type="submit">Save</button>
        </div>
      </form>
      <button type="button" className="danger-button" onClick={onRemove}>
        Remove profile
      </button>
    </div>
  );
}

function PortfolioSnapshotView({
  portfolio,
  hideBalances,
  refreshError,
  refreshing,
  displayMode,
  panelOpen,
}: {
  portfolio: NormalizedPortfolio;
  hideBalances: boolean;
  refreshError: Error | null;
  refreshing: boolean;
  displayMode: DisplayMode;
  panelOpen: boolean;
}) {
  if (portfolio.positions.length === 0) {
    return (
      <div className="empty-state">
        <WalletCards aria-hidden="true" size={24} strokeWidth={1.6} />
        <h2>No active positions</h2>
        <p>This valid principal has no reserves returned by Liquidium 0.5.1.</p>
        <small>Updated {formatAge(portfolio.fetchedAt)}</small>
      </div>
    );
  }

  return (
    <>
      {refreshError ? (
        <div className="inline-alert" role="status">
          Refresh failed. Showing data from {formatAge(portfolio.fetchedAt)}.
        </div>
      ) : null}
      <div className="risk-card">
        <div>
          <span>Net position</span>
          <strong>
            {formatPrivate(formatUsd(portfolio.netPositionUsd), hideBalances)}
          </strong>
        </div>
        <div className={`risk-pill ${portfolio.riskState}`}>
          {riskLabel(portfolio.riskState)}
        </div>
      </div>
      {displayMode === "graphs" && panelOpen ? (
        <PortfolioCompositionChart
          positions={portfolio.positions}
          hidden={hideBalances}
        />
      ) : (
        <section
          className="metric-grid portfolio-metrics"
          aria-label="Portfolio totals"
        >
          <Metric
            label="Supplied"
            value={formatPrivate(formatUsd(portfolio.totalSuppliedUsd), hideBalances)}
          />
          <Metric
            label="Borrowed"
            value={formatPrivate(formatUsd(portfolio.totalBorrowedUsd), hideBalances)}
          />
          <Metric
            label="Available to borrow"
            value={formatPrivate(
              formatUsd(portfolio.availableToBorrowUsd),
              hideBalances
            )}
          />
          <Metric
            label="Health factor"
            value={
              portfolio.healthFactorInfinite ? "∞" : formatRatio(portfolio.healthFactor)
            }
          />
          <Metric
            label="Weighted supply APR"
            value={formatApr(portfolio.weightedSupplyApr)}
          />
          <Metric
            label="Weighted borrow APR"
            value={formatApr(portfolio.weightedBorrowApr)}
          />
          <Metric
            label="Estimated net APR"
            value={formatApr(portfolio.estimatedNetApr)}
          />
          <Metric label="Current LTV" value={formatBps(portfolio.currentLtvBps)} />
        </section>
      )}
      <div className="list-heading">
        <span>{portfolio.positions.length} reserves</span>
        <span>
          {refreshing ? "Refreshing…" : `Updated ${formatAge(portfolio.fetchedAt)}`}
        </span>
      </div>
      <div className="market-list">
        {portfolio.positions.map((position) => (
          <PositionRow
            key={position.id}
            position={position}
            hideBalances={hideBalances}
          />
        ))}
      </div>
      <p className="data-note">
        APR is shown as reported. APY, compounding cadence, and per-position collateral
        flags are unavailable in SDK 0.5.1.
      </p>
    </>
  );
}

function PositionRow({
  position,
  hideBalances,
}: {
  position: NormalizedPosition;
  hideBalances: boolean;
}) {
  return (
    <details className="market-row position-row">
      <summary>
        <AssetIcon symbol={position.symbol} />
        <span className="market-identity">
          <strong>{position.symbol}</strong>
          <small>{position.chain}</small>
        </span>
        <Rate
          label="Supplied"
          value={formatPrivate(formatUsd(position.suppliedUsd), hideBalances)}
        />
        <Rate
          label="Borrowed"
          value={formatPrivate(formatUsd(position.borrowedUsd), hideBalances)}
        />
        <span className="disclosure" aria-hidden="true">
          <ChevronRight size={16} strokeWidth={1.8} />
        </span>
      </summary>
      <div className="market-details">
        <Detail
          label="Supplied"
          value={formatPrivate(
            formatToken(position.supplied, position.symbol),
            hideBalances
          )}
        />
        <Detail
          label="Borrowed"
          value={formatPrivate(
            formatToken(position.borrowed, position.symbol),
            hideBalances
          )}
        />
        <Detail
          label="Earned interest"
          value={formatPrivate(
            formatToken(position.earnedInterest, position.symbol),
            hideBalances
          )}
        />
        <Detail
          label="Debt interest"
          value={formatPrivate(
            formatToken(position.debtInterest, position.symbol),
            hideBalances
          )}
        />
        <Detail label="Supply APR" value={formatApr(position.supplyApr)} />
        <Detail label="Borrow APR" value={formatApr(position.borrowApr)} />
        <Detail label="Price" value={formatPrice(position.priceUsd)} />
        <Detail label="Updated" value={formatDateTime(position.lastUpdated)} />
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
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

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="toolbar-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PortfolioSkeleton() {
  return (
    <section
      className="portfolio-skeleton"
      aria-busy="true"
      aria-label="Loading portfolio"
    >
      <span />
      <span />
      <span />
    </section>
  );
}

function PortfolioError({ error, onRetry }: { error: Error; onRetry(): void }) {
  return (
    <div className="state-panel compact-state" role="alert">
      <span className="state-symbol" aria-hidden="true">
        !
      </span>
      <h2>Portfolio unavailable</h2>
      <p>{error.message || "Liquidium could not be reached."}</p>
      <button type="button" className="primary-button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function riskLabel(state: NormalizedPortfolio["riskState"]): string {
  if (state === "no-debt") return "No debt";
  if (state === "at-risk") return "At risk";
  if (state === "above-threshold") return "Healthy";
  return "Risk unavailable";
}
