import { EyeOff } from "lucide-react";
import type { ReactNode } from "react";
import { Bar } from "../components/dither-kit/bar";
import { BarChart } from "../components/dither-kit/bar-chart";
import type { ChartConfig } from "../components/dither-kit/chart-context";
import { Grid } from "../components/dither-kit/grid";
import { Legend } from "../components/dither-kit/legend";
import { Pie } from "../components/dither-kit/pie";
import { PieChart } from "../components/dither-kit/pie-chart";
import { Tooltip } from "../components/dither-kit/tooltip";
import { XAxis } from "../components/dither-kit/x-axis";
import { YAxis } from "../components/dither-kit/y-axis";
import type {
  NormalizedMarket,
  NormalizedPosition,
  ScaledAmount,
} from "../liquidium/sdk.types";

const valueConfig = {
  supplied: { label: "Supplied", color: "green" },
  borrowed: { label: "Borrowed", color: "blue" },
} satisfies ChartConfig;

const compositionColors = {
  BTC: "orange",
  ICP: "blue",
  USDT: "purple",
  USDC: "green",
} as const;
const fallbackColors = ["pink", "red", "grey"] as const;
const preferredCompositionOrder = ["BTC", "ICP", "USDT", "USDC"];

interface ValueDatum {
  label: string;
  supplied: number;
  borrowed: number;
}

interface CompositionDatum {
  asset: string;
  suppliedUsd: number;
}

export function MarketValueChart({
  markets,
  action,
}: {
  markets: NormalizedMarket[];
  action?: ReactNode;
}) {
  const data = markets.map((market) => ({
    label: market.symbol,
    supplied: chartAmount(market.totalSuppliedUsd),
    borrowed: chartAmount(market.totalBorrowedUsd),
  }));

  return (
    <ValueChart
      eyebrow="Capital by market"
      title="Supplied vs borrowed"
      note="USD snapshot"
      data={data}
      accessibleSummary={`${markets.length} Liquidium pools compared by supplied and borrowed USD value.`}
      action={action}
    />
  );
}

export function MarketCompositionChart({ markets }: { markets: NormalizedMarket[] }) {
  const data = markets.map((market) => ({
    asset: market.symbol,
    suppliedUsd: chartAmount(market.totalSuppliedUsd),
  }));

  return (
    <CompositionChart
      data={data}
      eyebrow="Market composition"
      title="Share of deposits"
      ariaLabel="Market composition"
      accessibleSummary={`Share of supplied USD value across ${markets.length} Liquidium markets.`}
    />
  );
}

export function PortfolioCompositionChart({
  positions,
  hidden,
}: {
  positions: NormalizedPosition[];
  hidden: boolean;
}) {
  if (hidden) {
    return (
      <section className="chart-card private-chart" aria-label="Portfolio graph hidden">
        <EyeOff aria-hidden="true" size={24} strokeWidth={1.6} />
        <strong>Graph hidden</strong>
        <small>Turn off privacy mode to view supplied-position composition.</small>
      </section>
    );
  }

  const data = positions.map((position) => ({
    asset: position.symbol,
    suppliedUsd: chartAmount(position.suppliedUsd),
  }));

  return (
    <CompositionChart
      data={data}
      eyebrow="Portfolio composition"
      title="Share of supplied positions"
      ariaLabel="Portfolio composition"
      accessibleSummary={`Share of supplied USD value across ${data.length} portfolio reserves.`}
    />
  );
}

function CompositionChart({
  data,
  eyebrow,
  title,
  ariaLabel,
  accessibleSummary,
}: {
  data: CompositionDatum[];
  eyebrow: string;
  title: string;
  ariaLabel: string;
  accessibleSummary: string;
}) {
  const visibleData = data
    .filter(({ suppliedUsd }) => suppliedUsd > 0)
    .sort((a, b) => compositionRank(a.asset) - compositionRank(b.asset));
  const config = Object.fromEntries(
    visibleData.map(({ asset }, index) => [
      asset,
      {
        label: asset,
        color:
          compositionColors[asset as keyof typeof compositionColors] ??
          fallbackColors[index % fallbackColors.length],
      },
    ])
  ) satisfies ChartConfig;
  const total = visibleData.reduce((sum, item) => sum + item.suppliedUsd, 0);

  return (
    <section className="chart-card composition-card" aria-label={ariaLabel}>
      <div className="chart-card-heading">
        <div>
          <span className="chart-eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
        </div>
        <small>USD snapshot</small>
      </div>
      <p className="sr-only">{accessibleSummary}</p>
      <div className="dither-chart-frame composition-chart-frame">
        <PieChart
          data={visibleData}
          config={config}
          dataKey="suppliedUsd"
          nameKey="asset"
          innerRadius={0.58}
          margins={{ top: 34 }}
          bloom="low"
          bloomOnHover
        >
          <Legend isClickable align="center" />
          <Tooltip valueFormatter={formatTooltipUsd} variant="frosted-glass" />
          <Pie variant="gradient" />
        </PieChart>
        <div className="composition-chart-total" aria-hidden="true">
          <strong>{formatCompactUsd(total)}</strong>
          <span>supplied</span>
        </div>
      </div>
    </section>
  );
}

function ValueChart({
  eyebrow,
  title,
  note,
  data,
  accessibleSummary,
  action,
}: {
  eyebrow: string;
  title: string;
  note: string;
  data: ValueDatum[];
  accessibleSummary: string;
  action?: ReactNode;
}) {
  return (
    <section className="chart-card" aria-label={title}>
      <div className="chart-card-heading">
        <div>
          <span className="chart-eyebrow">{eyebrow}</span>
          <strong>{title}</strong>
        </div>
        {action ?? <small>{note}</small>}
      </div>
      <p className="sr-only">{accessibleSummary}</p>
      <div className="dither-chart-frame">
        <BarChart
          data={data}
          config={valueConfig}
          margins={{ top: 34, right: 12, bottom: 28, left: 58 }}
          animationDuration={650}
          bloom="low"
          bloomOnHover
        >
          <Grid />
          <XAxis dataKey="label" />
          <YAxis tickFormatter={formatCompactUsd} />
          <Legend isClickable />
          <Tooltip
            labelKey="label"
            valueFormatter={formatTooltipUsd}
            variant="frosted-glass"
          />
          <Bar dataKey="supplied" variant="gradient" isClickable />
          <Bar dataKey="borrowed" variant="hatched" isClickable />
        </BarChart>
      </div>
    </section>
  );
}

function compositionRank(symbol: string): number {
  const rank = preferredCompositionOrder.indexOf(symbol);
  return rank === -1 ? preferredCompositionOrder.length : rank;
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
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTooltipUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
