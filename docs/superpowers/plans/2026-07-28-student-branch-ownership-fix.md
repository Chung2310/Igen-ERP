# Student Branch Ownership Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure students created or imported under an active branch remain visible in that branch and inaccessible from every other branch.

**Architecture:** Resolve one branch-local owner at the controller boundary for both manual creation and bulk import. Carry the selected `branchId` into every authenticated student service query so owner scope remains a compatibility mechanism while branch scope becomes the isolation boundary.

**Tech Stack:** TypeScript, Express, Mongoose, Vitest, Node test runner

## Global Constraints

- A student created or imported while branch A is active is stored with `branchId = A`.
- The stored `ownerId` belongs to branch A, with branch A's ID as deterministic fallback.
- Branch A can read and mutate the student; branch B receives no record.
- Existing malformed records are not migrated automatically.
- Superadmin and public-registration behavior remains supported.

---

### Task 1: Resolve branch-local ownership for manual creation and import

**Files:**
- Modify: `server/modules/student-management/controllers/student.controller.ts`
- Modify: `server/modules/student-management/services/student.service.ts`
- Create: `server/modules/student-management/services/student-branch-ownership.test.ts`

**Interfaces:**
- Consumes: `resolveCreateOwnerId(user, requestedCompanyCode?) => Promise<string>` and `req.user.branchId`
- Produces: `bulkCreateStudents(creatorId, ownerScope, studentsData, targetOwnerId, branchId)` with a non-global `targetOwnerId` for tenant admin/manager imports

- [ ] **Step 1: Write failing controller tests for branch-local ownership**

Create tests that mock `resolveCreateOwnerId` dependencies through the existing `User` model and intercept `StudentService.createStudent` / `bulkCreateStudents`. For an admin request with `uid: "global-admin"`, `companyCode: "ACME"`, and `branchId: "branch-a"`, assert manual creation passes `"branch-owner-a"` as argument 1 and bulk import passes it as argument 4. Also assert both service calls receive `branch-a` in their payload/branch argument.

```ts
expect(createArgs[0]).toBe("branch-owner-a");
expect((createArgs[2] as { branchId?: string }).branchId).toBe("branch-a");
expect(bulkArgs[3]).toBe("branch-owner-a");
expect(bulkArgs[4]).toBe("branch-a");
```

- [ ] **Step 2: Run the ownership test and verify RED**

Run: `npx vitest run server/modules/student-management/services/student-branch-ownership.test.ts`

Expected: manual creation receives `global-admin`, and bulk import receives `undefined`, proving both flows still use the global creator.

- [ ] **Step 3: Resolve owner once in each controller flow**

In `StudentController.create`, replace the tenant default `ownerId = req.user!.uid` behavior with:

```ts
let ownerId = req.user!.uid;
if (req.user!.role === "superadmin") {
  // keep explicit company validation and company-aware resolution
} else {
  ownerId = await resolveCreateOwnerId(req.user!);
  centerOwnerIds = await getCenterOwnerIds(req.user!);
}
```

In `StudentController.bulkCreate`, resolve `targetOwnerId` for non-superadmins before calling the service:

```ts
ownerId = await getCenterOwnerIds(req.user!);
targetOwnerId = await resolveCreateOwnerId(req.user!);
```

Keep `branchId: req.user!.branchId` for manual creation and the final `req.user!.branchId` argument for bulk import.

- [ ] **Step 4: Make bulk service reject a missing resolved owner for tenant imports**

Keep `targetOwnerId || creatorId` only for public/legacy callers that have no branch. For branch-scoped calls, the controller must always pass `targetOwnerId`; add a service-level guard that throws when `branchId` is present but `targetOwnerId` is empty:

```ts
if (branchId && !targetOwnerId) {
  throw new Error("Không thể xác định chủ sở hữu thuộc chi nhánh đã chọn.");
}
```

- [ ] **Step 5: Run ownership tests and verify GREEN**

Run: `npx vitest run server/modules/student-management/services/student-branch-ownership.test.ts server/modules/student-management/services/custom-field-write-integration.test.ts`

Expected: all tests pass, including public registration.

- [ ] **Step 6: Commit Task 1**

```bash
git add server/modules/student-management/controllers/student.controller.ts server/modules/student-management/services/student.service.ts server/modules/student-management/services/student-branch-ownership.test.ts
git commit -m "fix: assign students to branch-local owners"
```

### Task 2: Enforce branch scope on every authenticated student query

