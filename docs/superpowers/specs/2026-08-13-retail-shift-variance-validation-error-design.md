# Retail Shift Variance Validation Error Design

## Problem

Closing a cashier shift with a variance above the configured threshold and no variance reason currently throws a plain `Error`. The API error normalizer treats unknown errors as internal failures, so the client receives HTTP 500 with code `INTERNAL_ERROR` even though this is a correctable input validation failure.

## Design

The cashier shift service will throw the shared `ValidationError` when a variance reason is required but absent. The error will use code `SHIFT_VARIANCE_REASON_REQUIRED`, retain the existing Vietnamese message `Vui lòng nhập lý do chênh lệch ca.`, and be normalized by the existing API middleware to HTTP 400.

No controller, route, persistence, or frontend behavior will change. The existing variance threshold calculation remains authoritative.

## Error flow

1. The close-shift service calculates the shift variance.
2. If the configured threshold requires a reason and the submitted reason is blank, the service throws `ValidationError`.
3. The cashier shift controller forwards the error through `next`.
4. The global API error middleware preserves status 400, the stable error code, and the user-facing message.

## Testing

Add a focused service-level regression test proving that the missing-reason path produces an error which normalizes to:

- status: `400`
- code: `SHIFT_VARIANCE_REASON_REQUIRED`
- message: `Vui lòng nhập lý do chênh lệch ca.`

Run the full retail backend test suite and TypeScript typecheck after implementation.
