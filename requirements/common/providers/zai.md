# Z.ai (GLM Coding Plan) provider

Z.ai is an API-key provider in the shared [AI controller infrastructure](../ai-connects.md). A profile is added by pasting a Personal Coding Plan key; Limits validates the key, stores it encrypted on the device, and polls the quota once a minute. There is no browser sign-in.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-ZAI-001 | Add Z.ai through the shared controller contract. | Z.ai uses the common API-key controller and one registry entry (`zai`). No provider-specific branches exist in the monitor, account management, or renderer beyond its schema and normalization. |
| COM-ZAI-002 | Authenticate with a pasted API key. | The key is sent in the `Authorization` header (without a Bearer scheme) to `https://api.z.ai/api/monitor/usage/quota/limit`. A 401 or 403 response reports an invalid key. The key is never included in snapshots, IPC state, or diagnostics. |
| COM-ZAI-003 | Require a Personal Coding Plan. | When the service reports that no coding plan exists, Limits shows a coding-plan-required error and does not display the quota as zero. |
| COM-ZAI-004 | Poll the quota once a minute. | Z.ai refreshes on its own one-minute interval; manual refresh returns the same normalized snapshot. |
| COM-ZAI-005 | Report remaining allowances as percentages. | The short (5-hour) and weekly (7-day) remaining values are percentage-typed and are never summed or converted into money. |
| COM-ZAI-006 | Present the plan through the display schema. | The schema groups metrics under Z.ai and maps plan `lite`/`pro`/`max` to their display names. Details and the compact indicator show the remaining percentages and reset times when available. |
| COM-ZAI-007 | Open the API-key page in the browser. | The key-management action opens `https://z.ai/manage-apikey/apikey-list` in the default browser; no sign-in redirect is used. |
| COM-ZAI-008 | Use the shared safe error vocabulary. | Refresh and access failures surface as `quotaRefreshFailed`, `invalidApiKey`, and `codingPlanRequired`; a network failure is not reported as an invalid key or a missing plan. |

Related requirements: [AI controllers](../ai-connects.md) and [privacy](../privacy.md#controller-boundaries).
