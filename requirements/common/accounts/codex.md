# Accounts and authentication

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-ACC-001 | Provide ChatGPT browser sign-in. | Successful sign-in leads to reading actual limits; cancellation prevents a late response from opening the browser. |
| COM-ACC-002 | Support multiple additional accounts without an artificial two-account limit. | Personal, work, and further profiles can be added independently; long lists remain accessible through scrolling. |
| COM-ACC-003 | Isolate connected accounts from each other. | Signing one account in or out does not change other profiles; each account has separate authentication data. |
| COM-ACC-004 | Select one account for compact display while keeping the others accessible in account management. | Selection updates the widget/tray/menu bar/notch; other profiles’ data and states remain accessible in Settings. |
| COM-ACC-005 | Persist the selected profile and local names between launches. | Restart selects the same existing profile; an invalid ID falls back to a safe available option. |
| COM-ACC-006 | Allow a local name in place of email. | An empty name restores email display; names are truncated to 80 characters and control characters removed. Retrieving a ChatGPT nickname from the service is not promised. |
| COM-ACC-007 | Disambiguate matching local names. | Two names that match case-insensitively are displayed as `Name (email)` when email is known. |
| COM-ACC-008 | Allow only one active sign-in attempt at a time. | Repeated/concurrent starts do not create two remote attempts; the interface explains that the current attempt must finish or be cancelled. |
| COM-ACC-009 | Cancel sign-in correctly at any stage. | Cancellation during preparation or RPC does not return a late URL; completion of a cancelled attempt cannot unlock or replace another attempt. |
| COM-ACC-010 | Handle sign-in disconnection and timeout without permanent locks. | Locks are released after disconnection or failed remote cancellation; the user can retry. |
| COM-ACC-011 | Disconnect an additional account through logout and profile-registry removal. | The removed account is no longer shown; if selected, a remaining profile is selected. Any sign-in preparation for that profile is cancelled first. |
| COM-ACC-012 | Do not restore outdated account state from delayed responses. | Cancellation, removal, switching, and sign-in completion races do not mix limits or states across attempts. |
| COM-ACC-014 | Monitor accounts without an installed or running Codex desktop app or VS Code on Windows, macOS, and Linux. | Packaged Limits includes its native connection executable and owns its app-server process. With Codex and VS Code fully closed, browser sign-in, quota polling, suspend/resume, and restarting Limits remain available. Monitoring and credential maintenance are implemented in `src/common`; platform windows use the same monitors. |
| COM-ACC-015 | Refresh managed credentials when connecting the owned app server. | The first successful account read for each server connection requests credential refresh, including after a crash/reconnect. Failed initial reads retry with refresh enabled. Routine polls do not force token rotation on every refresh; they use the same server's automatic credential maintenance. |

## Planned improvement

The following requirement describes a future change rather than an already completed implementation. It applies to Windows, macOS, and Linux.

Version 1.3 satisfies runtime independence in COM-ACC-014; it does not claim the full storage/configuration isolation below. The default account may still share Codex's managed `CODEX_HOME` and credential store. Additional accounts continue to use isolated homes. Replacing the runtime prerequisite does not silently migrate or erase existing authentication data.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-ACC-013 | Obtain authentication and limit data independently of external Codex and VS Code installations. | Limits provides its own account connection and stores its own authentication state. It works without installed Codex or VS Code and does not read their configuration, profiles, credentials, or extension binaries. The connection mechanism will be defined during the future implementation. |
