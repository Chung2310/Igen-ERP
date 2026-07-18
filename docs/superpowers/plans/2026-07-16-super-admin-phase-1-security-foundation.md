# Super Admin Phase 1 Security Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mandatory Google Authenticator-compatible TOTP, revocable privileged sessions, step-up authentication, immutable audit records, and a guarded Super Admin control-plane shell.

**Architecture:** Keep the existing password-only flow for non-Super Admin users. For a Super Admin, successful password verification creates a short-lived login challenge instead of access and refresh tokens; TOTP enrollment or verification completes the login and creates a server-side privileged session referenced by JWT `sid`. Privileged mutations pass through a registered action framework that enforces risk, reason, step-up proof, idempotency, redaction, and audit.

**Tech Stack:** React 19, TypeScript 5.8, Express 4, MongoDB/Mongoose 9, JSON Web Tokens, Node `crypto`, `otplib`, `qrcode`, Joi, Node test runner via `tsx --test`.

## Global Constraints

- Every Super Admin login requires password plus a six-digit Google Authenticator-compatible TOTP or a valid one-time recovery procedure.
- The TOTP seed is encrypted at rest and never returned after enrollment confirmation.
- Staging and Production remain separate deployments; the browser cannot select a database or environment.
- Dangerous actions require current password, a fresh non-reused TOTP, and a written reason.
- Audit data is append-only through the application and redacts passwords, tokens, TOTP seeds, recovery codes, and private keys.
- Non-Super Admin login behavior must remain backward compatible.
- Do not add a generic MongoDB query or document editor.

## File structure

- `server/security/crypto.ts`: AES-256-GCM encryption and SHA-256/HMAC helpers.
- `server/security/totp.ts`: TOTP generation/verification and recovery-code helpers.
- `server/security/redaction.ts`: recursive audit-payload redaction.
- `server/model/super-admin-challenge.model.ts`: expiring password-first login challenges.
- `server/model/super-admin-session.model.ts`: revocable privileged sessions and TOTP replay state.
- `server/model/audit-event.model.ts`: append-only material/security event records.
- `server/model/admin-action.model.ts`: idempotent action execution records.
- `server/service/super-admin-auth.service.ts`: enrollment, TOTP completion, recovery, session, and step-up behavior.
- `server/service/audit.service.ts`: the only application write API for audit events.
- `server/super-admin/action-registry.ts`: typed risk and policy registry.
- `server/super-admin/action-executor.ts`: consistent action enforcement and result recording.
- `server/middleware/super-admin-auth.ts`: real-actor and privileged-session middleware.
- `server/router/super-admin-auth.router.ts`: authentication, enrollment, session, and recovery routes.
- `server/controller/super-admin-auth.controller.ts`: HTTP mapping for the privileged authentication service.
- `server/router/super-admin.router.ts`: guarded control-plane API root.
- `src/services/superAdminAuthService.ts`: challenge/TOTP/session API client.
- `src/context/SuperAdminAuthContext.tsx`: privileged login state and actions.
- `src/pages/super-admin/SuperAdminLoginPage.tsx`: password, enrollment, and TOTP screens.
- `src/pages/super-admin/SuperAdminShell.tsx`: environment-aware guarded shell.
- `src/components/super-admin/EnvironmentBanner.tsx`: persistent Staging/Production identity.

---

### Task 1: Cryptographic primitives and environment validation

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `server/config/env.ts`
- Create: `server/security/crypto.ts`
- Create: `server/security/totp.ts`
- Create: `server/security/redaction.ts`
- Test: `server/security/crypto.test.ts`
- Test: `server/security/totp.test.ts`
- Test: `server/security/redaction.test.ts`

**Interfaces:**
- Produces: `encryptSecret(plaintext): string`, `decryptSecret(payload): string`, `hashOpaque(value): string`, `createTotpSecret(): string`, `verifyTotp(secret, token, options?): boolean`, `generateRecoveryCodes(count?): string[]`, `redactSensitive(value): unknown`.
- Consumes: `SUPERADMIN_ENCRYPTION_KEY` as exactly 64 hexadecimal characters and `DEPLOYMENT_ENV` as `staging | production`.

- [ ] **Step 1: Add failing crypto, TOTP, recovery-code, replay-window, and recursive-redaction tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret } from "./crypto";

