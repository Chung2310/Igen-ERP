# Super Admin Control Plane Design

**Date:** 2026-07-16
**Status:** Approved design, pending written-spec review
**Project:** Igen ERP

## 1. Purpose

Build a dedicated Super Admin control plane that lets authorized operators manage the complete multi-tenant Igen ERP system without direct MongoDB access. The control plane covers tenant and user administration, access control, finance, data operations, observability, integrations, configuration, backup, restore, and immutable audit history across Staging and Production.

The control plane is not a generic MongoDB editor. Every operation is an explicit business action exposed through a validated API, protected according to its risk, and recorded in the audit trail.

## 2. Goals

- Let Super Admins perform all approved operational and business administration through the application.
- Preserve strict isolation between tenants identified by `companyCode`.
- Require password plus Google Authenticator-compatible TOTP for every Super Admin login.
- Require step-up authentication for dangerous actions.
- Allow time-limited user impersonation while retaining the real operator identity.
- Make every material action attributable, explainable, and searchable.
- Support Staging and Production without allowing the browser to choose or switch databases.
- Provide safe workflows for long-running, bulk, financial, backup, and restore operations.

## 3. Non-goals

- A Mongo shell, arbitrary query console, or generic collection/document editor.
- Displaying existing secrets, passwords, TOTP seeds, tokens, or private keys.
- Allowing Super Admin impersonation to bypass audit, step-up authentication, or environment boundaries.
- Treating direct mutation of a wallet balance as an administrative operation.
- Sharing Super Admin routes or permissions with a tenant-level `admin` role.

## 4. Current-system fit

The current application uses React 19 and Vite on the frontend, Express on the backend, and MongoDB through Mongoose. It already has the `superadmin` role, tenant-aware behavior based on `companyCode`, role and permission services, company and user models, wallet services, dashboard services, Redis infrastructure, and protected API middleware.

The new control plane extends these patterns with a separately guarded frontend area and an explicit Super Admin API surface. Existing services may be reused only when their tenant checks and audit behavior meet this specification.

## 5. Architecture

### 5.1 Frontend boundary

- Use a dedicated route namespace such as `/super-admin`.
- Use a dedicated layout, navigation, route guard, and error boundary.
- Permit access only to an authenticated user whose effective account and real actor satisfy the Super Admin route policy.
- Show a persistent environment marker. Production uses a prominent red warning treatment.
- Show a persistent impersonation banner containing the target user, tenant, expiry, reason, and an immediate exit action.
- Never accept a database connection string or environment database selector from the browser.

### 5.2 Backend boundary

- Place privileged endpoints under `/api/v1/super-admin/*`.
- Apply authentication, Super Admin authorization, environment policy, tenant resolution, input validation, risk classification, step-up authentication, execution, and audit in a consistent action pipeline.
- Return an `actionId` for material mutations and background operations.
- Use allow-listed request fields and service methods. Do not pass arbitrary client filters or updates into Mongoose.

Standard mutation flow:

`Super Admin -> privileged API -> actor check -> tenant check -> risk check -> step-up check -> validated service action -> transaction or queued job -> audit -> response`

### 5.3 Tenant boundary

- `companyCode` is the tenant boundary for business data.
- A system-level Super Admin may view all tenants or explicitly scope a request to one tenant.
- Tenant-scoped administrators and users cannot call the Super Admin API surface.
- Every tenant-scoped action records its resolved `companyCode`; the backend never trusts an unvalidated company code supplied by the browser.
- Cross-tenant bulk actions require an impact preview and explicit Production confirmation.

### 5.4 Environment boundary

- Staging and Production are separate deployments with separate authentication sessions and backend configuration.
- Environment selection is deployment-owned, not user-owned.
- Production applies stronger visual warnings and requires step-up authentication for all dangerous actions.
- Backup restore must be validated on Staging before the corresponding Production restore workflow becomes eligible.

## 6. Authentication and session security

### 6.1 Mandatory Google Authenticator TOTP

- Every Super Admin signs in with password plus a six-digit, standards-compatible TOTP code usable in Google Authenticator.
- On first sign-in, the Super Admin must enroll by scanning a QR code and confirming a valid TOTP before accessing the control plane.
- The TOTP seed is encrypted at rest and is never returned after enrollment is confirmed.
- Login and TOTP verification endpoints use rate limiting, attempt tracking, temporary lockout, and security audit events.
- A TOTP value accepted for step-up authentication cannot be reused for another step-up action in the same time window.

### 6.2 Recovery

- Enrollment creates one-time recovery codes.
- Recovery codes are shown once, stored as hashes, and invalidated individually after use.
- Losing the authenticator cannot be resolved by an unauthenticated email-only disable flow.
- Recovery requires a valid unused recovery code or an audited administrative recovery procedure.
- Resetting another Super Admin's 2FA revokes all of that account's sessions and raises a security alert.

### 6.3 Sessions and step-up authentication

