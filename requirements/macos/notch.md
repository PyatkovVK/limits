# macOS: physical MacBook notch

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| MAC-NOTCH-001 | Offer the mode only when a physical notch is confirmed on an active display. | The mode is hidden/unavailable on unsuitable Macs; an ordinary display does not create an artificial notch. |
| MAC-NOTCH-002 | Select a compatible MacBook display even when an external monitor is primary. | The panel remains at the MacBook’s physical notch rather than the center of an external display. |
| MAC-NOTCH-003 | Provide closed, peek, and expanded states. | States have distinct visible bounds; switching does not recreate the common account or limit monitor. |
| MAC-NOTCH-004 | Open peek on hover and collapse after the cursor leaves. | Stable hovering for approximately 100 ms shows peek; leaving for approximately 250 ms closes peek without accidentally opening the full panel. |
| MAC-NOTCH-005 | Open the full panel on click. | Expanded state offers limits, Settings, and account management; the window receives interaction focus. |
| MAC-NOTCH-006 | Collapse on Escape, loss of focus, or close when no guarded modal operation is active. | The island closes, not the whole application. When Settings is open, Escape applies to Settings first. |
| MAC-NOTCH-007 | Do not immediately reopen peek after explicit collapse. | After Escape/close, the cursor must leave the region before another hover. |
| MAC-NOTCH-008 | Accept mouse interaction only in the visible island region. | Transparent host-window areas pass interactions to underlying applications; hit testing matches actual native bounds. |
| MAC-NOTCH-009 | Respect Spaces, fullscreen applications, and accessibility settings. | The island is available in supported spaces and fullscreen without cluttering Mission Control; reduced motion/transparency change appearance. |
| MAC-NOTCH-010 | Return to the menu bar when the compatible display disconnects. | The overlay is disabled and indicators restored; late load/enable completion cannot restore a cancelled mode. |
| MAC-NOTCH-011 | Show the selected common account in the island. | Profile switching consistently updates island, details, and Settings data; display mode persists where the environment permits it. |
| MAC-NOTCH-012 | Hand browser sign-in over from the expanded notch with a clear message and timed collapse. | After a sign-in URL is ready, show a Russian/English notice explaining that the browser will open and the notch will collapse. Keep the notice visible for approximately 1.2 seconds, then collapse before opening the browser, even if the browser never takes focus. This applies to sign-in, account switching, and adding an account, including from Settings where the notice must remain visible. |
| MAC-NOTCH-013 | Keep delayed browser handoff consistent with the current mode and attempt. | Tray mode has no artificial handoff delay. Cancelled/completed attempts do not open a late browser URL. Switching the display mode during the wait does not collapse a newly enabled notch; success or failure clears the notice and modal guard. A collapsed notch remains closed until the normal hover-reentry rule permits reopening. |

## Notch side panel

The approved reference frames use the same sample quotas, 67% for 5h and 28% for 7d. Insets are measured in logical pixels from the outside edge of the black panel.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| MAC-NOTCH-014 | Align the collapsed side panel with the physical notch. | Its lower edge follows the camera safe area even when the menu bar is taller. Hover keeps the collapsed width and horizontal edges. Menu-bar controls beyond those edges remain visible and clickable. |
| MAC-NOTCH-015 | Keep the wide layout mirrored around the notch. | The left wing reads `● 67% 5h` and the right wing reads `7d 28% ●`. The dots are on the outer ends and the wings have equal 18 px outer insets. [Wide reference](../../docs/screenshots/apple-notch-side-wide.png) |
| MAC-NOTCH-016 | Fit both quotas on one line per wing in the compact layout. | The left wing reads `67% 5h` and the right wing reads `7d 28%`. Periods and values stay visible as the font shrinks. The decorative dots are hidden and the two outer insets are normally 10 px. [Compact reference](../../docs/screenshots/apple-notch-side-compact.png) |
| MAC-NOTCH-017 | Stack the quotas in the narrowest layout. | Each period appears above its percentage. The `5h` pair aligns to the left inset and the `7d` pair aligns to the right inset. The outer insets may decrease to 4 px to fit both pairs. When the wings have no usable room, hover reveals the quotas below the notch. [Two-line reference](../../docs/screenshots/apple-notch-side-tight.png) |
| MAC-NOTCH-018 | Keep the panel steady between meaningful menu-bar changes. | Routine polls read geometry passively and leave the status items in place. Small width variations and missing measurements preserve the last layout. A significant loss of space shrinks the panel promptly. Expansion waits for stable free space. When passive right-side geometry is unavailable, a one-off status-item measurement is allowed at activation or after a stable change in the set of running menu-capable apps. |

The macOS layout check exercises the three frames with simulated menu-bar widths. Deliberate changes to an approved layout require updating its requirement, reference frame and regression check together.
