# Liquidium SDK capability notes

## Version and inspection basis

LiquidiumBar pins `@liquidium/client@0.7.0` for read-only market, portfolio, profile, and protocol activity data. Version `0.7.0` was the npm `latest` release when these notes were verified on 2026-07-23. The capability details below were checked against the installed declarations, the upstream `@liquidium/client@0.7.0` tag, and its changelog.

## Used surface

`src/liquidium/adapter.ts` owns all SDK data calls. Other production modules may import SDK error types, but do not call the client. The adapter uses:

```ts
new LiquidiumClient({ timeoutMs: 30_000 })
client.market.listPools()
client.market.getAssetPrices()
client.positions.getUserPositionSummary(profileId)
client.positions.getUserReserves(profileId)
client.accounts.getProfileId(walletAddress)
client.history.getProtocolActivity({ limit: 50 })
```

Market, position, and profile reads are public canister queries. Protocol activity is fetched from the SDK's default HTTP API at `https://app.liquidium.fi/api/sdk/v2/history/activities`. No wallet adapter, profile mutation, signing, approval, borrowing, lending, repayment, withdrawal, or other transaction method is called.

## Stable LiquidiumBar contracts

- `ScaledAmount` and `ScaledRatio` retain a `bigint` value plus explicit decimal scale.
- Market and portfolio responses are normalized before reaching React.
- SDK failures are mapped to typed application errors without exposing raw objects or profile data in logs.
- USD calculations use the decimal metadata returned by the SDK.
- Protocol rates are rendered as APR.
- Aggregate utilization and USD totals are calculated from normalized pools.
- Weighted supply, borrow, and net APR require complete prices and rates. If any required input is absent, the metric is unavailable rather than estimated.
- LiquidiumBar derives health factor as `liquidationThresholdBps / currentLtvBps`. Zero debt is represented as no finite risk ratio.

SDK `0.7.0` documents current LTV, maximum LTV, liquidation threshold, liquidation bonus, protocol liquidation fee, and reserve factor as basis points. APR, APY, and utilization fields use the pool's `rateDecimals` scale. The adapter normalizes those two scales separately.

## Unused or unavailable data

| Field | LiquidiumBar behavior |
| --- | --- |
| Estimated supply and borrow APY | `Pool.estimatedLendingApy` and `Pool.estimatedBorrowingApy` are available but not displayed; LiquidiumBar shows current APR. |
| Per-position collateral flags | Not inferred from aggregate collateral data. |
| Price fetch timestamp | `client.market.getAssetPriceSnapshot()` returns an SDK retrieval timestamp, not an oracle observation timestamp. LiquidiumBar still calls `getAssetPrices()` and records the completion time of its combined market fetch. |
| Market display names | `Pool.displayName` is available, but LiquidiumBar uses asset symbols and app-owned icons. |
| SDK health factor | `UserPositionSummary.healthFactor` is now `bigint | null` with an explicit `healthFactorDecimals` scale. LiquidiumBar still derives its displayed value from basis-point LTV and liquidation-threshold fields. |
| Profile registration | `client.accounts.profileExists(profileId)` can distinguish a registered profile from an unknown principal. LiquidiumBar does not call it, so a syntactically valid unknown profile can still appear as an empty portfolio. |

## Principal validation

The SDK exports no standalone profile-principal validator. LiquidiumBar pins `@icp-sdk/core@5.4.0`, parses input with `Principal.fromText`, and returns the canonical `toText()` form. Invalid input is rejected before a network query; valid non-canonical text accepted by the principal parser is canonicalized rather than rejected. The SDK's `profileExists(profileId)` also validates its input, but performs a network query and is not used as the local syntax validator.