- Super Admin sessions have short inactivity and absolute lifetimes appropriate for privileged access.
- Session records support listing and revocation by the account owner or an authorized recovery action.
- Dangerous actions require the current password, a fresh TOTP, and a written reason.
- Step-up authorization is action-bound and short-lived; it is not a general bypass token.

## 7. Impersonation

- A Super Admin may start a time-limited impersonation session for a tenant user after entering a support reason.
- The session retains both `actorSuperAdminId` and `effectiveUserId`.
- All authorization decisions use the effective user except policies explicitly reserved for the real actor.
- All audit events record the real actor, effective user, tenant, environment, reason, source IP, user agent, and session identifier.
- While impersonating, the Super Admin cannot manage Super Admin accounts, reset privileged 2FA, expose or update system secrets, or remove the audit trail.
- Starting, extending, and ending impersonation are audited events.
- Expiry or manual exit immediately restores the real Super Admin context.

## 8. Control-plane modules

### 8.1 System overview

- Tenant, user, active-session, and locked-account counts.
- Revenue, wallet, transaction, and usage summaries by tenant and time range.
- Health of API, MongoDB, Redis, queues, storage, Socket.IO, and configured integrations.
- Security alerts, critical errors, failed jobs, backup status, and restore eligibility.
- A missing health signal is shown as `unknown`, never as healthy.

### 8.2 Tenant management

- Create, view, edit, suspend, reactivate, archive, and schedule deletion of tenants.
- Manage plan, quotas, enabled modules, and tenant-specific safe configuration.
- View tenant users, usage, storage, resources, financial summary, and recent audit activity.
- Tenant deletion is staged: suspension, retention window, impact preview, backup verification, queued deletion, and completion report.
- Direct immediate hard deletion is not available in the interface.

### 8.3 Users, roles, and access

- Search users across tenants using explicit filters and pagination.
- Create and edit accounts, lock or unlock access, revoke sessions, and initiate password reset.
- Reset 2FA through the controlled recovery workflow.
- Manage roles and permissions within an explicit tenant scope.
- Start and stop audited impersonation sessions.
- Prevent tenant administrators from escalating themselves or others to Super Admin.

### 8.4 Finance

- View wallets, ledger entries, transactions, reconciliation state, and abnormal activity.
- Change effective balances only through compensating ledger entries with reason, actor, and immutable references.
- Support controlled refunds and report export.
- Never directly overwrite a stored wallet balance from the control plane.
- Financial mutations are dangerous actions and always require impact preview and step-up authentication in Production.

### 8.5 Data and usage

- Show record counts, storage, quotas, and growth by tenant and module.
- Provide module-specific search, inspection, export, archive, and repair actions.
- Detect orphaned data, broken references, duplicate business identifiers, and quota violations through named checks.
- Repairs execute through reviewed, idempotent operations and produce before/after reports.
- No generic database query or arbitrary document update facility is included.

### 8.6 Operations and integrations

- Display service health, latency, capacity, queue depth, job failures, and storage availability.
- Permit allow-listed job actions such as retry and cancel when supported by the job type.
- Show sanitized error details with a correlation ID.
- Display integration state and allow safe connectivity tests or reconnection workflows.
- Secret-backed integrations permit secret replacement but never reveal the current secret.

### 8.7 Backup and restore

- Create and monitor backup jobs and view verification reports.
- Support tenant-scoped and full-system restore workflows where the storage format permits them.
- Restore performs compatibility checks, dependency checks, capacity checks, and an impact preview.
- Production restore requires a fresh restore point and evidence that the candidate backup passed a Staging restore validation.
- Restore never retries automatically after a failure.
- Every restore creates a durable report linked to its action and audit records.

### 8.8 Versioned system configuration

- Manage feature flags, quotas, safe operational limits, notification templates, and approved integration settings.
- Configuration changes create immutable versions with diffs, actor, reason, and deployment environment.
- Rollback creates a new version rather than deleting history.
- Sensitive configuration is write-only and redacted from APIs, logs, diffs, and audit payloads.

### 8.9 Security and audit

- Search login events, failed authentication, impersonation, permission changes, financial operations, configuration changes, bulk actions, backups, and restores.
- Filter by real actor, effective user, tenant, environment, action, result, risk, and time.
- Audit storage is append-only from the application perspective.
- The control plane has no edit or delete audit operation.
- Audit exports are themselves audited.

## 9. Administrative action framework

Each material action has a registered action type containing:

- Required real-actor role and effective-user restrictions.
- Tenant scope rules.
- Risk class: read-only, standard mutation, sensitive, or dangerous.
- Required input schema and allowed fields.
- Whether impact preview, step-up authentication, reason, transaction, queue, or idempotency is required.
- Audit redaction rules.
- Success, partial-failure, and failure result schemas.

Dangerous actions include at least tenant deletion, bulk account lock, privileged 2FA reset, wallet adjustment, Production configuration change, backup restore, and destructive repair.

The audit event for a material action contains:

- `actionId`, action type, risk class, result, and timestamps.
- Real actor, effective user, impersonation session, tenant, and environment.
- Written reason, source IP, user agent, and correlation ID.
- Redacted before and after snapshots where applicable.
- Background job identifier and per-item result summary where applicable.

