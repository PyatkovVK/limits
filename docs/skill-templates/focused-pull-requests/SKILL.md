---
name: focused-pull-requests
description: Prepare separate Limits branches and pull requests for independent bugs, features, refactors and documentation tasks, using the required limits/ prefix. Apply when starting work or splitting a multi-item request into reviewable changes.
---

# One task per pull request

Read `CONTRIBUTING.md`, `.github/pull_request_template.md`, local agent instructions and `requirements/common/build-and-release.md` for the current branch rules. Requirements files are read-only unless the user explicitly authorizes changing them.

For every independent bug, feature, refactor or documentation task, create a separate branch named `limits/<description>` and a separate MR/PR. Tests, translations, documentation and that task's changelog entry belong with the task they validate or explain. Do not split those companion changes into unrelated PRs. A small shared interface needed by one platform feature belongs in that feature's PR.

Use the base branch requested by the user, such as `1.5-demo`; otherwise follow the repository contribution rules. Reserve `main`, numeric version branches and `-demo` branches for integration/releases. An existing integration branch is not a task branch. Preserve unrelated local changes when switching branches; never overwrite another task's files.

For a multi-item request, make each independent task directly reviewable against the requested base, without including the other tasks' commits. If a real dependency requires stacking, explain it in the PR and keep the base requested by the user unless they choose a different one. Do not merge or publish a release merely because the PR exists.

Validate each task according to its scope and fill in the PR template with the problem, resulting behavior, checks actually run, limitations and related issue if any. Apply the local `changelog` skill when available for release-worthy behavior. Publish branches and create/update their PRs when the user requests that delivery; otherwise leave reviewable local changes and report that publication remains pending. Do not create empty PRs for requested features already present in the base.
