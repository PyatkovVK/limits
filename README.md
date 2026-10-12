<p align="center">
  <img src="docs/images/icon.png" width="80" alt="Limits icon">
</p>

<h1 align="center">Limits</h1>

<p align="center"><strong>Keep your Codex limits in sight.</strong><br>
Remaining usage, reset timers, and multiple accounts — right in your taskbar, menu bar, or system tray.</p>

<p align="center">
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-555" alt="Windows, macOS, and Linux">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://github.com/PyatkovVK/limits/releases"><strong>Download from Releases</strong></a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="https://github.com/PyatkovVK/limits/issues/new/choose">Report a bug</a> ·
  <a href="README.ru.md">Русский</a>
</p>

**Limits** is a desktop app for monitoring **Codex usage limits included in your ChatGPT subscription**. Check your remaining five-hour and weekly allowances before starting your next task, without opening Codex.

<p align="center">
  <img src="docs/screenshots/windows-accounts.png" width="440" alt="Windows account panel with demo accounts and remaining usage">
  <br><br>
  <img src="docs/screenshots/windows-widget.png" width="280" alt="Windows taskbar widget with demo usage and a reset timer">
</p>

*Windows and macOS screenshots use demo data. The macOS desktop background and menu bar are recreated for publication.*

## Features

- **Two usage windows:** remaining five-hour and weekly allowances, with reset information.
- **Multiple accounts:** separate usage data, local names, and a selected account for your compact indicators.
- **Automatic refresh:** polling about 30 seconds after each completed request, refresh after waking from sleep, and a manual refresh button.
- **Clear status:** low allowances are highlighted; unavailable values show a dash, and stale data is dimmed.
- **Platform-specific controls:** Windows taskbar widget or tray icons, macOS menu bar or compatible MacBook notch, and Linux tray icons.
- **English and Russian UI:** language and display preferences persist across launches.

## Download and install

