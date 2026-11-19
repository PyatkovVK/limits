---
name: settings-architecture
description: Add or migrate a group in the shared Limits Settings dialog. Use for new settings cards, controls and changes to the shared settings contract across macOS, Windows and Linux.
---

# Limits Settings architecture

- Start with `src/common/settings/common/group.js` for the `SettingsGroup` and `Setting` contract and `src/common/settings/general/group.js` for the reference group. If the user asks for a mockup first, show it for review before editing application code.
- Keep the shared contract, row rendering, dialog and shared styles in `src/common/settings/common/`. Give each group its own sibling folder under `src/common/settings/`. Put that group's order, localized copy, state mapping and action handlers there.
- A group describes `id`, `title` and ordered `settings`. A row has a stable `id` and `kind`, a `title` and a `description`. Supply a value and `onChange` for editable controls. Use the shared `select` and `toggle` kinds for choices and booleans. Keep short descriptions free of trailing periods in Russian and English.
- When a group needs a read-only value or an action, model it explicitly. Add a shared row kind only when it fits the contract and can be reused. Keep group-specific presentation and workflow in that group's folder.
- Load the group's script before `src/common/settings/common/dialog.js` in `src/common/renderer/index.html` and add its descriptor to the dialog's group list. Keep row IDs and kinds stable across state updates so controls and pending operations retain their state.
- Read capabilities and confirmed values from the existing application state. Reuse existing `window.limits` handlers and platform adapters. Keep persisted keys and OS-specific behavior intact during a UI migration. Disable unavailable controls, explain the reason, and surface failures without leaving a stale value selected.
- Migrate only the requested group. Check both languages, keyboard access, narrow layout and unavailable states. Exercise the normal settings entry point and the affected actions on the available host.
