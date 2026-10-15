# Monitoring without the Codex desktop app

Limits owns a separate `codex app-server --listen stdio://` child process on all three platforms. It reads account and quota RPCs directly; opening or keeping the Codex desktop app running is unnecessary. Packaged builds include the native executable (the runtime packaging PR is required for Linux/macOS).

The shared monitor requests a credential refresh after each successful server connection, including recovery after a crash. Regular quota polls use the same process and its automatic credential maintenance instead of rotating tokens every 30 seconds. A failed initial credential read is retried with refresh enabled. Credentials remain in Codex's managed store, and additional accounts keep their isolated homes.

Manual acceptance on macOS, Linux and Windows: sign in through Limits, quit Codex completely, verify fresh usage samples, suspend/resume, then restart Limits and verify that monitoring resumes. Source builds need the pinned npm dependencies or an installed native CLI. Do not copy authentication tokens into issue reports.

Protocol: https://developers.openai.com/codex/app-server
