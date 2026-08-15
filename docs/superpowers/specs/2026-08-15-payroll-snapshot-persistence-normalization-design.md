# Payroll Snapshot Persistence Normalization Design

## Problem

An effective payroll snapshot can produce one checksum before persistence and a different checksum after MongoDB returns it. The checksum currently normalizes ordinary objects, dates, and object IDs, but does not define a persistence-safe representation for every value that can occur in a Mongoose payroll projection. For example, a JavaScript `Map` hashes like an empty object under the current implementation while BSON persists its entries as an ordinary object.

Schema-level `minimize: false` preserves empty objects but cannot guarantee that every in-memory value has the same representation after BSON serialization. Browser cache clearing cannot affect this server-side mismatch.

## Goals

- Store and hash the same canonical snapshot representation.
- Preserve effective payroll values without weakening checksum validation.
- Automatically repair affected runs only while they are in `review` and remain safe to recalculate.
- Never mutate an immutable `closed` or `paid` payroll run.
- Keep repair tenant/branch scoped, version guarded, and auditable.

## Non-goals

- Changing payroll calculations or override precedence.
- Automatically rewriting closed or paid payroll history.
- Removing checksum validation or accepting a mismatched snapshot.
- Bulk-migrating all historical runs during deployment.

## Canonical Persistence Representation

Introduce one reusable snapshot normalizer whose output is both BSON-safe and checksum-stable. It recursively applies these rules:

- Plain objects: normalize values and preserve keys with defined values.
- `Map`: convert entries to a plain object, then normalize recursively.
- Arrays: normalize each position; values that cannot be represented become `null` so indexes do not shift.
- `Date`: convert to an ISO-8601 string.
- Mongoose/MongoDB object IDs: convert to their hexadecimal string.
- `undefined` object properties: omit them.
- `undefined` array elements: convert to `null`.
- Non-finite numbers (`NaN`, positive infinity, negative infinity): convert to `null`, matching JSON-safe persistence semantics.
- Strings, booleans, finite numbers, and `null`: preserve unchanged.

The normalizer must not mutate its input. Object-key ordering is handled by checksum canonicalization and does not need to be imposed on stored data.

## Snapshot Creation Flow

`createEffectivePayrollSnapshot` will:

1. Project the effective payroll lines from the immutable source revision and current material overrides.
2. Normalize the projected lines into the canonical persistence representation.
3. Calculate the effective checksum from the source revision checksum and the normalized lines.
4. Return a snapshot containing those exact normalized lines and checksum.

The service must never calculate a checksum from one representation and store another.

## Read and Repair Flow

Normal reads continue to recompute and verify the pinned snapshot checksum.

When verification fails with `PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH`:

- `draft`: no pinned snapshot is authoritative; use the existing live projection flow.
- `review`: attempt a controlled repair.
- `closed` or `paid`: fail closed without changing data.

The controlled repair for `review` runs will:

1. Reload the run under the authenticated company and branch scope.
2. Confirm its status is still `review` and its version matches the version that failed verification.
3. Validate that the active source revision exists, is completed, and still matches `activeRevisionChecksum`.
4. Rebuild the effective snapshot through the canonical creation flow.
5. Update only `effectiveSnapshot` and increment `version` using an optimistic filter on `_id`, scope, status, and version.
6. Write a payroll audit entry with action `effective_snapshot_repaired`, run ID, previous checksum, replacement checksum, source revision checksum, and correlation ID. It must not include payroll amounts or employee details.
7. Return the repaired run so the original request can load and display verified results.

If the optimistic update loses a race, the operation reloads once and accepts the winning snapshot only if it verifies. Otherwise it returns the existing version-conflict/checksum error; it must not retry writes indefinitely.

Repair must use the same transaction abstraction as payroll workflow operations when transactions are available, so the snapshot update and audit entry are atomic.

## API and UI Behavior

No new user action or endpoint is required. A GET that encounters an old malformed snapshot may repair a `review` run once and then return normal results. The response should expose the new run version through the existing shape so later workflow actions use the correct optimistic version.

For `closed` or `paid` runs, retain the current protected-data message. The frontend must not suppress or fabricate payroll figures when the server refuses an immutable snapshot.

## Logging and Observability

Structured logs will distinguish:

- `effective-checksum`: initial mismatch.
- `effective-repair-success`: repair completed.
- `effective-repair-conflict`: another request changed the run.
- `effective-repair-refused`: status or source-revision checks made repair unsafe.

Logs include run ID, period key, scope identifiers already permitted by payroll logging, status, version, and checksums. They exclude employee names, payroll amounts, bank data, and full snapshot lines.

## Testing

Unit tests cover canonical normalization for nested `Map`, empty objects, `Date`, object ID, `undefined`, non-finite numbers, and arrays. A BSON serialize/deserialize regression test proves that normalized lines retain the same checksum across persistence representation.

Service tests cover snapshot creation using normalized lines and successful verification after Mongoose update casting/BSON conversion.

Repair tests cover:

- A mismatched `review` snapshot is rebuilt, version incremented, audited, and returned verified.
- `closed` and `paid` snapshots are never repaired.
- A changed or missing source revision prevents repair.
- A version race does not overwrite the winner.
- A winning concurrent snapshot is accepted only after verification.
- Repeated reads after a successful repair do not write again.

Existing payroll controller, payment, export, workflow, checksum, and UI regression suites remain required.

## Rollout

Deploy the canonical creation path and review-only repair together. Existing `review` runs are repaired lazily on their first affected read. Existing `closed` or `paid` mismatches require explicit administrator investigation because their historical data is immutable. Monitor repair-success, conflict, and refusal logs after deployment before considering any separate historical migration.
