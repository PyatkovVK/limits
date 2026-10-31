---
name: test-failure-analysis
description: Investigate failing Limits tests and CI or build checks before fixing them. Trace the introducing commit, explain the affected functionality, and propose a behavior-based repair and validation plan.
---

# Investigate failures before fixing them

Apply this skill when tests, builds or CI fail. Restore correct platform behavior and verify it with evidence. Follow the minimal-change and platform-routing rules in [platform-routing](../platform-routing/SKILL.md).

## Collect evidence and trace the source

- Record the SHA, platform, CI run, failed step and original error. Distinguish the primary failure from skipped dependent steps.
- Read the relevant code, tests, fixtures and runner configuration. Separate application defects, incorrect test expectations, timing or load sensitivity, and infrastructure failures.
- Find the commit that introduced the broken behavior or incorrect expectation using history, blame and version comparisons. Where possible, reproduce the failure on that commit and verify its absence in the previous version or without the suspect change. Use an isolated temporary copy for bisecting and reproductions, preserving the user's working branch.
- Distinguish the introducing commit from the first observed failure. One successful run does not prove a flaky test is correct. If the exact introducing commit is unknown, report the confirmed range and missing evidence; do not blame the latest commit without checking.

## Explain the functionality and propose a systemic solution

Before editing, tell the user:

1. Which commit or range is associated with the problem and what evidence supports that conclusion.
2. Which functionality the code implements: intended platform behavior, current behavior and what the user experiences.
3. Where the defect is and how the system will behave after the solution: normal operation, failure, recovery and preserved invariants.
4. Which specific components need changes and which checks will verify the result.

If the test is wrong, explain how its expectation conflicts with the application's contract and how the corrected test will still exercise real failure and recovery. Do not remove assertions or increase timeouts merely to make CI green. For infrastructure failures, explain why an application patch is unnecessary and what rerunning the job would establish.

## Audit validation history

- Compare changes since the last confirmed working state with actual test and build runs on the corresponding SHAs and platforms.
- If checks were not run after several changes, identify those commits or their confirmed count and state the gap: which tests, platforms or builds remain unverified. Distinguish "not run", "failed" and "run on another SHA".
- Do not infer missing validation solely from the absence of a local log. Check available CI history and state any limits on access to that history.

## Fix and verify

When the user has already authorized a fix, continue after reporting the diagnosis and plan without asking for approval again. For analysis-only or plan-only requests, do not change code.

Make the smallest change that addresses the confirmed cause. Reproduce the original failure conditions and verify functional invariants and the affected test suite. Perform the required native checks on the available platform and report only checks actually completed. After an authorized push, check the new CI run on the exact SHA; distinguish passing tests from package builds and package verification. Preserve task boundaries: changes to requirements, merging and releasing are not automatically authorized.