test("encrypts with a random IV and decrypts exactly", () => {
  process.env.SUPERADMIN_ENCRYPTION_KEY = "11".repeat(32);
  const first = encryptSecret("JBSWY3DPEHPK3PXP");
  const second = encryptSecret("JBSWY3DPEHPK3PXP");
  assert.notEqual(first, second);
  assert.equal(decryptSecret(first), "JBSWY3DPEHPK3PXP");
});
```

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { authenticator } from "otplib";
import { generateRecoveryCodes, verifyTotp } from "./totp";

test("accepts a current authenticator code and rejects malformed input", () => {
  const secret = authenticator.generateSecret();
  assert.equal(verifyTotp(secret, authenticator.generate(secret)), true);
  assert.equal(verifyTotp(secret, "123"), false);
});

test("recovery codes are unique and display-safe", () => {
  const codes = generateRecoveryCodes(10);
  assert.equal(new Set(codes).size, 10);
  assert.ok(codes.every((code) => /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code)));
});
```

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitive } from "./redaction";

test("redacts sensitive keys recursively without mutating safe values", () => {
  assert.deepEqual(redactSensitive({ email: "a@b.vn", nested: { password: "x", accessToken: "y" } }), {
    email: "a@b.vn",
    nested: { password: "[REDACTED]", accessToken: "[REDACTED]" },
  });
});
```

- [ ] **Step 2: Run tests and verify they fail because the modules and dependencies do not exist**

Run: `npx tsx --test server/security/crypto.test.ts server/security/totp.test.ts server/security/redaction.test.ts`
Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Install runtime dependencies and implement the primitives**

Run: `npm install otplib qrcode && npm install -D @types/qrcode`

Implement AES-256-GCM with a fresh 12-byte IV and serialized `v1.iv.tag.ciphertext` payload, constant-shape six-digit TOTP validation, cryptographically random recovery codes, SHA-256 opaque hashing, and recursive case-insensitive redaction for `password`, `token`, `secret`, `authorization`, `cookie`, `privateKey`, and `recoveryCode` keys.

Add to `.env.example`:

```dotenv
# Exactly 32 random bytes encoded as 64 hex characters.
SUPERADMIN_ENCRYPTION_KEY=
# Deployment-owned; accepted values are staging or production.
DEPLOYMENT_ENV=staging
```

Expose validated getters in `server/config/env.ts`:

```ts
export function getSuperAdminEncryptionKey(): Buffer;
export function getDeploymentEnv(): "staging" | "production";
```

- [ ] **Step 4: Run the focused tests and typecheck**

Run: `npx tsx --test server/security/crypto.test.ts server/security/totp.test.ts server/security/redaction.test.ts`
Expected: 3 test files pass.

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 5: Commit the cryptographic foundation**

```bash
git add package.json package-lock.json .env.example server/config/env.ts server/security
git commit -m "feat: add super admin security primitives"
```

### Task 2: Privileged authentication persistence

**Files:**
- Modify: `server/interface/user.interface.ts`
- Modify: `server/model/user.model.ts`
- Create: `server/model/super-admin-challenge.model.ts`
- Create: `server/model/super-admin-session.model.ts`
- Create: `server/model/audit-event.model.ts`
- Create: `server/model/admin-action.model.ts`
- Test: `server/model/super-admin-security-models.test.ts`

**Interfaces:**
- Produces: user `superAdminSecurity` fields; `SuperAdminChallengeModel`, `SuperAdminSessionModel`, `AuditEventModel`, and `AdminActionModel`.
- Consumes: encrypted and hashed strings produced by Task 1.

- [ ] **Step 1: Write failing schema tests**

Test that challenge documents expire by `expiresAt`, session documents can be revoked and have unique `sessionId`, action records enforce unique `(actorId, idempotencyKey)`, audit records expose no update/delete helper, and user serialization omits `totpSecretEncrypted` and recovery hashes.

- [ ] **Step 2: Run the schema test and verify failure**

Run: `npx tsx --test server/model/super-admin-security-models.test.ts`
Expected: FAIL because the models and user security fields do not exist.

- [ ] **Step 3: Add focused schemas and indexes**

Use this user interface shape:

```ts
export interface ISuperAdminSecurity {
  totpEnabled: boolean;
  totpSecretEncrypted?: string;
  recoveryCodeHashes: string[];
  enrolledAt?: Date;
  failedTotpAttempts: number;
  lockedUntil?: Date;
}
```

Use challenge fields `challengeId`, `userId`, `purpose`, `passwordVerifiedAt`, `expiresAt`, `consumedAt`, `attempts`, `sourceIp`, and `userAgent`. Use session fields `sessionId`, `userId`, `createdAt`, `lastSeenAt`, `expiresAt`, `revokedAt`, `revokeReason`, and `lastAcceptedTotpStep`. Use immutable audit documents with the fields specified in the approved design. Add TTL indexes for challenges and expired sessions, without using TTL to delete audit records.

- [ ] **Step 4: Run model tests and typecheck**

Run: `npx tsx --test server/model/super-admin-security-models.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 5: Commit the security persistence layer**

