# Branch Data Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the authenticated branch on inventory and student-management records, require branch selection for admin writes, and prevent cross-branch CRUD access.

**Architecture:** Introduce small server-owned branch-scope helpers at each module boundary. Inventory passes the authenticated scope through the generic CRUD controller/service only for inventory models; student management carries the same scope alongside its existing owner scope and persists it on tenant-owned records. Client-supplied branch fields are overwritten, and legacy branchless records are left untouched.

**Tech Stack:** TypeScript, Express, Mongoose, Vitest, Node.js 22.

## Global Constraints

- `requireAuth` is the only source of the effective `branchId`.
- Admin create operations in scope fail with HTTP 400 when no branch is selected.
- Client-provided `companyCode` and `branchId` never override authenticated scope.
- Existing branchless records are not migrated automatically.
- Cross-branch access uses the existing not-found behavior.

---

### Task 1: Inventory write and record access scope

**Files:**
- Create: `server/service/crud-branch-scope.test.ts`
- Modify: `server/controller/crud.controller.ts`
- Modify: `server/service/crud.service.ts`
- Modify: `server/model/product.model.ts`
- Modify: `server/model/category.model.ts`

**Interfaces:**
- Produces: `type CrudBranchScope = { branchId?: string }`
- Produces: `requireInventoryBranch(modelName: SupportedModelName, branchId?: string): string | undefined`
- CRUD service `create/getById/update/delete` receive an optional authenticated branch ID.

- [ ] **Step 1: Write failing inventory scope tests**

Add tests proving inventory models require a branch for create, the persisted payload overwrites a body `branchId`, and get/update/delete queries contain `{ companyCode, branchId }`.

```ts
expect(() => requireInventoryBranch("products", undefined)).toThrow(/chi nhánh/i);
expect(requireInventoryBranch("products", "branch-a")).toBe("branch-a");
expect(requireInventoryBranch("training-courses", undefined)).toBeUndefined();
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx vitest run server/service/crud-branch-scope.test.ts`

Expected: FAIL because the branch-scope helper/export does not exist.

- [ ] **Step 3: Implement authenticated inventory scope**

Pass `req.user?.branchId` from all CRUD controller methods. For `products`, `categories`, and `stock-logs`, require a branch on create and add it to create/get/update/delete database queries. Strip `branchId` from client update payloads.

```ts
const INVENTORY_MODELS = new Set<SupportedModelName>(["products", "categories", "stock-logs"]);
export function requireInventoryBranch(modelName: SupportedModelName, branchId?: string) {
  if (!INVENTORY_MODELS.has(modelName)) return undefined;
  if (!branchId) throw Object.assign(new Error("Vui lòng chọn chi nhánh trước khi thao tác."), { statusCode: 400 });
  return branchId;
}
```

- [ ] **Step 4: Make inventory uniqueness branch-local**

Replace global product SKU uniqueness and company-only category indexes with compound indexes:

```ts
ProductSchema.index({ companyCode: 1, branchId: 1, sku: 1 }, { unique: true });
CategorySchema.index({ companyCode: 1, branchId: 1, name: 1 }, { unique: true });
CategorySchema.index({ companyCode: 1, branchId: 1, code: 1 }, { unique: true });
```

- [ ] **Step 5: Verify GREEN**

Run: `npx vitest run server/service/crud-branch-scope.test.ts && npm run typecheck`

Expected: all focused tests pass and typecheck exits 0.

### Task 2: Student branch-scope contract and persistence

**Files:**
- Modify: `server/modules/student-management/utils/auth.util.ts`
- Modify: `server/modules/student-management/utils/auth.util.test.ts`
- Modify: tenant-owned interfaces under `server/modules/student-management/interfaces/*.ts`
- Modify: matching schemas under `server/modules/student-management/models/*.ts`

**Interfaces:**
- Produces: `requireStudentBranch(user: StudentModuleUser): string`
- Produces: `buildStudentBranchQuery(branchId: string): { branchId: string }`
- Tenant-owned records expose `branchId: string`.

