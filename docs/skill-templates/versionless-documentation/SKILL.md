---
name: versionless-documentation
description: Keep concrete Limits release numbers out of README files, documentation, requirements, comments and skill examples. Apply when writing or reviewing repository text; release numbers belong only in CHANGELOG.md unless the user explicitly requests a specific occurrence elsewhere.
---

# Keep release numbers in the changelog

Write current Limits behavior without a release number in the product name, headings, feature descriptions, privacy notes, requirements, comments, test descriptions or agent instructions. Keep concrete release numbers only in `CHANGELOG.md`. An explicit user instruction may authorize a particular occurrence elsewhere; limit that exception to the requested place and purpose.

Use placeholders such as `<release>`, `<release>-demo`, `<major>.<minor>[.<patch>]` and `v<release>` when explaining branch names, tags, commands or version normalization. Link to the changelog for release history rather than copying release numbers into other files. Keep English and Russian text aligned. Do not replace an outdated release number with the newest one: remove the release-specific wording.

This is a rule for authored text, not a request to disable versioning. Preserve machine-readable package metadata, dependency pins, workflow version handling, version-comparison fixtures, and values read dynamically for the update UI. Third-party software prerequisites, license identifiers and protocol/format versions are not Limits release labels. Do not change application behavior or legal notices as part of text cleanup.

When checking a change, search tracked text outside `CHANGELOG.md` and explicitly inspect ignored local `skills/**/SKILL.md` files. Review numeric matches in context: remove concrete Limits release labels and replace numeric documentation examples with placeholders; preserve technical values needed to build, test and update the app. Check translated documentation and existing skill templates for the same stale labels.

Maintain this tracked template and its catalog entry so `npm run setup:skills` can restore the skill in local `skills/`. Update an existing local copy deliberately when necessary because setup preserves existing files. Record actual release-worthy application changes under the target changelog section; repository instructions and text cleanup do not need a product changelog entry.