```bash
git add server/interface/user.interface.ts server/model/user.model.ts server/model/super-admin-*.ts server/model/audit-event.model.ts server/model/admin-action.model.ts server/model/super-admin-security-models.test.ts
git commit -m "feat: persist privileged sessions and audit events"
```

### Task 3: Two-step Super Admin login and recovery service

**Files:**
- Modify: `server/service/auth.service.ts`
- Modify: `server/controller/auth.controller.ts`
- Create: `server/service/super-admin-auth.service.ts`
- Create: `server/service/audit.service.ts`
- Test: `server/service/super-admin-auth.service.test.ts`

**Interfaces:**
- Produces: `beginSuperAdminLogin`, `beginEnrollment`, `confirmEnrollment`, `completeTotpLogin`, `completeRecoveryLogin`, `listSessions`, `revokeSession`, and `verifyStepUp`.
- Changes: `authService.login()` returns a discriminated union: `{ kind: "authenticated", user, accessToken, refreshToken } | { kind: "super_admin_challenge", challengeId, enrollmentRequired, expiresAt }`.

- [ ] **Step 1: Write failing service tests with injected model, clock, token, encryption, and TOTP adapters**

Cover password success creating a challenge instead of JWTs, enrollment QR generation, confirmation returning recovery codes once, normal TOTP login, recovery-code consumption, temporary lockout, session revocation, TOTP step replay rejection, and non-Super Admin backward compatibility.

- [ ] **Step 2: Run tests and verify behavioral failures**

Run: `npx tsx --test server/service/super-admin-auth.service.test.ts`
Expected: FAIL because the privileged authentication service and login union do not exist.

- [ ] **Step 3: Implement the service and audit boundary**

Use 5-minute single-use challenges, ten recovery codes, five failed TOTP attempts before a 15-minute lock, 30-minute inactivity timeout, and 8-hour absolute session lifetime. JWT access and refresh payloads for Super Admin include `sid` and `authLevel: "totp"`. Enrollment returns an `otpauth://` QR data URL before confirmation but never after confirmation. Audit every success and failure using named event types without recording raw credentials.

- [ ] **Step 4: Adapt the existing login controller without changing non-Super Admin response fields**

For a challenge response return HTTP 202:

```json
{
  "status": "challenge_required",
  "challengeId": "opaque-id",
  "enrollmentRequired": true,
  "expiresAt": "2026-07-16T12:00:00.000Z"
}
```

Only set the refresh cookie after successful TOTP or recovery completion.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npx tsx --test server/service/super-admin-auth.service.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 6: Commit the two-step login service**

```bash
git add server/service/auth.service.ts server/controller/auth.controller.ts server/service/super-admin-auth.service.ts server/service/audit.service.ts server/service/super-admin-auth.service.test.ts
git commit -m "feat: require totp for super admin login"
```

### Task 4: Privileged authentication API and middleware

**Files:**
- Modify: `server/middleware/auth.ts`
- Modify: `server/router/index.ts`
- Create: `server/middleware/super-admin-auth.ts`
- Create: `server/controller/super-admin-auth.controller.ts`
- Create: `server/router/super-admin-auth.router.ts`
- Create: `server/router/super-admin.router.ts`
- Test: `server/middleware/super-admin-auth.test.ts`
- Test: `server/router/super-admin-auth.router.test.ts`

**Interfaces:**
- Produces: `requireRealSuperAdmin`, `requirePrivilegedSession`, and routes under `/api/v1/super-admin/auth`.
- Consumes: session and authentication functions from Task 3.

- [ ] **Step 1: Write failing middleware and route tests**

