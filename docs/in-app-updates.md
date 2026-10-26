# In-app updates — 1.5

Limits checks stable public GitHub Releases at startup, every six hours and after overdue wake-up. The existing Actions publication job uploads the platform packages and SHA256SUMS.txt; main/demo artifacts remain inspection builds rather than an update channel. No GitHub token is required. Private/temporary Actions downloads are deliberately not an update source.

Matching packages download automatically in installed builds. Download progress, verification, retry and Install and restart appear in Settings → Updates and the offer dialog. A checksum mismatch prevents installation. Account homes and settings are separate from application files and remain in place. Source/unpacked builds keep the manual release action.

| Installation | Package | Installation action |
| --- | --- | --- |
| Windows x64 portable | portable EXE | Wait for Limits to exit, stage beside the original, replace and restart; restore the original if replacement or launch fails. |
| Windows x64 per-user installation | NSIS setup EXE | Wait for exit, run the installer silently in the existing installation directory, then restart. |
| macOS arm64/x64 in writable Applications | ZIP | Existing bundle identity, architecture, version, signature checks and bundle replacement/restore. |
| Linux x64/arm64 AppImage | matching AppImage | Require a writable real file and parent directory; verify ELF/AppImage format and architecture; stage on the same filesystem and restore the original on replacement/launch failure. |
| Linux installed DEB | matching DEB | Check Package, Version and Architecture with dpkg-deb; use pkexec/dpkg after exit and restart as the desktop user. System authorization is requested on installation. |

Windows packages must be PE executables. If the running app has a valid Authenticode signature, the package must have the same publisher certificate. Unsigned current releases use the published checksum, consistent with the existing unsigned release policy. NSIS/DEB use their native installers; executable rollback applies to portable Windows and AppImage installs. Installation failure is reported on the next launch. An unwritable location or missing dpkg/pkexec prevents installation and explains how to proceed.

Linux AppImage helper processes preserve the desktop/session environment and strip AppImage library overrides before launching external programs. The main UI does not need administrator rights. The standard Actions release matrix publishes Linux x64; arm64 updating requires a maintainer-published matching package and checksum.

Validation uses mocked public release downloads with no credentials, corrupted payloads, both Windows package selections, AppImage/DEB format checks, cancellation, persistence and demo UI. Native helper tests exercise AppImage replacement/restore on Linux and portable replacement/restore on Windows. The Windows native test runs only on Windows; macOS retains its native bundle helper test. NSIS/DEB authorization and a full update between published versions still require acceptance on installed target systems.
