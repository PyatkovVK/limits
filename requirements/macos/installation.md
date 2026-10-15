# macOS: installation and startup

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| MAC-INST-001 | Distribute separate DMG and ZIP packages for Apple Silicon and Intel. | Packages match arm64/x64; DMG offers copying to Applications and ZIP contains the packaged application. |
| MAC-INST-002 | Include the platform’s own screen-information helper. | Packaged builds contain `apple-screen-info` for native geometry; the Windows helper is not added to common macOS resources. |
| MAC-INST-003 | Support packaged-application startup through Settings. | The choice persists using system facilities; source launches and demo/smoke are not presented as startup installation. |
| MAC-INST-004 | Support local ad hoc builds and fully configured signing. | Without a certificate, ad hoc packages are allowed; Developer ID distribution requires successful signing, hardened runtime, and configured notarization/verification under the build policy. |
| MAC-INST-006 | Include a matching native connection component in macOS packages. | Apple Silicon and Intel packages include the pinned arm64/x64 executable and its Apache license alongside `apple-screen-info`. A separate Codex installation or open Codex window is unnecessary; account monitoring follows COM-ACC-014/015 in common. Missing or non-executable runtime files stop packaging. |

## Limitations

MAC-INST-005: DMG and the native helper are normally built on macOS with the required tools. Renaming a ZIP to `.dmg` or running Windows smoke is not valid macOS package verification.
