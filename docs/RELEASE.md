# LiquidiumBar release runbook

Use this runbook for future macOS and Homebrew releases. It assumes this Mac
already has:

- the Developer ID Application identity in the login Keychain
- the `liquidiumbar-notary` notary profile
- the encrypted updater key at
  `~/Library/Application Support/LiquidiumBar Release/updater.key`
- the updater-key password in macOS Keychain under
  `liquidiumbar-updater-signing-password`
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
VERSION=0.1.7
IDENTITY="Developer ID Application: DYLAN PETER VAN HEERDEN (5PP5X9G9B3)"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"
APP="src-tauri/target/release/bundle/macos/LiquidiumBar.app"
DMG="src-tauri/target/release/bundle/dmg/LiquidiumBar_${VERSION}_aarch64.dmg"
APP_ZIP="/tmp/LiquidiumBar_${VERSION}_app.zip"
UPDATER_ARCHIVE="src-tauri/target/release/bundle/macos/LiquidiumBar.app.tar.gz"
UPDATER_SIGNATURE="${UPDATER_ARCHIVE}.sig"
UPDATER_KEY="$HOME/Library/Application Support/LiquidiumBar Release/updater.key"
UPDATER_PASSWORD="$(security find-generic-password \
  -a "$USER" \
  -s liquidiumbar-updater-signing-password \
  -w)"
RELEASE_NOTES="/tmp/liquidiumbar-release-notes.md"
LATEST_JSON="/tmp/latest.json"
```

## 2. Update version markers

Set the new version in:

- `package.json`
- `src-tauri/Cargo.toml`
- the `liquidiumbar` package entry in `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`

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
git add package.json pnpm-lock.yaml src-tauri/Cargo.toml src-tauri/Cargo.lock \
  src-tauri/tauri.conf.json
git commit -m "Prepare LiquidiumBar ${VERSION} release"
```

## 5. Build the signed app and DMG

```sh
security unlock-keychain "$KEYCHAIN"
export TAURI_SIGNING_PRIVATE_KEY="$UPDATER_KEY"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$UPDATER_PASSWORD"
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
src-tauri/target/release/bundle/macos/LiquidiumBar.app.tar.gz
src-tauri/target/release/bundle/macos/LiquidiumBar.app.tar.gz.sig
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

## 7. Notarize the app and DMG

```sh
ditto -c -k --keepParent "$APP" "$APP_ZIP"
xcrun notarytool submit "$APP_ZIP" \
  --keychain-profile "liquidiumbar-notary" \
  --keychain "$KEYCHAIN" \
  --wait
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

Staple the app before creating the final updater archive. The updater must
contain the exact notarized app that users will run. Recreate and re-sign the
archive because stapling changes the app bundle after Tauri's initial build:

```sh
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"
COPYFILE_DISABLE=1 tar -czf "$UPDATER_ARCHIVE" \
  -C "$(dirname "$APP")" \
  "$(basename "$APP")"
./node_modules/.bin/tauri signer sign \
  --private-key-path "$UPDATER_KEY" \
  "$UPDATER_ARCHIVE"
test -s "$UPDATER_SIGNATURE"
```

## 8. Staple tickets and calculate checksums

```sh
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
codesign --verify --deep --strict --verbose=4 "$APP"
spctl --assess --type execute --verbose=4 "$APP"
codesign --verify --strict --verbose=4 "$DMG"
spctl --assess --type open --context context:primary-signature \
  --verbose=4 "$DMG"
hdiutil verify "$DMG"
shasum -a 256 "$DMG"
shasum -a 256 "$UPDATER_ARCHIVE"
```

Gatekeeper must report:

```text
accepted
source=Notarized Developer ID
```

Save both SHA-256 outputs. Stapling changes the bytes, so only use the final
DMG checksum for Homebrew and the final archive checksum for GitHub verification.

## 9. Push, tag, and create the GitHub release

```sh
git push origin main
git tag -a "v${VERSION}" -m "LiquidiumBar v${VERSION}"
git push origin "v${VERSION}"
```

Write release notes to `$RELEASE_NOTES`. Generate the signed static updater
manifest using the final archive URL and signature:

```sh
UPDATER_URL="https://github.com/dylanvanh/LiquidiumBar/releases/download/v${VERSION}/LiquidiumBar.app.tar.gz"
pnpm updater:manifest \
  "$VERSION" \
  "$UPDATER_URL" \
  "$UPDATER_SIGNATURE" \
  "$LATEST_JSON" \
  "$RELEASE_NOTES"

gh release create "v${VERSION}" \
  "$DMG#Download LiquidiumBar ${VERSION} for macOS" \
  "$UPDATER_ARCHIVE#Automatic updater payload" \
  "$LATEST_JSON#Automatic updater metadata" \
  --repo dylanvanh/LiquidiumBar \
  --title "LiquidiumBar v${VERSION}" \
  --notes-file "$RELEASE_NOTES"
```

Do not rebuild or modify any artifact after publication.

## 10. Verify the published GitHub asset

```sh
mkdir -p "/tmp/liquidiumbar-${VERSION}-published"
gh release download "v${VERSION}" \
  --repo dylanvanh/LiquidiumBar \
  --dir "/tmp/liquidiumbar-${VERSION}-published" \
  --clobber
shasum -a 256 "/tmp/liquidiumbar-${VERSION}-published/LiquidiumBar_${VERSION}_aarch64.dmg"
shasum -a 256 "/tmp/liquidiumbar-${VERSION}-published/LiquidiumBar.app.tar.gz"
cmp "$LATEST_JSON" \
  "/tmp/liquidiumbar-${VERSION}-published/latest.json"
```

Compare both checksums with the final local artifacts. Stop if any checksum or
manifest differs. The detached `.sig` remains a local release artifact because its
contents are embedded in `latest.json`; do not upload it separately.

## 11. Update the Homebrew cask

Edit `/Users/dylan/Development/homebrew-tap/Casks/liquidiumbar.rb`:

- set `version` to the new version
- set `sha256` to the post-stapling checksum
- keep the GitHub release URL pattern unchanged
- add `auto_updates true` for the updater bridge release, then keep it

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

For the updater bridge release, complete the isolated two-version procedure in
[UPDATER_TEST.md](UPDATER_TEST.md). For later releases, confirm the previous
Homebrew-installed version shows the update, installs it, relaunches with the
new version, preserves profiles/settings, and remains the only
`/Applications/LiquidiumBar.app`.

After an in-app update, Homebrew's receipt may retain the bridge version while
the readable app bundle reports the newer version. Confirm normal Homebrew
behavior with:

```sh
brew info --cask --json=v2 dylanvanh/tap/liquidiumbar
brew outdated --cask
```

The cask's `auto_updates true` declaration lets Homebrew compare the actual app
bundle and avoid a normal downgrade.

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
- Confirm a deliberately corrupted updater archive is rejected without
  relaunching or modifying the installed app.

Clear updater credentials from the shell after all release checks:

```sh
unset TAURI_SIGNING_PRIVATE_KEY
unset TAURI_SIGNING_PRIVATE_KEY_PASSWORD
unset UPDATER_PASSWORD
```

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
- [Tauri: updater](https://v2.tauri.app/plugin/updater/)

## Distribution disclaimer

LiquidiumBar is unofficial and is not affiliated with, endorsed by, or
supported by Liquidium. It is a monitoring convenience and not financial
advice. Release notes should disclose the pinned SDK version and the incomplete
fields listed in [SDK_CAPABILITIES.md](SDK_CAPABILITIES.md).
