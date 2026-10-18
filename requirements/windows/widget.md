# Windows: taskbar widget

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| WIN-WDG-001 | Display a compact widget over the horizontal taskbar. | It shows the selected account, plan, two remaining allowances, and five-hour and weekly reset countdowns; it does not appear as an ordinary application taskbar button. |
| WIN-WDG-002 | Provide widths of 240, 280, 320, and 400 px and a visibility setting. | Settings selections persist; resetting position restores visibility and placement near the tray. |
| WIN-WDG-003 | Avoid covering Start, Widgets, centered application buttons, and the system tray. | Placement uses available gaps with margins, including Windows 11 center alignment. |
| WIN-WDG-004 | Reduce actual width when space is limited, down to a minimum of 200 logical geometry units. | A narrow gap retains a readable compact variant; the preferred width is retained and restored when space becomes available. |
| WIN-WDG-005 | Use an available left-side gap when there is no room on the right. | The widget moves to a suitable gap on the left; when no suitable gap exists it hides rather than covering buttons. |
| WIN-WDG-006 | Start dragging from any widget region. | Dragging works from the account name, “5h”, either countdown, “7д” / “7d”, either bar, percentages, and background. |
| WIN-WDG-007 | Allow one continuous gesture across the central button group. | One down/move/up sequence moves the widget from the right gap to the left and back; placement constraints do not trap it on the right. |
| WIN-WDG-008 | Distinguish ordinary clicks from dragging. | A stationary click or small mouse jitter opens details without moving; ending a drag does not additionally open the window. The current drag threshold is 4 logical units. |
| WIN-WDG-009 | Retain the grab offset throughout the gesture. | Changes to the constrained window position do not reset the cursor offset; release or cancellation ends the gesture. |
| WIN-WDG-010 | Persist horizontal position relative to the taskbar. | Restart restores the preference; monitor-coordinate changes, including negative coordinates, do not place the widget outside a permitted gap. |
| WIN-WDG-011 | Hide the widget when the taskbar is hidden or a true fullscreen application is active. | An ordinary maximized window, Start, and Search are not treated as fullscreen; the widget returns after fullscreen ends. |
| WIN-WDG-012 | Avoid flicker when native geometry is unchanged. | Repeated polling does not continually show/resize the window; Windows-accepted size is respected even when different from the requested size. |
| WIN-WDG-013 | Maintain the correct window order relative to the taskbar. | The widget remains visible above its owner when window order changes; the application does not modify foreign Explorer windows. |
| WIN-WDG-014 | Prevent accidental text selection during dragging. | Labels and percentages cannot be selected by a drag gesture; account-name editing fields remain editable. |
| WIN-WDG-016 | Display the weekly reset time beside `7д` / `7d` in a compact localized format. | At least 24 hours remaining uses days and whole hours: `5д20ч` in Russian or `5d20h` in English. Less than one day uses hours:minutes, for example `16:39`. At exactly one day show `1д0ч` / `1d0h`. The tooltip retains the full hours:minutes value; other countdown surfaces keep their existing format. |
| WIN-WDG-017 | Keep the weekly countdown accurate and readable. | Use the selected bucket's server-provided weekly reset timestamp, update every second and on account/bucket changes, show `—` for missing/invalid timestamps and `0:00` after expiry, and never infer new percentages from the timer. RU/EN layouts remain readable without overflow at 200–400 px widths. |
| WIN-WDG-018 | Show the widget immediately when starting in widget mode. | On Windows 11, the first usable taskbar observation displays the widget above the taskbar without clicking or activating Explorer and without taking focus. Restoring widget mode, returning from fullscreen, and recreating the widget after taskbar replacement use the same behavior; unchanged polling does not raise it repeatedly. See [#15](https://github.com/PyatkovVK/limits/issues/15). |

## Limitations

WIN-WDG-015: the widget is an overlay window and does not reserve space for application buttons. Vertical taskbars are unsupported by current placement. When geometry is unavailable, the application must show a clear state and offer tray mode rather than promise arbitrary dragging across the screen.
