---
name: changelog
description: Record release-worthy Limits changes immediately under the target version, never in Unreleased. Apply while implementing a user-visible feature or fix and before finalizing its commit or pull request.
---

# Write changelog entries directly under the target version

Read `CONTRIBUTING.md`, the top of `CHANGELOG.md` and the final diff. Determine the target release from the user's explicit version first, then the task's release/demo branch or PR base and the documented release plan. Normalize `1.6` or `1.6-demo` to the repository's `1.6.0` heading format. Do not select an older release solely because `package.json` still contains its version. If the target cannot be established, ask for it instead of inventing a version or using an `Unreleased` placeholder.

Write a concise English entry directly under `## <target-version>` as part of implementing the feature or fix, in the same focused commit/PR. Create that version section above older versions when needed. Never create an `Unreleased` section or defer assigning entries to a release. If the current task's entries are already under `Unreleased`, move them into the confirmed target version and remove the empty placeholder section.

Use `Added`, `Changed` or `Fixed` when helpful. Describe the resulting user behavior and operating-system scope, including material limitations or migration steps. Revise an existing entry when the implementation changes; avoid duplicate entries. Internal agent instructions, repository-only AI tooling, test maintenance and translations need no product entry unless they change release-worthy application behavior.

Before finalizing, check that every release-worthy change in the diff is reflected in the correct version section, that the target heading is not duplicated, and that no current-task entries remain under an unassigned heading. Check related documentation and agent guidance for conflicting release-section instructions or stale behavior descriptions. Keep affected English and Russian README content aligned. Preserve historical release entries and entries belonging to other target releases.

A version heading records the intended release; it does not prove publication. Do not invent a release date, claim a release was published, create tags or change package versions unless that release work is separately authorized. Report checks actually performed; testing claims do not replace changelog content or validation.
