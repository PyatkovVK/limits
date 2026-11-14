# src/common — shared, platform-agnostic code

Everything here works on Windows, macOS, and Linux without importing any platform implementation. Platform-specific code lives in `src/windows_feature/`, `src/apple_feature/`, and `src/linux_feature/`.

## Dependency boundary

`src/main.cjs` loads `src/common/` and the active platform implementation. Each feature depends on its own files and `src/common/`. Each packaged application includes the same source directories selected at runtime.

Shared modules receive platform capabilities through function parameters. The shared renderer uses optional capability functions on `window.limitsPlatform`, registered by the selected platform's renderer scripts. See the [platform-boundary skill](../../docs/skill-templates/platform-boundary/SKILL.md) for the checks.