- [ ] **Step 1: Write failing student branch tests**

```ts
expect(requireStudentBranch({ uid: "admin-a", role: "admin", centerId: "ACME", companyCode: "ACME", branchId: "branch-a" })).toBe("branch-a");
expect(() => requireStudentBranch({ uid: "admin-a", role: "admin", centerId: "ACME", companyCode: "ACME" })).toThrow(/chi nhánh/i);
expect(buildStudentBranchQuery("branch-a")).toEqual({ branchId: "branch-a" });
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npx vitest run server/modules/student-management/utils/auth.util.test.ts`

Expected: FAIL because the new helpers do not exist.

- [ ] **Step 3: Implement the branch contract**

Export `StudentModuleUser`, reject a missing effective branch for authenticated admin writes, and provide one query helper. Add required `branchId` fields and indexes to the principal tenant-owned student-management schemas and interfaces: students, courses, batches, exams, resources, partners, assignments, notifications, payments, course/resource categories, and commission levels.

- [ ] **Step 4: Verify model/type consistency**

Run: `npx vitest run server/modules/student-management/utils/auth.util.test.ts && npm run typecheck`

Expected: helper tests pass and typecheck identifies no missing branch fields.

### Task 3: Propagate branch scope through student-management writes and queries

**Files:**
- Modify: create/read/update/delete controllers in `server/modules/student-management/controllers/*.controller.ts`
- Modify: corresponding services in `server/modules/student-management/services/*.service.ts`
- Modify: `server/modules/student-management/services/custom-field-write-integration.test.ts`
- Create: focused branch persistence tests beside affected services where needed.

**Interfaces:**
- Consumes: `requireStudentBranch(user)` and `{ branchId: string }`.
- Service create methods receive `branchId` as a server-owned argument and save `{ ...writeData, ownerId, branchId }`.
- Service query methods receive `branchId` and combine it with the existing owner query.

- [ ] **Step 1: Write failing persistence/query tests**

For students and representative generic entities, assert constructor payloads contain `branchId: "branch-a"`; assert detail/update/delete queries contain both owner scope and `branchId`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run server/modules/student-management/utils/auth.util.test.ts server/modules/student-management/services/custom-field-write-integration.test.ts`

Expected: FAIL because services do not yet accept or persist branch scope.

- [ ] **Step 3: Propagate authenticated scope**

Controllers call `requireStudentBranch(req.user!)` for authenticated creates and pass the result to services. Services persist the branch and include it in all tenant-record queries. Public/token flows look up the parent teacher, student, batch, assignment, or notification and inherit that record's `branchId`; they never accept branch scope from the request body.

- [ ] **Step 4: Preserve server ownership on updates**

Remove `branchId`, `companyCode`, and `ownerId` from update payloads before applying updates. Use `{ _id, branchId, ...ownerScope }` for update/delete/detail matches.

- [ ] **Step 5: Verify GREEN and regressions**

Run:

```text
npx vitest run server/service/crud-branch-scope.test.ts server/modules/student-management/utils/auth.util.test.ts server/modules/student-management/services/custom-field-write-integration.test.ts
npm run typecheck
npm run build
git diff --check
```

Expected: focused tests, typecheck, and build all exit 0; diff check reports no whitespace errors.

### Task 4: Commit and publish

**Files:**
- All files modified in Tasks 1-3.

- [ ] **Step 1: Review scope**

Run: `git status --short && git diff --stat && git diff --check`

Expected: only branch-isolation implementation, tests, spec, and plan are present.

- [ ] **Step 2: Commit**

```text
git add server/controller/crud.controller.ts server/service/crud.service.ts server/service/crud-branch-scope.test.ts server/model/product.model.ts server/model/category.model.ts server/modules/student-management docs/superpowers
git commit -m "fix: enforce branch isolation for inventory and students"
```

- [ ] **Step 3: Push**

Run: `git push`

Expected: `origin/fix/student-management-branch-owner-scope` advances to the new commit.
