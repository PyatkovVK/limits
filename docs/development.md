# Development and configuration

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the contribution workflow.

## Run from source

Use Git, Node.js 22.12 or later, and npm. Windows x64 needs .NET Framework 4.x for its native helper. On macOS, install Xcode Command Line Tools. Linux needs a graphical desktop with tray support.

```sh
npm install
npm run demo
```

To open either welcome tour with demo data, use `npm run demo -- --welcome-install` or
`npm run demo -- --welcome-update`. These previews leave the real profile's one-time marker alone.

On Windows, `npm run build:win -- --demo` builds a portable demo for testing provider connections. Each launch starts with the welcome tour and a fresh profile. The launcher removes its data when Limits exits normally. The Claude Code status-line command generated in this build is valid for the current session. To preview the same build with sample quotas, pass `--sample-data`.

Run `npm start` to use real accounts and `npm run setup:skills` to install the default [local AI skills](ai-skills.md). Use `npm.cmd` in PowerShell if execution policy blocks `npm.ps1`. Install dependencies separately on each target OS.

## Checks

| Scope | Unit and integration tests | Desktop smoke tests |
| --- | --- | --- |
| Shared | `npm run test:common` | |
| Windows | `npm run test:win` | `npm run test:win:smoke` |
| macOS | `npm run test:mac` | `npm run test:mac:smoke` |
| Linux | `npm run test:linux` | `npm run test:linux:smoke` |

Run the suite for the affected code. Smoke tests need an interactive session on the target OS and write reports and screenshots to `artifacts/`.

## Source layout

- [`src/common/`](../src/common) contains shared providers, monitoring, account management and UI.
- [`src/windows_feature/`](../src/windows_feature), [`src/apple_feature/`](../src/apple_feature) and [`src/linux_feature/`](../src/linux_feature) contain OS-specific code and tests.
- [`scripts/`](../scripts) contains build, release and diagnostic tooling. [`test/`](../test) contains shared tests and app smoke entry points.

## Configuration

| Variable | Purpose |
| --- | --- |
| `CODEX_LIMITS_CODEX_PATH` | Absolute path to a Codex executable, used as an override. |
| `CODEX_HOME` | Local Codex home for the default external profile. See [Codex subscriptions](privacy.md#codex-subscriptions). |
| `CODEX_LIMITS_KEEP_BUILD=1` | Keep unpacked build output. |

Packaged builds include Codex. Source runs can use the executable from the project's npm dependencies or an installed CLI. On Linux, if the app cannot find your CLI in its desktop session's `PATH`, set `CODEX_LIMITS_CODEX_PATH` explicitly.

## Provider diagnostics

- Codex uses the local ChatGPT sign-in. Run `npm run doctor -- codex`.
- DeepSeek uses `DEEPSEEK_API_KEY`. Run `npm run doctor -- deepseek`.
- Z.ai uses `ZAI_API_KEY`. Run `npm run doctor -- zai`.

## Build packages

Run the build on the target OS. Packages are written to `release/`.

| Target | Command | Packages |
| --- | --- | --- |
| Windows x64 | `npm run build:win:x64` | Portable EXE and NSIS installer |
| macOS Apple Silicon | `npm run build:mac:arm64` | DMG and ZIP |
| macOS Intel | `npm run build:mac:x64` | DMG and ZIP |
| Linux x64 | `npm run build:linux:x64` | AppImage and DEB |
| Linux arm64 (local) | `npm run build:linux:arm64` | AppImage and DEB |

## Automated releases

GitHub Actions runs tests on every active branch and PR. The `main`, `demo` and numeric `<release>-demo` branches run tests only. Other branches build the four release targets and produce `SHA256SUMS.txt`. Only numeric release branch pushes and manual runs publish the verified packages. Release builds with configured certificates must pass signing verification and, on macOS, notarization.

See the [build and release requirements](../requirements/common/build-and-release.md) for routing, artifacts and publication details.
