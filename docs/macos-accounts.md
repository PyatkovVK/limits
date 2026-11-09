# macOS subscriptions

Settings → Subscriptions has **All**, **Connected in Limits** and **In Codex / VS Code** views. All is the default. Expand a profile to see its remaining quotas and any available management actions. The profile header shows its plan and connection status. Any subscription can be selected for the menu bar or notch regardless of the view filter. The filter and selection survive restarts.

Connected subscriptions retain the existing isolated `accounts/<id>` homes and file credential store. Existing profile IDs and local names are preserved. On macOS, connecting while the external source is selected creates a new isolated profile; it never switches the account in another application.

The default external source uses inherited `CODEX_HOME`, otherwise `~/.codex`. Codex CLI and the IDE extension normally share this login cache ([official authentication documentation](https://learn.chatgpt.com/docs/auth)). To add a subscription, open **+ Add** and choose a provider. Additional local homes, including previously saved folder references, are not tracked; their folders and sign-ins remain untouched. For shared storage one source represents the shared sign-in, not a separate subscription per app window.

Limits obtains the selected account and quotas through its bundled app-server, not by parsing tokens. Each external poll starts a fresh server to pick up changes to the managed file/keychain store and reads the account with `refreshToken: false` ([account protocol](https://learn.chatgpt.com/docs/app-server)). It does not force a refresh-token rotation on each poll. Codex may still refresh credentials itself when needed for a request. Browser login/logout is disabled for external sources.

“Current” means the locally saved sign-in in the selected home. It is not billing/expiry information and cannot identify the account of every individual running thread. A remote VS Code host or a session held only in another process's memory has no discoverable local login store. Sign-in revocation may require signing in again in the owning client. No Codex window needs to remain open for Limits' own monitoring.

Manual check: connect one account in Limits and another in local Codex; verify both, select each, switch the Codex sign-in and wait for the next poll, restart Limits, and verify selection/filter restoration. Verify that choosing a provider from **+ Add** creates isolated subscriptions while only the default external home is tracked. Never use real credentials in test fixtures or screenshots.
