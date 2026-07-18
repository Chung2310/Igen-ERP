# Super Admin Device Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture validated browser device IDs and server-derived IP addresses for every Super Admin login, session, and audit event, then expose explainable risk signals in the management UI.

**Architecture:** A shared request-metadata helper normalizes device ID, IP, and user agent at the HTTP boundary. Authentication carries that immutable origin metadata from challenge to session; privileged middleware derives per-request risk signals and makes the context available to audit adapters. A shared frontend request helper creates and attaches the browser UUID so every Super Admin service uses the same behavior.

**Tech Stack:** TypeScript, Express, Mongoose, React, Fetch API, Node test runner, Vitest, Vite.

## Global Constraints

- Device identity is a generated UUID v4 stored as `igen_device_id_v1`, not a hardware serial or browser fingerprint.
- The server accepts only canonical UUID values from `X-Device-ID`; missing or invalid values do not fail the request.
- Source IP comes from Express `req.ip` under explicit proxy trust and never from the request body.
- Device and IP signals are informational and never independently deny access.
- Persisted user-agent values are bounded to 512 characters.
- Device and IP data remain restricted to privileged session and audit APIs.

---

### Task 1: Normalize Super Admin request metadata

**Files:**
- Create: `server/security/super-admin-request-context.ts`
- Test: `server/security/super-admin-request-context.test.ts`
- Modify: `server.ts`

**Interfaces:**
- Produces: `SuperAdminRequestMetadata`, `getSuperAdminRequestMetadata(req)` and `isCanonicalDeviceId(value)`.

- [ ] **Step 1: Write failing tests for canonical UUID validation, absent headers, bounded user agent, IPv4-mapped addresses, and `req.ip` precedence.**

```ts
test("normalizes trusted request metadata", () => {
  const metadata = getSuperAdminRequestMetadata({
    ip: "::ffff:203.0.113.9",
    get: (name: string) => ({ "x-device-id": "550e8400-e29b-41d4-a716-446655440000", "user-agent": "Browser" }[name.toLowerCase()]),
  } as any);
  assert.deepEqual(metadata, { deviceId: "550e8400-e29b-41d4-a716-446655440000", sourceIp: "203.0.113.9", userAgent: "Browser" });
});
```

- [ ] **Step 2: Run `npx tsx --test server/security/super-admin-request-context.test.ts`; expect failure because the module does not exist.**
- [ ] **Step 3: Implement the pure normalizer with a canonical UUID regex, `req.get`, `req.ip`, IPv4-mapped cleanup, trimming, and 512-character bounds.**

```ts
export type SuperAdminRequestMetadata = { deviceId?: string; sourceIp?: string; userAgent?: string };
export function getSuperAdminRequestMetadata(req: Pick<Request, "ip" | "get">): SuperAdminRequestMetadata;
```

- [ ] **Step 4: Replace unconditional `app.set("trust proxy", 1)` with an environment-driven trusted hop count defaulting to `1` only in production and `false` otherwise; rerun the focused test and expect PASS.**
- [ ] **Step 5: Commit `server/security/super-admin-request-context*` and `server.ts` as `feat: normalize super admin device metadata`.**

### Task 2: Persist device metadata on security records

**Files:**
- Modify: `server/model/super-admin-challenge.model.ts`
- Modify: `server/model/super-admin-session.model.ts`
- Modify: `server/model/audit-event.model.ts`
- Modify: `server/model/super-admin-security-models.test.ts`

**Interfaces:**
- Consumes: `SuperAdminRequestMetadata` from Task 1.
- Produces: session/challenge fields `deviceId`, `sourceIp`, `userAgent`; audit fields `deviceId`, `riskSignals`.

- [ ] **Step 1: Extend model tests to require the new schema paths, audit immutability, and the `{ deviceId: 1, occurredAt: -1 }` audit index.**
- [ ] **Step 2: Run `npx tsx --test server/model/super-admin-security-models.test.ts`; expect missing-path failures.**
- [ ] **Step 3: Add typed schema fields. Use the exact signal union below and immutable audit arrays.**

```ts
export type SuperAdminRiskSignal = "new_device" | "device_changed_in_session" | "ip_changed_in_session" | "shared_privileged_device";
deviceId?: string;
riskSignals?: SuperAdminRiskSignal[];
```

- [ ] **Step 4: Add the device timeline index, rerun the focused model test, and expect PASS.**
- [ ] **Step 5: Commit the three models and test as `feat: persist privileged device intelligence`.**

### Task 3: Carry metadata through login and atomic session replacement

**Files:**
- Modify: `server/controller/auth.controller.ts`
- Modify: `server/service/auth.service.ts`
- Modify: `server/service/super-admin-auth.service.ts`
- Modify: `server/service/super-admin-auth.service.test.ts`

**Interfaces:**
- Consumes: `SuperAdminRequestMetadata`.
- Produces: `authService.login(email, password, requestMetadata?)` and `beginSuperAdminLogin(user, requestMetadata?)`.

