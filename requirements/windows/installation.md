# Windows: installation and startup

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| WIN-INST-001 | Provide portable EXE and NSIS installer packages for Windows x64. | Both packages launch the same application with the same features; portable mode requires no installation. |
| WIN-INST-002 | Install for the current user with directory selection. | Installation for all users is not mandatory; English and Russian installer languages are available. |
| WIN-INST-003 | Include native Codex and its license in standard packages. | Windows with an empty PATH and no separate Codex can find the bundled component and offer sign-in. A missing component stops packaging. |
| WIN-INST-004 | Allow startup only for the installed version. | The setting is available for the packaged installed application, persists the choice, and launches with `--hidden`; portable/demo/smoke do not enable system startup. |
| WIN-INST-005 | Recover from taskbar replacement and helper failure. | A window closed with its owner is recreated; a crashed or unresponsive helper is replaced; user exit stops retries. |
| WIN-INST-006 | Preserve compatibility between the product name and settings storage. | The product is named Limits and retains the previous installation identity and data directory; updating does not change saved profiles solely due to renaming. |
| WIN-INST-007 | Follow the Windows package signing policy. | Unsigned packages are allowed without a configured certificate; with a certificate, the app, installer, taskbar helper, and bundled Codex are verified. |

## Limitations

WIN-INST-008: Windows ARM64 is outside the standard release matrix of the current baseline. Additional architecture support does not follow automatically from a runtime package being present in dependencies.
