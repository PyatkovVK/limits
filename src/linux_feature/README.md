# Linux features

Linux implementation, renderer controls and tests live in this directory. The common application only connects them to the shared lifecycle, tray controller and preferences IPC.

## Tray styles

Choose **Settings → Tray icons**:

- **Bar · 5h / 7d** displays the fixed quota duration above a proportional remaining-usage bar. Russian labels are `5ч` / `7д`. Unknown values use a dashed bar.
- **Classic · percentages** preserves the exact colored percentage badges from Limits 1.0.0. This is the default for both new and existing profiles without an explicit selection.

The `linuxTrayStyle` preference is saved in `widget-settings.json`. Switching styles updates both icons in place. Account details, percentages and reset information remain available in tooltips.

## Codex discovery

After explicit overrides, bundled runtimes and PATH, Linux checks common per-user CLI directories and native VS Code / Flatpak VS Code extension installations. Extension updates select the newest executable. This also works when Limits is launched from the desktop application menu.

## Details panel

The Linux panel is 528 DIP wide with 120% interface scaling. Its height follows content between 480 and 720 DIP, limited by the display work area. Opening from a top panel places details below the indicator; opening from a bottom panel places them above it, on the indicator's display. Content changes preserve the attached edge.

When the tray host does not expose icon bounds, activation uses the current cursor position near the top or bottom of the display. Without usable bounds or cursor coordinates, startup and menu actions follow the reserved top or bottom panel on the primary display. Native Wayland compositors may restrict cursor coordinates and window placement; this fallback cannot determine an exact indicator position there.

## Session recovery

Waking from sleep and unlocking the desktop reconnect account monitoring immediately, including when the previous poll was still pending or waiting for a retry. Unlocking without suspend is handled separately. Recovery keeps the last known limits visible, does not open the details panel, and preserves an active browser sign-in.

Electron supplies the wake event. A read-only `gdbus monitor` watches the screen saver's `ActiveChanged` signal for Cinnamon, GNOME, MATE, Xfce or the freedesktop interface (including KDE). If that tool or signal is unavailable, a five-second idle check also reconnects when the user returns after at least one minute of inactivity, where the desktop supports idle-time queries. AppImage library paths are removed from the system tool's environment.

## Validation

`npm test` includes this directory's tests. `npm run smoke` checks scaling, simulated top/bottom tray activations, content growth and shrinking, both style controls, immediate tray updates, persistence and invalid-input rejection, and writes previews to `artifacts/`. The same checks run against packaged applications with `--demo --smoke-test`.
