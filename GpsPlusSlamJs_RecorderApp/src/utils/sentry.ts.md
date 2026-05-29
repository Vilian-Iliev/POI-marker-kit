# Sentry Error Tracking Module

## Purpose

Provides centralized Sentry configuration and utilities for error tracking,
performance monitoring, and structured logging throughout the RecorderApp.

## Public API

### `initSentry(): void`

Initializes the Sentry SDK. Must be called as early as possible in `main.ts`,
before any other code runs. This is the **only** export of this module — code
that needs other Sentry APIs (e.g. `captureException`, `startSpan`) imports them
directly from `@sentry/browser`.

```ts
import { initSentry } from './utils/sentry';

initSentry();
```

## How errors and logs reach Sentry

This module only calls `Sentry.init(...)`. There are two independent paths that
actually send data, and they land in different Sentry products:

- **Issues** — produced by the shared logger
  (`@gps-plus-slam/app-framework` `logger.ts`): `log.warn()` and `log.error()`
  call `Sentry.captureMessage` / `Sentry.captureException` with a stable
  `['log', level, tag]` fingerprint. This is the primary way warn/error level
  logs become standalone Issues.
- **Logs** — produced by the `consoleLoggingIntegration` configured here, which
  forwards `console.warn` / `console.error` to the Sentry **Logs** product
  (`_experiments.enableLogs: true`). This is a separate view from Issues.

A single `log.warn` / `log.error` therefore typically appears in both views.

## Invariants & Assumptions

- `initSentry()` must be called before any other Sentry API usage
- DSN is hardcoded; for multi-environment support, this could be made configurable
- `consoleLoggingIntegration` captures `warn` and `error` console calls and
  sends them to Sentry **Logs** (not Issues)
- Standalone **Issues** for warn/error come from the framework logger, not this
  module (see "How errors and logs reach Sentry" above)
- Source maps are uploaded during build via the Vite plugin
- Performance monitoring is enabled with `tracesSampleRate: 1.0` (100% of transactions captured)
- Browser tracing integration provides automatic instrumentation for page loads, navigation, and fetch/XHR requests
- `tracePropagationTargets` controls distributed tracing propagation; update the targets to match your actual API server URLs (accepts strings for exact/substring matching or RegExp patterns for complex matching)

## Configuration

The Sentry Vite plugin in `config/vite.config.ts` handles source map uploads
during production builds. This requires the `SENTRY_AUTH_TOKEN` environment
variable to be set in CI/CD.

## Tests

Since Sentry is a third-party service with side effects, we don't unit test
this module directly. Integration is verified by:

1. Building the app and checking source maps are uploaded
2. Triggering a test error in development and verifying it appears in Sentry
