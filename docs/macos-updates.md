# macOS updates — 1.5

Packaged macOS installs in a user-writable `/Applications` or `~/Applications` download the architecture-specific ZIP automatically from stable Actions-published GitHub Releases. Main/demo Actions artifacts are not an update channel. Windows, Linux and source runs retain their existing manual release action.

Download without credentials, constrain URLs and redirects to GitHub release hosts, bound size and time, and verify the matching `SHA256SUMS.txt` entry before extraction. Validate archive paths, bundle ID, semantic version, native architecture and code signature; a Developer ID build must retain its signing team. Ad hoc signed project packages remain supported.

Expose download progress, verification, retry and **Install and restart** in RU/EN. Quit only after an explicit install action and successful installer launch. Replace only the installed Limits bundle after the running process exits; retain and restore the old bundle on replacement or launch-command failure. Preserve account/preferences storage. Update failure must not interrupt quota monitoring. Applications launched from a DMG must be moved to Applications first.

Native installer checks use temporary fixture bundles, never the user's installed app. Validate Apple Silicon and Intel packages in CI; verify a real installed-to-newer-release upgrade before publishing 1.5.
