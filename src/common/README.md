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
