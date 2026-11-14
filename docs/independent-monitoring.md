# Monitoring without the Codex desktop app

On Windows, macOS, and Linux, Limits starts its own `codex app-server --listen stdio://` process to read account details and quotas. Packaged builds include the Codex executable and can monitor quotas while Codex Desktop is closed.

For accounts connected in Limits, the first account read on each server connection requests a credential refresh. Regular polls reuse the process. For the default external profile, each regular poll starts a fresh server to pick up sign-in changes in the local `CODEX_HOME`, with forced token refresh disabled. See [Codex subscriptions and local storage](privacy.md#codex-subscriptions).

After a failed account or quota read, the monitor discards the failed server connection so the next automatic retry reloads managed credentials, including credentials changed by a parallel Codex session. Retries retain the last sample and back off up to five minutes. On Linux, waking from sleep or unlocking the desktop reconnects all profiles immediately, cancels requests left pending before sleep, and bypasses that backoff. Overlapping recovery requests share one reconnect; an active browser sign-in is preserved.

Manual acceptance on macOS, Linux and Windows: sign in through Limits, quit Codex completely, verify fresh usage samples, suspend/resume, then restart Limits and verify that monitoring resumes. Source builds need the pinned npm dependencies or an installed native CLI. Do not copy authentication tokens into issue reports.

Protocol: https://developers.openai.com/codex/app-server
