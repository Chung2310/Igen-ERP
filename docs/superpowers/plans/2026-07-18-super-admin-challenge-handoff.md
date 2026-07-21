# Super Admin Challenge Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve a Super Admin Google Authenticator challenge when login starts from the normal ERP screen and resume the correct TOTP/enrollment step after redirecting to `/super-admin`.

**Architecture:** A focused client helper owns serialization, validation, expiry, stage resolution, and deletion of the pending challenge in `sessionStorage`. `AuthContext` saves the challenge before redirect; `SuperAdminShell` hydrates from it, starts enrollment when required, and clears it after success, expiry, or logout.

**Tech Stack:** React 19, TypeScript 5.8, browser `sessionStorage`, Node `node:test` via `tsx --test`.

## Global Constraints

- Never store passwords, access tokens, TOTP codes, or TOTP secrets in the pending challenge record.
- Use `sessionStorage`, not `localStorage`.
- Refresh preserves a valid challenge; closing the tab discards it.
- Existing backend endpoints and challenge lifetime remain unchanged.
- Invalid or expired client data is deleted and falls back to the password stage.

---

### Task 1: Pending challenge storage and stage resolution

**Files:**
- Create: `src/services/pendingSuperAdminChallenge.ts`
- Test: `src/services/pendingSuperAdminChallenge.test.ts`

**Interfaces:**
- Produces: `PendingSuperAdminChallenge`, `SuperAdminChallengeStage`, `savePendingSuperAdminChallenge(storage, value)`, `readPendingSuperAdminChallenge(storage, now?)`, `clearPendingSuperAdminChallenge(storage)`, `resolveSuperAdminChallengeStage(value)`.

- [ ] **Step 1: Write failing tests for valid, expired, malformed, enrollment, and clear behavior**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { clearPendingSuperAdminChallenge, readPendingSuperAdminChallenge, resolveSuperAdminChallengeStage, savePendingSuperAdminChallenge } from "./pendingSuperAdminChallenge";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test("saves and restores a valid TOTP challenge", () => {
  const storage = new MemoryStorage();
  const value = { challengeId: "challenge-1", enrollmentRequired: false, expiresAt: "2030-01-01T00:00:00.000Z" };
  savePendingSuperAdminChallenge(storage, value);
  assert.deepEqual(readPendingSuperAdminChallenge(storage, Date.parse("2029-01-01T00:00:00.000Z")), value);
  assert.equal(resolveSuperAdminChallengeStage(value), "totp");
});

test("expired or malformed challenges are removed", () => {
  const storage = new MemoryStorage();
  storage.setItem("igen.pending-super-admin-challenge", JSON.stringify({ challengeId: "old", enrollmentRequired: false, expiresAt: "2020-01-01T00:00:00.000Z" }));
  assert.equal(readPendingSuperAdminChallenge(storage, Date.now()), null);
  assert.equal(storage.getItem("igen.pending-super-admin-challenge"), null);
  storage.setItem("igen.pending-super-admin-challenge", "not-json");
  assert.equal(readPendingSuperAdminChallenge(storage), null);
});

test("enrollment challenges resolve correctly and can be cleared", () => {
  const storage = new MemoryStorage();
  const value = { challengeId: "challenge-2", enrollmentRequired: true, expiresAt: "2030-01-01T00:00:00.000Z" };
  savePendingSuperAdminChallenge(storage, value);
  assert.equal(resolveSuperAdminChallengeStage(value), "enroll");
  clearPendingSuperAdminChallenge(storage);
  assert.equal(readPendingSuperAdminChallenge(storage), null);
});
```

- [ ] **Step 2: Run RED**

Run: `npx tsx --test src/services/pendingSuperAdminChallenge.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the helper**

