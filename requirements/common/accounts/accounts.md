# Accounts

Windows, macOS, and Linux share account management in **Settings → Subscriptions**. The filters are **All**, **Connected in Limits**, and **In Codex / VS Code**. The selected profile supplies usage data to the active compact display.

| Platform | Compact display | Subscription preferences in Electron `userData` |
| --- | --- | --- |
| [Windows](../../windows/windows.md) | Taskbar widget or system tray | `subscriptions.json` |
| [macOS](../../macos/macos.md) | Menu bar or MacBook notch | `mac-subscriptions.json` |
| [Linux](../../linux/linux.md) | System tray | `subscriptions.json` |

On all three platforms, Limits stores profile identifiers, local names, provider IDs, and the selected profile in `accounts.json` under Electron's `userData`. Each connected profile has its own `accounts/<profile-id>/` directory. The default external Codex profile reads the local `CODEX_HOME` through Codex App Server, with `~/.codex` as the fallback. Sign-in and sign-out for that profile are managed in Codex or VS Code.

The [shared controller contract and provider list](../ai-connects.md) cover Codex, DeepSeek, Z.ai (GLM Coding Plan), Claude Code, and Kimi Code. See [Codex account sources and authentication](../providers/codex.md) and [local storage and privacy](../privacy.md#connection-and-local-storage).
