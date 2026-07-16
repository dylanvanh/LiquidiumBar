# LiquidiumBar release runbook

Use this runbook for future macOS and Homebrew releases. It assumes this Mac
already has:

- the Developer ID Application identity in the login Keychain
- the `liquidiumbar-notary` notary profile
- GitHub CLI authentication
- the Homebrew tap at `/Users/dylan/Development/homebrew-tap`

The release identity is:

```text
Developer ID Application: DYLAN PETER VAN HEERDEN (5PP5X9G9B3)
```

The repository keeps `bundle.macOS.signingIdentity` set to `-` for ad-hoc local
builds. Release commands override it through `APPLE_SIGNING_IDENTITY`.

## 1. Set release variables

Run these commands from the LiquidiumBar repository root. Change `VERSION` to
the version being released.

```sh
VERSION=0.1.3
IDENTITY="Developer ID Application: DYLAN PETER VAN HEERDEN (5PP5X9G9B3)"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"
APP="src-tauri/target/release/bundle/macos/LiquidiumBar.app"
DMG="src-tauri/target/release/bundle/dmg/LiquidiumBar_${VERSION}_aarch64.dmg"
```

## 2. Update version markers

Set the new version in:

- `package.json`
- `src-tauri/Cargo.toml`
- the `liquidiumbar` package entry in `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`
- the About value in `src/app/SettingsView.tsx`

Leave `signingIdentity` set to `-`.

## 3. Run checks

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
NODE_OPTIONS=--no-experimental-webstorage pnpm test
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
pnpm audit --prod
```

The `NODE_OPTIONS` value prevents Node 26's web storage global from replacing
jsdom's `localStorage` during tests.

## 4. Commit the release preparation

Commit the version changes before building. Push after Apple accepts the DMG.

```sh
git diff --check
git add package.json src-tauri/Cargo.toml src-tauri/Cargo.lock \
  src-tauri/tauri.conf.json src/app/SettingsView.tsx
git commit -m "Prepare LiquidiumBar ${VERSION} release"
```

## 5. Build the signed app and DMG

```sh
security unlock-keychain "$KEYCHAIN"
APPLE_SIGNING_IDENTITY="$IDENTITY" pnpm tauri build --bundles app,dmg
```

Enter the Mac login password if Keychain prompts for it. Approve private-key
access with **Always Allow**.

Tauri may report that it skipped notarization because Apple credential
environment variables are absent. This runbook submits the DMG through the
saved Keychain profile after the build.

The build must produce:

```text
src-tauri/target/release/bundle/macos/LiquidiumBar.app
src-tauri/target/release/bundle/dmg/LiquidiumBar_VERSION_aarch64.dmg
```

## 6. Verify signatures before notarization

```sh
codesign --verify --deep --strict --verbose=4 "$APP"
codesign -dv --verbose=4 "$APP"
codesign --verify --strict --verbose=4 "$DMG"
codesign -dv --verbose=4 "$DMG"
hdiutil verify "$DMG"
```

Confirm the output contains:

```text
Authority=Developer ID Application: DYLAN PETER VAN HEERDEN (5PP5X9G9B3)
Authority=Developer ID Certification Authority
Authority=Apple Root CA
TeamIdentifier=5PP5X9G9B3
flags=0x10000(runtime)
```

Both signatures need a secure timestamp. The runtime flag confirms Hardened
Runtime.

## 7. Submit the DMG to Apple

```sh
xcrun notarytool submit "$DMG" \
  --keychain-profile "liquidiumbar-notary" \
  --keychain "$KEYCHAIN" \
  --wait
```

Continue after the final status says:

```text
status: Accepted
```

For an `Invalid` result, fetch Apple's report with the submission ID:

```sh
xcrun notarytool log SUBMISSION_ID \
  --keychain-profile "liquidiumbar-notary" \
  --keychain "$KEYCHAIN"
```

Fix the reported issue and rebuild. Do not submit the rejected DMG again after
changing its contents.

## 8. Staple the ticket and calculate the checksum

```sh
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
codesign --verify --strict --verbose=4 "$DMG"
spctl --assess --type open --context context:primary-signature \
  --verbose=4 "$DMG"
