# Application update checks — 1.3

These are the agreed requirements for version 1.3 (`1.3.0` in the application). Implementation uses a task branch with the `limits/` prefix and no digits, such as `limits/auto-updates`. Pull requests target `1.3-demo`, forked from the previous version's `1.1.1` branch.

Update checking is shared by Windows, macOS and Linux. The application offers a newer release and opens its GitHub page; the user downloads and installs the appropriate package manually.

## Shared service and scheduling

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-UPD-001 | Keep update behavior in `src/common`. | Release requests, version comparison, scheduling, update state, IPC and shared UI are implemented in common. Platform interfaces use the same service and do not duplicate update logic. |
| COM-UPD-002 | Check published releases of `PyatkovVK/limits` through the GitHub API. | The service uses HTTPS and public release metadata without a GitHub token or HTML parsing. It selects the newest eligible stable version, excluding drafts, prereleases and unrecognized version tags. |
| COM-UPD-003 | Compare release versions numerically against the running application version. | Tags such as `v1.3` and `v1.3.0` are equivalent to `1.3.0`; `1.10.0` is newer than `1.9.0`. An equal or older release is not offered as an update. |
| COM-UPD-004 | Check for updates at application startup without blocking the interface. | The initial check runs in the background. Opening the application and monitoring limits do not wait for GitHub to respond. |
| COM-UPD-005 | Check every six hours while the application is running. | The shared service schedules recurring checks even when the details window is hidden. Quitting stops its timers and pending work. |
| COM-UPD-006 | Check after waking when the scheduled check is overdue. | Resume triggers a check if the six-hour deadline has passed. Missed intervals do not produce a burst of requests. |
| COM-UPD-007 | Share an in-flight check between automatic and manual callers. | Clicking the check button during a startup, scheduled or resume check uses the same pending request. Concurrent triggers do not start duplicate requests. |

## Interface and release action

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-UPD-008 | Add an Updates section to the shared Settings dialog. | The section shows the current application version, a “Check for updates” button, the result and the time of the last completed check. It is available on every supported platform, including the expanded macOS notch. |
| COM-UPD-009 | Show clear update-check states in Russian and English. | The interface distinguishes checking, current version, update available and check failed. Labels and messages follow the selected language; the available version is shown when an update is found. |
| COM-UPD-010 | Offer a newly discovered version in a modal dialog. | The dialog shows the newer version and “Update” / “Later” actions. Dismissing an offer prevents recurring automatic checks from reopening the same offer; a newer version may be offered again. The discovered update remains accessible from Settings. |
| COM-UPD-011 | Open the discovered release page when the user chooses “Update”. | The action opens the specific release's HTTPS page in the default browser. The destination is validated as a release page belonging to `github.com/PyatkovVK/limits`. The application does not download, replace or install itself, or restart for an update. |
| COM-UPD-012 | Keep update actions consistent with existing window and modal rules. | The section and offer remain readable and reachable on small screens and custom backgrounds. The offer does not stack over another active modal; dismissal and Escape respect the host window's behavior. |

## Failures, isolation and verification

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-UPD-013 | Handle network failures without disrupting the application. | Requests have a finite timeout. Offline operation, GitHub rate limits, invalid responses and missing eligible releases do not crash the application or prevent monitoring. Background errors do not open error dialogs; manual checks explain a failure and allow another attempt. A failed check is not reported as proof that the installed version is current. |
| COM-UPD-014 | Run network and release-opening actions through trusted common IPC. | The sandboxed renderer does not contact GitHub directly. Existing trusted-window checks apply to update commands. Requests contain no account credentials or limit data. |
| COM-UPD-015 | Use simulated update responses in demo and smoke modes. | UI checks can demonstrate current, available, checking and failed states without real GitHub requests or opening an external browser. Real profiles are unaffected. |
| COM-UPD-016 | Verify update behavior and document it before release. | Tests cover version normalization and comparison, stable-release selection, startup and six-hour scheduling, overdue resume, shared requests, failures, offer deduplication and release URL validation. Run the existing test suite and affected UI smoke checks; keep English and Russian README instructions aligned and record implemented behavior in CHANGELOG. |
