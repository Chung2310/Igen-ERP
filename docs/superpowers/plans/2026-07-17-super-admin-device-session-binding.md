# Super Admin Device Session Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind every privileged Super Admin challenge and session to one browser-profile UUID while recording, but not enforcing, login and latest IP addresses.

**Architecture:** A shared frontend request utility owns the persistent UUID and attaches it to every Super Admin request. The HTTP boundary normalizes device/IP/user-agent metadata, the authentication service carries it from password challenge into the session, and privileged middleware revokes sessions whose UUID no longer matches. Session metadata is returned by the existing endpoint and displayed in the session-management UI.

**Tech Stack:** TypeScript, Express, Mongoose, React, Fetch API, Node test runner, Vitest, Vite.

## Global Constraints

- Device identity is a generated canonical UUID stored in browser `localStorage`, not a hardware serial or fingerprint.
- A missing, malformed, or changed device ID must prevent challenge completion and revoke an existing privileged session.
- IP changes must never independently deny access.
- IP must come from Express `req.ip` under the existing one-hop proxy trust boundary.
- Pre-existing unrelated working-tree changes must not be staged or overwritten.

---

### Task 1: Shared browser device identity and request transport

**Files:**
- Create: `src/services/superAdminRequest.ts`
- Test: `src/services/superAdminRequest.test.ts`
- Modify: `src/services/superAdminAuthService.ts`
- Modify: `src/services/superAdminAuditService.ts`
- Modify: `src/services/superAdminDashboardService.ts`
- Modify: `src/services/superAdminTenantService.ts`
- Modify: `src/services/superAdminUserAccessService.ts`
- Modify: `src/pages/super-admin/SuperAdminShell.tsx`
- Modify: `src/components/super-admin/SessionsTab.tsx`

**Interfaces:**
- Produces: `getSuperAdminDeviceId(storage?, createUuid?)`, `getSuperAdminDeviceHeaders()`, and `superAdminRequest(path, init?)`.

- [ ] **Step 1: Write failing Vitest cases** for reusing a canonical UUID, replacing invalid storage, and attaching `x-device-id` to login and authenticated requests.
- [ ] **Step 2: Run** `npx vitest run src/services/superAdminRequest.test.ts --environment jsdom`; expect failure because the utility does not exist.
- [ ] **Step 3: Implement the minimal utility** using `crypto.randomUUID()`, a versioned storage key, merged request headers, bearer token lookup, and JSON error handling.
- [ ] **Step 4: Migrate all Super Admin fetch calls** to the shared utility, including `/api/v1/auth/login` and session list/revoke/logout.
- [ ] **Step 5: Re-run focused frontend tests** and expect PASS.

### Task 2: Persist request metadata from challenge to session

**Files:**
- Modify: `server/security/super-admin-request-context.ts`
- Test: `server/security/super-admin-request-context.test.ts`
- Modify: `server/model/super-admin-challenge.model.ts`
- Modify: `server/model/super-admin-session.model.ts`
- Modify: `server/model/super-admin-security-models.test.ts`
- Modify: `server/controller/auth.controller.ts`
- Modify: `server/service/auth.service.ts`
- Modify: `server/service/super-admin-auth.service.ts`
- Modify: `server/service/super-admin-auth.service.test.ts`

**Interfaces:**
- Consumes: `SuperAdminRequestMetadata { deviceId?, sourceIp?, userAgent? }`.
- Produces: required session `deviceId`, optional `loginIp`, `lastIp`, `userAgent`, and metadata-aware challenge completion methods.

- [ ] **Step 1: Extend tests first** to require challenge metadata, reject missing/mismatched device IDs at completion, and create a session with `deviceId`, `loginIp`, `lastIp`, and `userAgent`.
- [ ] **Step 2: Run focused backend tests** and confirm assertions fail specifically because metadata is not yet propagated or enforced.
- [ ] **Step 3: Add schema fields** and pass normalized request metadata from controllers through `authService` into challenge creation/completion.
- [ ] **Step 4: Add one device assertion helper** inside the auth service and call it for enrollment, TOTP, and recovery endpoints before session issuance.
- [ ] **Step 5: Create replacement sessions atomically** with the challenge metadata while preserving singleton-session behavior.
- [ ] **Step 6: Re-run focused backend tests** and expect PASS.

### Task 3: Enforce the device binding on privileged requests

**Files:**
- Modify: `server/middleware/super-admin-auth.ts`
- Modify: `server/middleware/super-admin-auth.test.ts`
- Modify: `server/router/super-admin.router.ts`

**Interfaces:**
- Consumes: `getSuperAdminRequestMetadata(req)` and persisted session metadata.
- Produces: device-bound request authorization and `device_mismatch` revocation.

- [ ] **Step 1: Write failing middleware tests** for correct device access, missing device revocation, mismatched device revocation, and changed-IP acceptance/update.
- [ ] **Step 2: Run the middleware test** and confirm the new cases fail for missing enforcement.
- [ ] **Step 3: Implement minimal enforcement** before idle-time checks; save `revokedAt` and `revokeReason = "device_mismatch"` before returning 401.
- [ ] **Step 4: Update `lastIp` without denying access** and preserve the existing throttled `lastSeenAt` update.
- [ ] **Step 5: Ensure logout/session routes use the same protected middleware** and re-run tests until PASS.

### Task 4: Expose and display session tracking metadata

**Files:**
- Modify: `src/components/super-admin/SessionsTab.tsx`
- Modify: `server/swagger/super-admin.swagger.ts`
- Test: `src/pages/super-admin/management-layout.test.ts`

**Interfaces:**
- Consumes: session `deviceId`, `loginIp`, `lastIp`, and `userAgent`.
- Produces: localized tracking details in the existing session cards.

- [ ] **Step 1: Add failing UI/layout assertions** for device ID, login IP, latest IP, and browser information.
- [ ] **Step 2: Run the focused layout test** and confirm it fails because labels/fields are absent.
- [ ] **Step 3: Extend the session type and cards** with a shortened device ID plus full tooltip, IP fields, and wrapped user-agent text.
- [ ] **Step 4: Update Swagger** with the exact response properties.
- [ ] **Step 5: Re-run focused UI tests** and expect PASS.

### Task 5: Regression verification and scoped commits

**Files:**
- All files changed by Tasks 1-4.

- [ ] **Step 1: Run all focused Node and Vitest tests** for request context, authentication, middleware, frontend requests, and session UI; expect zero failures.
- [ ] **Step 2: Run** `npm run typecheck`, `npm run build`, and `git diff --check`; expect exit code 0.
- [ ] **Step 3: Inspect `git diff` and `git status --short`** to ensure unrelated pre-existing files remain unstaged.
- [ ] **Step 4: Commit frontend transport, backend binding/enforcement, and UI/docs in scoped commits.**
- [ ] **Step 5: Do not push or create a pull request** unless the user requests it.
