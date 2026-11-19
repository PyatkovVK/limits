# Architecture

Shared code organization and the platform dependency boundary.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-ARC-001 | Keep platform-agnostic code in `src/common/`. | Shared services, AI controllers, settings groups, renderer assets, and the preload bridge live under `src/common/` and behave the same on Windows, macOS, and Linux. |
| COM-ARC-002 | Keep platform-specific code in the matching feature directory. | Native integration (taskbar, tray/menu bar, notch, startup, panel follow, codex path discovery) lives in `src/windows_feature/`, `src/apple_feature/`, or `src/linux_feature/`. |
| COM-ARC-003 | Enforce a one-way dependency: `*_feature` may require `common`, `common` must never require `*_feature`. | No `require()` or `import` of a `*_feature` path exists under `src/common/**`; verified by grep before committing. |
| COM-ARC-004 | Wire platform capabilities into shared modules through the composition root. | `src/main.cjs` builds platform-specific capabilities and passes them into `src/common/` modules as parameters — tray `quotaIcon`, preferences `platformApi`, codex path `platformFinders` — rather than `common` importing them. |
| COM-ARC-005 | Keep the composition root at `src/main.cjs`, outside `src/common/`. | `package.json` `"main"` points to `src/main.cjs`; it is the only module allowed to require both `src/common/**` and `src/*_feature/**`. |
| COM-ARC-006 | Mirror shared subsystem paths in platform feature directories. | Where a platform extends a subsystem, put its implementation at the matching relative path under `src/<platform>_feature/`, for example `renderer/i18n.js`, `tray/`, `updates/`, `settings/`, or `ai-connects/codex/`. Keep platform-only subsystems in their own directories, such as Windows `taskbar/`. Create directories as their implementations are needed. |
| COM-ARC-007 | Reuse shared implementations in platform extensions. | Extend a shared class when the platform service satisfies its contract, or compose shared behavior through functions and adapters. Keep platform-specific behavior in the feature directory and inject it through `src/main.cjs` where shared code consumes it. Shared renderer strings come from `common/renderer/i18n.js`. Platform dictionaries supply localized overrides and additions. |
