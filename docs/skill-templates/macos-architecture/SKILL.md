---
name: macos-architecture
description: Maintain the Limits macOS module layout and dependency boundaries when adding, moving, or refactoring code under src/apple_feature.
---

# Maintain the macOS module

| Directory | Responsibility |
| --- | --- |
| `src/apple_feature/ai-connects/codex/` | Desktop Codex CLI discovery and macOS subscription storage configuration |
| `src/apple_feature/core/` | Launch at login and recovery after wake or unlock |
| `src/apple_feature/panel/` | Tray panel placement and macOS display mode selection |
| `src/apple_feature/notch/` | Notch controller, window setup, hit testing, menu-bar measurements and notification queue |
| `src/apple_feature/tray/` | Quota bitmap rendering and Electron Retina image representations |
| `src/apple_feature/renderer/` | macOS translation overrides |
| `src/apple_feature/view-panel/` | Browser scripts and styles loaded by the shared view panel |
| `src/apple_feature/updates/` | Release state, package verification and installer handoff |
| `src/apple_feature/native/`, `scripts/`, `test/smoke/`, `test/` | Native screen helper source, build helpers, smoke scenarios, and unit tests |

Full-app smoke commands live in the repository's `test/smoke/` directory.

## Keep responsibilities narrow

- Keep layout and hit testing as functions over geometry data. The notch controller coordinates phases and window lifecycle. Menu-bar measurement owns probe history and the notification queue owns delivery order and expiration.
- Keep macOS adapters compatible with the shared contracts. The dependencies from the platform side point into `src/common/`. Connect the adapters in `src/main.cjs` as described in [platform-boundary](../platform-boundary/SKILL.md).
- Pass the behavior a component uses at the boundary. Existing examples include the screen probe and clock for menu-bar measurements, the timer callbacks for notifications, and the command runner for update verification. Introduce a class when it owns state or a verified shared contract. Use functions for calculations and one-off operations.
- Keep renderer paths in the asset list in `src/main.cjs`. They resolve relative to `src/common/view-panel/index.html` and script order follows the renderer dependencies. Keep saved preference keys and preload calls stable when moving code.
- Keep the update service responsible for download and install state. The package code verifies the download and prepares the bundle before the service can offer installation. Preserve user initiation for download and the separate install action.

## Check a change

- Run `npm run test:mac` for macOS changes and `npm run test:common` for shared changes. Confirm imports in `src/common/` still satisfy [platform-boundary](../platform-boundary/SKILL.md).
- Use `npm run demo` on macOS to inspect renderer and notch changes. Keep the installer shell script and app smoke scenarios in the packaged files and preserve helper resource resolution if moving build or update files.
