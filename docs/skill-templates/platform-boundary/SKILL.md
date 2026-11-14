---
name: platform-boundary
description: Organize Limits platform implementations under src/*_feature/ using the subsystem paths in src/common and preserve one-way dependencies. Use when adding, moving, or refactoring platform modules, renderer translations, or shared extension points.
---

# Keep the common/platform dependency boundary

## The rule

`src/common/` holds only platform-agnostic code. `src/windows_feature/`, `src/apple_feature/`, and `src/linux_feature/` hold platform-specific code.

The dependency is one-way:

- `*_feature/` modules **may** `require()` from `src/common/`.
- `src/common/` must **never** `require()` or `import` from `src/*_feature/`.

When a shared module needs a platform behavior, the composition root injects it as a parameter. See `requirements/common/architecture.md` (COM-ARC-001 through COM-ARC-007) for the acceptance criteria.

## Verify the boundary

Before committing a change that touches `src/common/` or a platform directory, run:

```sh
rg -n "_feature" src/common --glob '!*.md'
```

Any hit in code is a violation. `src/common/` must never `require()`/`import` a platform feature directory or load its assets. Documentation (`*.md`) may name the platform directories when describing the rule; code must not.

## Where platform behavior belongs

- Platform-specific code lives in the matching `*_feature/` directory; use `platform-routing` to pick it.
- Shared behavior lives in `src/common/`. Do not move an existing shared feature into a platform directory just because it is the current host.
- Match the relative subsystem path in `src/common/` for each platform extension. For Windows, put translation overrides in `renderer/i18n.js`, tray rendering in `tray/`, update support in `updates/`, settings extensions in `settings/`, and Codex sign-in behavior in `ai-connects/codex/`. Give Windows-only subsystems such as `taskbar/` and `widget/` their own directories. Create the directories the platform actually uses.
- Look for a shared implementation before adding a platform module. Use inheritance when the platform service fulfills the shared class contract, such as `WindowsUpdates` extending `Updates`. Compose shared functions or inject a platform adapter when they provide a closer fit. Keep the common translation lookup as the fallback for platform strings.
- When moving a module, update its imports and renderer asset paths at their existing call sites, including `src/main.cjs` and affected tests or smoke scripts. Keep `src/common/` unchanged for platform-only reorganizations.

## Injecting a platform capability into common

Do not add a `*_feature` import to `src/common/`. Instead:

1. Give the shared module an optional injection point (constructor or function parameter) with a graceful fallback when absent.
2. Build the capability in `src/main.cjs` (the composition root) from the right `*_feature/` module.
3. Pass it in at the call site. Existing examples: tray `quotaIcon`, preferences `platformApi`, codex path `platformFinders`.

Keep injected capabilities narrow (a single function or small object) and check the other callers, including tests, which must supply the capability explicitly.

## Update tests with the capability

Shared-module tests that previously relied on the module importing a platform file must now construct and pass the capability (from the real `*_feature` module, or a stub where the platform behavior is not asserted). Run `npm test` and confirm the baseline stays green.
