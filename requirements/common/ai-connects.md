# Pluggable AI controllers (planned)

This document defines a planned shared infrastructure for connecting AI services to Limits on Windows, macOS, and Linux. It does not describe an already completed refactor. The first implementation includes only OpenAI Codex, adapted from the existing integration. DeepSeek, Claude, Qwen, Alice AI, and other services are examples of future extensions; their integration is outside this task.

## Location and responsibilities

The target organization is:

```text
src/common/ai-connects/
  ai-controller.cjs
  registry.cjs
  contracts.cjs
  codex/
    controller.cjs
    client.cjs
    limits.cjs
```

`ai-controller.cjs` defines the abstract base class and required operations. `contracts.cjs` defines the shared data, display, capability, and error contracts. `registry.cjs` maps stable provider IDs to controller factories and metadata. Each provider directory owns its controller subclass, transport, authentication details, response normalization, and display metadata. Additional provider-specific helpers may live in that directory.

The shared monitor schedules updates and reconnects through the controller contract. Account management stores provider/profile associations and invokes controller operations. The shared interface renders normalized data using the display schema. OS integration remains in the existing platform directories and consumes the same shared display model.

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| COM-AI-001 | Place the shared connection infrastructure in `src/common/ai-connects/`. | All supported operating systems use the same controller contracts and registry. Provider logic is not duplicated in platform implementations. |
| COM-AI-002 | Add a provider through a subclass of the abstract controller and one registry entry. | A provider using the existing data types and display primitives can be added with its own directory and registry entry, without adding provider branches to the shared monitor, account management, or renderer. The production registry initially contains only `codex`. Runtime installation of third-party plugins is outside this task. |
| COM-AI-003 | Keep service details behind the controller contract. | Codex RPC method names, authentication environment variables, credential-home rules, and response field names remain in the Codex implementation. Shared orchestration does not access a controller's transport or raw responses directly. |
| COM-AI-004 | Distinguish connection readiness, authentication, and access to limit data. | Starting a transport does not imply a signed-in account or supported quota access. The controller reports signed-out, unsupported, and failed access separately; a network failure is not reported as a successful sign-out or a zero balance. |
| COM-AI-005 | Refresh data through one common operation. | Automatic polling and manual refresh obtain the same normalized snapshot through `refresh()`. Service notifications are translated into the same snapshot/state events rather than exposed as provider-specific RPC events to consumers. |
| COM-AI-006 | Describe presentation as data. | A schema selects and orders metrics, identifies their display types and captions, and chooses the compact indicator's primary metric. It contains no executable renderer code or markup. Reading the schema makes no network request. |
| COM-AI-007 | Declare supported account operations explicitly. | Capabilities identify whether sign-in, cancellation, and sign-out are available for the particular profile. Read-only external Codex sources remain read-only. Unsupported actions produce a defined result and are not offered as available in the interface. |
| COM-AI-008 | Give every controller an explicit lifecycle. | Connection setup is safe to repeat; stopping releases owned processes, timers, subscriptions, and pending work without signing the account out. Late responses or events from a stopped connection or obsolete login cannot restore account state or start a new browser action. |
| COM-AI-009 | Keep scheduling and recovery shared while preserving provider policy. | The common monitor owns polling, concurrent-refresh coalescing, retry backoff, stale-data tracking, and reconnect orchestration. A provider can declare its polling policy without changing the scheduler. Codex retains its existing interval, manual-refresh behavior, credential refresh after connection, and recovery behavior. |
| COM-AI-010 | Isolate account state and failures. | Every result and event belongs to a provider/profile and current connection or login attempt. A failed controller does not stop other profiles. A transient failure can retain that profile's last successful sample as stale; an account identity change clears the old identity's metrics before new data is displayed. |
| COM-AI-011 | Preserve existing profiles when introducing provider IDs. | Stored profiles without a `providerId` are interpreted as `codex`. Profile IDs, local names, selected profile, source references, settings, and authentication locations remain valid. An unknown provider ID is unavailable and is never silently treated as Codex. |
| COM-AI-012 | Preserve metric units and distinguish missing data from zero. | Percentages, monetary amounts, and counts use explicit types and semantics. Currency is not converted into a percentage or another currency. Missing values remain `null`; invalid numeric values are not shown as real quota values. A real zero remains visible. |
| COM-AI-013 | Move the existing Codex integration behind the new controller. | The Codex controller owns the current App Server client, account/access checks, browser login and cancellation, logout, quota response normalization, and notification translation. It reads limits without starting a chat or sending a prompt. Unsupported Codex authentication modes retain a clear unsupported state. |
| COM-AI-014 | Preserve the existing Codex user experience and runtime independence. | Five-hour and weekly remaining percentages, other reported windows, reset countdowns, plan/account information, account switching, demo mode, connected profiles, and read-only external sources continue to work. Packaged Limits still owns its connection runtime and does not require the Codex desktop app or VS Code to be running or installed. |
| COM-AI-015 | Carry existing privacy and account guarantees through the refactor. | Credentials and raw authentication responses are never included in snapshots, schemas, IPC state, or diagnostics. Login address validation, account isolation, and credential maintenance remain enforced. This refactor does not implement the separate full-storage-isolation goal in COM-ACC-013. |
| COM-AI-016 | Verify both compatibility and extension through the public contract. | Codex regression checks cover existing account and monitoring behavior. An in-memory test controller supplies monetary data to the same monitor and shared presentation path without service-specific branches. The test controller is not a production integration or a user-selectable service. |

