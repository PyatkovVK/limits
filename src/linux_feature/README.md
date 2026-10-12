# Linux features

Linux implementation, renderer controls and tests live in this directory. The common application only connects them to the shared lifecycle, tray controller and preferences IPC.

## Tray styles

Choose **Settings → Tray icons**:

- **Bar · 5h / 7d** displays the fixed quota duration above a proportional remaining-usage bar. Russian labels are `5ч` / `7д`. Unknown values use a dashed bar.
- **Classic · percentages** preserves the exact colored percentage badges from Limits 1.0.0. This is the default for both new and existing profiles without an explicit selection.

The `linuxTrayStyle` preference is saved in `widget-settings.json`. Switching styles updates both icons in place. Account details, percentages and reset information remain available in tooltips.

## Codex discovery

After explicit overrides, bundled runtimes and PATH, Linux checks common per-user CLI directories and native VS Code / Flatpak VS Code extension installations. Extension updates select the newest executable. This also works when Limits is launched from the desktop application menu.

## Validation

`npm test` includes this directory's tests. `npm run smoke` checks both style controls, immediate tray updates, persistence and invalid-input rejection and writes previews to `artifacts/`. The same checks run against packaged applications with `--demo --smoke-test`.
