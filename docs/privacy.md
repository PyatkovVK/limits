# Data storage and privacy / Хранение данных

## English

Limits starts a local Codex App Server subprocess and communicates with it over standard input/output. It requests account details and usage limits, and uses Codex's sign-in, cancellation, and logout operations for account management. The app does not create chats or send prompts to a model.

The UI receives email, subscription plan, usage limits, reset timestamps, and connection state. Local names are chosen in Limits because the account response does not provide a ChatGPT display name.

The default profile inherits `CODEX_HOME` from the environment, or uses Codex's default storage. That storage is shared with Codex CLI. Signing in to a different default account affects the CLI if it uses the same home directory.

Additional profiles use separate `CODEX_HOME` directories under the app's data directory: `accounts/<profile-id>`. Codex manages their sign-in credentials using its file credential store. Limits does not load OAuth tokens into the renderer. These directories still contain sensitive credential files managed by Codex; do not publish or attach them to issues.

The app data directory is named **Codex Limits** under Electron's platform-specific app data location. Limits stores:

- `accounts.json`: profile identifiers, local names, and the selected profile identifier.
- `widget-settings.json`: display mode, language, widget width, position, and visibility preferences.
- `update-settings.json`: the version whose automatic update offer was dismissed.
- `accounts/<profile-id>/`: isolated Codex storage for added accounts.

Disconnecting an added account calls Codex logout and removes it from the local account registry. It does not promise to erase every file in that profile directory. The shared default account is managed by Codex and cannot be removed through the added-account action.

There is no app-level analytics or telemetry integration in the Limits source. This does not make the app offline: Codex connects to OpenAI for authentication and usage information, and Codex's own network behavior and settings remain its responsibility. This document describes Limits' implementation, not OpenAI's data-retention policy.

Limits also makes anonymous HTTPS requests to `api.github.com` to check public releases at startup, every six hours and on manual checks. These requests contain no account data, OAuth tokens or usage limits. The Update action opens the selected release on `github.com` in the default browser. Demo and smoke checks simulate this behavior locally.

The RPC client discards the subprocess's stderr instead of forwarding potential account details. Diagnostic output and screenshots should still be reviewed before sharing. Never upload authorization files, OAuth tokens, API keys, or full app data directories.

## Русский

Limits запускает локальный процесс Codex App Server и общается с ним через стандартный ввод/вывод. Приложение читает аккаунт и лимиты, а для входа, отмены входа и выхода использует операции самого Codex. Чаты и запросы модели не создаются.

Интерфейс получает email, тариф, лимиты, время сброса и состояние подключения. Локальные имена задаются в Limits: ответ аккаунта не содержит отображаемого имени ChatGPT.

Основной профиль использует `CODEX_HOME` из окружения либо стандартное хранилище Codex. Если CLI использует то же хранилище, смена основного аккаунта влияет и на его авторизацию.

Добавленные аккаунты используют отдельные каталоги `accounts/<profile-id>` внутри данных приложения. Авторизацией и файлами учётных данных управляет Codex. Limits не загружает OAuth-токены в интерфейс, но в этих каталогах есть чувствительные файлы Codex: не публикуйте их и не прикладывайте к issues.

Каталог данных приложения называется **Codex Limits** и находится в системной папке данных Electron. `accounts.json` хранит идентификаторы профилей, локальные имена и выбранный профиль; `widget-settings.json` — режим, язык, ширину, положение и видимость виджета. Отдельные аккаунты находятся в `accounts/<profile-id>/`.

Файл `update-settings.json` хранит версию, для которой пользователь отложил автоматическое предложение обновиться.

Отключение добавленного аккаунта вызывает выход в Codex и удаляет профиль из реестра Limits. Это не гарантирует удаление всех файлов его каталога. Общим основным аккаунтом управляет Codex.

В исходниках Limits нет собственной интеграции аналитики или телеметрии. Приложение не работает полностью офлайн: Codex подключается к OpenAI для авторизации и чтения лимитов, а его сетевое поведение и настройки определяются самим Codex. Этот документ описывает реализацию Limits, а не политику хранения данных OpenAI.

Limits также отправляет анонимные HTTPS-запросы к `api.github.com` для проверки публичных релизов при запуске, каждые шесть часов и вручную. Запросы не содержат данных аккаунта, OAuth-токенов или лимитов. Кнопка «Обновить» открывает выбранный релиз на `github.com` в стандартном браузере. В demo и smoke проверках это поведение имитируется локально.

RPC-клиент не выводит stderr дочернего процесса, где могут быть данные аккаунта. Перед публикацией всё равно проверьте диагностику и скриншоты. Не передавайте файлы авторизации, токены, API-ключи или весь каталог данных приложения.