- [ ] **Step 1: Add failing tests proving challenge creation stores request metadata, login audit receives it, and `replaceActive` creates the session with the challenge metadata.**
- [ ] **Step 2: Run `npx tsx --test server/service/super-admin-auth.service.test.ts`; expect metadata assertions to fail.**
- [ ] **Step 3: Extract metadata in `authController.login`, pass it through `authService.login`, store it on the challenge, and spread only the three allowed fields into login audit events.**
- [ ] **Step 4: In the existing MongoDB transaction, create the replacement session with `deviceId`, `sourceIp`, and `userAgent`; preserve rollback and global singleton-session behavior.**
- [ ] **Step 5: Rerun the focused auth tests and expect all PASS; commit as `feat: bind super admin sessions to device context`.**

### Task 4: Derive per-request risk signals and enrich audits

**Files:**
- Create: `server/security/super-admin-risk-signals.ts`
- Test: `server/security/super-admin-risk-signals.test.ts`
- Modify: `server/middleware/super-admin-auth.ts`
- Modify: `server/middleware/super-admin-auth.test.ts`
- Modify: `server/service/audit.service.ts`

**Interfaces:**
- Produces: `deriveRiskSignals({ request, session, knownDevice, sharedDevice }): SuperAdminRiskSignal[]` and `req.superAdminContext`.

- [ ] **Step 1: Write table-driven failing tests for all four signals and for absent metadata producing no `new_device`.**
- [ ] **Step 2: Run both security and middleware focused tests; expect missing implementation failures.**
- [ ] **Step 3: Implement the pure signal function with deduplicated results in stable order.**
- [ ] **Step 4: Extend privileged middleware dependencies with device-history queries, attach `{ ...requestMetadata, riskSignals }` to `req.superAdminContext`, and keep `lastSeenAt` throttling unchanged.**
- [ ] **Step 5: Add an audit context adapter that merges only missing `deviceId`, `sourceIp`, `userAgent`, and `riskSignals` fields into Super Admin audit inserts; test success and failure events.**
- [ ] **Step 6: Run focused tests and expect PASS; commit as `feat: detect privileged device anomalies`.**

### Task 5: Generate one browser device ID and attach it to every Super Admin request

**Files:**
- Create: `src/services/superAdminRequest.ts`
- Test: `src/services/superAdminRequest.test.ts`
- Modify: `src/services/superAdminAuthService.ts`
- Modify: `src/services/superAdminAuditService.ts`
- Modify: `src/services/superAdminDashboardService.ts`
- Modify: `src/services/superAdminTenantService.ts`
- Modify: `src/services/superAdminUserAccessService.ts`
- Modify: `src/components/super-admin/SessionsTab.tsx`

**Interfaces:**
- Produces: `getSuperAdminDeviceId(storage?, uuid?)`, `superAdminRequest(path, init?)`, and `shortDeviceId(value)`.

- [ ] **Step 1: Write Vitest cases proving an existing canonical UUID is reused, invalid storage is replaced, SSR does not throw, and every request receives `X-Device-ID`.**
- [ ] **Step 2: Run `npx vitest run src/services/superAdminRequest.test.ts --environment jsdom`; expect module-not-found failure.**
- [ ] **Step 3: Implement the helper using `crypto.randomUUID()`, versioned local storage, merged headers, JSON error handling, and authorization from `accessToken`.**
- [ ] **Step 4: Migrate all listed Super Admin services and direct session fetches to the shared request helper; ensure the initial `/api/v1/auth/login` also includes the device header.**
- [ ] **Step 5: Rerun the focused Vitest file and existing Super Admin service tests; expect PASS. Commit as `feat: attach browser device id to admin requests`.**

### Task 6: Display device intelligence in sessions and audit views

**Files:**
- Modify: `src/components/super-admin/SessionsTab.tsx`
- Modify: `src/components/super-admin/AuditTab.tsx`
- Modify: `src/services/superAdminAuditService.ts`
- Modify: `src/pages/super-admin/management-layout.test.ts`

**Interfaces:**
- Consumes: session/audit `deviceId`, `sourceIp`, `userAgent`, `lastSeenAt`, and `riskSignals`.

- [ ] **Step 1: Add failing layout tests for the “Browser device ID” label, shortened ID, full-value copy control, IP, last-seen text, and all four risk badges.**
- [ ] **Step 2: Run `npx tsx --test src/pages/super-admin/management-layout.test.ts`; expect string/markup assertions to fail.**
- [ ] **Step 3: Extend response types and render compact metadata columns plus signal badges; render full device/IP/user-agent values in detail panels with `navigator.clipboard.writeText`.**
- [ ] **Step 4: Add explanatory copy that browser storage reset can change the identifier; do not call it a hardware or machine serial.**
- [ ] **Step 5: Rerun the layout test and expect PASS; commit as `feat: show super admin device risk signals`.**

### Task 7: Full regression verification

**Files:**
- Modify if required by verified contract drift: `server/swagger/super-admin.swagger.ts`

- [ ] **Step 1: Update Swagger session and audit schemas with the exact optional metadata and signal fields.**
- [ ] **Step 2: Run all Node tests with `npx tsx --test <all Node test files>` and expect zero failures.**
- [ ] **Step 3: Run all four Vitest suites with `npx vitest run --environment jsdom` and expect zero failures.**
- [ ] **Step 4: Run `npm run typecheck`, `npm run build`, and `git diff --check`; expect exit code 0 for each.**
- [ ] **Step 5: Inspect `git status --short` and confirm the pre-existing untracked singleton-session plan is not staged.**
- [ ] **Step 6: Commit Swagger or verification-driven fixes as `docs: document super admin device metadata`. Do not push until the user requests it.**
