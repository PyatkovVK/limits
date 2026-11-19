# In-app updates

Limits checks stable public GitHub Releases at startup, every six hours and after overdue wake-up. The Actions publication job uploads platform packages and SHA256SUMS.txt from numeric release branches. Ordinary branch artifacts are inspection builds; main/demo branches run only tests. No GitHub token is required. Private/temporary Actions downloads are deliberately not an update source.

Limits offers a new version first. For installations with in-app updates, matching packages download only after choosing **Download update** in Settings → Updates or the offer dialog. Postponing or checking again does not download a package or retry a failed download. Both places show download progress, verification and retry. Once the package is verified, choose **Update** in Settings or **Install and restart** in the offer dialog. A checksum mismatch prevents installation. Account homes and settings are separate from application files and remain in place. Linux DEB installations and source or unpacked builds open the release page for manual updates.

| Installation | Package | Installation action |
| --- | --- | --- |
| Windows x64 portable | portable EXE | Wait for Limits to exit, stage beside the original, replace and restart; restore the original if replacement or launch fails. |
| Windows x64 per-user installation | NSIS setup EXE | Wait for exit, run the installer silently in the existing installation directory, then restart. |
| macOS arm64/x64 in writable `/Applications` or `~/Applications` | Matching ZIP | Verify the bundle, wait for Limits to exit, replace `Limits.app` and restart. Restore the previous bundle if replacement or launch fails. |
| Linux x64/arm64 AppImage | matching AppImage | Require a writable real file and parent directory; verify ELF/AppImage format and architecture; stage on the same filesystem and restore the original on replacement/launch failure. |
| Linux installed DEB | matching DEB | Choose **Open release** in Settings → Updates, then download the matching DEB and install it manually using your distribution's package manager. |

Windows packages must be PE executables. If the running app has a valid Authenticode signature, the package must have the same publisher certificate. Unsigned current releases use the published checksum, consistent with the existing unsigned release policy. The Windows setup EXE uses NSIS. Executable rollback applies to portable Windows and AppImage installs. Limits reports installation failures on the next launch and explains when an unwritable location prevents an in-app update.

On macOS, move Limits to Applications before updating if it is running from a DMG. The updater validates archive paths before extraction and verifies the bundle ID, version, architecture and code signature. Developer ID builds must keep the same signing team. Ad hoc signed builds are also supported.

Linux AppImage helper processes preserve the desktop/session environment and strip AppImage library overrides before launching external programs. The main UI does not need administrator rights. The standard Actions release matrix publishes Linux x64; arm64 updating requires a maintainer-published matching package and checksum.

Validation covers mocked public release downloads with no credentials, corrupted payloads, both Windows package selections, AppImage format checks, the DEB release-page action, cancellation, persistence and demo UI. Native helper tests exercise AppImage replacement and restoration on Linux, portable executable replacement and restoration on Windows, and bundle replacement and restoration on macOS. A full update between published versions still requires acceptance on installed target systems.
