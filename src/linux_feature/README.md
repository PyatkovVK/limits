# Linux features

Linux implementation, renderer controls and tests live in this directory. The common application only connects them to the shared lifecycle, tray controller and preferences IPC.

## Architecture

Linux extensions follow the subsystem paths in `src/common/` and the Windows feature layout. Only implemented subsystems have directories:

```text
linux_feature/
├── ai-connects/codex/path.cjs     # Linux discovery injected into common Codex lookup
├── core/                        # Browser, environment, startup, session, preferences
├── panel/                       # Details controller, geometry, tray anchors
├── settings/general/            # Display selection and allowed tray styles
├── tray/tray-icon.cjs            # Linux pixels and Electron image representations
├── updates/                     # Service, package adapter, validator, installer
├── view-panel/style.css         # Linux details-panel styles
└── test/                        # Linux unit and integration tests
    └── smoke/                   # Panel and tray checks used by app smoke mode
```

### Shared implementations

| Linux component | Shared implementation | Linux responsibility |
| --- | --- | --- |
| `ai-connects/codex/path.cjs` | `common/ai-connects/codex/path.cjs` | Discover Linux user directories and VS Code binaries through the existing `platformFinders` injection. |
| `panel/panel.cjs` | `common/panel/panel-position.cjs` | Compose shared manual-position persistence with Linux tray anchors, display placement and zoom. |
| `tray/tray-icon.cjs` | `common/tray/tray-image.cjs` | Reuse percentage normalization and PNG encoding; draw Linux badge styles. |
| `updates/updates.cjs` | `common/updates/package-updates.cjs` | Extend `PackageUpdates` with the Linux adapter; inherit download, checksum, cancellation and installation-state handling. |
| `settings/general/group.js` | `common/settings/general/group.js` | Supply the existing synchronous display-selection adapter; reuse the shared settings controls and actions. |

The feature must not import Windows or Apple implementations. Common modules must not import this feature. Application wiring remains in `src/main.cjs`.

### Responsibility and dependency contracts

The details controller composes the shared `createPanelPosition` factory with a `trayAnchor` implementing `read(tray)`, `bounds(tray)` and `clear()`. `TrayAnchor` owns tray-host fallbacks and the activation cache. Resizing consumes the saved anchor without reading the cursor again; display changes invalidate the cache.

The update adapter selects and verifies native packages. `updates/installer.cjs` owns shell-script extraction and process handoff; `LinuxUpdates` inherits the shared package-update contract. Browser launch, session recovery and package tools all use `core/environment.cjs`, independently of each other. Electron objects, process launchers and storage are supplied through parameters.

Application smoke checks in this feature's `test/smoke/` are included in Linux packages for `--demo --smoke-test`. Full-app launchers live in the repository's `test/smoke/`.

Application wiring, diagnostic scripts and tests import subsystem modules directly. The feature root contains documentation only. The composition root supplies `view-panel/style.css` and `settings/general/group.js` through the existing platform-assets interface.

## Display modes

Choose **Settings → General → Display**, in this order:

1. **Percentages and bar** uses the classic colored percentage badges. This is the default for profiles without an explicit selection.
2. **Bar · 5h / 7d** displays the fixed quota duration above a proportional remaining-usage bar. Russian labels are `5ч` / `7д`. Unknown values use a dashed bar.

The `displayMode` and `linuxTrayStyle` preferences are saved in `widget-settings.json`. Previously saved widget modes automatically fall back to tray mode, preserving the chosen tray style. Switching styles updates both icons in place. Account details, percentages and reset information remain available in tooltips. Clicking either quota icon toggles details. Explicit Details and Settings menu actions continue to open their targets. Polling keeps tray menus stable.

## Launch at login

Enable **Settings → General → Launch at login** in a packaged DEB or AppImage build. Limits creates only its own `limits.desktop` entry in `$XDG_CONFIG_HOME/autostart` (default `~/.config/autostart`), without administrator privileges. Disabling removes that entry. Source, demo and smoke runs cannot enable startup.

Login starts Limits with `--hidden`, preserving the selected tray style and details-panel position without opening details. AppImage startup points at the original AppImage file; keep it at that location or disable and enable startup after moving it. Read-only configuration or unavailable executables disable the control, and save failures display the settings error.

## Codex discovery

After explicit overrides, bundled runtimes and PATH, Linux checks common per-user CLI directories and native VS Code / Flatpak VS Code extension installations. Extension updates select the newest executable. This also works when Limits is launched from the desktop application menu.

## Details panel

The Linux panel is 528 DIP wide with 120% interface scaling. Its height follows content between 80 and 720 DIP, limited by the display work area. Opening from a top panel places details below the indicator; opening from a bottom panel places them above it, on the indicator's display. Content changes preserve the attached edge.

When the tray host does not expose icon bounds, activation uses the current cursor position near the top or bottom of the display. Without usable bounds or cursor coordinates, startup and menu actions follow the reserved top or bottom panel on the primary display. Native Wayland compositors may restrict cursor coordinates and window placement; this fallback cannot determine an exact indicator position there.

## Session recovery

Waking from sleep and unlocking the desktop reconnect account monitoring immediately, including when the previous poll was still pending or waiting for a retry. Unlocking without suspend is handled separately. Recovery keeps the last known limits visible, does not open the details panel, and preserves an active browser sign-in.

Electron supplies the wake event. A read-only `gdbus monitor` watches the screen saver's `ActiveChanged` signal for Cinnamon, GNOME, MATE, Xfce or the freedesktop interface (including KDE). If that tool or signal is unavailable, a five-second idle check also reconnects when the user returns after at least one minute of inactivity, where the desktop supports idle-time queries. AppImage library paths are removed from the system tool's environment.

## Validation

Run `npm run test:linux` for this directory's tests. Use `npm run demo` on Linux to inspect the tray and details panel.
