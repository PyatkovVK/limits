# Contributing to Limits

[English README](README.md) · [README на русском](README.ru.md) · [Development guide](docs/development.md)

Thanks for helping improve Limits. Bug reports, translations, documentation, and testing on different desktop environments are useful contributions. Issues and pull requests may be written in English or Russian.

## Report a bug or suggest a feature

Use the [issue forms](https://github.com/PyatkovVK/limits/issues/new/choose). For a bug, include the app version, OS and processor architecture, display mode, steps to reproduce, and expected versus actual behavior. On Linux, include the desktop environment and X11 or Wayland session type.

Reproduce UI issues with `npm run demo` when possible. Remove email addresses and other personal information from screenshots and logs. Do not upload `auth.json`, OAuth tokens, API keys, or account storage directories.

For a feature request, explain the task you want to accomplish and how the proposed behavior would help. Discuss substantial changes in an issue before implementing them.

## Prepare a change

1. Fork the repository on GitHub and clone your fork.
2. Create a branch from the current project code, for example `git switch -c docs/improve-installation`.
3. Install dependencies with `npm install` using Node.js 22.12 or newer.
4. Run `npm run demo` to view the UI without signing in. See the [development guide](docs/development.md) for platform prerequisites.
5. Make a focused change. Keep shared behavior in `src/common` and platform behavior in the corresponding platform directory.

If the default branch does not yet contain the app, choose `create-mvp` as your starting branch and PR base. Once the app is available in `main`, use `main`.

## Validate your change

- **Behavior changes:** run `npm test`. Add or adjust tests for meaningful behavior, especially usage calculations, account isolation, and platform regressions.
- **UI changes:** run `npm run smoke` on the affected OS, inspect the result, and attach a demo screenshot. For Windows onboarding, use `npm run smoke:onboarding` where relevant.
- **Packaging changes:** build on the target OS with `npm run build:win`, `npm run build:mac`, or `npm run build:linux` and check the generated package.
- **Documentation changes:** check links, image paths, commands, and consistency between `README.md` and `README.ru.md`. App builds are not necessary for text-only edits.

Live checks require sign-in and should only be used when demo mode cannot verify the change. Do not include real account details in PR attachments.

## Open a pull request

Push your branch to your fork and choose **Compare & pull request** on GitHub. Choose the appropriate base branch as described above. Fill in the PR template with the problem, resulting behavior, validation, and related issue.

Keep English and Russian README content aligned when changing user-facing documentation. Add release-worthy behavior to the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md). Avoid including generated packages, `node_modules`, local credentials, or unrelated formatting changes.

## First contributions

Look for [good first issue](https://github.com/PyatkovVK/limits/labels/good%20first%20issue) tasks. Useful starting points include verifying installation instructions, checking Russian and English wording, and documenting tested Linux environments. Comment on a task before starting to help avoid duplicate work.

Please follow the [code of conduct](CODE_OF_CONDUCT.md).
