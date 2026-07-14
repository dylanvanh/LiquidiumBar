import { Bar } from "../components/dither-kit/bar";
import { BarChart } from "../components/dither-kit/bar-chart";
import type { ChartConfig } from "../components/dither-kit/chart-context";
import { Grid } from "../components/dither-kit/grid";
import { Tooltip } from "../components/dither-kit/tooltip";
import { XAxis } from "../components/dither-kit/x-axis";
import { YAxis } from "../components/dither-kit/y-axis";
import type {
  NormalizedMarket,
  NormalizedPosition,
  ScaledAmount,
} from "../liquidium/sdk.types";

const valueConfig = {
  supplied: { label: "Supplied", color: "blue" },
  borrowed: { label: "Borrowed", color: "orange" },
} satisfies ChartConfig;

interface ValueDatum {
  label: string;
  supplied: number;
  borrowed: number;
}

export function MarketValueChart({ markets }: { markets: NormalizedMarket[] }) {
  const data = markets.map((market) => ({
    label: market.symbol,
    supplied: chartAmount(market.totalSuppliedUsd),
    borrowed: chartAmount(market.totalBorrowedUsd),
  }));

  return (
    <ValueChart
      title="Liquidity by pool"
      note="USD · scrub for exact values"
      data={data}
      accessibleSummary={`${markets.length} Liquidium pools compared by supplied and borrowed USD value.`}
    />
  );
}

export function PortfolioValueChart({
  positions,
  hidden,
}: {
  positions: NormalizedPosition[];
  hidden: boolean;
}) {
  if (hidden) {
    return (
      <section className="chart-card private-chart" aria-label="Portfolio graph hidden">
        <span aria-hidden="true">◌</span>
        <strong>Graph hidden</strong>
        <small>Turn off privacy mode to compare position values.</small>
      </section>
    );
  }

  const data = positions.map((position) => ({
    label: position.symbol,
    supplied: chartAmount(position.suppliedUsd),
    borrowed: chartAmount(position.borrowedUsd),
  }));

  return (
    <ValueChart
      title="Position value"
      note="USD by reserve · scrub for exact values"
      data={data}
      accessibleSummary={`${positions.length} reserves compared by supplied and borrowed USD value.`}
    />
  );
}

function ValueChart({
  title,
  note,
  data,
  accessibleSummary,
}: {
  title: string;
  note: string;
  data: ValueDatum[];
  accessibleSummary: string;
}) {
  return (
    <section className="chart-card" aria-label={title}>
      <div className="chart-card-heading">
        <div>
          <strong>{title}</strong>
          <small>{note}</small>
        </div>
        <div className="chart-key" aria-hidden="true">
          <span className="supplied">Supplied</span>
          <span className="borrowed">Borrowed</span>
        </div>
      </div>
      <p className="sr-only">{accessibleSummary}</p>
      <div className="dither-chart-frame">
        <BarChart
          data={data}
          config={valueConfig}
          margins={{ top: 8, right: 5, bottom: 23, left: 43 }}
          animationDuration={650}
          bloom="off"
        >
          <Grid />
          <XAxis dataKey="label" maxTicks={5} />
          <YAxis tickCount={3} tickFormatter={formatCompactUsd} />
          <Bar dataKey="supplied" variant="dotted" />
          <Bar dataKey="borrowed" variant="hatched" />
          <Tooltip labelKey="label" valueFormatter={formatTooltipUsd} />
        </BarChart>
      </div>
    </section>
  );
}

function chartAmount(value: ScaledAmount | undefined): number {
  if (!value) return 0;
  const result = Number(value.value) / 10 ** value.decimals;
  return Number.isFinite(result) ? result : 0;
}

function formatCompactUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatTooltipUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
