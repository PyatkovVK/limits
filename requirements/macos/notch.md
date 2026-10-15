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
