# Data storage and privacy / Хранение данных

## English

Limits starts a local Codex App Server subprocess and communicates with it over standard input/output. It requests account details and usage limits, and uses Codex's sign-in, cancellation, and logout operations for account management. The app does not create chats or send prompts to a model.

The UI receives email, subscription plan, usage limits, reset timestamps, and connection state. Local names are chosen in Limits because the account response does not provide a ChatGPT display name.

For DeepSeek, Limits opens `https://platform.deepseek.com/api_keys` in the system browser and asks you to paste an API key into a password field. The key is sent to the main process once for validation and is never returned in UI state, profile metadata, display schemas, or diagnostics. Limits requests only `GET https://api.deepseek.com/user/balance` with the key in the Authorization header; it does not send model prompts. Successful connections store the key as encrypted bytes in `accounts/<profile-id>/deepseek-key.bin` using Electron safeStorage and the OS credential store. Encryption must be available; the Linux `basic_text` fallback is refused. Cancelled or failed connections do not save a key or add a profile. Disconnecting deletes that profile's local key without revoking it at DeepSeek. Balance snapshots contain only currency, amounts, availability and timestamps; they do not include account-wide spending or token history.

For GLM Coding Plan, Limits sends the pasted key to the main process and uses it only in the Authorization header of requests to `GET https://api.z.ai/api/monitor/usage/quota/limit`. A verified key is stored through the same encrypted OS storage in `accounts/<profile-id>/zai-key.bin`. Disconnecting deletes the local key. The interface receives normalized quota percentages, reset times, plan and connection state.

On macOS, the default profile tracks Codex's current local `CODEX_HOME` without offering login/logout into that source. Connections created in Limits use isolated accounts. Optional external profiles store directory references in `mac-subscriptions.json`, together with the subscription view mode and selected profile. Forgetting an external source does not delete its files or log it out. External account reads do not force refresh-token rotation and reload the managed store on each poll.

On Windows and Linux, the default external profile inherits `CODEX_HOME` from the environment, or uses Codex's default storage. Sign in or out of that source in Codex / VS Code. Limits connects new accounts in isolated homes instead of switching the external profile. Optional external directory references, subscription filters and selection are stored in `subscriptions.json`; forgetting a source does not sign it out or remove its files.

Additional profiles use separate `CODEX_HOME` directories under the app's data directory: `accounts/<profile-id>`. Codex manages their sign-in credentials using its file credential store. Limits does not load OAuth tokens into the renderer. These directories still contain sensitive credential files managed by Codex; do not publish or attach them to issues.

The app data directory is named **Codex Limits** under Electron's platform-specific app data location. Limits stores:

- `accounts.json`: profile identifiers, local names, and the selected profile identifier.
- `widget-settings.json`: display mode, language, widget width, position, and visibility preferences.
- `update-settings.json`: the version whose automatic update offer was dismissed.
- `accounts/<profile-id>/`: isolated Codex storage for added accounts.

Disconnecting an added account calls Codex logout and removes it from the local account registry. It does not promise to erase every file in that profile directory. The shared default account is managed by Codex and cannot be removed through the added-account action.

There is no app-level analytics or telemetry integration in the Limits source. This does not make the app offline: Codex connects to OpenAI for authentication and usage information, and Codex's own network behavior and settings remain its responsibility. This document describes Limits' implementation, not OpenAI's data-retention policy.

Limits also makes anonymous HTTPS requests to `api.github.com` to check public releases at startup, every six hours and on manual checks. These requests contain no account data, OAuth tokens or usage limits. Supported installed builds on Windows, macOS and Linux download release checksums and the matching package over HTTPS from GitHub and its release-asset hosts. macOS uses `mac-updates/` and `mac-update-result.json`; Windows uses `windows-updates/` and `windows-update-result.json`; Linux uses `package-updates/` and `package-update-result.json` inside app storage. Installation preserves account/settings storage. Source and unsupported unpacked runs open the release in the browser for manual installation. Demo and smoke checks simulate this behavior locally.

The RPC client discards the subprocess's stderr instead of forwarding potential account details. Diagnostic output and screenshots should still be reviewed before sharing. Never upload authorization files, OAuth tokens, API keys, or full app data directories.

## Русский

