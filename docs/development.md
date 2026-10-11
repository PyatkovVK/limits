# Development and configuration

[English README](../README.md) · [README на русском](../README.ru.md) · [Contributing](../CONTRIBUTING.md)

## Prerequisites

Use Git, Node.js 22.12 or newer, and npm. Windows native helpers need Windows x64 and .NET Framework 4.x; the built-in compiler is used, so .NET SDK is not required. On macOS, install Xcode Command Line Tools with `xcode-select --install`. Linux needs a graphical desktop with tray support.

For real usage data, macOS and Linux need an installed native Codex. The Windows app can use its bundled connection component. Demo mode does not require sign-in.

## Run from source

```sh
git clone https://github.com/PyatkovVK/limits.git
cd limits
npm install
npm run demo
```

If the default branch does not yet contain the app, switch to `create-mvp` before installing dependencies. Use `npm start` instead of demo mode to connect real accounts.

In PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`. Reinstall dependencies on each OS; do not copy `node_modules` across platforms.

## Checks

| Command | Purpose |
| --- | --- |
| `npm test` | Shared tests and all platform unit tests using mocked system dependencies |
| `npm run demo` | UI with clearly marked demo data |
| `npm run doctor` | Real Codex connection diagnostics without printing tokens or email |
| `npm run smoke` | Demo Electron UI smoke check and screenshots in `artifacts/` |
| `npm run smoke:onboarding` | Windows first-run sign-in with empty storage, without opening a browser |
| `npm run smoke:live` | UI check using a signed-in account |
| `npm run smoke:live -- --smoke-gpu --smoke-stability` | GPU and stability observation using a signed-in account |

Unit tests can run on any supported OS because platform dependencies are mocked. Real UI checks run on the target OS. Live checks require ChatGPT sign-in; keep generated files and account details out of commits.

## Source layout

- [`src/common`](../src/common): app lifecycle, account isolation, usage monitoring, RPC client, preload, tray controller, and shared details UI.
- [`src/windows_feature`](../src/windows_feature): taskbar widget, Windows tray rendering, Win32 helper, NSIS installer, build scripts, and platform tests.
- [`src/apple_feature`](../src/apple_feature): menu bar rendering, native screen helper, panel geometry, notch mode, packaging, and platform tests.
- [`src/linux_feature`](../src/linux_feature): Linux tray rendering, details panel sizing, and platform tests.
- [`scripts`](../scripts): packaging, build planning, bundled Codex setup, diagnostics, and onboarding checks.
- [`test`](../test): shared behavior, build configuration, and release-workflow tests.

## Configuration

| Variable | Purpose |
| --- | --- |
| `CODEX_LIMITS_CODEX_PATH` | Absolute path to a native Codex executable |
| `CODEX_HOME` | Shared account storage inherited by the default account; added accounts are isolated |
| `CODEX_LIMITS_KEEP_BUILD=1` | Preserve unpacked packaging output for diagnostics |

For AppImage, replace the placeholder with the exact downloaded filename:

```sh
chmod +x './Limits-<version>-x64.AppImage'
CODEX_LIMITS_CODEX_PATH='/absolute/path/to/codex' './Limits-<version>-x64.AppImage'
```

For DEB on a compatible Debian-based distribution, use `sudo apt install ./Limits-<version>-x64.deb`, replacing `<version>` first.

On Linux, Codex must be visible in the graphical app's `PATH` or configured explicitly. Automatic discovery inside VS Code extensions is not implemented on Linux. macOS also searches supported app bundles, Homebrew, nvm, and user directories.

## Usage data and timing

The app starts `codex app-server --listen stdio://`, performs the initialization handshake, and reads `account/read` and `account/rateLimits/read`. Remaining usage is `100 - usedPercent`; multiple `rateLimitsByLimitId` entries are supported.

Polling occurs 30 seconds after the previous request completes. Received `account/rateLimits/updated` notifications apply immediately, but updates from other processes may only be discovered by polling. Error backoff can reach five minutes; waking from sleep triggers a refresh.

The five-hour countdown uses the server's `resetsAt`, rounding up to the next minute. Reaching zero does not restore the remaining percentage until the server confirms a reset. Missing values are shown as unknown.

## Platform behavior

The Windows widget is an independent owned window over a horizontal taskbar. It does not reserve taskbar button space. Position, width, display mode, and language are saved. True full-screen apps hide it; maximized windows, Start, and Windows Search do not count as full-screen apps. The helper restarts after failure, and the widget is recreated if its taskbar owner is replaced. In tray mode, two usage icons replace the widget; unchanged icon images are reused.

macOS uses menu bar indicators or notch mode on a compatible screen. The menu bar countdown updates locally every 15 seconds. Native screen information controls notch availability and monitor placement; disconnecting the notch screen falls back to menu bar mode.

Linux uses separate tray indicators and a details panel that adapts to content, capped by the screen size. Click and tooltip behavior depends on the desktop environment. AppImage uses gzip compression to avoid the slow startup observed with maximum XZ compression on the tested Linux Mint environment.

## Build packages

Build on the target OS after installing dependencies:

| Host | Command | Output |
| --- | --- | --- |
| Windows x64 | `npm run build:win` | Portable EXE and per-user NSIS installer with the Codex component |
| macOS Apple Silicon | `npm run build:mac -- --arm64` | DMG and ZIP |
| macOS Intel | `npm run build:mac -- --x64` | DMG and ZIP |
| Linux x64 | `npm run build:linux -- --x64` | AppImage and DEB |

macOS and Linux default to the current Node.js architecture if none is specified. Linux also accepts `--arm64` for local builds; the release matrix publishes Linux x64. `npm run build:win:standalone` is a compatibility command for the same bundled Windows app with the older Standalone filenames.

Finished packages are written to `release/`; local build commands do not publish anything. Intermediate files use the OS temporary directory, which needs about 2 GB of free space. Windows packages are unsigned. Local macOS builds use ad hoc signing; Developer ID and notarization require separate setup.

## Automated releases

The [Build and release workflow](../.github/workflows/release.yml) runs on pushes and manual dispatch. Only `main` and exact numeric branches such as `1.0` or `1.0.0` build and publish. Other branches, including `create-mvp`, only pass the branch gate. Tag pushes do not trigger a build.

- `main` publishes the updating `latest` prerelease using the version in `package.json`.
- A numeric branch publishes `v<branch>`. A two-part branch such as `1.0` produces package version `1.0.0`.
- The version override happens inside CI, without a version commit to the branch.
- All four build targets must pass tests and packaging before publication.
- Each release includes eight app packages and `SHA256SUMS.txt`. Files are uploaded to a draft before the release becomes public.
- A later push to the same numeric branch updates that release's tag and assets. Other release versions are preserved.

The workflow must exist in the selected branch. Publishing uses the job's standard `GITHUB_TOKEN` with `contents: write`. See [CHANGELOG.md](../CHANGELOG.md) for user-facing release contents.
