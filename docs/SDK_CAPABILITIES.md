# Liquidium SDK capability notes

## Version and inspection basis

LiquidiumBar pins `@liquidium/client@0.5.0` exactly. The adapter was implemented against the installed package declarations and runtime, with source cross-checks in:

`/Users/dylan/liquidium/repos/liquidium-cross-chain-app/external`

That local source checkout reported commit `e53daf1` and a package version of `0.5.0`. The installed package declarations and stable source agree on LiquidiumBar's four read methods; the installed release remains authoritative for the application build.

## Used surface

`LiquidiumReadAdapter` is the only module allowed to import `@liquidium/client`. It uses:

```ts
new LiquidiumClient({ timeoutMs: 30_000 })
client.market.listPools()
client.market.getAssetPrices()
client.positions.getUserPositionSummary(profileId)
client.positions.getUserReserves(profileId)
client.accounts.getProfileId(walletAddress)
```

Wallet-address profile lookup is a public, read-only canister query. No wallet adapter, profile mutation, signing, approval, borrowing, lending, repayment, withdrawal, or other transaction API is imported or called.

## Stable LiquidiumBar contracts

- `ScaledAmount` and `ScaledRatio` retain a `bigint` value plus explicit decimal scale.
- Market and portfolio responses are normalized before reaching React.
- SDK failures are mapped to typed application errors without exposing raw objects or profile data in logs.
- USD calculations use the decimal metadata returned by the SDK.
- Protocol rates are rendered as APR.
- Aggregate utilization and USD totals are calculated from normalized pools.
- Weighted supply, borrow, and net APR require complete prices and rates. If any required input is absent, the metric is unavailable rather than estimated.
- Derived health factor uses `liquidationThresholdBps / currentLtvBps`. Zero debt is represented as no finite risk ratio rather than an invented number.

SDK 0.5.0 runtime risk fields are represented in basis points despite some generated comments implying the general rate scale. The adapter confines that discrepancy by normalizing current LTV, maximum LTV, and liquidation threshold explicitly as basis points.

## Unsupported or incomplete fields

| Field | LiquidiumBar behavior |
| --- | --- |
| APY | Not derived or displayed; compounding cadence is unavailable. |
| Per-position collateral flags | Not inferred from aggregate collateral data. |
| Price timestamps | No timestamp is attached to SDK prices, so only the LiquidiumBar fetch time is shown. |
| Market names and icons | Asset symbols are used; missing presentation metadata is not guessed. |
| Raw SDK health factor | Ignored because its scale is not documented reliably. |
| Profile existence | A syntactically valid empty profile cannot be distinguished from an unregistered profile. |

## Principal validation

The SDK exports no profile validator in version 0.5.0. LiquidiumBar pins `@icp-sdk/core@5.4.0` and uses `Principal.fromText`, then compares the canonical `toText()` result. Invalid or non-canonical input is rejected before a network query.
