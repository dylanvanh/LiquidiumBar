# Tauri WebView compatibility

## Spike result

Tested on 2026-07-14 in the real macOS WKWebView using both `pnpm tauri dev` and a release-bundled `.app`.

| Capability | Development | Release bundle |
| --- | --- | --- |
| ESM loading | Pass | Pass |
| `bigint` operations | Pass | Pass |
| `fetch` | Pass | Pass |
| Web Crypto | Pass | Pass |
| SDK market pools and prices | Pass, 4 pools | Pass, 4 pools |
| `aaaaa-aa` position queries | Pass, 0 reserves | Pass, 0 reserves |
| CORS | Pass | Pass |
| Frontend bundle | Pass | Pass |

Captured release report:

```text
runtime_ready=true markets_ok=true market_count=4 portfolio_ok=true position_count=0 observed_origins=["https://icp-api.io"]
```

Captured development report:

```text
runtime_ready=true markets_ok=true market_count=4 portfolio_ok=true position_count=0 observed_origins=["http://localhost:1420", "https://icp-api.io"]
```

No polyfill, fetch shim, Web Crypto workaround, CORS proxy, or SDK patch was required.

The four live read calls were repeated after upgrading to stable
`@liquidium/client@0.5.0`: four pools (`BTC`, `USDT`, `USDC`, and `ICP`), five
price entries, an empty `aaaaa-aa` summary, and zero reserves were returned
successfully.

## Observed network surface

- Production external network origin: `https://icp-api.io`
- Development asset/HMR origin: `http://localhost:1420`
- Development HMR socket: `ws://localhost:1421`

No other SDK network origin was observed during live market, price, position-summary, and reserve calls. If a future SDK version introduces another origin, update the CSP only after repeating the traffic inspection.

## Manual macOS checks

The current Mac verified accessory activation, absence of a normal Dock app, one hidden reusable window, tray open/toggle behavior, focus-loss hiding, live refresh, dark appearance, persistence, offline cached states, and the packaged app launch.

Only one 2560×1440 display was attached during the run, and automated screen capture lacked macOS Screen Recording permission. The committed screenshots were therefore captured through the development WebView. Multi-display placement, full-screen Spaces behavior, VoiceOver, and Open at Login after a signed installation remain physical release-gate checks; use the checklist in [RELEASE.md](RELEASE.md).
