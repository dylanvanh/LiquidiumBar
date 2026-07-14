# Security, network, and local data

LiqWatch is intentionally read-only. It has no wallet connection, private-key handling, signing, transactions, backend service, analytics, or telemetry.

## Content Security Policy

The production policy is defined in `src-tauri/tauri.conf.json`:

```text
default-src 'self';
connect-src 'self' ipc: http://ipc.localhost https://icp-api.io;
img-src 'self' asset: http://asset.localhost data:;
style-src 'self' 'unsafe-inline';
font-src 'self';
object-src 'none';
base-uri 'none';
frame-ancestors 'none'
```

Production permits local bundled assets, Tauri IPC, and the sole observed SDK origin. Inline styles are allowed because Dither Kit positions and sizes its canvas layers dynamically; scripts remain restricted to bundled local assets. It permits no remote scripts or styles, `eval`, frames, plugins, or arbitrary connections. Development has a separate `devCsp` for Vite assets, React refresh, and the local HMR socket; its HMR exceptions are not present in release builds.

## Tauri permissions

The `main` window receives only:

- Tauri core defaults required for the window lifecycle
- Narrow Store get/set/delete/save access
- Autostart access
- URL opening restricted to `https://liquidium.fi/*` and the official Liquidium SDK GitHub repository

There is no shell, command execution, filesystem, process, clipboard, notification, HTTP plugin, or unrestricted opener permission.

## Local storage

The Tauri Store file is:

```text
~/Library/Application Support/app.liqwatch.desktop/liqwatch.v1.json
```

It contains versioned settings, public profile principals and local labels, privacy preference, refresh interval, selected tab/profile, and normalized market/portfolio snapshots. Financial integers are serialized as tagged decimal strings and restored to `bigint` explicitly. A profile's cached portfolio snapshot is deleted when the profile is removed. Corrupt or old-version records are ignored safely.

The data is not encrypted because it contains only public protocol data and user-selected local preferences. Privacy mode masks amounts on screen; it does not encrypt the store. Removing the store file resets all local LiqWatch state.

In an ordinary browser development session—not a Tauri window—the same keys use that browser's `localStorage` solely to support UI development and tests.
