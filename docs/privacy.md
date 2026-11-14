# Data storage and privacy

Limits starts a local Codex App Server subprocess and communicates with it over standard input/output. It requests account details and usage limits, and uses Codex's sign-in, cancellation, and logout operations for account management. The app does not create chats or send prompts to a model.

The UI receives email, subscription plan, usage limits, reset timestamps, and connection state. Local names are chosen in Limits because the account response does not provide a ChatGPT display name.

For DeepSeek, Limits opens `https://platform.deepseek.com/api_keys` in the system browser and asks you to paste an API key into a password field. The key is sent to the main process once for validation and is never returned in UI state, profile metadata, display schemas, or diagnostics. Limits requests only `GET https://api.deepseek.com/user/balance` with the key in the Authorization header; it does not send model prompts. Successful connections store the key as encrypted bytes in `accounts/<profile-id>/deepseek-key.bin` using Electron safeStorage and the OS credential store. Encryption must be available; the Linux `basic_text` fallback is refused. Cancelled or failed connections do not save a key or add a profile. Disconnecting deletes that profile's local key without revoking it at DeepSeek. Balance snapshots contain only currency, amounts, availability and timestamps; they do not include account-wide spending or token history.

For GLM Coding Plan, Limits sends the pasted key to the main process and uses it only in the Authorization header of requests to `GET https://api.z.ai/api/monitor/usage/quota/limit`. A verified key is stored through the same encrypted OS storage in `accounts/<profile-id>/zai-key.bin`. Disconnecting deletes the local key. The interface receives normalized quota percentages, reset times, plan and connection state.

For Kimi Code, Limits uses the pasted key in the Authorization header of `GET https://api.kimi.ai/coding/v1/usages` and stores it encrypted in `accounts/<profile-id>/kimi-key.bin` after validation. Disconnecting deletes the local key.

For Claude Code, the optional status line script stores quota percentages, reset times, and the sample time in `accounts/<profile-id>/claude-quota.json`. Sign-in stays in Claude Code. Limits reads the local sample and deletes it along with the script when you disconnect the profile.

## Codex subscriptions

On Windows, macOS, and Linux, **Settings → Subscriptions** offers **All**, **Connected in Limits**, and **In Codex / VS Code**. Expand a profile to see its plan, connection status, quotas and available actions. Select a profile to show its usage in the widget, tray, menu bar or notch, depending on the platform.

- **In Codex / VS Code** tracks the sign-in in the local `CODEX_HOME` inherited by Limits, or `~/.codex` when the variable is unset. Limits starts a fresh Codex App Server on each regular poll to pick up sign-in changes, with forced token refresh disabled. Sign in or out of this profile in Codex or VS Code. Limits monitors one external home and detects sign-ins saved on the same machine.
- **Connected in Limits** includes accounts added through **+ Add**. Each Codex account gets a separate `CODEX_HOME` at `accounts/<profile-id>/` under Electron's app data directory. Codex manages the credential files there. OAuth tokens stay out of the renderer. Adding an account leaves the external sign-in intact. Disconnecting an added Codex account calls Codex logout and removes the profile from Limits. Other files may remain in the profile directory.

## Local app data

Limits stores its data on this device in Electron's `userData` directory, named **Codex Limits** under the OS-specific app data path. The external Codex home is accessed separately through the Codex App Server.

| File or directory | Contents |
| --- | --- |
| `accounts.json` | Profile identifiers, local names and the selected profile. |
| `mac-subscriptions.json` (macOS) or `subscriptions.json` (Windows and Linux) | Subscription filter and selected profile, restored after restart. |
| `accounts/<profile-id>/` | Isolated storage for connected profiles, including Codex credential files or provider-specific data. |
| `widget-settings.json` | Display mode, language, widget width, position and visibility. |
| `update-settings.json` | The version whose automatic update offer was dismissed. |

## Network activity

There is no app-level analytics or telemetry integration in the Limits source. This does not make the app offline: Codex connects to OpenAI for authentication and usage information, and Codex's own network behavior and settings remain its responsibility. This document describes Limits' implementation, not OpenAI's data-retention policy.

Limits also makes anonymous HTTPS requests to `api.github.com` to check public releases at startup, every six hours and on manual checks. These requests contain no account data, OAuth tokens or usage limits. Supported installed builds on Windows, macOS and Linux download release checksums and the matching package over HTTPS from GitHub and its release-asset hosts. macOS uses `mac-updates/` and `mac-update-result.json`; Windows uses `windows-updates/` and `windows-update-result.json`; Linux uses `package-updates/` and `package-update-result.json` inside app storage. Installation preserves account/settings storage. Source and unsupported unpacked runs open the release in the browser for manual installation. Demo and smoke checks simulate this behavior locally.

The RPC client discards the subprocess's stderr instead of forwarding potential account details. Diagnostic output and screenshots should still be reviewed before sharing. Never upload authorization files, OAuth tokens, API keys, or full app data directories.
