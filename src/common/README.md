# src/common — shared, platform-agnostic code

Everything here works on Windows, macOS, and Linux without importing any platform implementation. Platform-specific code lives in `src/windows_feature/`, `src/apple_feature/`, and `src/linux_feature/`.

## Dependency boundary

```
            ┌─────────────┐
            │ src/main.cjs│   composition root (the only module that
            └──────┬──────┘   requires BOTH common/ and *_feature/)
      injects platform capabilities
                   │
                   ▼
            src/common/       platform-agnostic: NEVER imports *_feature
                   ▲
                   │ requires common (allowed)
  ┌────────────────┼────────────────┐
  ▼                ▼                ▼
windows_feature  apple_feature  linux_feature
```

- `*_feature/` modules may `require()` from `src/common/`.
- `src/common/` must never `require()` or `import` from `src/*_feature/`.
- When a shared module needs a platform behavior, the composition root (`src/main.cjs`) injects it as a parameter.

## Layout

```text
src/common/
├── preload.cjs
├── core/
│   ├── accounts.cjs
│   ├── appearance.cjs
│   ├── limits.cjs
│   ├── monitor.cjs
│   ├── polling-defaults.cjs
│   └── preferences.cjs
├── ai-connects/
│   ├── ai-controller.cjs
│   ├── api-key-controller.cjs
│   ├── api-key-credentials.cjs
│   ├── contracts.cjs
│   ├── quota-display.cjs
│   ├── registry.cjs
│   ├── codex/
│   │   ├── client.cjs
│   │   ├── controller.cjs
│   │   ├── limits.cjs
│   │   ├── options.cjs
│   │   ├── path.cjs
│   │   ├── reset-notifications.cjs
│   │   └── subscriptions.cjs
│   ├── deepseek/
│   │   ├── balance.cjs
│   │   ├── client.cjs
│   │   ├── controller.cjs
│   │   └── credentials.cjs
│   └── zai/
│       ├── client.cjs
│       ├── controller.cjs
│       └── quota.cjs
├── tray/
│   ├── metric-icon.cjs
│   ├── tray-image.cjs
│   └── tray.cjs
├── updates/
│   ├── package-updates.cjs
│   ├── update-download.cjs
│   └── updates.cjs
├── panel/
│   └── panel-position.cjs
├── demo/
│   └── demo-monitor.cjs
├── renderer/
├── settings/
└── view-panel/
```
