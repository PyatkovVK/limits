# Changelog

Only user-visible features and bug fixes are recorded here. Downloadable packages and publication status are listed in [GitHub Releases](https://github.com/PyatkovVK/limits/releases).

## 1.7.0

### Changed

- Remove the separate Add Codex profile button and manual CODEX_HOME folder tracking on all platforms. Previously added folder references are no longer loaded; their folders and sign-ins remain untouched. Add subscriptions through the provider selector; automatic tracking of the current Codex / VS Code account remains available.

### Added

- Add DeepSeek to the subscription provider selector. Open its API-key page in the browser, validate a pasted key before adding a profile, and store it encrypted with the OS. Monitor total, granted and topped-up balances in their original currencies once per minute with an independent polling setting; support key replacement and local removal without model requests.
- On macOS, add a third display mode with persistent quota values on both sides of the physical notch, curved black edges, and expanding in-panel notifications for low allowance, Codex Resets and update offers. Fit additional metrics with a +N control and scrollable details; queue messages without stealing focus and preserve the menu-bar and original notch modes.

### Fixed

- On macOS, fit the notch side panel between neighbouring menu-bar controls, shorten its labels when necessary, and fall back to a compact notch with limits on hover when space is insufficient or unknown. Keep collapsed and hover widths identical; shrink promptly and restore width only after stable free space.
- On macOS, keep the notch side panel's hover preview at exactly the collapsed width: its left and right edges stay fixed while it grows downward to show details. Preserve the click-expanded panel size.
- On Windows and Linux, show Panel settings only when the widget display mode is selected, use a platform-neutral section title, and rename the Linux percentage-icon option to Icons · percentages.
- On Windows, keep compact balance rows evenly spaced inside the taskbar widget, including short taskbars, with room below the bonus amount.
- On Windows, keep the taskbar widget visible when opening Start, Quick Settings and Limits details, while preserving its chosen position. Embed it in the taskbar surface and forward its mouse gestures so clicks, context menus and dragging still work, including DeepSeek balance text.
- On Windows, close the hidden-icons flyout through Explorer when opening Limits from the tray so its chevron returns to the collapsed state instead of leaving the popup logically open.
- On macOS, keep the compact quota indicators level with the physical notch when menu-bar space permits. Fill the small notch's side margins with black so its lower strip joins the physical notch without light cutouts. Join hover previews and expanded panels to the notch with smooth curved shoulders instead of rectangular steps, preserving the connection to the physical notch when foreground menus change. Keep both collapsed notch modes black and apply custom backgrounds only to expanded details. Pass clicks through transparent areas outside the notch chrome.
- Keep the Windows bar on the taskbar surface while Quick Settings and other system flyouts open or close, without topmost polling repairs or position jumps. Preserve the measured tray geometry through transient failures and save position only during explicit dragging. Use a separate row above a crowded taskbar and continue hiding for fullscreen applications and taskbar auto-hide.
- On Windows, macOS and Linux, offer new updates before downloading. Start the download only after choosing Download update, then offer Install and restart after verification; postponing or checking again does not download a package.

## 1.6.0

### Changed

- Poll Codex usage once per minute and check enabled Codex Resets notifications every hour.

## 1.5.0

### Added

- Add Linux login startup for installed DEB and AppImage builds through Settings. Create or remove a per-user XDG autostart entry and launch the saved presentation without opening details.
- Combine Linux display choices into one Settings selector: classic percentage tray icons, period/bar tray icons, then the desktop widget. Preserve existing selections.
- Extend connected/current subscription tracking to Linux and Windows; retain independent local Codex homes, persisted filters and selection, and removal without logout.
- Add a separate compact Linux desktop widget with two quota bars, reset countdowns, account switching, width/visibility controls and persisted draggable placement; retain tray mode. Wayland placement follows compositor policy.
- macOS downloads the matching Apple Silicon/Intel update ZIP from Actions-published stable GitHub Releases, verifies SHA-256, bundle identity, version, architecture and code signature, and offers installation with restart. Preserve the previous bundle if replacement or launch fails.
- On Linux, automatically download the matching AppImage/DEB update from Actions-published stable Releases, verify SHA-256 and package identity/architecture, and install from the app with restart. AppImage replacement restores the previous executable on launch failure; DEB uses system authorization through pkexec.
- Windows downloads the matching NSIS or portable update from Actions-published stable GitHub Releases, verifies SHA-256, product/version and publisher when signed, then installs and restarts on request. Portable replacement keeps a backup until relaunch.
- Windows distinguishes accounts connected in Limits from current Codex / VS Code subscriptions, supports all/connected/current views and multiple local Codex homes, and reloads external account switches without signing those profiles in or out.
- Windows reset labels show the local clock time, with a date for other days and a full localized date in the tooltip.
- On macOS, distinguish subscriptions connected in Limits from current local Codex / VS Code profiles. Show both together or filter either source, retain selection and mode, reload external sign-in changes, and track additional CODEX_HOME directories without logging them out when removed.

### Fixed

- On macOS, center the Settings close icon, make its full button clickable, contain select arrows, align subscription actions, and remove the subscription footnote.
- Use a per-user macOS LaunchAgent for packaged-app startup, including local ad hoc signed builds; launch in the background and remove the entry when disabled.
- Align Windows widget reset times and quota bars, keep subscription reset labels on one line, and give subscription filters and add buttons consistent spacing and inset select arrows.
- Keep Windows and other external Codex profile quota values visible while routine polling reloads the same signed-in account; still clear values on logout or a confirmed account change.
- Dismiss the Windows hidden tray icons flyout when clicking a Limits icon to open details.
- On Linux, toggle details by clicking a quota icon or the desktop widget again; use the application tray icon to hide or restore the desktop widget, and keep menus and visible widgets stable during usage polling.
- On Linux, fit short panels to their content below the previous 480px minimum and include Settings in height measurements; grow and shrink without moving the attached edge.
- On Linux tray hosts without icon geometry, retain a stable activation position across repeated clicks and reuse it when opening Settings from the menu.
- On Linux and macOS, remember the details panel position after title-bar dragging across reopening and restart; keep it within the available screen when displays change and preserve it during content resizing.
- Windows remembers a manually moved details panel across tray/widget clicks and restarts, clamps it to available displays, and preserves its position while content resizes.
- On macOS, reconnect usage monitoring after waking or unlocking, cancel requests left pending across sleep and bypass retry backoff. Preserve active browser sign-in and coalesce overlapping wake/unlock events.
- On macOS, place Settings below the physical notch with balanced margins, keep long content scrollable inside the panel and give the close button a fixed circular shape.

## 1.4.0

- Recover quota polling after failed account or usage reads by reconnecting with managed credentials; on Linux, reconnect immediately after waking or unlocking the desktop, including requests left pending across sleep, while preserving browser sign-in.
- Enlarge the Linux details panel and interface, open above or below the activated tray indicator on its display, and preserve the attached edge as content grows and shrinks.
- Move the additional-account disconnect action to a trash icon in each account heading, with localized accessible labels and protection against repeated clicks while disconnecting.
- Celebrate a displayed 67% allowance with a brief SIX SEVEN animation and a pastel progress bar, including account cards and the Windows widget; respect reduced-motion preferences.
- Add [opt-in Codex Resets notifications](docs/reset-notifications.md) in Settings, disabled by default. Check codex-resets.com on enable/startup and every six hours for an announced upcoming reset or active forecast; ignore completed resets and suppress duplicate alerts across restarts. Include a right-hand help control with source attribution and thanks to @wong2__.
- Show the Windows taskbar widget above the taskbar on first launch and when restoring it, without requiring a taskbar click or taking focus (#15).

## 1.3.0

- Include the native connection component in Linux and macOS packages; a separate Codex installation or open Codex window is no longer required.
- Open Linux browser sign-in with the desktop environment preserved and AppImage runtime paths removed.
- Refresh account credentials in the shared monitor, independently of the Codex desktop app.
- Show a weekly reset countdown next to `7д` / `7d` in the Windows widget.
- Dismiss Windows details when focus moves outside the panel, while preserving native dialogs.
- Show a browser sign-in message in the macOS notch and collapse it after a short delay.

## 1.2.0

### New features

- Check stable GitHub releases at startup, every six hours and after an overdue wake-up on Windows, macOS and Linux.
- A Russian and English Updates section in Settings shows the installed version, last check result and a manual check button. New-version offers remember dismissal; Update opens the specific GitHub release for manual download and installation.
- Update checks run without blocking startup or usage monitoring, share concurrent requests and handle network timeouts and GitHub errors. Demo mode previews update states without network or browser access.

### Bug fixes

- Keep one pending update dialog across repeated six-hour checks, including while the details window is hidden. Newer release information updates the existing offer without opening another dialog or bringing the window forward again.

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

## 1.0.0

### Usage monitoring

- Remaining Codex subscription allowances for five-hour and weekly windows, with reset information and support for multiple usage-limit sets.
- Automatic polling about 30 seconds after each completed request, immediate handling of received usage updates, manual refresh, and refresh after waking from sleep.
- Retry backoff up to five minutes after errors, distinct stale and unknown states, and color highlighting for low remaining usage.
- A five-hour countdown calculated from the server reset timestamp; usage percentages change only when confirmed by the service.
- English and Russian interfaces with saved language and display preferences.
- Demo mode and connection diagnostics.

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
