# Partner Admin Active-Branch Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure an admin creates and reads every Partner in the currently selected branch while other roles remain branch-bound.

**Architecture:** The authenticated `req.user.branchId` remains the trusted branch boundary. Partner creation resolves an owner inside that branch, while the Partner UI reacts to `activeBranchId` and sends it explicitly.

**Tech Stack:** TypeScript 5.8, Express 4, React 19, Vitest 4, Node test runner.

## Global Constraints

- Admin may switch only to an active branch belonging to their company.
- Manager, branch_owner and user cannot expand their assigned branch scope.
- Partner records remain isolated by `branchId`.
- No migration of existing records in this change.

---

### Task 1: Resolve Partner owner inside the active branch

**Files:**
- Modify: `server/modules/student-management/controllers/partner.controller.ts`
- Test: `server/modules/student-management/controllers/partner.controller.branch.test.ts`

**Interfaces:**
- Consumes: `resolveCreateOwnerId(user, requestedCompanyCode?)` and authenticated `req.user.branchId`.
- Produces: `PartnerService.createPartner(resolvedOwnerId, {...body, branchId}, context)`.

- [ ] **Step 1: Write failing controller test**

Stub `resolveCreateOwnerId` dependencies through the User model so an admin in active `branch-a` resolves `branch-owner-a`; assert `PartnerService.createPartner` receives that owner and `branchId: "branch-a"`, not the admin uid.

- [ ] **Step 2: Run RED**

Run: `npx tsx --test server/modules/student-management/controllers/partner.controller.branch.test.ts`
Expected: FAIL because Partner create receives the admin uid.

- [ ] **Step 3: Implement minimal controller change**

For non-superadmin admin/manager create paths, call `await resolveCreateOwnerId(req.user!)`; retain the existing superadmin company selection branch.

- [ ] **Step 4: Run GREEN and existing Partner tests**

Run: `npx tsx --test server/modules/student-management/controllers/partner.controller.branch.test.ts server/modules/student-management/controllers/partner.controller.error.test.ts server/modules/student-management/services/partner.service.error.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

    git add server/modules/student-management/controllers/partner.controller.ts server/modules/student-management/controllers/partner.controller.branch.test.ts
    git commit -m "fix: resolve partner owner in active branch"

---

### Task 2: Refresh and scope Partner UI by selected branch

**Files:**
- Modify: `src/context/BranchContext.tsx`
- Modify: `src/modules/student-management/pages/Partners/PartnersPage.tsx`
- Modify: `src/modules/student-management/pages/Partners/components/AddPartnerModal.tsx`
- Test: `src/modules/student-management/pages/Partners/partnerBranchRequests.test.ts`

**Interfaces:**
- Consumes: `useBranch().activeBranchId` and `apiFetch(endpoint, { headers })`.
- Produces: every Partner list/create/update request includes `x-branch-id` when an active branch exists.

- [ ] **Step 1: Write failing request-scope tests**

Test a pure exported `buildPartnerBranchHeaders(activeBranchId)` helper: branch id produces `{ "x-branch-id": branchId }`; empty id produces no header. Test source behavior by rendering or extracting the list dependency so changing branch A to B triggers another request.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/modules/student-management/pages/Partners/partnerBranchRequests.test.ts`
Expected: FAIL because the helper and explicit branch request behavior do not exist.

- [ ] **Step 3: Implement minimal UI change**

Export `buildPartnerBranchHeaders`; read `activeBranchId` in `PartnersPage` and `AddPartnerModal`; pass its result to `apiFetch`; add `activeBranchId` to `fetchPartners` dependencies. In `BranchContext`, persist the resolved default branch to the same localStorage key before updating state.

- [ ] **Step 4: Run GREEN, typecheck and build**

Run: `npx vitest run src/modules/student-management/pages/Partners/partnerBranchRequests.test.ts src/context/branchFetch.test.ts`
Run: `npm run typecheck`
Run: `npm run build`
Expected: all exit 0.

- [ ] **Step 5: Commit and push**

    git add src/context/BranchContext.tsx src/modules/student-management/pages/Partners/PartnersPage.tsx src/modules/student-management/pages/Partners/components/AddPartnerModal.tsx src/modules/student-management/pages/Partners/partnerBranchRequests.test.ts
    git commit -m "fix: refresh partners for active branch"
    git push origin feat/backend-error-middleware