# Linux: installation and environment

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| LIN-INST-001 | Distribute AppImage and DEB packages for Linux x64. | AppImage runs after executable permission is granted; DEB installs on a compatible Debian-based environment and contains required package metadata. |
| LIN-INST-002 | Use gzip compression for AppImage under the current project decision. | Packaging does not revert to maximum XZ compression, which caused slow startup in the verified environment. |
| LIN-INST-003 | Support local x64/arm64 selection without promising both in the release matrix. | `build:linux -- --arm64` is allowed in a suitable environment; the standard published set contains Linux x64. |

## Limitations

- LIN-INST-004: Linux startup is not implemented yet. Settings must not show a switch that looks functional but does nothing; further development is planned.
- LIN-INST-005: the confirmed graphical environment is Linux Mint 22.2 Zara / XFCE 4.18 / X11 / x64. Other desktop environments require separate verification.
