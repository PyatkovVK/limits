# Linux: installation and environment

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| LIN-INST-001 | Distribute AppImage and DEB packages for Linux x64. | AppImage runs after executable permission is granted; DEB installs on a compatible Debian-based environment and contains required package metadata. |
| LIN-INST-002 | Use gzip compression for AppImage under the current project decision. | Packaging does not revert to maximum XZ compression, which caused slow startup in the verified environment. |
| LIN-INST-003 | Support local x64/arm64 selection without promising both in the release matrix. | `build:linux -- --arm64` is allowed in a suitable environment; the standard published set contains Linux x64. |
| LIN-INST-006 | Include the native Codex connection component in Linux packages. | AppImage/DEB do not require a separately installed Codex desktop app, CLI, VS Code, Node.js, or npm. Packaging selects the pinned Linux executable for the target x64/arm64 architecture, includes its Apache license, and fails if the executable is missing or lacks execute permission. |
| LIN-INST-007 | Open browser sign-in from the Linux desktop and packaged AppImage. | Launch the validated HTTPS sign-in URL through the user's default browser using `xdg-open`, with `gio open` as the fallback on failure. Pass the URL as a separate argument, preserve display/Wayland/DBus session settings, and remove AppImage-private library/helper paths or restore their original values in a copied environment. Do not alter the running application's environment. |
| LIN-INST-008 | Recover from an unavailable browser launcher. | Launcher failures/timeouts produce a safe sign-in error and cancel the affected attempt so retry is possible. Launcher output containing OAuth URLs or account data is not exposed in diagnostics. Browser-launch attempts have a finite timeout. |

## Limitations

- LIN-INST-004: Linux startup is not implemented yet. Settings must not show a switch that looks functional but does nothing; further development is planned.
- LIN-INST-005: the confirmed graphical environment is Linux Mint 22.2 Zara / XFCE 4.18 / X11 / x64. Other desktop environments require separate verification.
