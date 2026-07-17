# Super Admin Security Runbook

## Environment setup

Set `DEPLOYMENT_ENV` independently to `staging` or `production`. Generate a different encryption key for each deployment with `openssl rand -hex 32` and store the 64-character result as `SUPERADMIN_ENCRYPTION_KEY`. Never expose either value through a `VITE_` variable.

Back up the encryption key in the deployment secret manager. Losing it makes enrolled TOTP seeds unrecoverable. To rotate it, decrypt every enrolled seed with the old key, re-encrypt with the new key, verify a staging login, and only then switch the deployment secret.

## Enrollment and recovery

The first password login redirects the operator to QR enrollment. Confirm the QR with one six-digit code. Recovery codes appear once and must be stored offline. Each recovery code is single-use. If all codes are lost, an authorized database operator must disable TOTP for the account and revoke every privileged session before re-enrollment.

Five invalid TOTP attempts should be treated as a security incident. Revoke sessions, verify the real operator out of band, inspect audit events, and only then unlock or reset enrollment.

## Sessions and incidents

Privileged access tokens carry a server-side `sid`. Revoking the corresponding session immediately blocks the control-plane API even if its JWT has not expired. For suspected compromise: revoke all sessions, rotate the password, re-enroll TOTP, rotate recovery codes, and correlate audit events by action/correlation ID.

Rollback the application without rolling back or deleting `audit_events`. Staging and Production databases and encryption keys must never be interchangeable.