**Files:**
- Modify: `server/modules/student-management/controllers/student.controller.ts`
- Modify: `server/modules/student-management/services/student.service.ts`
- Create: `server/modules/student-management/services/student-branch-query.test.ts`

**Interfaces:**
- Consumes: selected `branchId` from `AuthRequest.user`
- Produces: branch-aware service signatures for list, detail, update, delete, bulk delete, and installment mutation

- [ ] **Step 1: Write failing query-construction tests**

Mock the `Student` model methods and call each service operation with owner scope `['shared-owner']` and branch `branch-a`. Assert every student query includes both boundaries:

```ts
expect(query).toMatchObject({
  ownerId: { $in: ["shared-owner"] },
  branchId: "branch-a",
});
```

For the list test, return one branch-A record and verify both `countDocuments` and `find` receive `branchId`. For detail, update, delete, bulk delete, and `markInstallmentPaid`, assert a branch-B record cannot be selected even when it shares the same owner ID.

- [ ] **Step 2: Run query tests and verify RED**

Run: `npx vitest run server/modules/student-management/services/student-branch-query.test.ts`

Expected: captured queries contain owner scope but omit `branchId`.

- [ ] **Step 3: Add one reusable branch query builder**

In `student.service.ts`, add:

```ts
function buildBranchScopeQuery(branchId?: string) {
  return branchId ? { branchId } : {};
}
```

Combine it with `buildOwnerScopeQuery` in each authenticated query. Update signatures exactly as follows:

```ts
getStudents(ownerId, filters, branchId?)
getStudentById(ownerId, id, branchId?)
updateStudent(ownerId, ownerScope, id, data, context, branchId?)
deleteStudent(ownerId, id, branchId?)
bulkDeleteStudents(ownerId, ids, branchId?)
markInstallmentPaid(ownerId, studentId, installmentNo, branchId?)
```

Add `...buildBranchScopeQuery(branchId)` to the student model query in each method. Also scope the existing-student lookup inside `bulkCreateStudents` by its existing `branchId` parameter so uniqueness checks are branch-local.

- [ ] **Step 4: Pass selected branch from every authenticated controller action**

Update controller calls:

```ts
StudentService.getStudents(ownerId, req.query, req.user!.branchId)
StudentService.getStudentById(ownerId, req.params.id, req.user!.branchId)
StudentService.updateStudent(ownerId, centerOwnerIds, req.params.id, req.body, context, req.user!.branchId)
StudentService.deleteStudent(ownerId, req.params.id, req.user!.branchId)
StudentService.bulkDeleteStudents(ownerId, ids, req.user!.branchId)
StudentService.markInstallmentPaid(ownerId, id, installmentNo, req.user!.branchId)
```

Public lookup remains unscoped because it is a separate deliberately public path.

- [ ] **Step 5: Run branch-query and integration tests and verify GREEN**

Run: `npx vitest run server/modules/student-management/services/student-branch-query.test.ts server/modules/student-management/services/student-branch-ownership.test.ts server/modules/student-management/services/custom-field-write-integration.test.ts server/modules/student-management/utils/auth.util.test.ts`

Expected: all tests pass and all captured authenticated queries include `branchId`.

- [ ] **Step 6: Commit Task 2**

```bash
git add server/modules/student-management/controllers/student.controller.ts server/modules/student-management/services/student.service.ts server/modules/student-management/services/student-branch-query.test.ts
git commit -m "fix: enforce student branch query isolation"
```

### Task 3: Verify regression safety and publish

**Files:**
- Verify: `server/modules/student-management/**`
- Verify: `src/modules/student-management/**`

**Interfaces:**
- Consumes: Task 1 ownership resolution and Task 2 query isolation
- Produces: verified branch ready for remote push

- [ ] **Step 1: Run the complete student-management test set**

Run: `npx vitest run server/modules/student-management src/modules/student-management`

Expected: zero failed test files and zero failed tests.

- [ ] **Step 2: Run TypeScript verification**

Run: `npm run typecheck`

Expected: exit code 0 with no TypeScript diagnostics.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite and server esbuild both exit code 0; the existing chunk-size warning is non-blocking.

- [ ] **Step 4: Review repository state**

Run: `git diff --check && git status --short --branch`

Expected: no whitespace errors and only intentional task files before the final commit.

- [ ] **Step 5: Push the branch**

```bash
git push origin fix/student-management-branch-owner-scope
```

Expected: remote branch advances to the final verified commit.
