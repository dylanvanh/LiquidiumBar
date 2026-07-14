# Build, signing, and release guidance

## Reproducible checks

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
pnpm audit --prod
pnpm tauri build
```

The active bundle targets are `app` and `dmg`. Outputs are written below:

```text
src-tauri/target/release/bundle/macos/LiquidiumBar.app
src-tauri/target/release/bundle/dmg/LiquidiumBar_0.1.0_aarch64.dmg
```

## Developer ID signing and notarization

The development Mac used for this build has no valid code-signing identity, so committed configuration is signing-ready but the produced artifact is unsigned and not suitable for public distribution.

For distribution outside the Mac App Store:

1. Install a **Developer ID Application** certificate in the build keychain.
2. Set `APPLE_SIGNING_IDENTITY` to its full identity name.
3. Supply notarization credentials using either App Store Connect API credentials (`APPLE_API_ISSUER`, `APPLE_API_KEY`, and `APPLE_API_KEY_PATH`) or Apple ID credentials (`APPLE_ID`, app-specific `APPLE_PASSWORD`, and `APPLE_TEAM_ID`).
4. Run `pnpm tauri build` on a trusted release host.
5. Confirm code signing, notarization, stapling, and Gatekeeper acceptance before publishing.

See Tauri's official [macOS code-signing guide](https://v2.tauri.app/distribute/sign/macos/) for current credential and CI details.

## Physical release checklist

- Launch the packaged `.app`; confirm no normal Dock icon appears.
- Left-click the tray icon repeatedly; confirm the same panel toggles instead of new windows being created.
- Use the native **Open LiquidiumBar** and **Quit LiquidiumBar** menu commands.
- Move the menu-bar item across displays and test above left, center, and right menu-bar regions.
- Test with a second display disconnected/reconnected and with different display scaling.
- Open from a full-screen Space and confirm placement, all-Spaces visibility, focus, and focus-loss hiding.
- Verify light and dark appearance, keyboard traversal, 40px controls, reduced motion, and VoiceOver labels/order.
- Add a valid populated mainnet profile and compare market, reserve, APR, USD, and risk values with the official Liquidium app.
- Disconnect the network after a successful refresh; confirm cached data remains visible with a refresh-failure notice.
- Restart the app; confirm profiles, labels, settings, and cached snapshots survive.
- Remove a profile, restart, and confirm its cached portfolio does not return.
- Toggle **Open at Login**, log out/in, and confirm the packaged installed app starts once.
- Inspect release WebView traffic and verify the only external origin remains `https://icp-api.io` before changing the CSP.
- Run `codesign --verify --deep --strict --verbose=2`, `spctl --assess --type execute --verbose=4`, and notarization/stapling checks on the final signed artifact.

## Distribution disclaimer

LiquidiumBar is unofficial and is not affiliated with, endorsed by, or supported by Liquidium. It is a monitoring convenience, not financial advice or a transaction interface. Release notes should disclose the pinned SDK version and known incomplete fields listed in [SDK_CAPABILITIES.md](SDK_CAPABILITIES.md).
