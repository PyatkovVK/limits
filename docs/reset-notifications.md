# Codex Resets integration

[Codex Resets](https://codex-resets.com/) is a community service by [@wong2__](https://x.com/wong2__) that tracks announcements and forecasts of upcoming Codex resets. Enable the integration under **Settings → Codex resets → Reset notifications**. It is off by default.

When enabled, Limits checks the service immediately, at startup and every hour while running. It also checks after waking if a check is due. The main process sends an anonymous HTTPS `GET` to the [public status API](https://codex-resets.com/api/docs) at `https://codex-resets.com/api/v1/status`. The request sends no credentials or account data, rejects redirects and times out after 15 seconds.

An upcoming announcement (`scheduled_reset`) takes priority over an unexpired forecast (`active_watch`). Limits labels forecasts as estimates and ignores reports of completed resets. These alerts are independent of each account's quota and reset timer.

Limits shows a system notification for each new announcement or forecast and opens Codex Resets when clicked. It saves the opt-in and up to 128 notification identifiers in `reset-notifications.json` in Electron's local app data directory to avoid duplicate alerts across restarts. Settings show request or delivery errors.
