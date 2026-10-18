# Upcoming Codex reset notifications — 1.4

This feature targets `1.4-demo` from `limits/codex-reset-notifications`. It uses [Codex Resets](https://codex-resets.com/), a community service tracking reset announcements. Thanks to its author, [@wong2__](https://x.com/wong2__), for the public API.

## Settings

Open **Settings → Codex resets → Receive reset notifications**. The checkbox is **off by default**. Until explicitly enabled, the integration makes no API requests and schedules no checks. The choice is saved for future launches.

The **?** button to the right opens a localized explanation of the integration, its six-hour polling, and a final thank-you to the author. A source link remains visible in the section. Both links open through the main process at fixed HTTPS addresses.

Russian: **«Настройки → Сбросы Codex → Получать уведомления о сбросах»**. Чекбокс **выключен по умолчанию**. Кнопка **?** справа открывает описание интеграции и благодарность автору. Пока опция выключена, запросов к сервису нет.

## Behavior

- Check immediately on enable and at startup when already enabled, then every six hours while Limits is running. After wake-up, check only if overdue, without replaying missed intervals. Concurrent triggers share the same request.
- Use the site's [public status API](https://codex-resets.com/api/docs), `GET https://codex-resets.com/api/v1/status`, without an API key, account data, cookies or authentication headers. Requests have a 15-second timeout and reject redirects. The renderer does not access the network.
- Notify only for `scheduled_reset` (an explicit announcement of an upcoming regular/banked reset) or `active_watch` (an unexpired forecast). If both are present, the announced reset takes precedence. An unknown scheduled time remains unknown; passing a scheduled time never implies completion.
- **Ignore `latest_reset` entirely.** Completed resets never cause notifications or appear in this section. This integration never changes an account's quota percentages or reset timers.
- Label forecasts as estimates by the site, show their probability when supplied and expiry time, and explain that they are not confirmed OpenAI commitments. Expired forecasts and past scheduled times do not trigger new notifications.
- Notify once per announcement ID or forecast observation time, including across restarts. A changing probability for the same forecast does not repeat the notification.
- Show native system notifications in the current application language, with Codex Resets attribution. Clicking a notification opens the site. System permission/desktop support is needed; a native notification failure is surfaced in Settings and the announcement remains retryable.
- Disabling cancels pending work, removes the scheduled check, and ignores late responses. Quit also cancels work. Network, schema and HTTP errors remain visible in Settings without interrupting usage monitoring; automatic retries follow the same six-hour interval.

## Local data and privacy

`reset-notifications.json` in the existing **Codex Limits** application data directory stores only `enabled` and the identifiers of the last 128 notified announcements/forecasts. Missing, corrupt or non-boolean opt-in values default to disabled. No tokens, account identifiers, email addresses or usage values are sent to this service. As with any HTTPS service, the server receives the connecting IP address and standard request metadata.

Demo and smoke modes simulate results without networking, browser launches, OS notifications or writes to this preference file. Settings includes demo choices for no announcement, an upcoming reset, a forecast and a failed check. Normal application mode does not expose those controls.

## Validation

- `npm test`: default-off behavior, interval/resume scheduling, cancellation and races, schema validation, filtering completed/expired events, anonymous requests, persistence, deduplication, safe links and localized forecast wording.
- `npm run smoke:resets`: real Electron Settings UI in RU/EN, default-off checkbox, right-hand explanation/credits, announced/forecast/error states, keyboard dismissal, narrow-window scrolling, custom-background contrast and rejection of untrusted IPC. All external effects are simulated; screenshots and `report.json` are saved under `artifacts/resets-smoke-*`.

The shared implementation lives in `src/common`; native Windows/macOS/Linux notification delivery still needs acceptance testing in each target desktop environment.
