# AI controllers

Limits registers its AI integrations in `src/common/ai-connects/registry.cjs`. The only production provider is `codex`. Its folder owns App Server transport, runtime discovery, account storage options, authentication, local source tracking, quota normalization, and display metadata.

`AiController` defines `connect()`, `checkAccess()`, `refresh()`, `getDisplaySchema()`, and `disconnect()`. Account actions are optional and declared by `state.capabilities`. Disconnect releases resources without signing out. Interactive authentication must be explicit; access checks and quota reads must not invoke a model.

The shared `Monitor` schedules updates and retry backoff, coalesces refreshes, reconnects, and exposes safe state. Controllers call `publish(patch)` to emit normalized snapshots; `subscribe(listener)` returns an unsubscribe function. A `refresh-requested` event requests a poll after a service notification invalidates the account. A `login-ended` event releases the account manager's sign-in lock. Controllers must discard results from obsolete connections, account identities, and login attempts.

## Add another provider

1. Create `src/common/ai-connects/<provider>/controller.cjs` extending `AiController`, with any transport, storage, and translation helpers in the same directory.
2. Implement the required operations. Return normalized snapshots from `refresh()` and publish service updates through `publish()`. Use `providerId` and the supplied `profileId`; do not include credentials in state or diagnostics.
3. Return groups of metrics and a display schema. Supported types are `percentage`, `money` with an uppercase currency code, and `count` with a unit. Values may be `null`; totals and reset times are optional. Timestamps use Unix milliseconds and durations use seconds. Captions have `ru` and `en` variants.
4. Register one factory with `registry.register('<provider>', { name: 'Provider name', create: options => new ProviderController(options) })`. An optional `connectionOptions(context)` prepares provider-owned storage/environment options. Standard context includes the root, profile, and profile ID. Registered providers appear in the add-account selector when more than one is available. Declare sign-in capabilities and implement `isSignInUrlAllowed(url)` before enabling browser authentication.
5. Verify polling, reconnects, account isolation, stale samples, and display behavior with the shared consumers. The test-only `MoneyController` in `test/fixtures/money-controller.cjs` demonstrates a monetary/count provider; it is not registered in the application.

Generic layouts use `layout: 'metrics'` and an explicit `primaryMetricId`. `groups` in the schema reference the data group IDs and ordered metric descriptors. Each descriptor has an `id`, localized `label`, and optional `compactLabel`. Details, account summaries, compact widgets/notch, and tray tooltips share the same formatter. Tray icons use a compact numeric readout; their tooltip preserves the complete amount and currency/unit.

Codex uses the `quota-windows` layout with `short` and `weekly` display slots. A shared presentation projection retains the existing window fields and seconds-based countdown interfaces for platform consumers. Service response fields stay in the Codex adapter. The legacy `codex-client.cjs`, `codex-path.cjs`, and `subscriptions.cjs` modules remain compatibility entry points.

Profiles without a `providerId` remain Codex profiles, with their IDs, selected account, names, source references, and credential locations preserved. Unknown provider IDs become unavailable; they never fall back to another provider's credentials. Full isolation from external Codex credential/configuration storage remains a separate task.

## Validation

Run `npm test` for account/controller regressions and the test monetary provider. Run `npm run smoke` and `npm run smoke:accounts` on the native host for the existing Codex UI. `npm run smoke:ai-connects` exercises the real shared details, account summaries, locale switching, zero/missing/stale states, restoration of the Codex layout, and the Windows compact widget using isolated test data. It writes screenshots and a report under `artifacts/ai-connects-smoke-*` and performs no sign-in, network requests, or inference.
