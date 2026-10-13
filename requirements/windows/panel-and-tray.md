# Windows: tray and notifications

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| WIN-UI-001 | Provide an alternative two-tray-icon mode. | Five-hour and weekly windows have separate icons; switching replaces the widget with two indicators and persists. |
| WIN-UI-002 | Display the percentage above each indicator’s bar. | A full scale means 100%; unknown data is distinct from zero, low and stale remainders are distinguishable, and theme/DPI are accounted for. |
| WIN-UI-003 | Provide detailed hover tooltips. | The tooltip contains account/local name, plan, remainder, reset time/date, and demo/stale markers. |
| WIN-UI-004 | Open details by clicking either icon. | Clicking the five-hour or weekly indicator opens the same details window; the menu includes Settings, refresh, and quit. |
| WIN-UI-005 | Retain system icon visibility preferences. | Stable identifiers are used; ordinary updates do not recreate unchanged icons or images. |
| WIN-UI-006 | Notify on a confirmed remainder ≤ 10% where system notifications are available. | Low values for the selected account and bucket trigger a warning for each window; errors, stale data, demo, and smoke do not trigger false warnings. |
| WIN-UI-007 | Do not continually repeat warnings within one limit window. | Repeated low readings with the same reset timestamp do not create new notifications; a new confirmed period may notify again. |
