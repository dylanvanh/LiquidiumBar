import type { ScaledAmount, ScaledRatio } from "../liquidium/sdk.types";

const DASH = "—";

export function formatScaled(
  scaled: ScaledAmount | ScaledRatio | undefined,
  fractionDigits = 2
): string {
  if (!scaled) return DASH;
  const negative = scaled.value < 0n;
  const absolute = negative ? -scaled.value : scaled.value;
  const scale = 10n ** BigInt(scaled.decimals);
  const requestedPrecision = Math.max(0, fractionDigits);
  const displayScale = 10n ** BigInt(requestedPrecision);
  const rounded = (absolute * displayScale + scale / 2n) / scale;
  const whole = rounded / displayScale;
  const fraction = rounded % displayScale;
  const grouped = groupDigits(whole.toString());
  const decimals = requestedPrecision
    ? `.${fraction.toString().padStart(requestedPrecision, "0")}`
    : "";
  return `${negative ? "−" : ""}${grouped}${decimals}`;
}

export function formatUsd(value: ScaledAmount | undefined): string {
  return value ? `$${formatScaled(value, 2)}` : DASH;
}

export function formatPrivate(value: string, hidden: boolean): string {
  return hidden && value !== DASH ? "••••••" : value;
}

export function formatApr(value: ScaledRatio | undefined): string {
  if (!value) return DASH;
  return `${formatScaled({ value: value.value * 100n, decimals: value.decimals }, 2)}%`;
}

export function formatToken(value: ScaledAmount | undefined, symbol: string): string {
  return value ? `${formatScaled(value, 4)} ${symbol}` : DASH;
}

export function formatPrice(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return DASH;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatRatio(value: ScaledRatio | undefined): string {
  return value ? formatScaled(value, 2) : DASH;
}

export function formatBps(value: bigint | undefined): string {
  if (value === undefined) return DASH;
  return `${formatScaled({ value, decimals: 2 }, 2)}%`;
}

export function truncateProfile(value: string): string {
  return value.length > 17 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export function formatAge(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1_000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function groupDigits(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
