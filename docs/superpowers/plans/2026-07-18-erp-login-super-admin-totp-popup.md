# ERP Login Super Admin TOTP Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Super Admin Google Authenticator verification in a popup on the normal ERP login page and enter the normal ERP interface without redirecting to `/super-admin`.

**Architecture:** `AuthContext` returns a typed password-login outcome and owns final ERP profile hydration. A focused `ErpAuthenticatorDialog` owns enrollment, TOTP, recovery, pending, and error presentation while reusing `superAdminAuthService` for challenge endpoints. The direct `/super-admin` shell stays independent.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS, Vitest, Testing Library, Node test runner

## Global Constraints

- Authentication started from the normal ERP login page must remain on the normal ERP route.
- The popup must support enrolled TOTP, first-time QR enrollment, and recovery codes.
- Invalid or expired codes must not reload the document or erase the email/password form.
- Direct `/super-admin` authentication behavior must remain unchanged.
- No server-side TOTP policy or challenge lifetime changes.

---

## File Structure

- `src/context/AuthContext.tsx`: returns typed login outcomes and hydrates ERP user state after challenge completion.
- `src/components/auth/ErpAuthenticatorDialog.tsx`: isolated popup UI and challenge state machine.
- `src/components/auth/ErpAuthenticatorDialog.test.tsx`: behavioral tests for first-submit, success, failure, enrollment, and recovery.
- `src/pages/AuthPage.tsx`: opens the popup from the password-login outcome and preserves the normal ERP route.
- `src/pages/erp-authenticator-handoff.test.ts`: source contract preventing regression to `/super-admin` redirection.
- `src/pages/super-admin/challenge-handoff.test.ts`: retain only the direct Super Admin shell contract; remove the obsolete ERP handoff assertion.

### Task 1: Return a typed challenge from normal ERP password login

**Files:**
- Modify: `src/context/AuthContext.tsx`
- Create: `src/pages/erp-authenticator-handoff.test.ts`
- Modify: `src/pages/super-admin/challenge-handoff.test.ts`

**Interfaces:**
- Produces: `ErpLoginChallenge { status: "challenge_required"; challengeId: string; enrollmentRequired: boolean; expiresAt: string }`
- Produces: `ErpLoginOutcome = { status: "authenticated" } | ErpLoginChallenge`
- Produces: `loginWithEmail(...): Promise<ErpLoginOutcome>`
- Produces: `completeErpChallenge(): Promise<void>`

