# Monitoring without the Codex desktop app

Limits owns a separate `codex app-server --listen stdio://` child process on all three platforms. It reads account and quota RPCs directly; opening or keeping the Codex desktop app running is unnecessary. Packaged builds include the native executable (the runtime packaging PR is required for Linux/macOS).

The shared monitor requests a credential refresh after each successful server connection, including recovery after a crash. Regular quota polls use the same process and its automatic credential maintenance instead of rotating tokens every 30 seconds. A failed initial credential read is retried with refresh enabled. Credentials remain in Codex's managed store, and additional accounts keep their isolated homes.

After a failed account or quota read, the monitor discards the failed server connection so the next automatic retry reloads managed credentials, including credentials changed by a parallel Codex session. Retries retain the last sample and back off from one minute to five minutes. On Linux, waking from sleep or unlocking the desktop reconnects all profiles immediately, cancels requests left pending before sleep, and bypasses that backoff. Overlapping recovery requests share one reconnect; an active browser sign-in is preserved.

Manual acceptance on macOS, Linux and Windows: sign in through Limits, quit Codex completely, verify fresh usage samples, suspend/resume, then restart Limits and verify that monitoring resumes. Source builds need the pinned npm dependencies or an installed native CLI. Do not copy authentication tokens into issue reports.

Protocol: https://developers.openai.com/codex/app-server
