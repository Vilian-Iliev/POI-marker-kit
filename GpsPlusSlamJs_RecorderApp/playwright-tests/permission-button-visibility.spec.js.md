# permission-button-visibility.spec.js

## Purpose

End-to-end smoke test for the "Grant Permissions" button visibility rule
introduced by Issue 2 of
`GpsPlusSlamJs_Docs/docs/2026-05-03-setup-screen-defaults-and-permission-rerequest.md`.

## What it verifies

- Button stays visible when any mandatory permission (`granted !== true`).
- Button hides only after every mandatory permission is `granted === true`.
- Denied permissions surface in `#permission-error` for context.

## How

Uses the `window.testHooks.updatePermissionStatus` hook (exposed by `main.ts`
in dev builds) to inject fabricated `PermissionCheckResult` values, so we
don't depend on a real browser permission prompt.

## Related

- Unit-level coverage: `src/ui/hud.test.ts` ("updatePermissionStatus — Grant Permissions button visibility").
- Subscription model: `GpsPlusSlamJs_AppFramework/src/sensors/permission-checker.ts` (`subscribePermissionChanges`).
