# Enforce feature branch naming on GitHub

[Development guide](development.md) · [Branch naming requirements](../requirements/common/build-and-release.md#branch-naming)

New feature/task branches must use `limits/<description>`, including fixes, refactors and documentation. `main`, exact numeric release branches and their `-demo` variants retain their integration/release roles. This guide describes settings to apply separately on GitHub; adding these files does not activate repository rules.

## Restrict branch creation in this repository

An administrator, or a role with permission to edit repository rules, can configure a branch ruleset. Branch rulesets are available for public repositories on GitHub Free and for private repositories on the relevant paid plans. See [GitHub's ruleset setup documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository).

1. Open the repository's **Settings → Rules → Rulesets → New ruleset → New branch ruleset**. For this project, open [repository ruleset settings](https://github.com/PyatkovVK/limits/settings/rules).
2. Name the ruleset `feature-branch-names` and set **Enforcement status → Active**.
3. Under **Target branches**, choose **Add target → Include all branches**.
4. Add exclusions using **Exclude by pattern**, with one entry per pattern/name:

   ```text
   limits/*
   limits/**/*
   main
   1.4
   1.4-demo
   ```

   Add other approved numeric release/demo branches by their exact names, such as `2.0` and `2.0-demo`, before creating them. The first two patterns allow task names under `limits/`, including nested descriptions. Target patterns use GitHub's `fnmatch` syntax, not regular expressions; broad patterns such as `1.*` also allow non-release names and should not replace exact release exceptions.
5. Under **Branch rules/protections**, enable **Restrict creations** only for this naming ruleset. Leave **Restrict updates**, **Restrict deletions**, and other unrelated protections off; GitHub may preselect deletion/force-push protections. Existing branch-protection rules can remain in their own rulesets.
6. Leave the **Bypass list** empty to apply the restriction to everyone. An actor on that list can create names outside the allowed namespace, so adding a role/app there creates an explicit exception.
7. Click **Create**.

The rule targets names outside the exclusions. Without bypass permission, GitHub rejects creating `feature/add-provider` or `codex/add-provider`, while permitting `limits/add-provider` and the explicitly excluded integration/release names. Existing branches are not renamed or deleted; this creation-only rule does not prohibit ordinary pushes to existing branches. See [Restrict creations](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#restrict-creations).

GitHub checks remote operations; it cannot block a local `git switch -c feature/add-provider`. Also, repository branch rulesets do not propagate into contributors' forks. To block merging PRs from incorrectly named fork branches, add a separate PR source-name check and require that status check on the integration/release target branches. That check must accept `limits/` task names and permitted integration/release sources. This documentation change does not add that check. See [GitHub's ruleset behavior for forks](https://docs.github.com/en/organizations/managing-organization-settings/creating-rulesets-for-repositories-in-your-organization).

## Enterprise alternative: branch name restrictions

GitHub Enterprise organizations can use metadata restrictions for branch names. If **Restrict branch names** is available, target all branches, choose **Must match a given regex pattern**, and use:

```regex
^(main|limits/.+|(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*))?(-demo)?)$
```

This accepts the task namespace and exact numeric release/demo names without maintaining per-version exclusions. Review the active legacy branches before enabling name restrictions. See [GitHub Enterprise metadata restrictions](https://docs.github.com/en/enterprise-cloud@latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#metadata-restrictions).
