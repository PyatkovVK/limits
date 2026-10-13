# macOS: menu-bar indicators

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| MAC-MENU-001 | Display two independent menu-bar indicators. | Five-hour and weekly limits have distinct labels and bars and use the selected common account. |
| MAC-MENU-002 | Show a countdown next to the five-hour indicator. | Time is derived from the server reset and updated locally approximately every 15 seconds without artificially changing percentages. |
| MAC-MENU-003 | Retain readability in light/dark themes and on Retina displays. | Text and bars remain distinct; higher-scale images are provided, and the weekly indicator is not widened by the five-hour countdown. |
| MAC-MENU-004 | Distinguish fresh, low, stale, and unknown limits. | Zero allowance does not look absent; unknown time does not become a full reset. |
| MAC-MENU-005 | Open details on ordinary click and the menu on right click. | The native context menu does not intercept normal indicator activation. |
