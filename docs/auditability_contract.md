# Auditability Contract — Verbal Sage (Frontend)

This repository guarantees end-to-end request traceability.

## Required Invariants (DO NOT BREAK)

For every `app/api/**/route.ts` that calls Brains (seebx):

1. A request id MUST be derived:
   - Prefer incoming `x-request-id` or `x-correlation-id`
   - Otherwise mint a UUID

2. That request id MUST:
   - Be forwarded to Brains via `x-request-id`
   - Be echoed back on *all* responses (2xx / 4xx / 5xx)

3. No upstream call to Brains may omit `x-request-id`.

This enables:
- transcript ↔ telemetry ↔ answer trace correlation
- deterministic debugging
- enterprise auditability

Violations should fail CI.

Last verified: 2026-01-14
