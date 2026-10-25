# Changelog

User-visible changes are recorded here. Downloadable packages and publication status are listed in [GitHub Releases](https://github.com/PyatkovVK/limits/releases).

## Unreleased

### Added

- Windows distinguishes accounts connected in Limits from current Codex / VS Code subscriptions, supports all/connected/current views and multiple local Codex homes, and reloads external account switches without signing those profiles in or out.

- macOS downloads the matching Apple Silicon/Intel update ZIP from Actions-published stable GitHub Releases, verifies SHA-256, bundle identity, version, architecture and code signature, and offers installation with restart. Preserve the previous bundle if replacement or launch fails. Windows and Linux retain manual installation.
- On macOS, distinguish subscriptions connected in Limits from current local Codex / VS Code profiles. Show both together or filter either source, retain selection and mode, reload external sign-in changes, and track additional CODEX_HOME directories without logging them out when removed.

### Fixed

- On macOS, reconnect usage monitoring after waking or unlocking, cancel requests left pending across sleep and bypass retry backoff. Preserve active browser sign-in and coalesce overlapping wake/unlock events.
- On macOS, place Settings below the physical notch with balanced margins, keep long content scrollable inside the panel and give the close button a fixed circular shape.

## 1.4.0

- Recover quota polling after failed account or usage reads by reconnecting with managed credentials; on Linux, reconnect immediately after waking or unlocking the desktop, including requests left pending across sleep, while preserving browser sign-in.
- Enlarge the Linux details panel and interface, open above or below the activated tray indicator on its display, and preserve the attached edge as content grows and shrinks.
- Move the additional-account disconnect action to a trash icon in each account heading, with localized accessible labels and protection against repeated clicks while disconnecting.
- Celebrate a displayed 67% allowance with a brief SIX SEVEN animation and a pastel progress bar, including account cards and the Windows widget; respect reduced-motion preferences.
- Add [opt-in Codex Resets notifications](docs/reset-notifications.md) in Settings, disabled by default. Check codex-resets.com on enable/startup and every six hours for an announced upcoming reset or active forecast; ignore completed resets and suppress duplicate alerts across restarts. Include a right-hand help control with source attribution and thanks to @wong2__.
- Show the Windows taskbar widget above the taskbar on first launch and when restoring it, without requiring a taskbar click or taking focus (#15).
- Require all new feature/task branches to use the `limits/` prefix, reserve `main` and numeric release/demo branches for integration and releases, and document GitHub ruleset configuration and fork limitations.
- Replace GitHub Actions branch routing: `main` keeps all packages in Actions artifacts; numeric version branches build and publish releases; numeric `-demo` branches run the full build, artifact upload and eight-package SHA-256 verification without creating tags or releases. Every other branch runs automated tests on Windows, macOS and Linux. Pull requests follow their source branch and never publish.
- Group npm build commands by Windows, macOS and Linux, add explicit architecture commands, and use them in the CI build matrix while retaining existing commands.
- Define the replacement CI flow, release boundary, platform commands and acceptance checks in [build and release requirements](requirements/common/build-and-release.md).
- Documented the agreed 1.3 scope and acceptance criteria in the shared and platform requirements, including compact weekly countdowns and the distinction between runtime independence and future account-storage isolation.

## 1.3.0

Six focused pull requests target `1.3-demo`; the release pull request targets `main`.

- Include the native connection component in Linux and macOS packages; a separate Codex installation or open Codex window is no longer required.
- Open Linux browser sign-in with the desktop environment preserved and AppImage runtime paths removed.
- Refresh account credentials in the shared monitor, independently of the Codex desktop app.
- Show a weekly reset countdown next to `7д` / `7d` in the Windows widget.
- Dismiss Windows details when focus moves outside the panel, while preserving native dialogs.
- Show a browser sign-in message in the macOS notch and collapse it after a short delay.

## 1.2.0

### New features

- Check stable GitHub releases at startup, every six hours and after an overdue wake-up, with all update behavior shared in `src/common` across Windows, macOS and Linux.
- A Russian and English Updates section in Settings shows the installed version, last check result and a manual check button. New-version offers remember dismissal; Update opens the specific GitHub release for manual download and installation.
- Update checks run without blocking startup or usage monitoring, share concurrent requests and handle network timeouts and GitHub errors. Demo mode previews update states without network or browser access.

### Bug fixes

- Keep one pending update dialog across repeated six-hour checks, including while the details window is hidden. Newer release information updates the existing offer without opening another dialog or bringing the window forward again.

### Development

- Version 1.2 development targets `1.3-demo`, based on 1.1.1, before creating the numeric `1.2` release branch. Pushes and pull requests into the demo branch run tests on Windows, macOS and Linux without publishing releases.

### Documentation

- Added the agreed requirements for version 1.2: shared GitHub release checks at startup, every six hours and after overdue wake-up, plus a manual check in Settings.
- Defined stable-version comparison, Russian and English update states, a new-version offer without repeated automatic prompts, and an “Update” action that opens the release on GitHub for manual download and installation.
- Specified non-blocking error handling, shared concurrent checks, simulated demo/smoke responses and validation for the update feature.
- Added a macOS first-launch guide in both README languages for allowing Limits through System Settings when the developer cannot be verified. Explained that the maintainer currently cannot afford Apple Developer Program membership, so current macOS downloads lack Developer ID signing and Apple notarization.

## 1.1.0

### New features

- A Settings dialog on Windows, macOS and Linux brings language, accounts, display modes and supported autostart controls together. Windows widget width, visibility and position reset are available in the same dialog.
- Choose the default background, a solid color or a local image for the details panel on every platform and for the Windows widget. Images are copied into app storage, and appearance preferences persist across restarts.
- Linux tray icons can use quota-period labels (`5h` / `7d`, or `5ч` / `7д`) with remaining-usage bars, or the classic colored percentage badges. The selected style is saved; classic remains the default for existing and new profiles.
- Linux can find Codex in common per-user CLI directories and native or Flatpak VS Code extension installations when launched from the desktop menu, selecting the newest available extension executable.

### Bug fixes

- Windows details now fit their content instead of leaving a large empty area below the limits. Opening Settings grows the panel, closing Settings shrinks it, and long content scrolls within the available screen space.
- Drag the Windows widget from any part, including quota labels, countdowns, progress bars and percentages. A continuous drag can cross the centered task buttons into free space on the left; ordinary clicks still open details, and dragging does not also trigger a click.
- The Windows widget avoids centered app buttons, Widgets and the system tray. It shrinks to fit beside the tray or moves into a free area on the left; it hides when no usable gap remains.
- An open Windows details panel follows the widget when it moves. Dismissed panels stay hidden, and routine taskbar polling does not snap a manually moved panel back into place.
- Prevent accidental text selection in the Windows widget and details panel while keeping account names editable.
- macOS details and expanded notch panels grow and shrink with their content, including notices and Settings, with smooth resizing and scrolling when content exceeds the screen.
- Keep the macOS notch panel open while choosing a background image, and close Settings when the notch panel collapses.
- Keep text, progress indicators, notices and keyboard focus readable on custom backgrounds, and keep Settings colors independent of the panel background.

### Builds and releases

- `main` builds are kept in GitHub Actions artifacts without creating a release or tag. Only numeric version branches publish releases. `1.1-demo` and pull requests into it run tests on Windows, macOS and Linux without packaging or uploading builds.
- Release verification uses the actual Linux artifact names and checks all eight packages and their SHA-256 checksums before publication.
- Fix packaging after a fresh dependency install when Electron has not downloaded its runtime yet.
- Automated Windows and macOS builds can run without signing certificates. Configured certificates still require successful signing and verification.

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
