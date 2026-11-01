---
name: version-branches-from-main
description: Create new Limits numeric version and demo integration branches from the current main branch. Apply when preparing a new release or demo branch, such as 1.7 or 1.7-demo; ordinary task branches follow the requested task base instead.
---

# Start new version branches from main

Create every new numeric version branch and its `-demo` variant from the current `main`, including when the working branch is a previous version or demo branch. For example, both a new `1.7` and a new `1.7-demo` start from `main`, not from `1.6-demo` or from each other.

Before creating the branch, inspect the working tree and existing refs. Fetch `origin/main` and fast-forward the local `main` when possible; do not reset a diverged local `main`. Use the fetched `origin/main` as the base if local `main` cannot be fast-forwarded. If fetching is unavailable, report that the base could not be refreshed instead of silently treating a stale ref as current.

Pass the base explicitly, for example `git switch -c 1.7-demo main` after updating `main`, or `git switch -c 1.7-demo origin/main`. Verify that the new branch initially points to the same commit as that base.

Continue an existing version branch when requested. Do not recreate it or discard its commits unless the user authorizes that correction. Preserve unrelated working changes.

This rule concerns integration and release branch creation. Individual task branches still use the `limits/` prefix and the task base requested by the user, following `CONTRIBUTING.md`. Branch creation does not authorize pushing, merging or publishing releases.