Для DeepSeek Limits открывает `https://platform.deepseek.com/api_keys` в системном браузере и предлагает вставить API-ключ в поле пароля. Ключ передаётся основному процессу для проверки и не возвращается в состоянии интерфейса, метаданных профиля, схемах отображения или диагностике. Limits обращается только к `GET https://api.deepseek.com/user/balance`, передавая ключ в заголовке Authorization; запросы модели не отправляются. После успешной проверки ключ хранится в зашифрованном файле `accounts/<profile-id>/deepseek-key.bin` через Electron safeStorage и хранилище ОС. Без доступного шифрования подключение не сохраняется; резервный режим Linux `basic_text` запрещён. Отмена и ошибка подключения не сохраняют ключ и не добавляют профиль. Отключение удаляет локальный ключ профиля, но не отзывает его в DeepSeek. Состояние баланса содержит только валюту, суммы, доступность и время обновления; история расходов и токенов всего аккаунта не включена.

Для GLM Coding Plan Limits передаёт вставленный ключ основному процессу и использует его только в заголовке Authorization запроса `GET https://api.z.ai/api/monitor/usage/quota/limit`. Проверенный ключ хранится в `accounts/<profile-id>/zai-key.bin` с тем же шифрованием через хранилище ОС. Отключение профиля удаляет локальный ключ. Интерфейс получает проценты остатка квот, время сброса, тариф и состояние подключения.

Limits запускает локальный процесс Codex App Server и общается с ним через стандартный ввод/вывод. Приложение читает аккаунт и лимиты, а для входа, отмены входа и выхода использует операции самого Codex. Чаты и запросы модели не создаются.

Интерфейс получает email, тариф, лимиты, время сброса и состояние подключения. Локальные имена задаются в Limits: ответ аккаунта не содержит отображаемого имени ChatGPT.

На macOS основной профиль отслеживает текущий локальный `CODEX_HOME` без входа/выхода через Limits. Подключение из Limits создаёт отдельный аккаунт. Дополнительные внешние профили сохраняются как ссылки на каталоги в `mac-subscriptions.json` вместе с режимом просмотра и выбранным профилем. Удаление из отслеживания не удаляет файлы и не выполняет выход. Внешний профиль перечитывается при каждом опросе без принудительной ротации refresh-токена.

На Windows и Linux основной внешний профиль использует `CODEX_HOME` из окружения либо стандартное хранилище Codex. Вход и выход в этот источник выполняются в Codex / VS Code. Limits подключает новые аккаунты в отдельных хранилищах, не переключая внешний профиль. Ссылки на дополнительные внешние каталоги, фильтр подписок и выбранный профиль сохраняются в `subscriptions.json`; удаление источника из отслеживания не выполняет выход и не удаляет его файлы.

Добавленные аккаунты используют отдельные каталоги `accounts/<profile-id>` внутри данных приложения. Авторизацией и файлами учётных данных управляет Codex. Limits не загружает OAuth-токены в интерфейс, но в этих каталогах есть чувствительные файлы Codex: не публикуйте их и не прикладывайте к issues.

Каталог данных приложения называется **Codex Limits** и находится в системной папке данных Electron. `accounts.json` хранит идентификаторы профилей, локальные имена и выбранный профиль; `widget-settings.json` — режим, язык, ширину, положение и видимость виджета. Отдельные аккаунты находятся в `accounts/<profile-id>/`.

Файл `update-settings.json` хранит версию, для которой пользователь отложил автоматическое предложение обновиться.

Отключение добавленного аккаунта вызывает выход в Codex и удаляет профиль из реестра Limits. Это не гарантирует удаление всех файлов его каталога. Общим основным аккаунтом управляет Codex.

В исходниках Limits нет собственной интеграции аналитики или телеметрии. Приложение не работает полностью офлайн: Codex подключается к OpenAI для авторизации и чтения лимитов, а его сетевое поведение и настройки определяются самим Codex. Этот документ описывает реализацию Limits, а не политику хранения данных OpenAI.

Limits также отправляет анонимные HTTPS-запросы к `api.github.com` для проверки публичных релизов при запуске, каждые шесть часов и вручную. Запросы не содержат данных аккаунта, OAuth-токенов или лимитов. Поддерживаемые установленные сборки Windows, macOS и Linux скачивают контрольные суммы и подходящий пакет по HTTPS с GitHub и его серверов файлов релизов. Внутри данных приложения macOS использует `mac-updates/` и `mac-update-result.json`, Windows — `windows-updates/` и `windows-update-result.json`, Linux — `package-updates/` и `package-update-result.json`. Обновление сохраняет аккаунты и настройки. Запуск из исходников и неподдерживаемые распакованные сборки открывают релиз в браузере для ручной установки. В demo и smoke проверках это поведение имитируется локально.

RPC-клиент не выводит stderr дочернего процесса, где могут быть данные аккаунта. Перед публикацией всё равно проверьте диагностику и скриншоты. Не передавайте файлы авторизации, токены, API-ключи или весь каталог данных приложения.
