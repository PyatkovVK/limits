# Privacy and data handling

These requirements describe how Limits obtains the data needed to display limits and protects account information.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-DATA-001 | Obtain only the data needed to display limits, using one request per refresh. | Each refresh uses a single request to obtain limit windows, remaining values, reset times, and related display information. Reading limits does not create chats or send prompts to a model. |
| COM-DATA-002 | Keep authentication credentials out of the UI. | The renderer receives state, email/plan, and limits, but not authentication-file contents or OAuth tokens. |
| COM-DATA-003 | Keep each account’s authentication data isolated. | Accounts do not inherit unrelated environment keys or tokens; authentication data is stored separately for each profile. |
| COM-DATA-004 | Store the local profile registry separately from authentication files. | `accounts.json` contains IDs, names, and the selected profile; corrupt, duplicate, or invalid IDs cannot create arbitrary paths. |
| COM-DATA-005 | Retain the existing data directory when renaming the application to Limits. | The `Codex Limits` storage continues to be used; settings, names, and accounts are not lost solely due to the product name. |
| COM-DATA-006 | Allow internal commands only from trusted application windows. | Account actions, details-height changes, and Windows-widget dragging are accepted only from approved application main frames through IPC; other WebContents and iframes cannot perform these actions. |
| COM-DATA-007 | Keep the interface in an isolated environment. | The renderer uses context isolation and a sandbox. Node access (`require`), webviews, arbitrary navigation, and new windows are unavailable in the UI. |
| COM-DATA-008 | Use verified addresses for sign-in. | Sign-in uses HTTPS on `auth.openai.com`, `auth.chatgpt.com`, or `chatgpt.com`. An address with another protocol or host ends the attempt with a clear sign-in error. |
| COM-DATA-009 | Keep credentials and account data out of diagnostic logs. | Diagnostics use operation stages and safe codes. Tokens and account data from stderr/RPC errors are not exposed; child Codex stderr is not forwarded to interface logs. |
| COM-DATA-010 | Store background images safely in the application directory. | Image copies use valid identifiers within the application directory. Saved paths cannot access arbitrary files; an unusable copy restores the default background. |

## Connection and local storage

- COM-DATA-011: Sign-in and limit refreshes require a connection to the service. No application-owned analytics integration was found in Limits; the service provider’s data handling is governed by its own policies.
- COM-DATA-012: Signing an additional profile out ends its use in the application; some local credential files may remain. Account directories, OAuth files, and complete profiles remain private and must not be included in packages, commits, or public reports.