```ts
export const PENDING_SUPER_ADMIN_CHALLENGE_KEY = "igen.pending-super-admin-challenge";
export interface PendingSuperAdminChallenge { challengeId: string; enrollmentRequired: boolean; expiresAt: string; }
export type SuperAdminChallengeStage = "password" | "enroll" | "totp";
interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; }

export function savePendingSuperAdminChallenge(storage: StorageLike, value: PendingSuperAdminChallenge): void {
  storage.setItem(PENDING_SUPER_ADMIN_CHALLENGE_KEY, JSON.stringify(value));
}
export function clearPendingSuperAdminChallenge(storage: StorageLike): void { storage.removeItem(PENDING_SUPER_ADMIN_CHALLENGE_KEY); }
export function readPendingSuperAdminChallenge(storage: StorageLike, now = Date.now()): PendingSuperAdminChallenge | null {
  const raw = storage.getItem(PENDING_SUPER_ADMIN_CHALLENGE_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingSuperAdminChallenge>;
    const expiry = typeof value.expiresAt === "string" ? Date.parse(value.expiresAt) : NaN;
    if (typeof value.challengeId !== "string" || !value.challengeId.trim() || typeof value.enrollmentRequired !== "boolean" || !Number.isFinite(expiry) || expiry <= now) {
      clearPendingSuperAdminChallenge(storage); return null;
    }
    return { challengeId: value.challengeId, enrollmentRequired: value.enrollmentRequired, expiresAt: value.expiresAt! };
  } catch { clearPendingSuperAdminChallenge(storage); return null; }
}
export function resolveSuperAdminChallengeStage(value: PendingSuperAdminChallenge | null): SuperAdminChallengeStage {
  return value ? (value.enrollmentRequired ? "enroll" : "totp") : "password";
}
```

- [ ] **Step 4: Run GREEN**

Run: `npx tsx --test src/services/pendingSuperAdminChallenge.test.ts`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/pendingSuperAdminChallenge.ts src/services/pendingSuperAdminChallenge.test.ts
git commit -m "feat(auth): persist pending super admin challenge"
```

---

### Task 2: Handoff from ERP login to Super Admin shell

**Files:**
- Modify: `src/context/AuthContext.tsx`
- Modify: `src/pages/super-admin/SuperAdminShell.tsx`

**Interfaces:**
- Consumes: Task 1 helper and existing Super Admin auth service methods.
- Produces: redirect-safe challenge handoff and automatic TOTP/enrollment hydration.

- [ ] **Step 1: Save the challenge before redirect**

In `AuthContext.tsx`, import `savePendingSuperAdminChallenge`, save `challengeId`, `enrollmentRequired`, and `expiresAt`, then redirect immediately to `/super-admin` without `setTimeout`.

- [ ] **Step 2: Hydrate the shell**

In `SuperAdminShell.tsx`, read pending data once. Initialize `challenge` and stage from it unless an access token exists. For an enrollment challenge, call `startEnrollment(challengeId)` once in an effect and populate the QR. On failure clear storage, reset to password, and show the error.

- [ ] **Step 3: Clear terminal state**

Clear pending storage after successful TOTP/enrollment/recovery verification, after recovery codes are acknowledged, and on logout. Preserve it after an ordinary invalid-code response so the user can retry while the backend challenge remains valid.

- [ ] **Step 4: Verify**

Run: `yarn typecheck`

Expected: PASS.

Run: `yarn build`

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/context/AuthContext.tsx src/pages/super-admin/SuperAdminShell.tsx
git commit -m "fix(auth): resume super admin authenticator challenge"
```

---

### Task 3: Final verification

**Files:**
- Verify: `src/services/pendingSuperAdminChallenge.test.ts`
- Verify: `src/context/AuthContext.tsx`
- Verify: `src/pages/super-admin/SuperAdminShell.tsx`

- [ ] **Step 1: Run all relevant checks**

```bash
npx tsx --test src/services/pendingSuperAdminChallenge.test.ts server/service/super-admin-auth.service.test.ts server/middleware/super-admin-auth.test.ts
yarn typecheck
yarn lint
yarn build
```

Expected: tests, typecheck, and build PASS; lint has no errors (unrelated existing warnings may remain).

- [ ] **Step 2: Confirm clean state**

Run: `git status --short`.

Expected: no uncommitted files.