1. Open [GitHub Releases](https://github.com/PyatkovVK/limits/releases) and expand **Assets** for the release you want.
2. Download a package for your OS and processor using the table below.
3. Launch Limits. If you are not already signed in to Codex, choose **Sign in with ChatGPT** and complete sign-in in your browser.

Ready-to-use packages include Electron and do not require Node.js.

| System | Choose in Assets | Codex requirement |
| --- | --- | --- |
| Windows 10 / 11, x64 | `Limits-Setup-*.exe` to install; `Limits-*-portable.exe` without installation | Connection component included |
| macOS, Apple Silicon | `Limits-*-arm64.dmg` or `Limits-*-arm64.zip` | Installed Codex app or native Codex CLI |
| macOS, Intel | `Limits-*-x64.dmg` or `Limits-*-x64.zip` | Installed Codex app or native Codex CLI |
| Linux, x64 | `Limits-*-x86_64.AppImage` or `Limits-*-amd64.deb` | Native Codex CLI accessible to the app |

**Windows:** run the per-user installer or launch the portable EXE. No separate Codex installation is needed. Tray icons may initially appear under the arrow near the clock; drag them into the visible area if desired.

**macOS:** open the DMG and drag Limits into **Applications**, or extract the ZIP and move the app there. Limits searches for Codex in Codex.app / ChatGPT.app, Homebrew, nvm, and user directories.

**Linux:** make the downloaded AppImage executable in your file manager's permissions and open it. Alternatively, install the DEB on a compatible distribution. Codex must be in the app's `PATH`; see [configuration](docs/development.md#configuration) to specify its location manually.

**Platform notes:** Linux Mint 22.2 Zara, XFCE 4.18, X11, x64 is the tested Linux environment. Other desktops need testing; tray behavior varies. Linux autostart is not implemented.

## Screenshots

### macOS — menu bar and notch

![Limits in the macOS menu bar with a light details panel](docs/screenshots/apple-menu-bar-light.png)

Two indicators, **5h** and **7d**, show remaining usage, with a reset timer beside **5h**. The panel supports light and dark themes, Retina, and native background blur. On a MacBook with a physical notch, hover for a compact view or click for the full panel. Packaged apps support autostart.

<details>
<summary>Dark theme and MacBook notch</summary>

![Dark macOS details panel](docs/screenshots/apple-menu-bar-dark.png)

![Compact usage view on notch hover](docs/screenshots/apple-notch-hover.png)

![Expanded MacBook notch panel](docs/screenshots/apple-notch-expanded.png)

The notch mode uses the compatible MacBook screen, including when an external display is attached. It is hidden on Macs without a physical notch. Esc or loss of focus collapses the panel. Reduced motion and transparency settings are respected.

</details>

### Linux — system tray

![Five-hour and weekly usage indicators in the Linux system tray](docs/screenshots/linux-tray.jpg)

The turquoise **5h** and purple **7d** indicators show remaining usage with numbers and short bars. Tooltips expose account details and reset information where supported by the desktop environment. The details panel adapts to its contents and scrolls for long account lists.

### Windows — taskbar or tray

The widget and account panel are shown above. Switch between a taskbar widget and two tray icons in the display menu. Drag the account area to move the widget; choose **240 / 280 / 320 / 400 px** widths in its context menu. It hides for full-screen apps and recovers after the taskbar restarts. At **10% or less**, a Windows notification appears once per usage window. Autostart is available for the installed version.

When the area beside the tray is crowded, the widget automatically shrinks to fit, down to 200 px, or moves to a free area on the left without covering taskbar buttons. The preferred width returns when more space becomes available. Text in the widget and details panel cannot be selected; account name fields remain editable.

## Everyday use

- Click the widget or an indicator to open details, view accounts, and refresh usage.
- Add an account from **Accounts**, complete browser sign-in, give it a local name, and select it for the compact display.
- Change the language and available display mode in the details panel or context menu.
- Closing the details panel keeps Limits running. Choose **Quit application** to exit; quit the old version before launching an update.

## Data and sign-in

Limits starts a local **Codex App Server** process and reads account and usage information. It does not create chats or send model prompts. ChatGPT sign-in is required; API-key authentication does not expose these subscription limits. Limits monitors Codex allowances, rather than all ChatGPT model message limits.

The default account shares Codex's `CODEX_HOME`. Signing in to a different default account also changes the account used by Codex CLI with that same storage. Accounts added in Limits use separate storage managed by Codex. The app does not read OAuth tokens into its UI.

Limits has no app-level analytics or telemetry integration in its source. Codex connects to OpenAI services for sign-in and usage data; its behavior is managed by Codex. See [data storage and privacy](docs/privacy.md).

**Limits is an independent community project and is not affiliated with or endorsed by OpenAI.**

## Help and contribute

[Report a bug or suggest a feature](https://github.com/PyatkovVK/limits/issues/new/choose). Include your OS, app version, and steps to reproduce; hide personal information in screenshots.

Translations, documentation improvements, and platform testing are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), the [development guide](docs/development.md), and issues labeled [good first issue](https://github.com/PyatkovVK/limits/labels/good%20first%20issue). Please follow the [code of conduct](CODE_OF_CONDUCT.md).

See [CHANGELOG.md](CHANGELOG.md) for release features. Limits uses the [MIT license](LICENSE); bundled dependencies have their own [third-party notices](THIRD-PARTY-NOTICES.md).

## Roadmap

These are ideas for future work, not current features:

- Claude Code integration, subject to availability of a suitable usage data source.
- DeepSeek integration, subject to availability of a suitable usage data source.
- Automatic updates, with a modal dialog offering to install a new version when one is available.
- Configurable low-usage and approaching-reset notifications.
- Broader Linux desktop support and Linux autostart.
- Try to connect send notify about Codex reset.

Tell us which feature would help you in a [feature request](https://github.com/PyatkovVK/limits/issues/new/choose).