hdiutil verify "$DMG"
shasum -a 256 "$DMG"
```

Gatekeeper must report:

```text
accepted
source=Notarized Developer ID
```

Save the SHA-256 output. Stapling changes the DMG bytes, so use this checksum
for GitHub and Homebrew verification.

## 9. Push, tag, and create the GitHub release

```sh
git push origin main
git tag -a "v${VERSION}" -m "LiquidiumBar v${VERSION}"
git push origin "v${VERSION}"
```

Write release notes to `/tmp/liquidiumbar-release-notes.md`, then create the
release:

```sh
gh release create "v${VERSION}" "$DMG" \
  --repo dylanvanh/LiquidiumBar \
  --title "LiquidiumBar v${VERSION}" \
  --notes-file /tmp/liquidiumbar-release-notes.md
```

Do not rebuild or modify the DMG after publication.

## 10. Verify the published GitHub asset

```sh
mkdir -p "/tmp/liquidiumbar-${VERSION}-published"
gh release download "v${VERSION}" \
  --repo dylanvanh/LiquidiumBar \
  --pattern "LiquidiumBar_${VERSION}_aarch64.dmg" \
  --dir "/tmp/liquidiumbar-${VERSION}-published" \
  --clobber
shasum -a 256 "/tmp/liquidiumbar-${VERSION}-published/LiquidiumBar_${VERSION}_aarch64.dmg"
```

Compare this checksum with the post-stapling checksum. Stop if they differ.

## 11. Update the Homebrew cask

Edit `/Users/dylan/Development/homebrew-tap/Casks/liquidiumbar.rb`:

- set `version` to the new version
- set `sha256` to the post-stapling checksum
- keep the GitHub release URL pattern unchanged

Validate and publish the cask:

```sh
cd /Users/dylan/Development/homebrew-tap
brew style Casks/liquidiumbar.rb
brew audit --cask --strict liquidiumbar
git diff --check
git add Casks/liquidiumbar.rb
git commit -m "Update LiquidiumBar cask to ${VERSION}"
git push origin main
cd /Users/dylan/Development/liquidiumbar
```

## 12. Test the public Homebrew install

Refresh Homebrew before testing so it reads the new cask commit:

```sh
brew update
brew info --cask dylanvanh/tap/liquidiumbar
```

Install on a Mac without LiquidiumBar:

```sh
brew install --cask dylanvanh/tap/liquidiumbar
```

Upgrade an existing installation:

```sh
brew upgrade --cask dylanvanh/tap/liquidiumbar
```

Verify the installed app:

```sh
plutil -extract CFBundleShortVersionString raw \
  /Applications/LiquidiumBar.app/Contents/Info.plist
codesign --verify --deep --strict --verbose=4 \
  /Applications/LiquidiumBar.app
codesign -dv --verbose=4 /Applications/LiquidiumBar.app
spctl --assess --type execute --verbose=4 \
  /Applications/LiquidiumBar.app
```

The installed version must match `$VERSION`. Gatekeeper must report:

```text
accepted
source=Notarized Developer ID
```

## 13. Test the app

- Launch the Homebrew-installed app and confirm no normal Dock icon appears.
- Toggle the tray panel several times and confirm Tauri reuses one window.
- Test **Open LiquidiumBar**, **Quit LiquidiumBar**, and **Open at Login**.
- Test panel placement across displays, scaling modes, and full-screen Spaces.
- Verify light and dark appearance, keyboard traversal, reduced motion, and
  VoiceOver order.
- Compare a populated mainnet profile with the official Liquidium app.
- Disconnect the network after a successful refresh and confirm cached data
  stays visible with a refresh error.
- Restart the app and confirm profiles, settings, and cached snapshots persist.

## Release failures

### `errSecInternalComponent` during signing

Unlock the Keychain and rerun the build from Terminal:

```sh
security unlock-keychain "$KEYCHAIN"
```

Approve the private-key prompt with **Always Allow**.

### Homebrew still sees the previous version

Run `brew update`, then confirm `brew info --cask dylanvanh/tap/liquidiumbar`
shows the new version before retrying the upgrade.

### The published checksum differs

Keep the Homebrew cask unchanged. Delete the incorrect GitHub release asset,
upload the exact notarized and stapled DMG, download it again, and compare the
checksum.

## References

- [Apple: Notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
- [Tauri: macOS code signing](https://v2.tauri.app/distribute/sign/macos/)

## Distribution disclaimer

LiquidiumBar is unofficial and is not affiliated with, endorsed by, or
supported by Liquidium. It is a monitoring convenience and not financial
advice. Release notes should disclose the pinned SDK version and the incomplete
fields listed in [SDK_CAPABILITIES.md](SDK_CAPABILITIES.md).