Cover absent `sid`, tenant admin with forged role, revoked session, expired session, user role changed after token issuance, enrollment/verify/recovery request validation, cookie issuance only after completion, session listing, and revocation.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx tsx --test server/middleware/super-admin-auth.test.ts server/router/super-admin-auth.router.test.ts`
Expected: FAIL because privileged middleware and routes do not exist.

- [ ] **Step 3: Implement middleware that re-loads the real actor and session**

Extend `AuthenticatedRequest.user` with `sessionId`, `authLevel`, `actorId`, and optional `effectiveUserId`. For privileged routes, do not trust the role embedded in an old JWT: load the current user, require `role === "superadmin"`, require a live privileged session owned by that user, and update `lastSeenAt` with throttling.

- [ ] **Step 4: Add validated endpoints**

```text
POST   /api/v1/super-admin/auth/enrollment/start
POST   /api/v1/super-admin/auth/enrollment/confirm
POST   /api/v1/super-admin/auth/totp/verify
POST   /api/v1/super-admin/auth/recovery/verify
GET    /api/v1/super-admin/auth/sessions
DELETE /api/v1/super-admin/auth/sessions/:sessionId
POST   /api/v1/super-admin/auth/logout
GET    /api/v1/super-admin/environment
```

Mount authentication completion routes with challenge validation and mount all session/control-plane routes with `requireAuth`, `requireRealSuperAdmin`, and `requirePrivilegedSession`.

- [ ] **Step 5: Run API tests and typecheck**

Run: `npx tsx --test server/middleware/super-admin-auth.test.ts server/router/super-admin-auth.router.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 6: Commit the privileged API boundary**

```bash
git add server/middleware/auth.ts server/middleware/super-admin-auth.ts server/controller/super-admin-auth.controller.ts server/router/super-admin-auth.router.ts server/router/super-admin.router.ts server/router/index.ts server/middleware/super-admin-auth.test.ts server/router/super-admin-auth.router.test.ts
git commit -m "feat: guard super admin api sessions"
```

### Task 5: Registered action execution and step-up proof

**Files:**
- Create: `server/super-admin/action-registry.ts`
- Create: `server/super-admin/action-executor.ts`
- Create: `server/super-admin/action-types.ts`
- Test: `server/super-admin/action-executor.test.ts`

**Interfaces:**
- Produces: `registerAdminAction(definition)`, `executeAdminAction(context, request, handler)`, `AdminActionRisk`, and the first `security.session.revoke` definition.
- Consumes: step-up verification from Task 3, redaction from Task 1, action/audit models from Task 2.

- [ ] **Step 1: Write failing action-policy tests**

Test standard mutation, dangerous-action rejection without password/TOTP/reason, replay rejection, idempotent duplicate response, redacted before/after audit, handler failure audit, and partial result representation.

- [ ] **Step 2: Run the test and verify failure**

Run: `npx tsx --test server/super-admin/action-executor.test.ts`
Expected: FAIL because the registry and executor do not exist.

- [ ] **Step 3: Implement explicit action definitions and executor**

```ts
export type AdminActionRisk = "read_only" | "standard" | "sensitive" | "dangerous";

export interface AdminActionDefinition<Input> {
  type: string;
  risk: AdminActionRisk;
  tenantScope: "system" | "single_tenant" | "cross_tenant";
  requiresReason: boolean;
  requiresStepUp: boolean;
  background: boolean;
  parse(input: unknown): Input;
}
```

The executor reserves the idempotency record before mutation, binds step-up to action type plus action ID, passes only parsed input to the handler, writes success or failure audit, and returns the stored result for exact duplicates. A duplicate key with a different payload hash returns HTTP 409 through a typed conflict error.

- [ ] **Step 4: Run action tests and typecheck**

Run: `npx tsx --test server/super-admin/action-executor.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 5: Commit the administrative action framework**

```bash
git add server/super-admin server/super-admin/action-executor.test.ts
git commit -m "feat: enforce audited super admin actions"
```

### Task 6: Super Admin login UI and guarded shell

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/context/AuthContext.tsx`
- Modify: `src/services/authService.ts`
- Create: `src/services/superAdminAuthService.ts`
- Create: `src/context/SuperAdminAuthContext.tsx`
- Create: `src/pages/super-admin/SuperAdminLoginPage.tsx`
- Create: `src/pages/super-admin/SuperAdminShell.tsx`
- Create: `src/components/super-admin/EnvironmentBanner.tsx`
- Test: `src/services/superAdminAuthService.test.ts`
- Test: `src/pages/super-admin/SuperAdminLoginPage.test.tsx`

**Interfaces:**
- Produces: `/super-admin` shell and a login state machine with `password`, `enroll`, `verify_totp`, `recovery`, and `authenticated` states.
- Consumes: Task 4 API routes and existing authenticated profile types.

- [ ] **Step 1: Add frontend test dependencies and failing state/API tests**

Run: `npm install -D vitest jsdom @testing-library/react @testing-library/user-event`

