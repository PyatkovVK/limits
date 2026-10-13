# Interface, settings, and appearance

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-UI-001 | Support Russian and English interfaces. | Labels, tooltips, states, and settings switch together; the chosen language persists. First launch respects the system locale. |
| COM-UI-002 | Open details from the compact indicator. | The window shows the selected account/name and plan, five-hour and weekly bars with remaining percentages, reset countdown, connection state, last update time, refresh and account-switch actions, and access to account management and display settings. |
| COM-UI-003 | Consolidate user settings in the Settings dialog. | The dialog is accessible through the window button and menu item; language, accounts, display modes, and background are in one place. |
| COM-UI-004 | Show only modes and options available on the platform. | Windows widths are inactive in tray mode; notch mode is unavailable without a suitable display; unsupported startup is not presented as working. |
| COM-UI-005 | Persist language, display mode, and platform options. | Restart restores the selection; corrupt/unsupported values fall back to safe settings. |
| COM-UI-006 | Support the default background, a selected color, and a local image. | The background applies to details on all OSes and to the Windows widget; the default appearance can be restored. |
| COM-UI-007 | Store an application-owned copy of the background image. | Moving/deleting the source PNG/JPG after import does not break the background; the selection survives restart. |
| COM-UI-008 | Validate input images and colors. | Unreadable images, invalid colors, or files larger than 10 MiB do not replace working settings; a clear error is shown. Excessively large images are limited by area and normalized before storage. |
| COM-UI-009 | Recover safely when the saved image is unavailable. | A missing or unusable copy does not crash the app; the default background is restored. |
| COM-UI-010 | Keep text, bars, notices, and focus indicators readable on different backgrounds. | Light/dark colors do not make the remainder or warnings invisible; Settings retains its own colors independently of the details background. |
| COM-UI-011 | Keep long lists and settings accessible. | Long account lists and settings scroll; all buttons and fields remain reachable when content cannot fit on screen. The shared details-window rules below define sizing and placement. |
| COM-UI-012 | Close Settings using its close button, Escape, or an outside click. | These actions close Settings while fields inside remain usable. In notch mode, Escape must not simultaneously collapse the host behind an open dialog. |
| COM-UI-013 | Provide an explicitly marked demo mode without real authentication. | `npm run demo` shows sample accounts and data; sign-in and manual network refresh are unavailable. Demo uses a separate application profile. |
| COM-UI-014 | Allow switching sample accounts in demo mode. | Compact display and details show the same selected demo account; real accounts are unaffected. |
| COM-UI-015 | Do not create a second instance of the same application profile. | A repeated launch shows the existing details window; demo/smoke with separate storage does not replace the real profile. |
| COM-UI-016 | Distinguish closing details from quitting the application. | Closing hides the window while monitoring/indicators continue; Quit stops monitoring and helper processes. |

## Details window

These requirements describe the shared details window and its account/settings content on all platforms. Platform-specific anchoring and native effects are stated in the acceptance criteria. The same content-sizing and modal rules apply when shown in the macOS notch.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-UI-017 | Fit the details height to its content. | A short list leaves no large empty area. Accounts, Settings, and notices grow the window; closing them shrinks it again. The expanded notch follows the same content rule. |
| COM-UI-018 | Keep the window within the available screen work area. | Width and height fit small screens and do not extend beneath the taskbar or off screen. Long content scrolls. The current Linux height cap is also 590 logical units; other containers use their applicable screen limits. |
| COM-UI-019 | Open details at the active compact indicator on the corresponding monitor. | Windows anchors to the widget or clicked tray icon, including top taskbars; macOS uses the clicked menu-bar indicator; Linux uses the current screen’s bottom-right work-area anchor. Negative monitor coordinates are supported. |
| COM-UI-020 | Preserve anchoring while resizing. | Windows retains taskbar anchoring, macOS retains menu-bar anchoring, and Linux retains bottom/right anchoring. Notch content changes retain top anchoring and the expanded height across display rediscovery. |
| COM-UI-021 | Recalculate placement when displays change. | Small secondary monitors and negative coordinates do not place the window off screen; display handlers are released when the window is disposed. |
| COM-UI-022 | Keep visible details aligned with a moving compact widget without stealing focus. | On Windows, details follow a dragged widget without repeated show/focus; unchanged geometry or zero movement does not reset a manually moved details window. |
| COM-UI-023 | Do not reopen user-hidden details on polling or movement. | Hidden details stay hidden; an explicit reopening uses the current indicator and monitor position. |
| COM-UI-024 | Reject temporary or obsolete opening geometry. | On macOS, wait for valid menu-bar bounds before first display; AppKit’s temporary bottom-screen rectangle causes no jump. Use safe primary-screen placement when no usable anchor exists. Hiding or a newer request cancels a pending opening. |
| COM-UI-025 | Respect native appearance and accessibility settings. | macOS default panels support blur/transparency, rounded corners, light/dark themes, and smooth resizing without losing the anchor. Reduced transparency is respected and reduced motion disables resizing animation. |
| COM-UI-026 | Keep modal operations consistent with their details container. | A native background-image picker does not collapse the notch on temporary focus loss; the guard is released after success, cancellation, or error. Collapsing the notch closes Settings so reopening cannot expose a leftover dialog. |
| COM-UI-027 | Offer sign-in from details when no account is authenticated. | Account controls explain that sign-in is needed. Windows opens the panel once at the first signed-out state; later polls do not reopen a window hidden by the user. |
| COM-UI-028 | Keep details separate from an ordinary launcher window. | macOS does not add an ordinary application window to the Dock; compact indicators/notch and details remain the entry points, with Quit available from the menu. |
