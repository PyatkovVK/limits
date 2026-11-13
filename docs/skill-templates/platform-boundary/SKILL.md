---
name: platform-boundary
description: Enforce the one-way dependency between src/common and src/*_feature/ in the Limits app — common must never require or import a platform feature directory; shared modules get platform behavior injected through the composition root src/main.cjs. Apply before adding or moving code between src/common and a platform directory, and verify the boundary before committing.
---

# Keep the common/platform dependency boundary

## The rule

`src/common/` holds only platform-agnostic code. `src/windows_feature/`, `src/apple_feature/`, and `src/linux_feature/` hold platform-specific code.

The dependency is one-way:

- `*_feature/` modules **may** `require()` from `src/common/`.
- `src/common/` must **never** `require()` or `import` from `src/*_feature/`.

When a shared module needs a platform behavior, the composition root injects it as a parameter — it never imports the platform file. See `requirements/common/architecture.md` (COM-ARC-001..005) for the acceptance criteria.

## Verify the boundary

Before committing a change that touches `src/common/` or a platform directory, run:

```sh
rg -n "_feature" src/common --glob '!*.md'
```

Any hit in code is a violation. `src/common/` must never `require()`/`import` a platform feature directory or load its assets. Documentation (`*.md`) may name the platform directories when describing the rule; code must not.

## Where platform behavior belongs

- Platform-specific code lives in the matching `*_feature/` directory; use `platform-routing` to pick it.
- Shared behavior lives in `src/common/`. Do not move an existing shared feature into a platform directory just because it is the current host.

## Injecting a platform capability into common

Do not add a `*_feature` import to `src/common/`. Instead:

1. Give the shared module an optional injection point (constructor or function parameter) with a graceful fallback when absent.
2. Build the capability in `src/main.cjs` (the composition root) from the right `*_feature/` module.
3. Pass it in at the call site. Existing examples: tray `quotaIcon`, preferences `platformApi`, codex path `platformFinders`.

Keep injected capabilities narrow (a single function or small object) and check the other callers, including tests, which must supply the capability explicitly.

## Update tests with the capability

Shared-module tests that previously relied on the module importing a platform file must now construct and pass the capability (from the real `*_feature` module, or a stub where the platform behavior is not asserted). Run `npm test` and confirm the baseline stays green.
