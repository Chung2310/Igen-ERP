# Payroll Policy Version Management Design

## Goal

Allow users with `payroll:manage` to create, edit, clone, activate, retire, and delete payroll formula-policy versions while preserving the formula history of finalized payroll periods. A policy used by a `closed` or `paid` payroll run cannot be deleted.

## Permission and Scope

All policy reads continue to use `payroll:read`. Every mutating operation—create, edit, clone, activate, retire, and delete—uses the existing `payroll:manage` permission. Every query and mutation is scoped by the authenticated company. Policies from another company must appear as not found.

## Lifecycle Rules

Policies retain the states `draft`, `active`, and `retired`.

- Create always produces a `draft` owned by the authenticated company.
- Edit is allowed only for `draft`. The request supplies the expected document version; a stale version returns HTTP 409.
- Clone accepts any source state and creates a new `draft`. The caller supplies a unique new code. The default display name is the source name followed by “Bản sao” unless the caller supplies a name. Activation, retirement, identity, timestamps, and version metadata are not copied.
- Activate changes only `draft -> active` and retains the existing definition and effective-window validation.
- Retire changes only `active -> retired`.
- Delete accepts only `draft` or `retired`. An `active` policy must be retired first.
- Delete is rejected when a `closed` or `paid` payroll run references the policy.

Every successful mutation writes an audit entry containing the operation, policy ID/code, actor, and relevant before/after state. Delete audit metadata is recorded before removal so the event remains available afterward.

## Immutable Payroll References

Payroll calculation snapshots must identify the exact policy version used. Newly calculated legacy lines and operational calculation-revision lines store:

- `policyId`: database ID of the selected policy, omitted only when the built-in default policy is used.
- `policyCode`: policy code, or a stable built-in default marker.
- `policyName`: policy name at calculation time.
- Existing `formulaVersion`: algorithm version, retained separately because it does not identify a policy record.

The fields are snapshots: later edits to a draft policy or retirement of an active policy do not rewrite historical payroll lines.

Before deletion, the backend searches `closed` and `paid` runs in the same company for matching `lines.policyId`, including calculation revisions referenced by those runs. A match returns HTTP 409 with code `PAYROLL_POLICY_IN_USE` and a compact list of affected period keys.

Older finalized runs may not have `policyId`. For these records only, deletion performs a conservative fallback: if the run period intersects the policy effective window and its lines have no policy identity, the policy is treated as in use. This can block deletion rather than risk destroying historical configuration.

## API

Existing endpoints remain:

- `GET /policies`
- `POST /policies`
- `POST /policies/:id/activate`
- `POST /policies/:id/retire`

Add:

- `PATCH /policies/:id` with the complete validated policy definition plus `expectedVersion`.
- `POST /policies/:id/clone` with `code` and optional `name`.
- `DELETE /policies/:id`.

All mutation responses return the resulting policy except delete, which returns the deleted policy ID. Validation and duplicate-code errors use the existing payroll operation error format.

## UI

The payroll configuration area displays policy versions in effective-date order with status badges and state-appropriate actions:

- Draft: **Sửa**, **Nhân bản**, **Áp dụng**, **Xóa**.
- Active: **Nhân bản**, **Ngưng áp dụng**.
- Retired: **Nhân bản**, **Xóa**.

Only users with `payroll:manage` see mutation controls. The create/edit form uses the existing policy definition fields and submits a complete definition. Clone prompts for a new code and optional name. Delete and retire require confirmation. A blocked delete displays the affected payroll periods returned by the API.

The UI reloads the policy list after every successful mutation and prevents duplicate submissions while a request is active.

## Boundaries

Policy lifecycle and deletion checks live in the payroll-policy operations service. Policy usage lookup is isolated behind a repository-style function so lifecycle tests can exercise decisions without rendering UI or running an HTTP server. Payroll calculation services own stamping policy identity onto snapshots. The UI owns presentation and confirmation only.

This feature does not allow editing active or retired policies, restoring retired policies, deleting active policies, or rewriting historical payroll results.

## Testing

Automated coverage verifies:

- Every mutation route requires `payroll:manage` and remains company-scoped.
- Only draft policies can be edited, with optimistic version conflict handling.
- Clone creates an independent draft with a unique code and sanitized metadata.
- Activate and retire retain their current legal transitions.
- Active deletion is rejected.
- Draft/retired deletion succeeds when unused.
- Deletion is rejected for direct `policyId` references in `closed` and `paid` runs.
- Revision references are checked.
- Legacy finalized runs without policy identity trigger the conservative effective-window fallback.
- Calculation lines and revisions snapshot `policyId`, `policyCode`, and `policyName` alongside `formulaVersion`.
- All mutations write audit entries.
- UI action policy exposes only lifecycle-valid controls and manager-only mutations.
- TypeScript typechecking and existing payroll workflow tests remain green.
