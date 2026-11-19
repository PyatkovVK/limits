---
name: versionless-documentation
description: Keep Limits release numbers out of general documentation and synchronize package metadata when preparing a release. Apply when writing repository text or preparing a release.
---

# Document release numbers and update package metadata

Write current Limits behavior without a release number in the product name, headings, feature descriptions, privacy notes, requirements, comments, test descriptions or agent instructions. Use concrete release numbers in `CHANGELOG.md` for release history. An explicit user request can specify another place where a release number belongs in prose.

Use placeholders such as `<release>`, `<release>-demo`, `<major>.<minor>[.<patch>]` and `v<release>` when explaining branch names, tags, commands or version normalization. Link to the changelog for release history rather than copying release numbers into other files. Keep English and Russian text aligned. Do not replace an outdated release number with the newest one: remove the release-specific wording.

When preparing a release, set `package.json`'s `version` to the confirmed target release and sync the package and root versions in `package-lock.json`. Use the same version as the target changelog heading, including a zero patch component when the release branch omits it. Leave package versions unchanged during documentation-only edits. Preserve dependency pins, CI version handling, version-comparison fixtures and the dynamic update display. Third-party prerequisites, license identifiers and protocol or format versions are independent of the Limits release.

When checking a change, search tracked text outside `CHANGELOG.md` and explicitly inspect ignored local `skills/**/SKILL.md` files. Review numeric matches in context: remove concrete Limits release labels and replace numeric documentation examples with placeholders; preserve technical values needed to build, test and update the app. Check translated documentation and existing skill templates for the same stale labels.

Maintain this tracked template and its catalog entry so `npm run setup:skills` can restore the skill in local `skills/`. Update an existing local copy deliberately when necessary because setup preserves existing files. Record actual release-worthy application changes under the target changelog section; repository instructions and text cleanup do not need a product changelog entry.
