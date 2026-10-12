# Changelog

User-visible changes are recorded here. Downloadable packages and publication status are listed in [GitHub Releases](https://github.com/PyatkovVK/limits/releases).

## Unreleased

- Fix release verification to use electron-builder's Linux artifact names, and verify all packages and checksums on the test branch before publication.
- Fix packaging after a fresh dependency install when Electron has not downloaded its runtime yet.
- Prevent accidental text selection in the Windows widget and details panel while keeping account names editable.
- Allow automated Windows and macOS releases without configured signing certificates; configured certificates still require successful signing and verification.

## 1.0.0

The initial feature set prepared for the 1.0 release. This entry describes the version's contents; it does not imply that packages have already been published.

### Usage monitoring

- Remaining Codex subscription allowances for five-hour and weekly windows, with reset information and support for multiple usage-limit sets.
- Automatic polling about 30 seconds after each completed request, immediate handling of received usage updates, manual refresh, and refresh after waking from sleep.
- Retry backoff up to five minutes after errors, distinct stale and unknown states, and color highlighting for low remaining usage.
- A five-hour countdown calculated from the server reset timestamp; usage percentages change only when confirmed by the service.
- English and Russian interfaces with saved language and display preferences.

### Accounts

- ChatGPT browser sign-in through Codex App Server and reuse of the existing shared Codex account.
- Multiple additional accounts in isolated Codex storage, independent usage data, saved local names, and selection of the account shown in compact indicators.
- Sign-in cancellation and disconnection of additional accounts without changing the shared Codex account.
- Local account registry storing profile identifiers, names, and selection; OAuth credentials remain managed by Codex.

### Windows

- Windows 10 / 11 x64 taskbar widget and an alternative mode with two usage tray icons.
- Draggable widget with saved position and widths of 240, 280, 320, and 400 px.
- Five-hour countdown, account and plan display, details panel, DPI-aware tray icons, and light/dark theme support.
- Full-screen hiding, recovery after taskbar recreation, and restart of the native helper after failure.
- Low-usage notification at 10% or less, once per usage window.
- Per-user installer, portable EXE, bundled Codex connection component, first-run sign-in panel, and autostart for the installed app.

### macOS

- Separate five-hour and weekly menu bar indicators, including a five-hour countdown updated locally every 15 seconds.
- Light and dark details panels with native blur, Retina support, and account switching.
- Hover preview and expanded panel on MacBooks with a physical notch, including external-monitor handling and fallback to the menu bar.
- Respect for reduced-motion and reduced-transparency settings; autostart for packaged apps.
- Automatic discovery of installed Codex in app bundles and common CLI installation locations.
- DMG and ZIP packaging for Apple Silicon and Intel.

### Linux

- Separate turquoise five-hour and purple weekly tray indicators with remaining percentages and bars.
- Account and reset tooltips where supported by the desktop environment.
- Details window sized to its contents, with scrolling for long account lists.
- AppImage and DEB packaging for x64; documented testing on Linux Mint 22.2 Zara with XFCE/X11.

### Development and distribution

- Demo mode, connection diagnostics, automated unit tests, and platform UI smoke checks.
- Automated tests and package builds for Windows x64, macOS arm64 / x64, and Linux x64.
- GitHub Releases publication for `main` and numeric version branches, with SHA-256 package checksums.
- English and Russian repository documentation, platform screenshots, contribution instructions, and issue / PR templates.

### Known limitations

- Monitoring covers Codex subscription limits; API keys and general ChatGPT model message limits are not supported.
- Missing service-side usage windows remain unknown. Polling does not guarantee instant updates from other Codex processes.
- macOS and Linux require an installed native Codex; Windows packages include the connection component.
- The Windows widget overlays a horizontal taskbar and does not reserve space among app buttons. Windows packages are unsigned.
- macOS Developer ID signing and notarization require separate setup.
- Linux autostart is not implemented; desktops beyond the documented XFCE/X11 environment need testing.
- Claude Code, DeepSeek, and configurable notifications are roadmap items and are not included in this release.
