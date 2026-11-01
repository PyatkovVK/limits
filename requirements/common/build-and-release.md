# Build and release requirements

These rules replace the previous CI pipeline. Numeric release names use `<major>.<minor>[.<patch>]`, with two or three non-negative integer components and no leading zeros except `0`. Names in angle brackets are placeholders.

## Branch naming

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| BRANCH-001 | Use `limits/` for new task branches. | Features, fixes, refactors and documentation use this exact prefix and a nonempty, valid Git branch description, including automation and fork PRs. Existing branches are not renamed or deleted. |
| BRANCH-002 | Reserve integration and release names. | `main`, `demo`, numeric branches and numeric `-demo` variants serve integration, demo and release work. Individual tasks use `limits/`. New numeric integration and demo branches start from current `main`. |
| BRANCH-003 | Enforce naming separately from CI routing. | Every existing branch receives CI even if its name does not follow the task convention. GitHub restrictions require separate administrator configuration; see the [ruleset guide](../../docs/github-rulesets.md). |

## Branch routing

| Source branch | Tests | Package builds and verification | Artifacts | GitHub Release |
| --- | --- | --- | --- | --- |
| `main` | Windows, macOS, Linux | None | None | None |
| `demo` | Windows, macOS, Linux | None | None | None |
| Numeric name plus `-demo`: `<release>-demo` | Windows, macOS, Linux | None | None | None |
| Numeric name: `<major>.<minor>[.<patch>]` | Each build target | All eight packages and SHA-256 checksums | Seven days | Publish/update `v<branch>` on push or manual run |
| Every other branch, including `limits/*` and legacy names | Each build target | All eight packages and SHA-256 checksums | Seven days | None |

Numeric and numeric-demo patterns apply to every version without a list of version numbers. `demo` runs only tests: it does not perform a trial package build or save packages anywhere. Names such as `limits/demo`, `<release>-beta` or a path ending in `<release>-demo` are ordinary branches.

## Required behavior

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| CI-001 | Classify names exactly according to the table. | A prefix, extra suffix, leading `v` or invalid numeric pattern does not grant demo or release behavior. Ordinary branches build every release target without publication. Future numeric versions require no workflow edits. |
| CI-002 | Handle all branch pushes, manual dispatch and PRs. | No branch/PR-target filter excludes ordinary branches. Manual branch runs use push routing. Tag pushes do not trigger CI; deleted branches, non-branch refs on push/manual runs, and unsupported events cannot start pipelines. Manual dispatch also requires the entrypoint on the default branch. |
| CI-003 | Route PRs using their source and check the proposed merge. | A task PR into any integration branch builds all targets. Sources `main`, `demo` and numeric-demo run only tests. Numeric-source PRs build with their numeric version. Use `pull_request` and default merge checkout. PRs never publish, move tags or receive signing credentials in their process environment. Ordinary branch builds also receive no signing credentials. |
| CI-004 | Execute real tests in every active pipeline. | Test-only runs execute `npm test` on Windows, macOS and Linux without builds, package verification or uploads. Build runs execute the same suite on each build target before packaging. The selector alone is not a successful test run. |
| CI-005 | Build the complete native matrix. | Windows x64 produces portable EXE and NSIS installer; macOS arm64 and x64 each produce DMG and ZIP; Linux x64 produces AppImage and DEB. Use each target's native host and explicit npm command. Preserve the bundled connection runtime. Failed tests/builds block verification and publication. |
| CI-006 | Verify every build pipeline before publication. | A separate read-only job downloads all four package artifacts, rejects missing, empty or non-file expected packages, and computes `SHA256SUMS.txt` for eight files. Ordinary branches finish after verification and artifact saving. Test-only branches never reach this job. |
| CI-007 | Derive package versions from numeric branches only. | Append `.0` to a two-component numeric branch; preserve three components. Override inside CI without a version commit or npm-created tag. Ordinary branches use `package.json`; test-only runs do not override versions. |
| CI-008 | Retain artifacts only for branches that build. | Save `packages-win-x64`, `packages-mac-arm64`, `packages-mac-x64`, `packages-linux-x64` and `packages-checksums` for seven days. The checksum artifact contains `SHA256SUMS.txt`. Missing uploads fail. `main`, `demo` and numeric-demo upload no artifacts. |
| CI-009 | Publish only numeric branch pushes and manual runs. | After successful tests, builds and verification, a dedicated `contents: write` job points `v<branch>` at the built commit, uploads eight packages and checksums to a draft, then makes it public. Repeat runs update the same tag/release and preserve other releases. Serialize runs per workflow/ref. All other jobs use `contents: read`. Expose signing secrets only during numeric publication builds: absent certificates remain allowed, but configured signing, notarization and verification must succeed. |
| CI-010 | Keep `.github` files small and declarative. | Each CI workflow/action file has at most 100 lines. The entrypoint calls separate test, build, verification and publication workflows. Share dependency setup through a small composite action. Keep routing, checksums, tag updates and release shell logic in `scripts/ci/`; YAML steps call these files without multiline embedded programs. |
| BUILD-001 | Preserve explicit platform/architecture commands. | Keep grouped preparation, Windows, macOS and Linux scripts in `package.json`, including `build:win:x64`, `build:mac:arm64`, `build:mac:x64`, `build:linux:x64` and `build:linux:arm64`. CI uses explicit architecture commands. Preserve `build:win`, `build:mac`, `build:linux` and `build:win:standalone`. |
| BUILD-002 | Keep local packaging separate from publication. | Build on the target OS with `--publish=never` and write completed packages to `release/`. Linux arm64 remains a local option outside the four-target CI matrix. |

## Validation

- Execute the workflow's actual selector for push, manual and PR events, including main/demo, numeric, numeric-demo, ordinary and invalid partial names.
- Check PR source/target combinations, inactive refs/events, dependencies, permissions and signing boundaries.
- Check all four native commands, tests before packaging, and expected filenames against electron-builder output.
- Hash fixtures for all eight files and reject every missing, empty or non-file package. Mock GitHub refs and the CLI to verify new/repeated publication and failed uploads without publishing a real release.
- Enforce the 100-line CI YAML limit and external script calls. Run `npm test` and available native package checks; report the OS and result. Other targets require native CI runners.

Implementation: [entrypoint](../../.github/workflows/release.yml), [CI scripts](../../scripts/ci/) and [development guide](../../docs/development.md#automated-releases). GitHub behavior follows [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) and [Reuse workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows).
