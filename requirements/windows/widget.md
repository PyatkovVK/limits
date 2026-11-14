# Windows: taskbar widget

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| WIN-WDG-001 | Display a compact widget over the horizontal taskbar. | The widget shows the selected account and its plan when available. The [provider display schema](../common/interface.md#controller-driven-display) determines the metrics, and the widget's reset-time setting determines how available reset times appear. The overlay does not create a taskbar button. |
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
| WIN-WDG-016 | Offer three display modes under Settings → Panel settings → Widget reset times. | Date and time is the default. Date and time, Time until reset, and Do not show apply immediately and persist across restarts independently of the widget style. |
| WIN-WDG-017 | Keep displayed reset times accurate and readable. | Use the selected metric's reported reset timestamp. Recalculate countdowns every second and when the selection changes. Use `—` for a missing or invalid timestamp in quota-window layouts with visible reset fields. Countdown expiry stops at zero. The remaining percentages come from usage data. Russian and English layouts remain readable at widget widths of 200–400 px. |
| WIN-WDG-018 | Show the widget immediately when starting in widget mode. | On Windows 11, the first usable taskbar observation displays the widget above the taskbar without clicking or activating Explorer and without taking focus. Restoring widget mode, returning from fullscreen, and recreating the widget after taskbar replacement use the same behavior; unchanged polling does not raise it repeatedly. See [#15](https://github.com/PyatkovVK/limits/issues/15). |
| WIN-WDG-019 | Offer Classic, Rows, and Cells under Settings → Panel settings → Widget style. | Classic is the default. The styles below arrange the selected profile's metrics differently. Changing the style updates the widget immediately and persists across restarts. |

## Widget styles

| Style | Layout for five-hour and weekly quotas |
| --- | --- |
| [Classic](../../docs/screenshots/windows/widget.png) | Two stacked rows. Each row shows the period, optional reset time, progress bar, and remaining percentage in that order. |
| [Rows](../../docs/screenshots/windows/widget-rows.png) | Two stacked rows. Each row shows the period, progress bar, optional reset time, and remaining percentage in that order. |
| [Cells](../../docs/screenshots/windows/widget-cells.png) | Two side-by-side cells. Each cell shows the period and remaining percentage on the top line, the optional reset time below, and a thin progress bar at the bottom. |

## Reset-time modes

| Mode | Display |
| --- | --- |
| Date and time (default) | Local 24-hour time for a reset today. Include the localized day and month for a reset on another date. Hovering over a displayed reset time shows its full local date and time. |
| Time until reset | The five-hour counter uses hours and minutes (`H:MM`). The weekly counter uses days, hours, and minutes (`D:HH:MM`), including a zero day count when less than one day remains. Both round remaining time up to the next minute and reach `0:00` and `0:00:00` respectively at expiry. |
| Do not show | Hide reset times while keeping the available quota values and bars visible. |

## Limitations

WIN-WDG-015: the widget is an overlay window and does not reserve space for application buttons. Vertical taskbars are unsupported by current placement. When geometry is unavailable, the application must show a clear state and offer tray mode rather than promise arbitrary dragging across the screen.
