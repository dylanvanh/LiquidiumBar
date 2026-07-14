import { LiquidiumError, LiquidiumErrorCode } from "@liquidium/client";
import {
  formatApr,
  formatBps,
  formatPrivate,
  formatScaled,
  formatUsd,
} from "../app/format";
import {
  deserializeWithBigInt,
  isSnapshotStale,
  serializeWithBigInt,
} from "../app/storage";
import { mapLiquidiumError } from "./errors";
import { validateProfileId } from "./profile";

describe("application contracts", () => {
  it("formats atomic, USD, APR, and basis-point values", () => {
    expect(formatScaled({ value: 123_456_789n, decimals: 8 }, 4)).toBe("1.2346");
    expect(formatUsd({ value: 12_345_000_000_000n, decimals: 12 })).toBe("$12.35");
    expect(
      formatApr({ value: 50_000_000_000_000_000_000_000_000n, decimals: 27 })
    ).toBe("5.00%");
    expect(formatBps(7_400n)).toBe("74.00%");
  });

  it("masks balances without masking unavailable fields", () => {
    expect(formatPrivate("$12.35", true)).toBe("••••••");
    expect(formatPrivate("—", true)).toBe("—");
    expect(formatPrivate("$12.35", false)).toBe("$12.35");
  });

  it("round-trips tagged bigint persistence", () => {
    const input = { amount: 123_456_789_012_345_678_901n, nested: [0n, -2n] };
    expect(deserializeWithBigInt(serializeWithBigInt(input))).toEqual(input);
  });

  it("detects stale and invalid snapshot timestamps", () => {
    const now = Date.parse("2026-07-14T12:00:31.000Z");
    expect(isSnapshotStale("2026-07-14T12:00:00.000Z", 30_000, now)).toBe(true);
    expect(isSnapshotStale("2026-07-14T12:00:02.000Z", 30_000, now)).toBe(false);
    expect(isSnapshotStale("not-a-date", 30_000, now)).toBe(true);
  });

  it("validates and canonicalizes ICP principals", () => {
    expect(validateProfileId("  aaaaa-aa ")).toEqual({
      ok: true,
      profileId: "aaaaa-aa",
    });
    expect(validateProfileId("not a principal")).toMatchObject({
      ok: false,
      error: { type: "invalid-profile" },
    });
  });

  it("maps SDK transport errors separately from protocol errors", () => {
    expect(
      mapLiquidiumError(new LiquidiumError(LiquidiumErrorCode.REQUEST_TIMEOUT))
    ).toMatchObject({ type: "network" });
    expect(
      mapLiquidiumError(new LiquidiumError(LiquidiumErrorCode.POOL_NOT_FOUND))
    ).toMatchObject({ type: "sdk" });
    expect(mapLiquidiumError(new Error("Invalid principal text"))).toMatchObject({
      type: "invalid-profile",
    });
  });
});
