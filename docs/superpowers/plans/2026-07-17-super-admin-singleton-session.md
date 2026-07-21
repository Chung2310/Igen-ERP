# Super Admin Singleton Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce one Super Admin account and one globally active privileged session, while adding management-navigation icons.

**Architecture:** A MongoDB partial unique index makes `User.role = superadmin` a database invariant. A transaction-backed session issuer consumes the challenge, revokes active privileged sessions, creates a replacement, and audits displacement atomically.

**Tech Stack:** TypeScript, Express, Mongoose 9, MongoDB transactions, node:test, React 19, Lucide React.

## Global Constraints

- Existing duplicate Super Admin records are never modified automatically.
- Duplicate records fail fast with only IDs and emails in the operations error.
- New privileged authentication revokes active privileged sessions with `replaced_by_new_login`.
- A deployment without transaction support must not issue a privileged session.

---

### Task 1: Singleton role index and assignment guard

**Files:**
- Modify: `server/model/user.model.ts`
- Modify: `server/super-admin/user-access-management.service.ts`
- Test: `server/super-admin/user-access-management.service.test.ts`

**Interfaces:** Add `findOtherSuperAdmin(userId)` to the user dependency, returning a distinct Super Admin or null.

- [ ] Write a failing test that calls `assignRole({ tenantId: "SYSTEM", userId: "other", role: "superadmin" })` when `findOtherSuperAdmin` returns `{ _id: "root", email: "root@example.com" }`; assert rejection matches `/already exists/i`.
- [ ] Run `npx tsx --test server/super-admin/user-access-management.service.test.ts`; expect failure because no lookup occurs.
- [ ] Add `UserSchema.index({ role: 1 }, { unique: true, partialFilterExpression: { role: "superadmin" }, name: "unique_superadmin_role" })`; then in `assignRole`, reject a non-SYSTEM request, call `findOtherSuperAdmin(data.userId)`, and throw `A Super Admin account already exists: ${existing.email}` if found. Wire the dependency to `UserModel.findOne({ role: "superadmin", _id: { $ne: userId } }).select("_id email").lean()`.
- [ ] Re-run the focused test; expect pass.
- [ ] Commit `feat: enforce singleton super admin role`.

### Task 2: Atomic session replacement and audit

**Files:**
- Modify: `server/service/super-admin-auth.service.ts`
- Modify: `server/service/super-admin-auth.service.test.ts`
- Modify: `server/model/super-admin-session.model.ts`

**Interfaces:** Add `sessions.replaceActive({ userId, challenge, sessionId, now, expiresAt })` and call it from the common `createSession` function.

- [ ] Write three failing tests: a second TOTP login, recovery login, and enrollment login each leave the old session with `revokeReason === "replaced_by_new_login"` and the new session unrevoked.
- [ ] Run `npx tsx --test server/service/super-admin-auth.service.test.ts`; expect failure because sessions remain active.
- [ ] Implement `createSession` to create an ID and delegate to `replaceActive`. The Mongo adapter must use `mongoose.connection.transaction`; inside it conditionally consume the challenge, revoke `{ revokedAt: { $exists: false }, expiresAt: { $gt: now } }` with `{ revokedAt: now, revokeReason: "replaced_by_new_login" }`, create the new session, and record one audit event per displaced session. Add `{ revokedAt: 1, expiresAt: 1 }` index while retaining TTL.
- [ ] Make unsupported transaction topology reject privileged-session issuance explicitly.
- [ ] Re-run focused authentication tests; expect pass.
- [ ] Commit `feat: replace active super admin session on login`.

### Task 3: Duplicate-account preflight

**Files:**
- Modify: `server/service/super-admin-auth.service.ts`
- Modify: `server/service/super-admin-auth.service.test.ts`
- Modify: `server.ts`

**Interfaces:** Add `superAdminAuthService.assertSingleSuperAdmin(): Promise<void>`.

- [ ] Write a failing test with two records from `listSuperAdmins`; assert that `assertSingleSuperAdmin()` rejects and includes both emails.
- [ ] Run `npx tsx --test server/service/super-admin-auth.service.test.ts`; expect failure because the method is absent.
- [ ] Implement the method using `UserModel.find({ role: "superadmin" }).select("_id email").lean()`. For more than one account throw `Multiple Super Admin accounts found; resolve manually: ${id} (${email}), ...`. Await it after successful Mongo connection and before listening in `server.ts`.
- [ ] Re-run focused tests; expect pass.
- [ ] Commit `feat: fail fast on duplicate super admin accounts`.

### Task 4: Navigation icons and integration verification

**Files:**
- Modify: `src/pages/super-admin/SuperAdminShell.tsx`
- Modify: `src/pages/super-admin/management-layout.test.ts`

- [ ] Extend the source test with `assert.match(shell, /UsersRound/)` and `assert.match(shell, /Building2/)`.
- [ ] Run `npx tsx --test src/pages/super-admin/management-layout.test.ts`; expect failure because the icons are absent.
- [ ] Import `UsersRound` and `Building2` from `lucide-react`; render `<UsersRound className="h-4 w-4" />` before User & Access and `<Building2 className="h-4 w-4" />` before Tenant management.
- [ ] Run `npx tsx --test server/service/super-admin-auth.service.test.ts server/super-admin/user-access-management.service.test.ts src/pages/super-admin/management-layout.test.ts`, `npm run typecheck`, and `npm run build`; expect all commands to exit 0.
- [ ] Commit `feat: add super admin singleton access controls`.