## 10. Data consistency and long-running work

- Use MongoDB transactions for short operations that mutate multiple related documents when the deployment supports transactions.
- Use queues for exports, bulk changes, tenant deletion, backup, restore, and repair jobs.
- Require an idempotency key for retriable mutations and background-job creation.
- A repeated request with the same key returns the original action result instead of applying the mutation twice.
- Bulk actions produce a preview count and a stable target definition before execution.
- Partial batch failures return per-item outcomes and an accurate aggregate state.
- Restore jobs are explicitly non-auto-retriable.

## 11. Error handling

- Field validation errors identify the invalid field without exposing internals.
- Authorization and tenant errors reveal no inaccessible tenant data.
- API and background errors include a correlation ID usable across UI, application logs, job records, and audit events.
- A partially completed operation is never reported as a complete success.
- Retriable jobs expose bounded retry controls and attempt history.
- Unknown monitoring state is distinct from healthy, degraded, and unavailable.
- Sensitive values are redacted before they reach logs, error responses, audit events, or monitoring providers.

## 12. Delivery phases

### Phase 1: Privileged security foundation

Deliver mandatory password-plus-TOTP login, enrollment and recovery codes, privileged sessions, step-up authentication, action registration, audit records, redaction, environment policy, and base Super Admin route/API guards.

### Phase 2: Core tenant administration

Deliver the overview dashboard, tenant lifecycle, global user search and administration, roles and permissions, session revocation, controlled 2FA reset, and user impersonation.

### Phase 3: Finance and governed data tools

Deliver wallet and ledger administration, reconciliation views, compensating entries, usage analytics, exports, named integrity checks, and allow-listed repair actions.

### Phase 4: Operations and integrations

Deliver health dashboards, queue and job controls, sanitized error inspection, storage status, Socket.IO status, integration state, connectivity tests, and reconnection workflows.

### Phase 5: Configuration, backup, and restore

Deliver versioned configuration, feature flags and quotas, secret replacement, backup management, Staging validation, Production restore gates, and restoration reports.

Each phase must result in working, testable software and must pass Staging acceptance before Production rollout.

## 13. Testing strategy

### 13.1 Unit tests

- Tenant resolution and isolation.
- Super Admin route and action authorization.
- TOTP enrollment, verification, replay prevention, recovery-code consumption, and lockout.
- Step-up action binding and expiry.
- Audit redaction and risk classification.
- Impersonation identity resolution and prohibited actions.
- Ledger-based balance adjustment and idempotency.

### 13.2 API integration tests

- Every privileged endpoint with missing, invalid, expired, tenant-level, and valid Super Admin credentials.
- Cross-tenant access and forged `companyCode` attempts.
- Dangerous actions with missing password, stale or reused TOTP, and missing reason.
- Transactions, duplicate idempotency keys, partial batch results, job creation, and audit linkage.
- Secret replacement without secret disclosure.

### 13.3 End-to-end tests

- First-login TOTP enrollment and subsequent password-plus-TOTP login.
- Recovery-code login and one-time invalidation.
- Tenant creation, suspension, reactivation, archive, and scheduled deletion preview.
- User lock, session revocation, 2FA reset, impersonation, and impersonation exit.
- Wallet compensating entry with Production step-up authentication.
- Backup creation, Staging restore validation, and gated Production restore workflow.

### 13.4 Operational acceptance

- Run smoke tests on Staging before Production rollout.
- Verify unavailable monitoring dependencies display `unknown` rather than healthy.
- Verify secrets do not appear in browser responses, application logs, errors, configuration diffs, or audit data.
- Verify every dangerous success and failure can be traced by `actionId` and correlation ID.

## 14. Acceptance criteria

- An authorized Super Admin can perform every approved operation in this specification without direct MongoDB access.
- A non-Super Admin cannot access any Super Admin page or API, even with a forged tenant or role value.
- Every Super Admin login requires a password and a valid Google Authenticator-compatible TOTP or valid one-time recovery procedure.
- Every dangerous Production action requires the current password, a fresh non-reused TOTP, and a reason.
- Every material change identifies the real actor, effective user, tenant, environment, reason, result, and redacted before/after state where applicable.
- Impersonation is time-limited, visible, auditable, and unable to perform reserved privileged actions.
- No secret is retrievable through the control plane after it is stored.
- Financial corrections use ledger entries rather than direct balance mutation.
- Backup validity and Staging restore evidence are required before Production restore eligibility.
- Failed or partial actions are reported accurately and remain traceable.

## 15. Implementation planning boundaries

This design must be converted into five implementation plans matching the delivery phases. Phase 1 is a prerequisite for every later plan. Phases 2 through 5 may reuse the action framework but must define their own API contracts, models, migrations or indexes, frontend routes, tests, observability, rollout, and rollback procedures.

No implementation phase may introduce a generic database editor as a shortcut for a missing administrative workflow.
