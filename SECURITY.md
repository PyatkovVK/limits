# Security policy

## Report a vulnerability

Send a private report in English or Russian using [GitHub's vulnerability reporting form](https://github.com/PyatkovVK/limits/security/advisories/new). Keep vulnerability details out of public issues and pull requests.

Include the affected Limits version or commit, OS and architecture, installation type, the affected feature, the steps needed to observe the issue, and its impact. If possible, check the [latest stable release](https://github.com/PyatkovVK/limits/releases/latest). Reports about older builds and previews should include the exact version or commit. Remove API keys, OAuth tokens and account details from attachments. Use synthetic account data where possible and keep `auth.json` and account directories private.

## Security boundaries

Limits is a desktop app for Windows, macOS and Linux. Its security-sensitive assets include provider credentials, local account state, and the code and packages that users install or update.

- Keep OAuth tokens and saved API keys out of renderer state and diagnostics. Restrict each provider credential to its intended account and service. Preserve isolation between connected Codex accounts and the existing Codex or VS Code sign-in.
- Validate requests from the Electron renderer before performing privileged work in the main process. Treat provider responses, release metadata and locally imported data as untrusted input. The Codex Resets integration must use its configured endpoint and keep account data out of its requests.
- Require user consent to download and install app updates. Verify downloaded packages against the published checksum and apply the platform-specific identity and signature checks before installation.

Report any path that could expose credentials or account data, cross an account or process boundary, execute code without user authorization, or bypass update verification. For a dependency alert, include the installed dependency version and its relevance to a Limits build or release if known.
