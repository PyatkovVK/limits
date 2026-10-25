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
| macOS, Apple Silicon | `Limits-*-arm64.dmg` or `Limits-*-arm64.zip` | Connection component included |
| macOS, Intel | `Limits-*-x64.dmg` or `Limits-*-x64.zip` | Connection component included |
| Linux, x64 | `Limits-*-x86_64.AppImage` or `Limits-*-amd64.deb` | Connection component included |

**Windows:** run the per-user installer or launch the portable EXE. No separate Codex installation is needed. Tray icons may initially appear under the arrow near the clock; drag them into the visible area if desired.

**macOS:** open the DMG and drag Limits into **Applications**, or extract the ZIP and move the app there. If macOS says the developer cannot be verified, follow the [first-launch guide](#macos-first-launch) below. The connection component is included; Codex does not need to be installed or kept open.

**Linux:** make the downloaded AppImage executable in your file manager's permissions and open it. Alternatively, install the DEB on a compatible distribution. The connection component is included; a separate Codex installation is not required. Source builds can use an installed CLI; see [configuration](docs/development.md#configuration).

**Platform notes:** Linux Mint 22.2 Zara, XFCE 4.18, X11, x64 is the tested Linux environment. Other desktops need testing; tray behavior varies. Linux autostart is not implemented.

<a id="macos-first-launch"></a>

### macOS: allow the first launch

I maintain Limits independently and currently cannot afford the [Apple Developer Program membership](https://developer.apple.com/programs/) ($99 per year). The current macOS downloads are not signed with a Developer ID certificate or notarized by Apple, so macOS may block the first launch with an unidentified-developer warning.

If you downloaded Limits from this project's [GitHub Releases](https://github.com/PyatkovVK/limits/releases) and trust the app, allow it through System Settings:

1. Open **Limits** from **Applications**. If macOS blocks it, dismiss the warning with **Done** or **Cancel**, keeping the app.
2. Open **Apple menu → System Settings → Privacy & Security**.
3. Scroll down to **Security**. Find the message about Limits being blocked and click **Open Anyway**. This option appears after an attempt to open the app.
4. Authenticate if macOS asks, then click **Open** in the confirmation dialog.

macOS remembers this exception for the app, so subsequent launches can use a normal double-click. See [Apple's first-launch instructions](https://support.apple.com/en-us/102445).

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

In **Settings → Tray icons**, choose quota-period labels with remaining-usage bars or the classic percentage badges. The classic style remains the default, and your selection is saved.

### Windows — taskbar or tray

If the details panel is open, it follows the widget as you drag it along the taskbar and stays within the screen. Moving the widget keeps a dismissed panel closed.

The widget and account panel are shown above. Switch between a taskbar widget and two tray icons in **Settings**. Drag any part of the widget, including labels, bars and percentages, to move it; a regular click on the limits opens details. Choose **240 / 280 / 320 / 400 px** widths in **Settings → Windows widget**. Drag the details title bar to keep a preferred position across openings and restarts. The details panel fits its content and resizes when Settings opens or closes. Reset labels show the local clock time and include the date for other days; hover for the full date. The widget hides for full-screen apps and recovers after the taskbar restarts. At **10% or less**, a Windows notification appears once per usage window. Autostart is available for the installed version.

When the area beside the tray is crowded, the widget automatically shrinks to fit, down to 200 px, or moves to a free area on the left without covering taskbar buttons. The preferred width returns when more space becomes available.

![Compact Windows taskbar widget at 200 px with demo data](docs/screenshots/windows-widget-compact.png)

## Everyday use

- Click the widget or an indicator to open details, view accounts, and refresh usage.
- Add an account from **Accounts**, complete browser sign-in, give it a local name, and select it for the compact display.
- Open **Settings** to change the language, display mode, account settings, widget size, or supported autostart options. The tray menu also opens Settings.
- Closing the details panel keeps Limits running. Choose **Quit application** to exit; quit the old version before launching an update.

## Application updates

Limits checks stable releases on GitHub in the background at startup and every six hours. After waking, it checks if the scheduled time has passed. Open **Settings → Updates → Check for updates** for a manual check, the installed version and the last check result.

**macOS (1.5):** installed copies in `/Applications` or `~/Applications` automatically download the matching Apple Silicon or Intel ZIP from stable GitHub Releases published by Actions. Limits verifies the published SHA-256 checksum, app identity, version, architecture and code signature before offering **Install and restart**. Installation preserves the previous app if replacement or launching fails. The app folder must be writable by your user; move the app out of the DMG before updating. No GitHub account or token is needed. Builds kept only in Actions artifacts, including demo builds, are not update releases.

**Windows:** installed and portable x64 builds download their matching update automatically from Actions-published stable GitHub Releases. Packages are checked against SHA256SUMS.txt and product/version metadata; signed installations also require a valid matching publisher. Choose **Install and restart** when ready. Portable updates replace the original executable and keep a backup until relaunch. Accounts and settings are retained. The app reports download, verification and installation errors and allows retries.

**Linux:** Linux also downloads stable update packages automatically and verifies SHA-256 before offering Install and restart. Writable AppImages update in place; installed DEBs use dpkg/pkexec and ask for system authorization only when installing. Accounts and settings remain in place. See [platform installation details](docs/in-app-updates.md). Source/unpacked builds retain manual installation.

Demo mode simulates update checks without contacting GitHub or opening a browser; **Demo result** in Updates lets you preview current, available and failed states.

## Data and sign-in

Limits starts a local **Codex App Server** process and reads account and usage information. It does not create chats or send model prompts. ChatGPT sign-in is required; API-key authentication does not expose these subscription limits. Limits monitors Codex allowances, rather than all ChatGPT model message limits.

**macOS (1.5):** Settings → Subscriptions distinguishes **Connected in Limits** from **In Codex / VS Code**; **All** shows both. The current local Codex account is tracked from `CODEX_HOME` (normally `~/.codex`) and is reloaded on each poll. Sign in or out of that profile in Codex / VS Code. Connecting from Limits creates an isolated account and does not switch the external profile. Use **Add Codex profile** to select another local `CODEX_HOME` if your clients use different stores. Forgetting it stops tracking without logging it out. These are locally saved sign-ins, not proof of which account an individual running chat uses; remote VS Code and memory-only sessions are not discovered. Details: [macOS subscriptions](docs/macos-accounts.md).

On Windows and Linux, choose All, Connected in Limits, or In Codex / VS Code to view subscriptions. The default local Codex home is tracked automatically; add another CODEX_HOME folder to track a separate local profile. External profiles reload sign-in changes on polling; sign in or out in Codex / VS Code. Removing a source only stops tracking it. Accounts added in Limits use separate storage managed by Codex. The app does not read OAuth tokens into its UI.

Limits has no app-level analytics or telemetry integration in its source. Codex connects to OpenAI services for sign-in and usage data; its behavior is managed by Codex. See [data storage and privacy](docs/privacy.md).

**Limits is an independent community project and is not affiliated with or endorsed by OpenAI.**

## Backgrounds

Use **Background** to choose the platform default, a solid color, or a local PNG/JPG image. It applies to the details panel and Windows widget. Images are copied into the app profile and remain available if the original file is moved.

## Help and contribute

[Report a bug or suggest a feature](https://github.com/PyatkovVK/limits/issues/new/choose). Include your OS, app version, and steps to reproduce; hide personal information in screenshots.

Translations, documentation improvements, and platform testing are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), the [development guide](docs/development.md), and issues labeled [good first issue](https://github.com/PyatkovVK/limits/labels/good%20first%20issue). Please follow the [code of conduct](CODE_OF_CONDUCT.md).

See [CHANGELOG.md](CHANGELOG.md) for release features. Limits uses the [MIT license](LICENSE); bundled dependencies have their own [third-party notices](THIRD-PARTY-NOTICES.md).

## Roadmap

These are ideas for future work, not current features:

- Claude Code integration, subject to availability of a suitable usage data source.
- DeepSeek integration, subject to availability of a suitable usage data source.
- Configurable low-usage and approaching-reset notifications.
- Broader Linux desktop support and Linux autostart.
- Try to connect send notify about Codex reset.

Tell us which feature would help you in a [feature request](https://github.com/PyatkovVK/limits/issues/new/choose).

On Linux, Settings → Subscriptions also distinguishes accounts connected in Limits from current local Codex / VS Code profiles. Choose All, Connected in Limits, or In Codex / VS Code; add other CODEX_HOME folders to monitor multiple local sign-ins. Removing an external source never signs it out.
On Linux and macOS, drag the details title bar to keep a custom position across openings and restarts. The panel is kept inside the available screen after monitor changes.
Linux also supports a separate compact widget with two quota bars. Select Widget in Settings, drag its account label to move it, and click the bars to open details. Width, visibility and position persist. It is a floating desktop window; placement is controlled by the compositor on Wayland. Tray mode remains available.
