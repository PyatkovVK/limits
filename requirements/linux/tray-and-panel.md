# Linux: system-tray indicators

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| LIN-UI-001 | Display two independent limit indicators. | The five-hour indicator is turquoise and the weekly indicator purple; both refer to the selected common profile. |
| LIN-UI-002 | Retain the classic percentage style as the default. | A new profile or existing setting without an explicit choice uses classic, preserving the earlier colored badges. |
| LIN-UI-003 | Provide a bar style with the period label above the remaining bar. | English shows `5h`/`7d` and Russian `5ч`/`7д`; bar fill is proportional to the confirmed remainder. |
| LIN-UI-004 | Distinguish missing data, zero, full allowance, and stale data. | Unknown values use a dashed bar in bar style; 0% does not look unknown and 100% fills the bar; stale/low values have distinct styling. |
| LIN-UI-005 | Switch style through Settings → Tray icons. | Changes apply immediately to both existing indicators, persist after restart, and do not unnecessarily recreate tray objects. |
| LIN-UI-006 | Keep indicators readable across tray themes and sizes. | Images have square canvases and scale representations; classic uses its own surface so numbers/bars do not merge with the panel background. |
| LIN-UI-007 | Provide tooltips and details activation where supported by the desktop. | Tooltips include account, remainder, and reset; supported clicks open the selected account’s details. |
