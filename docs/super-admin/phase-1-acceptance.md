# Super Admin Phase 1 Acceptance

- [ ] First password login returns HTTP 202 without access or refresh tokens.
- [ ] QR enrollment works with Google Authenticator-compatible TOTP.
- [ ] Recovery codes display once and are consumed once.
- [ ] Subsequent login requires password plus TOTP.
- [ ] Revoked and expired privileged sessions receive HTTP 401.
- [ ] A current tenant admin cannot use a forged/stale Super Admin JWT.
- [ ] `/super-admin` shows a persistent Staging or Production banner.
- [ ] Production and Staging use separate databases and encryption keys.
- [ ] Passwords, tokens, TOTP seeds and recovery codes are absent from audit payloads.
- [ ] Sensitive actions require reason; dangerous actions require password and fresh TOTP.
