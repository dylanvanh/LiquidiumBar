import type { LiquidiumClient } from "@liquidium/client";
import { poolFixture, reserveFixture, summaryFixture } from "../test/fixtures";
import {
  normalizeMarket,
  normalizePortfolio,
  SdkLiquidiumReadAdapter,
} from "./adapter";

describe("Liquidium 0.7.0 normalization", () => {
  it("normalizes rates and observed basis-point risk fields", () => {
    const market = normalizeMarket(poolFixture, 100);
    expect(market.supplyApr).toEqual({
      value: 50_000_000_000_000_000_000_000_000n,
      decimals: 27,
    });
    expect(market.maxLtv).toEqual({ value: 6_500n, decimals: 4 });
    expect(market.liquidationThreshold).toEqual({ value: 7_400n, decimals: 4 });
    expect(market.totalSuppliedUsd?.value).toBe(200_000_000_000_000n);
  });

  it("leaves USD values unavailable when the protocol has no price", () => {
    const market = normalizeMarket(poolFixture, undefined);
    expect(market.priceUsd).toBeUndefined();
    expect(market.totalSuppliedUsd).toBeUndefined();
  });

  it("derives weighted and net APR only from fully priced positions", () => {
    const portfolio = normalizePortfolio("aaaaa-aa", summaryFixture, [reserveFixture]);
    expect(portfolio.totalSuppliedUsd?.value).toBe(200_000_000_000_000n);
    expect(portfolio.totalBorrowedUsd?.value).toBe(50_000_000_000_000n);
    expect(portfolio.weightedSupplyApr?.value).toBe(50_000_000_000n);
    expect(portfolio.weightedBorrowApr?.value).toBe(100_000_000_000n);
    expect(portfolio.estimatedNetApr?.value).toBe(33_333_333_333n);
  });

  it("derives health from basis points instead of the raw SDK health factor", () => {
    const portfolio = normalizePortfolio("aaaaa-aa", summaryFixture, [reserveFixture]);
    expect(portfolio.healthFactor).toEqual({ value: 2_960_000n, decimals: 6 });
    expect(portfolio.riskState).toBe("above-threshold");
  });

  it("does not derive weighted APR when a reserve price is missing", () => {
    const unpriced = { ...reserveFixture, priceUsd: 0 };
    const portfolio = normalizePortfolio("aaaaa-aa", summaryFixture, [unpriced]);
    expect(portfolio.pricesComplete).toBe(false);
    expect(portfolio.weightedSupplyApr).toBeUndefined();
    expect(portfolio.estimatedNetApr).toBeUndefined();
  });
});

describe("Liquidium protocol activity", () => {
  it("normalizes feed entries into app types", async () => {
    // given
    const getProtocolActivity = vi.fn().mockResolvedValue([
      {
        id: "inflow:supply-1",
        operation: "deposit",
        poolId: poolFixture.id,
        asset: "BTC",
        decimals: 8,
        amount: 2_014_000_000n,
        timestamp: "2026-07-14T12:00:00.000Z",
        txids: ["3755.9187"],
      },
      {
        id: "outflow:borrow-1",
        operation: "borrow",
        poolId: "usdc-pool",
        asset: "USDC",
        decimals: 6,
        amount: 500_000_000n,
        timestamp: "2026-07-14T11:00:00.000Z",
      },
    ]);
    const client = {
      history: { getProtocolActivity },
    } as unknown as LiquidiumClient;
    const adapter = new SdkLiquidiumReadAdapter(client);

    // when
    const snapshot = await adapter.getProtocolActivity();

    // then
    const EXPECTED_FEED_LIMIT = 50;
    expect(getProtocolActivity).toHaveBeenCalledWith({
      limit: EXPECTED_FEED_LIMIT,
    });
    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[0]).toEqual({
      id: "inflow:supply-1",
      operation: "deposit",
      marketId: poolFixture.id,
      symbol: "BTC",
      amount: { value: 2_014_000_000n, decimals: 8 },
      timestamp: "2026-07-14T12:00:00.000Z",
      txids: ["3755.9187"],
    });
    expect(snapshot.entries[1]?.txids).toEqual([]);
    expect(Number.isNaN(Date.parse(snapshot.fetchedAt))).toBe(false);
  });
});

describe("Liquidium profile resolution", () => {
  it("uses a profile principal directly without a wallet lookup", async () => {
    const getProfileId = vi.fn();
    const adapter = profileResolver(getProfileId);

    await expect(adapter.resolveProfileId("  aaaaa-aa ")).resolves.toBe("aaaaa-aa");
    expect(getProfileId).not.toHaveBeenCalled();
  });

  it("resolves a linked wallet address through the accounts module", async () => {
    const walletAddress = "0x1111111111111111111111111111111111111111";
    const getProfileId = vi.fn().mockResolvedValue("aaaaa-aa");
    const adapter = profileResolver(getProfileId);

    await expect(adapter.resolveProfileId(walletAddress)).resolves.toBe("aaaaa-aa");
    expect(getProfileId).toHaveBeenCalledWith(walletAddress);
  });

  it("rejects a wallet address with no linked profile", async () => {
    const adapter = profileResolver(vi.fn().mockResolvedValue(null));

    await expect(
      adapter.resolveProfileId("0x1111111111111111111111111111111111111111")
    ).rejects.toMatchObject({
      type: "invalid-profile",
      message: "No Liquidium profile is linked to this wallet address.",
    });
  });
});

function profileResolver(getProfileId: ReturnType<typeof vi.fn>) {
  const client = {
    accounts: { getProfileId },
  } as unknown as LiquidiumClient;

  return new SdkLiquidiumReadAdapter(client);
}
