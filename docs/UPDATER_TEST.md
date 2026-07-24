# Signed updater test

This test uses a separate `LiquidiumBarUpdaterTest.app` bundle and a localhost
manifest. It does not replace `/Applications/LiquidiumBar.app`, alter the
production cask, or publish a GitHub release.

The private updater key is stored outside the repository at:

```text
~/Library/Application Support/LiquidiumBar Release/updater.key
```

Its password is stored in macOS Keychain under the service
`liquidiumbar-updater-signing-password`.

## 1. Prepare the signing environment

```sh
UPDATER_KEY="$HOME/Library/Application Support/LiquidiumBar Release/updater.key"
UPDATER_PASSWORD="$(security find-generic-password \
  -a "$USER" \
  -s liquidiumbar-updater-signing-password \
  -w)"
export TAURI_SIGNING_PRIVATE_KEY="$UPDATER_KEY"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$UPDATER_PASSWORD"
TEST_DIR="$(mktemp -d /tmp/liquidiumbar-updater-test.XXXXXX)"
```

Keep the terminal open so these variables remain available. Never print the
private key or password.

## 2. Build the update version

```sh
pnpm tauri build \
  --bundles app \
  --config src-tauri/tauri.updater-test.conf.json \
  --config '{"version":"0.1.7"}'

cp "src-tauri/target/release/bundle/macos/LiquidiumBarUpdaterTest.app.tar.gz" \
  "$TEST_DIR/LiquidiumBarUpdaterTest.app.tar.gz"
cp "src-tauri/target/release/bundle/macos/LiquidiumBarUpdaterTest.app.tar.gz.sig" \
  "$TEST_DIR/LiquidiumBarUpdaterTest.app.tar.gz.sig"

pnpm updater:manifest \
  0.1.7 \
  http://127.0.0.1:4187/LiquidiumBarUpdaterTest.app.tar.gz \
  "$TEST_DIR/LiquidiumBarUpdaterTest.app.tar.gz.sig" \
  "$TEST_DIR/latest.json"
```

## 3. Build and install the baseline

```sh
pnpm tauri build \
  --bundles app \
  --config src-tauri/tauri.updater-test.conf.json \
  --config '{"version":"0.1.6"}'

ditto \
  "src-tauri/target/release/bundle/macos/LiquidiumBarUpdaterTest.app" \
  "/Applications/LiquidiumBarUpdaterTest.app"
```

Confirm the baseline version:

```sh
plutil -extract CFBundleShortVersionString raw \
  "/Applications/LiquidiumBarUpdaterTest.app/Contents/Info.plist"
```

It must print `0.1.6`.

## 4. Serve and install the update

In a second terminal:

```sh
python3 -m http.server 4187 --directory "$TEST_DIR"
```

In the first terminal:

```sh
open "/Applications/LiquidiumBarUpdaterTest.app"
```

Open the panel, click **Update 0.1.7**, and confirm it progresses through
downloading and installing before relaunching.

Verify the result:

```sh
plutil -extract CFBundleShortVersionString raw \
  "/Applications/LiquidiumBarUpdaterTest.app/Contents/Info.plist"
find /Applications -maxdepth 1 -name "LiquidiumBarUpdaterTest.app" -print
```

The version must be `0.1.7` and exactly one test app must exist. Profiles,
settings, and snapshots should remain intact across the relaunch.

## 5. Verify failure safety

Reinstall the `0.1.6` baseline, change one byte in the copied update archive
without changing its `.sig`, and repeat the update. Tauri must reject the
signature, show **Retry update**, leave the baseline app intact, and avoid a
relaunch.

Also test with the server stopped. The update check must fail silently and the
rest of LiquidiumBar must continue to work.

## 6. Clean up

Quit and move `LiquidiumBarUpdaterTest.app` to Trash. Stop the local HTTP server,
then remove the temporary test directory. Finally clear the exported signing
variables:

```sh
unset TAURI_SIGNING_PRIVATE_KEY
unset TAURI_SIGNING_PRIVATE_KEY_PASSWORD
unset UPDATER_KEY
unset UPDATER_PASSWORD
```

The production app and its Homebrew receipt are not involved in this test.
