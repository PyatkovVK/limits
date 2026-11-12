# DeepSeek provider

DeepSeek is an API-key provider in the shared [AI controller infrastructure](../ai-connects.md). A profile is added by pasting an API key; Limits validates the key, stores it encrypted on the device, and polls the balance once a minute. There is no browser sign-in.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-DS-001 | Add DeepSeek through the shared controller contract. | DeepSeek uses the common API-key controller and one registry entry (`deepseek`). No provider-specific branches exist in the monitor, account management, or renderer beyond its schema and normalization. |
| COM-DS-002 | Authenticate with a pasted API key. | The key is sent as `Authorization: Bearer <key>` to `https://api.deepseek.com/user/balance`. A 401 or 403 response reports an invalid key. The key is never included in snapshots, IPC state, or diagnostics. |
| COM-DS-003 | Validate a key before adding a profile. | Connecting reads the balance endpoint once and creates a profile only for a valid key. An invalid key shows an invalid-key error and creates no profile. |
| COM-DS-004 | Poll the balance once a minute. | DeepSeek refreshes on its own one-minute interval; manual refresh returns the same normalized snapshot. |
| COM-DS-005 | Report monetary balances in their original currencies. | The `total_balance`, `granted_balance`, and `topped_up_balance` metrics are money-typed in USD or CNY only and are never converted into percentages or other currencies. |
| COM-DS-006 | Present balances through the display schema. | The schema uses the `metrics` layout with `total_balance` as the primary metric. Details and the compact indicator show a monetary amount with its currency code. |
| COM-DS-007 | Distinguish an unavailable account from an empty balance. | When the service reports the account as unavailable, Limits shows an insufficient-balance state instead of a zero balance or a signed-out account. |
| COM-DS-008 | Open the API-key page in the browser. | The key-management action opens `https://platform.deepseek.com/api_keys` in the default browser; no sign-in redirect is used. |
| COM-DS-009 | Support key replacement and local removal. | A connected profile can replace its key or be removed locally with a direct remove action, without model requests. |
| COM-DS-010 | Use the shared safe error vocabulary. | Refresh and access failures surface as `balanceRefreshFailed` and `insufficientBalance`; a network failure is not reported as an invalid key. |

Related requirements: [AI controllers](../ai-connects.md) and [privacy](../privacy.md#controller-boundaries).
