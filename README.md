# LiquidiumBar

LiquidiumBar is an unofficial, read-only Liquidium monitor for the macOS menu bar. See protocol liquidity at a glance and monitor public positions without connecting a wallet or signing anything.

<p align="center">
  <img src="docs/liquidiumbar-demo.gif" alt="LiquidiumBar switching between Insights, Activity, Portfolio, and Settings" width="390">
</p>

## What it does

- Shows supplied, borrowed, and available liquidity across Liquidium markets.
- Displays market composition and supplied-versus-borrowed charts.
- Shows recent protocol supply, borrow, repay, withdraw, and liquidation activity.
- Monitors a Liquidium profile from its principal or a linked Ethereum/Bitcoin address.
- Shows portfolio composition, balances, APR, LTV, and health factor.
- Optionally places a compact market total beside the macOS menu-bar icon.
- Stores settings and cached snapshots locally. No LiquidiumBar backend, analytics, telemetry, or transactions.

## Screenshots

### Insights

<p align="center">
  <img src="docs/screenshots/insights.png" alt="LiquidiumBar Insights charts" width="47%">
  <img src="docs/screenshots/insights-details.png" alt="LiquidiumBar Insights details" width="47%">
</p>

### Activity

<p align="center">
  <img src="docs/screenshots/activity.png" alt="LiquidiumBar recent protocol activity" width="390">
</p>

### Portfolio

<p align="center">
  <img src="docs/screenshots/portfolio.png" alt="LiquidiumBar Portfolio chart" width="47%">
  <img src="docs/screenshots/portfolio-details.png" alt="LiquidiumBar Portfolio details" width="47%">
</p>

### Settings

<p align="center">
  <img src="docs/screenshots/settings.png" alt="LiquidiumBar Settings" width="390">
</p>

## Install with Homebrew

LiquidiumBar currently supports Apple Silicon Macs:

```sh
brew install --cask dylanvanh/tap/liquidiumbar
```

Current releases use Developer ID signing and Apple notarization. Homebrew
installs pass Gatekeeper without the previous **Open Anyway** workaround.
Starting with the updater bridge release, LiquidiumBar checks for signed updates
and installs them in place only after the user clicks **Update**.

## Run locally

Requires macOS, Node.js 22+, pnpm, Rust, and the Apple build tools.

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
```

Create a release build with:

```sh
pnpm tauri build
```

The `.app` and `.dmg` are written to `src-tauri/target/release/bundle/`.

## Project notes

- Liquidium SDK: `@liquidium/client@0.7.0`
- [SDK capabilities](docs/SDK_CAPABILITIES.md)
- [Compatibility results](docs/COMPATIBILITY.md)
- [Security and local storage](docs/SECURITY.md)
- [Release guidance](docs/RELEASE.md)

LiquidiumBar is unofficial and is not affiliated with, endorsed by, or supported by Liquidium. Information may be delayed, incomplete, or incorrect and is not financial advice.