## Base controller contract

The four primary operations below are required. The abstract base class must reject direct use or missing required implementations with a clear contract error. The names describe the public contract; transport-specific calls remain private to each provider.

| Operation | Responsibility and result |
| --- | --- |
| `connect()` | Establish the transport or service session. Return when it is ready for access checks; do not start interactive authentication implicitly. |
| `checkAccess()` | Return the current account, capability information, and whether limit data can be read. Distinguish signed-out, unsupported, and failed checks. Do not send an inference request to test access. |
| `refresh()` | Return the normalized account and metric snapshot with its successful update time, or a defined safe failure. A failed refresh does not advance the last successful update time. Authentication/session maintenance must not create duplicate quota reads. |
| `getDisplaySchema()` | Return the declarative schema for the supported metrics, including details and compact presentation. Support Russian and English captions and formatting. |

The lifecycle also includes `disconnect()`, which releases resources without revoking credentials. Capability-dependent `signIn()`, `cancelSignIn()`, and `signOut()` support the existing Codex account workflow, including cancellation during preparation and protection against delayed completion. Sign-in returns only the information needed for the authorized user action; credentials stay inside the provider implementation.

Controllers publish normalized state changes through one shared subscription/event contract with a way to unsubscribe. Notifications and returned snapshots use the same provider/profile identity and safe error vocabulary. The shared monitor exposes the resulting application state to its existing consumers; consumers do not subscribe to Codex RPC notifications.

## Shared data and display contracts

The common data model must support the following information without requiring all services to have Codex's `short` and `weekly` windows:

| Data | Required meaning |
| --- | --- |
| Provider and profile | Stable `providerId` and local `profileId` identifying the source of the snapshot. Provider identity is separate from a metric group ID or display name. |
| Account and capabilities | Safe account identity/plan information when available, plus supported operations for this profile. Email and plan are optional, not prerequisites for a future provider. |
| State and freshness | Connection/access state, refresh-in-progress state, last successful update time, and a safe error code when applicable. Cached samples are explicitly stale after a failed refresh. |
| Groups and metrics | Stable group and metric IDs, with any number of metrics. Five-hour and weekly windows are a Codex mapping rather than mandatory fields for all providers. |
| Metric type and semantics | `percentage`, `money`, or `count`, and whether the value represents remaining, used, or balance. Counts include their unit, such as requests or tokens. |
| Numeric value | A finite value or `null`. Percentages use the 0-100 range. Money preserves the source amount and currency without percentage conversion; rounding is a display concern. |
| Optional limit | A maximum/total only when the source provides one with the same unit and semantics. Missing totals are not invented to draw a progress bar. |
| Currency and unit | An explicit currency code for money and a unit for counts. Metrics with different currencies or units are not summed. |
| Period and reset | Optional duration and reset time. Normalized duration fields use seconds; timestamp fields use Unix milliseconds. The provider adapter converts its source units. A missing reset does not produce a countdown. |

The display schema references group/metric IDs and specifies localized captions, order, display primitives, value semantics, and the primary compact metric. Initial shared primitives cover percentage progress, a monetary amount with currency, and a count with its unit. Progress for a non-percentage metric is optional and requires a valid source total. The schema must not impose percentage thresholds on money or counts.

For example, Codex can describe five-hour and weekly percentage bars with reset countdowns; a test controller can describe a remaining balance of `12.50 USD` with no percentage or reset. Both use the same data and display contracts. If a primary metric is unavailable, the compact indicator shows the shared no-data state instead of substituting an unrelated metric or zero. Existing platform sizing and accessibility rules still apply.

## Implementation acceptance

These checks apply when implementing the planned architecture, not to this requirements-only change:

- Run the shared test suite and verify Codex login/cancellation/logout, profile/source persistence, account switching, notification updates, polling/reconnect behavior, and stale-data handling through the controller contract.
- Verify a saved profile without `providerId` remains the same Codex profile with the same selection and credential location; an unknown provider does not load Codex credentials.
- Use a test-only monetary controller to verify refresh, safe errors, schema-driven details and compact formatting, missing values versus zero, and currency preservation through the common consumer path.
- Verify that delayed results after cancellation, disconnection, account removal, or identity changes do not update another attempt/profile or reopen a browser.
- Exercise Codex demo UI on the native host and verify that details, account cards, and the compact indicator agree. Report native checks on other operating systems only when actually performed.

Related requirements: [Codex accounts](accounts/codex.md), [interface and settings](interface.md#planned-controller-driven-display), and [privacy](privacy.md#planned-controller-boundaries).
