# Super Admin Phase 2A/2B: Tenant and User Management

**Date:** 2026-07-17  
**Status:** Approved for specification review  
**Parent:** Super Admin Control Plane, Phase 2

## Purpose

Deliver the complete tenant-management and user/access-management capabilities of the Super Admin Control Plane in two independently mergeable branches. Both modules reuse the existing Super Admin authentication, action, step-up, and audit foundations.

## Branch boundaries

### Branch A: `feat/super-admin-tenant-management`

Own tenant lifecycle and tenant-scoped administration:

- Create, list, search, filter, view, and edit tenants.
- Suspend, reactivate, archive, and schedule deletion of a tenant.
- Require a retention window, impact preview, backup-verification evidence, and a queued job before deletion; the UI offers no immediate hard-delete action.
- Manage tenant plan, quotas, enabled modules, and allow-listed safe configuration.
- Show tenant users, usage, storage, resource counts, financial summary, and recent audit activity.

### Branch B: `feat/super-admin-user-access-management`

Own global users, access, and support actions:

- Search, filter, paginate, view, create, and edit users across explicit tenant scopes.
- Lock and unlock accounts, start password-reset workflows, and revoke user sessions.
- Reset 2FA only through the controlled recovery workflow; privileged-account recovery revokes all sessions and creates a security alert.
- View and manage tenant-scoped roles and permissions.
- Start and stop time-limited impersonation sessions with a written support reason.
- Prevent any tenant administrator or user from assigning or escalating Super Admin access.

## Shared backend contract

- All endpoints are under `/api/v1/super-admin` and require a current authenticated `superadmin` account.
- Browser requests may select a tenant only by an explicit `companyCode`; the server validates scope and resolves it before use.
- Mutations use an allow-listed input schema, return an `actionId`, and write a redacted audit event including actor, effective user (if impersonating), tenant, environment, reason, result, source metadata, and correlation ID.
- Dangerous operations require current-password and fresh-TOTP step-up authentication plus a non-empty reason. These include scheduled tenant deletion, privileged 2FA reset, permission changes affecting high-privilege accounts, and impersonation start.
- Forbidden or cross-tenant requests must not reveal inaccessible data.

## Frontend contract

- The Super Admin shell owns top-level navigation and route composition; module branches add route-local screens, services, types, components, and tests only.
- Tenant pages include list, detail, edit, lifecycle workflow, configuration, and related-data tabs.
- User pages include global search, user detail, access controls, role/permission editor, 2FA recovery workflow, sessions, and impersonation controls.
- Every destructive or dangerous action presents an impact summary, requires a reason, and routes the operator through the existing step-up flow when required.
- Errors show safe messages and correlation IDs, never raw backend details or secret values.

## Data and safety rules

- Tenant lifecycle transitions are explicit and validated: active -> suspended -> active, active/suspended -> archived, and archived -> scheduled deletion. Scheduled deletion is cancellable until its execution time.
- Deletion executes asynchronously, is idempotent, produces per-stage results, and never retries automatically after failure.
- Tenant configuration is limited to explicitly approved keys; existing secrets are never returned by an API.
- User mutations operate inside one resolved tenant scope. Bulk mutation is excluded from this phase.
- Impersonation records the real Super Admin and effective user, expires automatically, is visible in the UI, and cannot manage Super Admin accounts, privileged recovery, secrets, or audit records.

## Testing and handoff

- Unit tests cover lifecycle transitions, tenant resolution, role-escalation prevention, validation, risk classification, and audit payload redaction.
- API tests cover missing/invalid/non-Super-Admin credentials, cross-tenant attempts, mutation validation, step-up failure/success, audit linkage, and idempotency where applicable.
- Frontend tests cover route guards, loading/error states, confirmation/step-up flows, and rendering of related data.
- Each branch runs focused tests, `npm run typecheck`, `npm run build`, and `git diff --check` before handoff.
- The integrator merges API registration and top-level Super Admin navigation after contracts are stable, then runs end-to-end authorization and audit regression checks.

## Out of scope

- Wallet adjustments, ledger correction, backups/restores, operations health, integrations, and versioned system configuration are later phases.
- Generic database queries, arbitrary document edits, or immediate tenant hard deletion are not permitted.
