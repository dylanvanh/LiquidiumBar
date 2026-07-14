import {
  applyRatio,
  atomicToUsd,
  divideAmounts,
  rescaleBigInt,
  subtractAmounts,
  sumAmounts,
} from "./math";

describe("scaled financial math", () => {
  it("rescales atomic values without converting them to numbers", () => {
    expect(rescaleBigInt(123_456_789n, 8, 12)).toBe(1_234_567_890_000n);
    expect(rescaleBigInt(1_234_567_890_000n, 12, 8)).toBe(123_456_789n);
  });

  it("converts atomic amounts to scaled USD at the boundary", () => {
    expect(atomicToUsd({ value: 150_000_000n, decimals: 8 }, 100)).toEqual({
      value: 150_000_000_000_000n,
      decimals: 12,
    });
    expect(atomicToUsd({ value: 1n, decimals: 8 }, Number.NaN)).toBeUndefined();
  });

  it("derives utilization, weighted amounts, and net amounts", () => {
    const supplied = { value: 200_000_000_000_000n, decimals: 12 };
    const borrowed = { value: 50_000_000_000_000n, decimals: 12 };
    expect(divideAmounts(borrowed, supplied)).toEqual({
      value: 250_000_000_000n,
      decimals: 12,
    });
    expect(
      applyRatio(supplied, { value: 50_000_000_000_000_000_000_000_000n, decimals: 27 })
    ).toEqual({
      value: 10_000_000_000_000n,
      decimals: 12,
    });
    expect(subtractAmounts(supplied, borrowed).value).toBe(150_000_000_000_000n);
    expect(sumAmounts([supplied, borrowed]).value).toBe(250_000_000_000_000n);
  });

  it("does not derive a ratio when its denominator is missing", () => {
    expect(
      divideAmounts({ value: 1n, decimals: 12 }, { value: 0n, decimals: 12 })
    ).toBeUndefined();
  });
});
