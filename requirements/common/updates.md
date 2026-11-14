# Application updates

Windows, macOS, and Linux share release checks and update controls. Supported packages can be downloaded, verified, and installed from Limits. Source launches and builds without a supported in-app update path open the release page for manual installation.

## Shared service and scheduling

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-UPD-001 | Share release checking and update controls across platforms. | Common code owns release checks, comparison, scheduling, the state contract, and the update UI. The composition root wires IPC and selects the platform updater. Platform features handle package selection, platform validation, and installation. |
| COM-UPD-002 | Check published releases of `PyatkovVK/limits` through the GitHub API. | The service uses HTTPS and public release metadata without a GitHub token or HTML parsing. It selects the newest eligible stable version, excluding drafts, prereleases and unrecognized version tags. |
| COM-UPD-003 | Compare release versions numerically against the running application version. | Tags with an optional `v` prefix and an omitted or zero patch component normalize to the same version. Compare major, minor and patch components numerically, rather than lexicographically. An equal or older release is not offered as an update. |
| COM-UPD-004 | Check for updates at application startup without blocking the interface. | The initial check runs in the background. Opening the application and monitoring limits do not wait for GitHub to respond. |
| COM-UPD-005 | Check every six hours while the application is running. | The shared service schedules recurring checks even when the details window is hidden. Quitting stops its timers and pending work. |
| COM-UPD-006 | Check after waking when the scheduled check is overdue. | Resume triggers a check if the six-hour deadline has passed. Missed intervals do not produce a burst of requests. |
| COM-UPD-007 | Share an in-flight check between automatic and manual callers. | Clicking the check button during a startup, scheduled or resume check uses the same pending request. Concurrent triggers do not start duplicate requests. |

## Interface and release action

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-UPD-008 | Add an Updates section to the shared Settings dialog. | The section shows the current application version, the result and the time of the last completed check. The Check button stays in the right-hand control column while its accompanying text wraps on the left. The button uses the same styling as other Settings actions. The section is available on every supported platform, including the expanded macOS notch. |
| COM-UPD-009 | Show clear update-check states in Russian and English. | The interface distinguishes checking, current version, update available and check failed. Labels and messages follow the selected language; the available version is shown when an update is found. |
| COM-UPD-010 | Offer a newly discovered version in a modal dialog. | The dialog shows the available version, the action for the current update stage, and “Later”. Dismissing the offer suppresses repeat automatic offers for that version. The update remains accessible from Settings. |
| COM-UPD-011 | Offer an update action appropriate to the running build. | Supported packages expose **Download update** and a separate installation action after verification. Build types without in-app installation open the specific HTTPS release page validated against `github.com/PyatkovVK/limits`. A supported build that fails a location or package check shows the corresponding error. |
| COM-UPD-012 | Keep update actions consistent with existing window and modal rules. | The section and offer remain readable and reachable on small screens and custom backgrounds. The offer does not stack over another active modal; dismissal and Escape respect the host window's behavior. |

## Package download and installation

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-UPD-017 | Download only after the user requests it. | Settings and the offer show download and verification progress. Checking for a release or choosing “Later” leaves package downloads untouched. Failed downloads can be retried explicitly. |
| COM-UPD-018 | Verify the package before offering installation. | The package matches the selected stable release, platform, architecture, and installation type. Its SHA-256 matches the entry in the release's `SHA256SUMS.txt`, and it passes applicable platform package checks. Failed verification prevents installation. |
| COM-UPD-019 | Install and restart only after explicit confirmation. | Settings offers **Update** and the dialog offers **Install and restart** after verification. The platform installer runs after Limits exits and preserves accounts and settings. Installation failures are reported, including on the next launch if the failure happens after exit. |

| Running build | Update package and installation requirement |
| --- | --- |
| Windows x64 portable | Portable EXE. Verify the PE format and apply the Windows publisher check. Replace from a writable location and restore the original if replacement or launch fails. |
| Windows x64 per-user installation | NSIS EXE. Verify the PE format and apply the Windows publisher check. Update the existing installation and restart. |
| macOS Apple Silicon or Intel | Matching ZIP. Verify the bundle and its signature, replace the app in a writable Applications folder, and restore the previous bundle if replacement or launch fails. Builds running from a DMG prompt the user to move the app to Applications. |
| Linux AppImage | Matching AppImage for the installed architecture when published. Verify format and architecture, replace the writable AppImage, and restore it if replacement or launch fails. |
| Linux installed DEB | Matching DEB. Verify package name, version, and architecture. Request system authorization through the package installer when the user starts installation. |

The Windows publisher check requires the update package to match the existing publisher certificate when the running executable has a valid signature. The [in-app update guide](../../docs/in-app-updates.md) documents platform prerequisites and native verification.

## Failures, isolation and verification

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-UPD-013 | Handle network failures without disrupting the application. | Requests have a finite timeout. Offline operation, GitHub rate limits, invalid responses and missing eligible releases do not crash the application or prevent monitoring. Background errors do not open error dialogs; manual checks explain a failure and allow another attempt. A failed check is not reported as proof that the installed version is current. |
| COM-UPD-014 | Run update actions through trusted main-process IPC. | Existing trusted-window checks apply to release checks, downloads, installation and release opening. The sandboxed renderer leaves GitHub requests to the main process. Requests contain no account credentials or limit data. |
| COM-UPD-015 | Use simulated update responses in demo and smoke modes. | UI checks can demonstrate checking, available, ready and failed states without GitHub requests, launching an installer, or opening an external browser. Real profiles are unaffected. |
| COM-UPD-016 | Verify update behavior and document it before release. | Tests cover comparison, stable-release selection, scheduling, concurrent checks, offer deduplication, URL validation, package selection, verification and installation failures. Run the shared suite and affected platform checks. Keep English and Russian README instructions aligned and record implemented behavior in CHANGELOG. |
