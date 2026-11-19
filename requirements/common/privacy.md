# Privacy and data handling

These requirements describe how Limits obtains the data needed to display limits and protects account information.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-DATA-001 | Obtain only the data needed to display limits. | Codex makes one quota-data request per refresh. Other remote providers read their own usage or balance endpoint, and Claude Code reads its local quota sample. Reading limits does not create chats or send prompts to a model. |
| COM-DATA-002 | Keep authentication credentials out of the UI. | The renderer receives state, email/plan, and limits, but not authentication-file contents or OAuth tokens. |
| COM-DATA-003 | Isolate authentication data for connected profiles. | Connected profiles keep their provider's credentials separate and do not inherit unrelated environment keys or tokens. The read-only external Codex profile uses its existing local Codex home. |
| COM-DATA-004 | Store the local profile registry separately from authentication files. | `accounts.json` in Electron's `userData` contains IDs, names, provider IDs, and the selected profile. Corrupt, duplicate, or invalid IDs cannot create arbitrary paths. |
| COM-DATA-005 | Retain the existing data directory when renaming the application to Limits. | The `Codex Limits` storage continues to be used; settings, names, and accounts are not lost solely due to the product name. |
| COM-DATA-006 | Allow internal commands only from trusted application windows. | Account actions, details-height changes, and Windows-widget dragging are accepted only from approved application main frames through IPC; other WebContents and iframes cannot perform these actions. |
| COM-DATA-007 | Keep the interface in an isolated environment. | The renderer uses context isolation and a sandbox. Node access (`require`), webviews, arbitrary navigation, and new windows are unavailable in the UI. |
| COM-DATA-008 | Use verified addresses for Codex sign-in. | Codex sign-in uses HTTPS on `auth.openai.com`, `auth.chatgpt.com`, or `chatgpt.com`. An address with another protocol or host ends the attempt with a clear sign-in error. |
| COM-DATA-009 | Keep credentials and account data out of diagnostic logs. | Diagnostics use operation stages and safe codes. Tokens and account data from stderr/RPC errors are not exposed; child Codex stderr is not forwarded to interface logs. |
| COM-DATA-010 | Store background images safely in the application directory. | Image copies use valid identifiers within the application directory. Saved paths cannot access arbitrary files; an unusable copy restores the default background. |

## Connection and local storage

- COM-DATA-011: Remote sign-in and remote usage or balance queries require a provider connection. Claude Code quota refresh in Limits reads a local sample. Limits has no app-level analytics integration. Providers govern data handling on their services.
- COM-DATA-012: Disconnecting a connected profile ends its use in Limits. Codex logs out the connected account and may leave files in its profile directory. Disconnecting DeepSeek, Z.ai, or Kimi Code deletes the locally stored key. Disconnecting Claude Code deletes the Limits-generated status line script and quota sample. Account directories, OAuth files, and complete profiles must stay out of packages, commits, and public reports.

On Windows, macOS, and Linux, Limits stores account metadata and connected profile data under Electron's `userData` directory, named `Codex Limits`. Each Codex account connected in Limits uses its own home under `accounts/<profile-id>/`. The external Codex profile reads the local `CODEX_HOME`, or `~/.codex` by default, through Codex App Server. See [account storage by platform](accounts/accounts.md) and [Codex account sources](providers/codex.md#account-sources).

## Controller boundaries

These requirements apply to the [AI controller infrastructure](ai-connects.md). Codex supports browser sign-in. DeepSeek, Z.ai, and Kimi Code use encrypted local API keys. Claude Code uses a local status line sample and manages its own sign-in.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-DATA-013 | Keep provider credentials behind the controller boundary. | Shared UI state, normalized snapshots, schemas, and diagnostics contain no credentials or raw authentication payloads. Storage and environment handling belong to the provider implementation; an unknown provider ID cannot select another provider's credentials. |
| COM-DATA-014 | Preserve verified sign-in addresses per provider. | Codex continues to enforce the exact HTTPS hosts in COM-DATA-008. Provider registration cannot bypass browser-opening validation, and schemas cannot initiate navigation. API-key providers do not use browser sign-in; each provider explicitly defines the key-management URL opened in the default browser. |
| COM-DATA-015 | Read access and usage without invoking a model. | `checkAccess()` and `refresh()` do not create chats, send prompts, or initiate paid inference. The Codex controller preserves the single quota-data request per refresh in COM-DATA-001; connection/authentication maintenance does not cause duplicate quota reads. |
