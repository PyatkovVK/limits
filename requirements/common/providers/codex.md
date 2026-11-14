# Codex accounts and authentication

These requirements apply to the Codex account workflow on Windows, macOS, and Linux. The Codex controller implements provider-specific behavior through the [shared controller contract](../ai-connects.md).

## Account sources

The default external profile reads the inherited local `CODEX_HOME` through the bundled Codex App Server and uses `~/.codex` when the variable is unset. This profile is read-only in Limits. Sign-in and sign-out happen in Codex or VS Code. Each Codex account connected in Limits uses a separate `CODEX_HOME` at `accounts/<profile-id>/` under Electron's `userData`. Codex manages credentials in that home. Limits keeps account metadata and subscription preferences in [its local storage](../accounts/accounts.md).

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-ACC-001 | Provide ChatGPT browser sign-in. | Successful sign-in leads to reading actual limits; cancellation prevents a late response from opening the browser. |
| COM-ACC-002 | Support multiple additional accounts without an artificial two-account limit. | Personal, work, and further profiles can be added independently; long lists remain accessible through scrolling. |
| COM-ACC-003 | Isolate connected accounts from each other. | Each account connected in Limits uses its own Codex home. Signing one account in or out leaves the other connected accounts and the external sign-in intact. |
| COM-ACC-004 | Select one account for compact display while keeping the others accessible in account management. | Selection updates the widget/tray/menu bar/notch; other profiles’ data and states remain accessible in Settings. |
| COM-ACC-005 | Persist the selected profile and local names between launches. | Restart selects the same existing profile; an invalid ID falls back to a safe available option. |
| COM-ACC-006 | Allow a local name in place of email. | An empty name restores email display; names are truncated to 80 characters and control characters removed. Retrieving a ChatGPT nickname from the service is not promised. |
| COM-ACC-007 | Disambiguate matching local names. | Two names that match case-insensitively are displayed as `Name (email)` when email is known. |
| COM-ACC-008 | Allow only one active sign-in attempt at a time. | Repeated/concurrent starts do not create two remote attempts; the interface explains that the current attempt must finish or be cancelled. |
| COM-ACC-009 | Cancel sign-in correctly at any stage. | Cancellation during preparation or RPC does not return a late URL; completion of a cancelled attempt cannot unlock or replace another attempt. |
| COM-ACC-010 | Handle sign-in disconnection and timeout without permanent locks. | Locks are released after disconnection or failed remote cancellation; the user can retry. |
| COM-ACC-011 | Disconnect an additional account through logout and profile-registry removal. | The removed account is no longer shown; if selected, a remaining profile is selected. Any sign-in preparation for that profile is cancelled first. |
| COM-ACC-012 | Do not restore outdated account state from delayed responses. | Cancellation, removal, switching, and sign-in completion races do not mix limits or states across attempts. |
| COM-ACC-014 | Monitor accounts without an installed or running Codex desktop app or VS Code on Windows, macOS, and Linux. | Packaged Limits includes the native connection executable and owns its app-server process. Connected profiles support browser sign-in, quota polling, suspend/resume, and restart with Codex and VS Code closed. The read-only external profile can monitor a locally saved sign-in under the same conditions. |
| COM-ACC-015 | Refresh managed credentials when connecting the owned app server for a connected profile. | The first successful account read for each connected profile's server connection requests credential refresh, including after a crash or reconnect. Failed initial reads retry with refresh enabled. Routine polls rely on the server's automatic credential maintenance. External profiles start a fresh app server on a regular poll with forced credential refresh disabled. |

## Planned improvement

The future storage and configuration requirement below applies to Windows, macOS, and Linux. COM-ACC-014 covers the existing runtime independence. Any storage migration must preserve existing authentication data.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-ACC-013 | Obtain authentication and limit data independently of external Codex and VS Code installations. | Limits provides its own account connection and stores its own authentication state. It works without installed Codex or VS Code and does not read their configuration, profiles, credentials, or extension binaries. The connection mechanism will be defined during the future implementation. |

## Controller integration

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-ACC-016 | Preserve Codex profiles under the shared provider compatibility rules. | Apply [COM-AI-011](../ai-connects.md#location-and-responsibilities) to existing Codex profiles, including their account source and credential home. |
| COM-ACC-017 | Route account actions through controller capabilities. | Shared account management invokes sign-in, cancellation, sign-out, and disconnect through the controller contract rather than its client/RPC internals. Codex retains the existing single-login lock and cancellation guarantees. Read-only external sources do not acquire login/logout actions; disconnecting a controller does not log out the account. |
