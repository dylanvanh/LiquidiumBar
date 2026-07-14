import type { ScaledAmount, ScaledRatio } from "./sdk.types";

export const USD_DECIMALS = 12;
export const CALCULATED_RATIO_DECIMALS = 12;

export function toSafeDecimals(value: bigint, label: string): number {
  const decimals = Number(value);
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error(`${label} decimals are outside the supported range`);
  }
  return decimals;
}

export function rescaleBigInt(
  value: bigint,
  fromDecimals: number,
  toDecimals: number
): bigint {
  if (fromDecimals === toDecimals) {
    return value;
  }

  if (fromDecimals < toDecimals) {
    return value * 10n ** BigInt(toDecimals - fromDecimals);
  }

  return value / 10n ** BigInt(fromDecimals - toDecimals);
}

export function atomicToUsd(
  amount: ScaledAmount,
  priceUsd: number
): ScaledAmount | undefined {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    return undefined;
  }

  const priceScale = 10n ** BigInt(USD_DECIMALS);
  const priceScaled = BigInt(Math.round(priceUsd * Number(priceScale)));
  const value = (amount.value * priceScaled) / 10n ** BigInt(amount.decimals);

  return { value, decimals: USD_DECIMALS };
}

export function sumAmounts(
  values: readonly ScaledAmount[],
  decimals = USD_DECIMALS
): ScaledAmount {
  return {
    value: values.reduce(
      (sum, value) => sum + rescaleBigInt(value.value, value.decimals, decimals),
      0n
    ),
    decimals,
  };
}

export function divideAmounts(
  numerator: ScaledAmount,
  denominator: ScaledAmount,
  decimals = CALCULATED_RATIO_DECIMALS
): ScaledRatio | undefined {
  const numeratorValue = rescaleBigInt(
    numerator.value,
    numerator.decimals,
    USD_DECIMALS
  );
  const denominatorValue = rescaleBigInt(
    denominator.value,
    denominator.decimals,
    USD_DECIMALS
  );

  if (denominatorValue <= 0n) {
    return undefined;
  }

  return {
    value: (numeratorValue * 10n ** BigInt(decimals)) / denominatorValue,
    decimals,
  };
}

export function applyRatio(amount: ScaledAmount, ratio: ScaledRatio): ScaledAmount {
  return {
    value: (amount.value * ratio.value) / 10n ** BigInt(ratio.decimals),
    decimals: amount.decimals,
  };
}

export function subtractAmounts(
  left: ScaledAmount,
  right: ScaledAmount,
  decimals = USD_DECIMALS
): ScaledAmount {
  return {
    value:
      rescaleBigInt(left.value, left.decimals, decimals) -
      rescaleBigInt(right.value, right.decimals, decimals),
    decimals,
  };
}
