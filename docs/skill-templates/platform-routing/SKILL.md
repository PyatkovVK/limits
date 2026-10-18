---
name: platform-routing
description: Route Limits application changes to the requested operating system, defaulting to the current host for platform-specific work, while keeping shared behavior in src/common. Apply when choosing implementation, UI, tests or build paths for a feature or fix.
---

# Route platform changes

## Choose the target

- Use the platform explicitly requested by the user, even when it differs from the current machine. An explicitly shared/cross-platform feature targets `src/common`, with platform adapters only where needed.
- When no platform is specified, route platform-specific work to the current execution host. Run `node -p "process.platform"`: `linux` means Linux, `darwin` means macOS, and `win32` means Windows. Do not infer the OS from path spelling, interface language or CI runner names. WSL/containers/remote shells identify their execution environment; honor an explicitly requested desktop target instead when supplied.
- If the host cannot be identified, inspect the affected implementation and continue independent work; ask for a target only if the choice would change the solution.

## Choose files

| Target | Implementation and native integration | Platform tests |
| --- | --- | --- |
| Linux | `src/linux_feature/` | `src/linux_feature/test/` |
| macOS | `src/apple_feature/` | `src/apple_feature/test/` |
| Windows | `src/windows_feature/` | `src/windows_feature/test/` |
| Shared | `src/common/` | `test/` |

Keep OS-specific UI, tray/notch/taskbar behavior, helpers and settings adapters in the matching platform directory. For a Linux task, edit the Linux implementation; for a macOS task, edit the Apple implementation; for a Windows task, edit the Windows implementation. Avoid incidental changes to the other platforms.

Use `src/common/` for behavior intended to work on all supported systems and for existing shared services. A necessary shared interface change can accompany a platform fix; keep it small and check the other callers. Do not duplicate shared logic or move an existing shared feature into a platform directory just because that is the current host. Shared package/workflow/documentation files may be changed when the task requires them.

## Validate on the available host

Run the shared tests for behavior changes. Exercise the affected UI on the native target when available. For packaging changes, choose the platform/architecture script in `package.json`: Windows `build:win:x64`, macOS `build:mac:arm64` or `build:mac:x64`, Linux `build:linux:x64` or `build:linux:arm64`.

Cross-platform intent does not imply that native tests ran on every OS. State which native checks were performed and which remain for the target machine or CI.