- [ ] **Step 1: Write the failing source contract**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("ERP login returns the challenge without redirecting to the control plane", () => {
  const source = read("../context/AuthContext.tsx");
  assert.match(source, /return\s+\{[\s\S]*status:\s*["']challenge_required["']/);
  assert.doesNotMatch(source, /window\.location\.pathname\s*=\s*["']\/super-admin["']/);
  assert.doesNotMatch(source, /savePendingSuperAdminChallenge\(sessionStorage/);
});

test("ERP challenge completion hydrates the authenticated profile", () => {
  const source = read("../context/AuthContext.tsx");
  assert.match(source, /completeErpChallenge/);
  assert.match(source, /await authService\.getMe\(\)/);
  assert.match(source, /setUserProfile\(profile\)/);
});
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `npx tsx --test src/pages/erp-authenticator-handoff.test.ts`

Expected: FAIL because `AuthContext` still redirects to `/super-admin` and does not expose `completeErpChallenge`.

- [ ] **Step 3: Implement typed outcomes and ERP hydration**

Add exported types and update the context interface:

```ts
export interface ErpLoginChallenge {
  status: "challenge_required";
  challengeId: string;
  enrollmentRequired: boolean;
  expiresAt: string;
}

export type ErpLoginOutcome = { status: "authenticated" } | ErpLoginChallenge;

loginWithEmail: (email: string, password: string, rememberMe?: boolean) => Promise<ErpLoginOutcome>;
completeErpChallenge: () => Promise<void>;
```

Replace the redirect branch with:

```ts
if (result.status === "challenge_required") {
  return {
    status: "challenge_required",
    challengeId: result.challengeId,
    enrollmentRequired: Boolean(result.enrollmentRequired),
    expiresAt: result.expiresAt,
  };
}
// existing profile hydration
return { status: "authenticated" };
```

Add the completion method:

```ts
const completeErpChallenge = async () => {
  const profile = await authService.getMe();
  if (!profile) {
    localStorage.removeItem("accessToken");
    throw new Error("Không thể khởi tạo phiên ERP sau khi xác thực.");
  }
  setUser(profile as any);
  setUserProfile(profile);
};
```

Expose `completeErpChallenge` through the provider and remove the unused pending-challenge import from `AuthContext`.

- [ ] **Step 4: Replace the obsolete handoff assertion**

Remove the first test in `src/pages/super-admin/challenge-handoff.test.ts`. Keep the test proving `SuperAdminShell` restores its own direct-login pending challenge.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npx tsx --test src/pages/erp-authenticator-handoff.test.ts src/pages/super-admin/challenge-handoff.test.ts && yarn typecheck`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/context/AuthContext.tsx src/pages/erp-authenticator-handoff.test.ts src/pages/super-admin/challenge-handoff.test.ts
git commit -m "refactor(auth): return ERP authenticator challenge"
```

### Task 2: Build the isolated ERP authenticator popup

**Files:**
- Create: `src/components/auth/ErpAuthenticatorDialog.tsx`
- Create: `src/components/auth/ErpAuthenticatorDialog.test.tsx`

**Interfaces:**
- Consumes: `ErpLoginChallenge` from `src/context/AuthContext.tsx`
- Consumes: `superAdminAuthService.startEnrollment`, `confirmEnrollment`, `verifyTotp`, and `verifyRecovery`
- Produces: `ErpAuthenticatorDialogProps { challenge: ErpLoginChallenge; onAuthenticated(): Promise<void>; onCancel(): void }`

- [ ] **Step 1: Write failing TOTP interaction tests**

```tsx
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { ErpAuthenticatorDialog } from "./ErpAuthenticatorDialog";
import { superAdminAuthService } from "../../services/superAdminAuthService";

vi.mock("../../services/superAdminAuthService", () => ({
  superAdminAuthService: {
    startEnrollment: vi.fn(),
    confirmEnrollment: vi.fn(),
    verifyTotp: vi.fn(),
    verifyRecovery: vi.fn(),
  },
}));

const challenge = { status: "challenge_required" as const, challengeId: "c1", enrollmentRequired: false, expiresAt: "2099-01-01T00:00:00.000Z" };

beforeEach(() => vi.clearAllMocks());

test("first TOTP submission verifies once without submitting the password form", async () => {
  vi.mocked(superAdminAuthService.verifyTotp).mockResolvedValue({ accessToken: "token" });
  const onAuthenticated = vi.fn().mockResolvedValue(undefined);
  const outerSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(<form onSubmit={outerSubmit}><ErpAuthenticatorDialog challenge={challenge} onAuthenticated={onAuthenticated} onCancel={() => {}} /></form>);
  fireEvent.change(screen.getByLabelText("Mã Google Authenticator"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác thực" }));
  await waitFor(() => expect(superAdminAuthService.verifyTotp).toHaveBeenCalledWith("c1", "123456"));
  expect(superAdminAuthService.verifyTotp).toHaveBeenCalledTimes(1);
  expect(outerSubmit).not.toHaveBeenCalled();
  expect(onAuthenticated).toHaveBeenCalledTimes(1);
});

test("invalid TOTP stays open and displays an inline error", async () => {
  vi.mocked(superAdminAuthService.verifyTotp).mockRejectedValue(new Error("Mã xác thực không hợp lệ"));
  render(<ErpAuthenticatorDialog challenge={challenge} onAuthenticated={vi.fn()} onCancel={() => {}} />);
  fireEvent.change(screen.getByLabelText("Mã Google Authenticator"), { target: { value: "000000" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác thực" }));
  expect(await screen.findByText("Mã xác thực không hợp lệ")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the popup tests and verify RED**

Run: `npx vitest run src/components/auth/ErpAuthenticatorDialog.test.tsx`

Expected: FAIL because `ErpAuthenticatorDialog.tsx` does not exist.

- [ ] **Step 3: Implement the TOTP and recovery popup states**

Create a dialog with `role="dialog"`, `aria-modal="true"`, local `mode: "totp" | "recovery"`, code, pending, and error state. Its action buttons must explicitly use `type="button"`.

Core submit logic:

```tsx
const submitCode = async () => {
  if (pending) return;
  setPending(true);
  setError("");
  try {
    if (mode === "recovery") {
      await superAdminAuthService.verifyRecovery(challenge.challengeId, code.trim());
    } else {
      await superAdminAuthService.verifyTotp(challenge.challengeId, code.trim());
    }
    await onAuthenticated();
  } catch (cause: any) {
    setError(cause.message || "Không thể xác thực. Vui lòng thử lại.");
  } finally {
    setPending(false);
  }
};
```

Render a labeled input, inline error, `Xác thực`, `Dùng mã khôi phục`/`Dùng Google Authenticator`, and `Hủy` controls.

- [ ] **Step 4: Run the TOTP tests and verify GREEN**

Run: `npx vitest run src/components/auth/ErpAuthenticatorDialog.test.tsx`

Expected: both tests PASS.

- [ ] **Step 5: Add failing enrollment and recovery-code tests**

```tsx
test("first-time login loads a QR and confirms enrollment", async () => {
  vi.mocked(superAdminAuthService.startEnrollment).mockResolvedValue({ qrDataUrl: "data:image/png;base64,qr" });
  vi.mocked(superAdminAuthService.confirmEnrollment).mockResolvedValue({ accessToken: "token", recoveryCodes: ["AAAAA-BBBBB"] });
  const onAuthenticated = vi.fn().mockResolvedValue(undefined);
  render(<ErpAuthenticatorDialog challenge={{ ...challenge, enrollmentRequired: true }} onAuthenticated={onAuthenticated} onCancel={() => {}} />);
  expect(await screen.findByAltText("Mã QR Google Authenticator")).toHaveAttribute("src", "data:image/png;base64,qr");
  fireEvent.change(screen.getByLabelText("Mã Google Authenticator"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Kích hoạt và đăng nhập" }));
  expect(await screen.findByText("AAAAA-BBBBB")).toBeInTheDocument();
  expect(onAuthenticated).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Tôi đã lưu mã khôi phục" }));
  expect(onAuthenticated).toHaveBeenCalledTimes(1);
});

test("recovery mode verifies a recovery code", async () => {
  vi.mocked(superAdminAuthService.verifyRecovery).mockResolvedValue({ accessToken: "token" });
  render(<ErpAuthenticatorDialog challenge={challenge} onAuthenticated={vi.fn().mockResolvedValue(undefined)} onCancel={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Dùng mã khôi phục" }));
  fireEvent.change(screen.getByLabelText("Mã khôi phục"), { target: { value: "AAAAA-BBBBB" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác thực" }));
  await waitFor(() => expect(superAdminAuthService.verifyRecovery).toHaveBeenCalledWith("c1", "AAAAA-BBBBB"));
});
```

- [ ] **Step 6: Run enrollment tests and verify RED**

Run: `npx vitest run src/components/auth/ErpAuthenticatorDialog.test.tsx`

Expected: new tests FAIL because enrollment and recovery-code acknowledgement are not implemented.

- [ ] **Step 7: Implement enrollment and recovery-code acknowledgement**

When `challenge.enrollmentRequired` is true, call `startEnrollment` once in an effect, display its `qrDataUrl`, and use `confirmEnrollment` for submission. If the response includes recovery codes, render them and require `Tôi đã lưu mã khôi phục` before calling `onAuthenticated`. Enrollment-start errors remain inline in the dialog.

- [ ] **Step 8: Run popup tests and typecheck**

Run: `npx vitest run src/components/auth/ErpAuthenticatorDialog.test.tsx && yarn typecheck`

Expected: all popup tests PASS and TypeScript exits 0.

- [ ] **Step 9: Commit**

```bash
git add src/components/auth/ErpAuthenticatorDialog.tsx src/components/auth/ErpAuthenticatorDialog.test.tsx
git commit -m "feat(auth): add ERP authenticator popup"
```

### Task 3: Connect the popup to the normal ERP login page

**Files:**
- Modify: `src/pages/AuthPage.tsx`
- Modify: `src/pages/erp-authenticator-handoff.test.ts`

**Interfaces:**
- Consumes: `ErpLoginChallenge`, `loginWithEmail`, and `completeErpChallenge` from `AuthContext`
- Consumes: `ErpAuthenticatorDialog` from `src/components/auth/ErpAuthenticatorDialog.tsx`
- Produces: normal ERP login flow that opens the popup and never navigates to `/super-admin`

- [ ] **Step 1: Extend the failing page contract**

```ts
test("AuthPage opens the ERP authenticator dialog from a challenge outcome", () => {
  const source = read("./AuthPage.tsx");
  assert.match(source, /const\s+result\s*=\s*await\s+loginWithEmail/);
  assert.match(source, /result\.status\s*===\s*["']challenge_required["']/);
  assert.match(source, /setChallenge\(result\)/);
  assert.match(source, /<ErpAuthenticatorDialog/);
  assert.match(source, /onAuthenticated=\{completeErpChallenge\}/);
});
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `npx tsx --test src/pages/erp-authenticator-handoff.test.ts`

Expected: FAIL because `AuthPage` ignores the login outcome and has no dialog.

- [ ] **Step 3: Wire the challenge outcome into AuthPage**

Import the dialog and type, then add:

```tsx
const { loginWithEmail, completeErpChallenge } = useAuth();
const [challenge, setChallenge] = useState<ErpLoginChallenge | null>(null);

const result = await loginWithEmail(email.trim(), password.trim(), rememberMe);
if (result.status === "challenge_required") setChallenge(result);
```

Render the dialog outside the password `<form>`:

```tsx
{challenge && (
  <ErpAuthenticatorDialog
    challenge={challenge}
    onAuthenticated={completeErpChallenge}
    onCancel={() => setChallenge(null)}
  />
)}
```

- [ ] **Step 4: Run focused UI and contract tests**

Run: `npx tsx --test src/pages/erp-authenticator-handoff.test.ts src/pages/super-admin/challenge-handoff.test.ts && npx vitest run src/components/auth/ErpAuthenticatorDialog.test.tsx src/services/superAdminAuthService.test.ts`

Expected: all tests PASS.

- [ ] **Step 5: Run full verification**

Run: `yarn typecheck && yarn lint && yarn build`

Expected: typecheck and build exit 0; lint has no new errors or warnings beyond the existing Kanban warnings.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AuthPage.tsx src/pages/erp-authenticator-handoff.test.ts
git commit -m "fix(auth): keep Super Admin login in ERP interface"
```

### Task 4: Regression verification

**Files:**
- Verify: `src/context/AuthContext.tsx`
- Verify: `src/pages/AuthPage.tsx`
- Verify: `src/components/auth/ErpAuthenticatorDialog.tsx`
- Verify: `src/pages/super-admin/SuperAdminShell.tsx`

**Interfaces:**
- Consumes: all completed authentication changes
- Produces: evidence that normal ERP and direct Super Admin entry points remain independent

- [ ] **Step 1: Run all focused authentication tests**

Run: `npx tsx --test src/pages/erp-authenticator-handoff.test.ts src/pages/super-admin/challenge-handoff.test.ts src/services/pendingSuperAdminChallenge.test.ts server/service/super-admin-auth.service.test.ts server/middleware/super-admin-auth.test.ts && npx vitest run src/components/auth/ErpAuthenticatorDialog.test.tsx src/services/superAdminAuthService.test.ts`

Expected: every test passes.

- [ ] **Step 2: Run static and production checks**

Run: `yarn typecheck && yarn lint && yarn build`

Expected: all commands exit 0, with no new lint warnings.

- [ ] **Step 3: Inspect final scope**

Run: `git diff --check && git status --short --branch && git log -6 --oneline`

Expected: no whitespace errors; only intended commits are ahead of the remote branch.