Test that an HTTP 202 login response does not store an access token, enrollment renders the QR and recovery codes once, six-digit verification completes login, recovery is an explicit alternate path, `/super-admin` rejects non-Super Admin profiles, and the environment banner cannot be dismissed.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/services/superAdminAuthService.test.ts src/pages/super-admin/SuperAdminLoginPage.test.tsx`
Expected: FAIL because the privileged frontend modules do not exist.

- [ ] **Step 3: Implement the challenge-aware client without persisting challenge secrets**

Keep the challenge ID in React state/session storage only for the short enrollment flow. Store access tokens only after TOTP/recovery completion. Clear challenge, QR, and recovery-code display state on completion, cancellation, expiry, or navigation away.

- [ ] **Step 4: Route `/super-admin` before the normal ERP tab router**

Render the privileged provider and shell only for the normalized `/super-admin` path. The shell fetches `/api/v1/super-admin/environment`, rejects a mismatch with deployment-provided UI metadata, and renders a persistent red Production or amber Staging banner. Phase 1 navigation contains Overview, Security, and Audit placeholders labeled as unavailable until their owning phase is delivered; it contains no fake operational data.

- [ ] **Step 5: Run frontend tests, typecheck, and build**

Run: `npx vitest run src/services/superAdminAuthService.test.ts src/pages/super-admin/SuperAdminLoginPage.test.tsx`
Expected: PASS.

Run: `npm run typecheck`
Expected: exit code 0.

Run: `npm run build`
Expected: exit code 0 and both frontend and server bundles produced.

- [ ] **Step 6: Commit the guarded control-plane shell**

```bash
git add package.json package-lock.json src/App.tsx src/context/AuthContext.tsx src/services/authService.ts src/services/superAdminAuthService.ts src/context/SuperAdminAuthContext.tsx src/pages/super-admin src/components/super-admin
git commit -m "feat: add super admin totp login shell"
```

### Task 7: Phase 1 security verification and operational documentation

**Files:**
- Modify: `README.md`
- Create: `docs/super-admin/security-runbook.md`
- Create: `docs/super-admin/phase-1-acceptance.md`

**Interfaces:**
- Produces: deployment key-generation, enrollment, recovery, session-revocation, key-rotation, and incident procedures.
- Consumes: all Phase 1 behavior.

- [ ] **Step 1: Document exact environment setup and safe rollout**

Include generation of `SUPERADMIN_ENCRYPTION_KEY`, independent values for Staging and Production, backup implications, the rule that key rotation must re-encrypt enrolled TOTP secrets before switching, initial enrollment, recovery-code handling, account lockout recovery, session revocation, rollback, and audit verification.

- [ ] **Step 2: Run the complete Phase 1 test suite**

Run: `npx tsx --test server/security/*.test.ts server/model/super-admin-security-models.test.ts server/service/super-admin-auth.service.test.ts server/middleware/super-admin-auth.test.ts server/router/super-admin-auth.router.test.ts server/super-admin/action-executor.test.ts`
Expected: all Phase 1 backend tests pass.

Run: `npx vitest run src/services/superAdminAuthService.test.ts src/pages/super-admin/SuperAdminLoginPage.test.tsx`
Expected: all Phase 1 frontend tests pass.

- [ ] **Step 3: Run repository verification**

Run: `npm run typecheck`
Expected: exit code 0.

Run: `npm run build`
Expected: exit code 0.

Run: `git diff --check`
Expected: no whitespace errors.

- [ ] **Step 4: Complete manual Staging acceptance**

Verify first enrollment, subsequent TOTP login, invalid-code lockout, recovery-code single use, session revocation, non-Super Admin denial, Production/Staging banner identity, absence of secrets in network responses and logs, and traceability of success and failure events by audit ID.

- [ ] **Step 5: Commit Phase 1 documentation**

```bash
git add README.md docs/super-admin
git commit -m "docs: add super admin security runbook"
```

## Self-review result

- Spec coverage: Phase 1 covers mandatory TOTP, recovery, privileged sessions, step-up authentication, environment identity, action registration, redaction, and immutable audit foundations. Tenant/user, finance/data, operations, and backup/configuration remain explicitly assigned to Phases 2-5.
- Placeholder scan: no deferred implementation placeholders are used; Phase 1 unavailable navigation is intentional product copy and contains no simulated data.
- Type consistency: privileged JWTs use `sid`; server requests expose `sessionId`; challenges use `challengeId`; actions use `actionId` and `(actorId, idempotencyKey)` uniqueness throughout.
