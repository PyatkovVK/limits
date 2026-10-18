# Build and release requirements

These requirements define the GitHub Actions flow introduced on `1.4-demo`. They replace earlier branch-specific CI rules. Version examples use numeric components: `1.x` means branches such as `1.4` or `1.5`, rather than a literal branch named `1.x`.

## Branch naming

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| BRANCH-001 | Create feature and other task branches only in the `limits/` namespace. | Every new branch for a feature, fix, refactor or documentation task starts with the exact, case-sensitive prefix `limits/`, followed by a nonempty description and a valid Git branch name, for example `limits/add-provider` or `limits/fix-tray`. This applies to contributors and automation, including branches in forks used for pull requests. New task branches named `feature/...`, `fix/...`, `codex/...` or without the prefix are not allowed. |
| BRANCH-002 | Reserve integration and release names for their existing roles. | `main`, exact numeric version branches and their `-demo` variants remain permitted for integration, release and demo work. They are not exceptions for naming an individual feature branch. Existing branches are not automatically renamed or deleted by this policy. |
| BRANCH-003 | Keep naming policy separate from CI routing and explicitly configure server enforcement. | `limits/*` task branches use the tests-only pipeline. The fallback tests for all other branches remain, including legacy branches. Documentation changes alone do not enable a GitHub rule or prevent local branch creation. Server enforcement must preserve `main`, approved release/demo branches, and the existing build/publication rules. See the [GitHub ruleset setup](../../docs/github-rulesets.md) for creation restrictions, bypass behavior and fork limitations. |

## Branch routing

| Branch | Automated tests | Package builds and verification | GitHub Release |
| --- | --- | --- | --- |
| `main` | All build targets | All eight packages and SHA-256 checksums, saved in Actions artifacts | No |
| Exact numeric version, such as `1.4`, `2.0`, `3.2.1` | All build targets | All eight packages and SHA-256 checksums, saved in Actions artifacts | Publish or update `v<branch>` |
| Exact numeric version followed by `-demo`, such as `1.4-demo`, `2.0-demo`, `3.2.1-demo` | All build targets | The same builds, artifact uploads and package verification as a release branch | No |
| Every other branch, including feature/fix branches and `1.0-fix` | Windows, macOS and Linux | No packaging or artifact uploads | No |

## Required behavior

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| CI-001 | Route branches by exact names and numeric patterns, without a list of individual demo branches or legacy exceptions. | Numeric versions have two or three non-negative integer components with no leading zeros except `0`. Only the exact `-demo` suffix enables demo packaging. Names such as `feature/1.4-demo`, `1.4-demo-feature`, `v1.4`, `01.4` and `1.0-fix` run tests only. Future major/minor versions work without workflow edits. |
| CI-002 | Run the pipeline on every branch push, manual branch dispatch and pull request, with no PR target-branch filter. | A manual branch run follows the same routing as a push. Tag pushes do not trigger the workflow. Deleted branches, tag refs and unsupported events cannot start tests, packaging or publication. Manual dispatch requires the workflow to be present on the repository's default branch. |
| CI-003 | Classify a pull request by its source branch and check the proposed merged result. | An ordinary feature branch targeting `main`, a numeric branch or a demo branch runs only tests. A numeric/demo source branch runs the full package pipeline; `main` also retains its full pipeline. No PR can publish a release, move a tag or receive signing secrets. Use `pull_request`, with the default merge checkout. |
| CI-004 | Run real automated tests for every ordinary branch. | `npm test` must pass on Windows, macOS and Linux. A successful branch-selection job alone is not a completed test run. Tests-only runs never invoke a package build or upload package/checksum artifacts. |
| CI-005 | Preserve the complete build matrix for `main`, numeric and demo branches. | Windows x64 produces portable EXE and NSIS installer; macOS arm64 and x64 each produce DMG and ZIP; Linux x64 produces AppImage and DEB. Each of the four target jobs runs `npm test` before packaging. Keep the bundled native connection runtime and the existing signing/notarization policy. A failed test, build or verification prevents publication. |
| CI-006 | Verify demo builds as fully as release builds before the publication boundary. | A separate job with read-only repository access downloads all four target artifacts, rejects any missing/empty expected package and calculates `SHA256SUMS.txt` for all eight files. `main` and demo runs finish after this verification and artifact upload. They never enter a job with `contents: write`, create a tag, create a draft or publish a Release. |
| CI-007 | Derive CI package versions consistently. | `main` uses `package.json`. Numeric and demo branches use the numeric portion of the name: `1.4` and `1.4-demo` build `1.4.0`; `3.2.1` and `3.2.1-demo` build `3.2.1`. Apply the override only inside CI, without a version commit or npm-generated Git tag. |
| CI-008 | Preserve downloadable packages and checksums for inspection. | Upload packages under `packages-win-x64`, `packages-mac-arm64`, `packages-mac-x64` and `packages-linux-x64`, plus `packages-checksums` containing `SHA256SUMS.txt`. Retain them for seven days. Empty/missing artifact uploads fail the run. |
| CI-009 | Publish only numeric version branches after successful package verification. | Only a numeric branch push or manual branch dispatch can run the publication job with `contents: write`. Point `v<branch>` at the built commit, upload all eight packages and their checksums to a draft, then make it public. A subsequent run updates the same tag/release while preserving other versions. Serialize runs for the same workflow/ref. |
| BUILD-001 | Make platform and architecture choices visible in `package.json`. | Group preparation, Windows, macOS and Linux scripts separately, using the existing visual separator convention. Provide `build:win:x64`, `build:mac:arm64`, `build:mac:x64`, `build:linux:x64` and `build:linux:arm64`; CI invokes the matching explicit command. Retain `build:win`, `build:mac`, `build:linux` and `build:win:standalone` for compatibility. |
| BUILD-002 | Keep local packaging separate from publication and require the target OS. | Windows builds run on Windows, macOS builds on macOS, and Linux builds on Linux. All local package commands retain `--publish=never` and write completed files to `release/`. Linux arm64 remains a local option, outside the standard release matrix. |

## Validation

- Exercise the actual workflow branch-selection script for pushes and manual runs of `main`, numeric, demo and ordinary branches, including future major versions and invalid partial matches.
- Exercise PR source/target combinations, including a numeric source, and verify that publication is always disabled.
- Check job dependencies and permissions so build failures block verification/publication and demo verification has no repository write access.
- Execute the package verification script against all eight expected filenames, check SHA-256 values, and reject missing or empty files. Verify publication ordering with a mocked GitHub CLI, including a failed upload.
- Run the full `npm test` suite. Native package generation for all four targets is verified by GitHub Actions on their corresponding operating systems.

GitHub event/ref behavior follows [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows); the implementation lives in [release.yml](../../.github/workflows/release.yml), with commands documented in the [development guide](../../docs/development.md).
