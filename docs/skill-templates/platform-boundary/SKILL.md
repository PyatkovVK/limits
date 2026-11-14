---
name: platform-boundary
description: Enforce platform isolation in Limits application code, renderer assets, build commands, and packages. Use when changing or reviewing src/common, a platform feature, or the code that loads and packages them.
---

# Keep platforms isolated

- Allow local dependencies within `src/common/` and from each `src/*_feature/` to its own directory or `src/common/`. Check imports, re-exports, preloads, HTML and CSS assets, and paths constructed at runtime.
- In `src/main.cjs`, select the active implementation by `process.platform`. Use `windows_feature` on `win32`, `apple_feature` on `darwin`, and `linux_feature` on `linux`. Put the load itself behind the platform selection.
- Pass capabilities into shared Node code as parameters. For the shared renderer, let the selected scripts register capability functions on `window.limitsPlatform`. Use shared fallbacks where appropriate. Keep shared code independent of named platform globals and asset paths.
- Keep shared build tooling in `scripts/`, and keep platform helpers and tests for individual platform modules under their feature. Full-app smoke entry points go in `test/smoke/` with access to the composition root. Build and preparation entry points select only the target's helpers.
- Package `src/main.cjs`, `src/common/`, and the matching feature. Check that the package includes the selected feature's runtime assets, preload and installer resources as applicable.

## Verify

Run `node --test test/platform-boundary.test.cjs test/platform-scope.test.cjs` and `npm test`. When changing runtime paths, check that all computed paths resolve with only the selected feature present. Run the relevant native smoke or build command on the available target and report which targets were exercised.

Use `platform-routing` to choose a feature. Follow the subsystem layout and contracts in `requirements/common/architecture.md`.
