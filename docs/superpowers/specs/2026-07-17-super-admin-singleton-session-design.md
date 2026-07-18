# Super Admin singleton account and session design

## Purpose

The system must have exactly zero or one user with `role: "superadmin"`, and at most one active privileged Super Admin session across the whole database. A successful new Super Admin login immediately invalidates the previous privileged session.

## Scope

- Add icons to the Super Admin navigation entries for User & Access and Tenant Management.
- Enforce the singleton Super Admin account at the persistence layer and at role-assignment boundaries.
- Enforce a single globally active Super Admin session after enrollment, TOTP login, or recovery-code login.
- Record replacement-session audit events and cover the behavior with automated tests.

## Account invariant

`User` will own a MongoDB partial unique index on `role`, filtered to documents where `role` is `"superadmin"`. This makes the database the final authority: scripts, direct model writes, and concurrent requests cannot create a second Super Admin.

The application will also reject any request that attempts to assign the Super Admin role when a different Super Admin already exists. This provides a clear domain error before MongoDB produces a duplicate-key error.

Existing databases are never modified automatically. Before the unique index is created, a startup/preflight check detects more than one existing Super Admin, reports their stable identifiers and emails without secrets, and fails the Super Admin security initialization. An operator must manually select the intended account and change the excess accounts to a non-Super-Admin role before deployment continues.

## Session invariant

The successful privileged-authentication paths (`confirmEnrollment`, `completeTotpLogin`, and `completeRecoveryLogin`) use one shared session-issuance operation:

1. Atomically consume the one-time challenge.
2. Revoke every unexpired, non-revoked Super Admin session with reason `replaced_by_new_login`.
3. Create the new session and issue its tokens.

The operation is run in a MongoDB transaction where transactions are available, so concurrent logins cannot leave two usable sessions. If the deployment does not support transactions, initialization fails with an explicit configuration error rather than silently weakening the one-session guarantee.

`requirePrivilegedSession` continues to check the session record on every Super Admin API request. Consequently, a revoked prior session is rejected immediately even if its JWT has not expired. Normal logout and manual revocation retain their existing behavior.

## Auditing and user experience

Each displaced session produces a security audit event containing the acting Super Admin ID, displaced session ID, replacement reason, and a non-sensitive result. The new login succeeds normally; the old browser receives an authorization/session-invalid response on its next API request and returns to the Super Admin sign-in flow.

The navigation will use the existing Lucide icon set: `UsersRound` for User & Access and `Building2` for Tenant Management. Icons include their labels and do not change route behavior.

## Error handling

- Duplicate pre-existing Super Admin users: fail fast with an actionable operations error; do not alter records.
- Attempt to promote another user: return a domain validation error; the database index remains the concurrency-safe fallback.
- Unsupported MongoDB transactions: do not issue a privileged session and report the deployment requirement.
- Revoked/expired session: return the existing privileged-session rejection response.

## Verification

- Model/index and role-assignment tests prove that a second Super Admin is rejected.
- Authentication tests prove that a new enrollment, TOTP, or recovery login revokes the previous session globally and that the previous session is no longer authorized.
- Concurrent/session-transaction adapter tests prove the session issue workflow uses one atomic boundary.
- Frontend layout tests assert both management navigation entries render their icons and preserve responsive, truncated labels.

## Out of scope

- Automatically demoting duplicate historical Super Admin accounts.
- Limiting regular Admin or non-privileged application sessions.
- Reworking the broader account-role model beyond the Super Admin invariant.
