import { LiquidiumError, LiquidiumErrorCode } from "@liquidium/client";
import {
  formatApr,
  formatBps,
  formatPrivate,
  formatScaled,
  formatUsd,
} from "../app/format";
import {
  DEFAULT_SETTINGS,
  deserializeWithBigInt,
  isSnapshotStale,
  loadSettings,
  serializeWithBigInt,
} from "../app/storage";
import { formatTrayValue, selectMenuBarAmount } from "../app/useTrayMarketTotal";
import { marketSnapshotFixture } from "../test/fixtures";
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
    expect(formatTrayValue({ value: 803_067_600_000n, decimals: 6 })).toBe("$803.1K");
    expect(formatTrayValue(undefined)).toBe("—");
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

  it("defaults Insights to numbers and Portfolio to graphs", async () => {
    expect(DEFAULT_SETTINGS.section).toBe("insights");
    expect(DEFAULT_SETTINGS.insightsDisplayMode).toBe("numbers");
    expect(DEFAULT_SETTINGS.portfolioDisplayMode).toBe("graphs");
    expect(DEFAULT_SETTINGS.menuBarMetric).toBe("none");
    expect(DEFAULT_SETTINGS.refreshIntervalSeconds).toBe(300);
    window.localStorage.setItem(
      "settings",
      serializeWithBigInt({
        version: 1,
        section: "markets",
        profiles: [],
        hideBalances: false,
        refreshIntervalSeconds: 60,
      })
    );
    expect(await loadSettings()).toMatchObject({
      section: "insights",
      insightsDisplayMode: "numbers",
      portfolioDisplayMode: "graphs",
      menuBarMetric: "none",
    });
  });

  it("migrates the former 30-second refresh interval to the one-minute minimum", async () => {
    window.localStorage.setItem(
      "settings",
      serializeWithBigInt({
        ...DEFAULT_SETTINGS,
        refreshIntervalSeconds: 30,
      })
    );
    expect((await loadSettings()).refreshIntervalSeconds).toBe(60);
  });

  it("migrates the former menu-bar total default to no value", async () => {
    window.localStorage.setItem(
      "settings",
      serializeWithBigInt({
        ...DEFAULT_SETTINGS,
        version: 1,
        menuBarMetric: "borrowed",
      })
    );
    expect(await loadSettings()).toMatchObject({
      version: 2,
      menuBarMetric: "none",
    });
  });

  it("migrates the former shared preference only to Portfolio", async () => {
    window.localStorage.setItem(
      "settings",
      serializeWithBigInt({
        version: 1,
        section: "insights",
        profiles: [],
        hideBalances: false,
        displayMode: "graphs",
        refreshIntervalSeconds: 60,
      })
    );
    expect(await loadSettings()).toMatchObject({
      insightsDisplayMode: "numbers",
      portfolioDisplayMode: "graphs",
    });
  });

  it("selects the configured menu-bar market total", () => {
    const snapshot = marketSnapshotFixture();
    expect(selectMenuBarAmount(snapshot, "none")).toBeUndefined();
    expect(selectMenuBarAmount(snapshot, "supplied")).toBe(snapshot.totalSuppliedUsd);
    expect(selectMenuBarAmount(snapshot, "borrowed")).toBe(snapshot.totalBorrowedUsd);
    expect(selectMenuBarAmount(snapshot, "available")).toBe(
      snapshot.availableLiquidityUsd
    );
  });

  it("persists the insights section", async () => {
    window.localStorage.setItem(
      "settings",
      serializeWithBigInt({ ...DEFAULT_SETTINGS, section: "insights" })
    );
    expect((await loadSettings()).section).toBe("insights");
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
