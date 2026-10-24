---
name: changelog
description: Update the Limits changelog when implementing a user-visible bug fix, feature or other release-worthy change. Apply before finalizing its commit or pull request.
---

# Keep the changelog current

Find the repository root and read `CONTRIBUTING.md` and the top of `CHANGELOG.md`. Use the actual final diff to describe the change, including its operating-system scope.

Add a concise English entry under `Unreleased`, creating that section above the latest version if needed. Use `Added`, `Changed` or `Fixed` when they improve readability. Explain the resulting user behavior; include a material limitation or migration step when needed. Keep the entry in the same focused commit/PR as the feature or fix. A README translation or internal cleanup needs an entry only when it changes something release-worthy.

Avoid duplicating an existing entry for the same task. When revising a feature, revise its unreleased entry to match the final implementation. Preserve historical release entries. Do not claim a version was published, add a release date, move unreleased entries into a version, or change package versions unless release preparation is part of the user's request.

Check links and consistency with both README languages when they describe the affected behavior. Report the checks actually run; do not write testing claims into the changelog as a substitute for validation.
