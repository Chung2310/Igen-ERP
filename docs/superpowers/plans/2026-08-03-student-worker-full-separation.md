# Student Worker Full Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Student and Worker separate modules with separate business type filtering, backend data/API ownership, and frontend workspaces.

**Architecture:** Keep `student-management` as the education module and move labor-specific profile, project, attendance, and QR flows into `worker-management`. Keep old customer/candidate code in place for compatibility, but remove it from selectable business type and tenant/module UX. Do not migrate legacy worker preset data.

**Tech Stack:** TypeScript, React 19, Express, Mongoose, Vitest, node:test, existing `apiFetch`, existing module guard and permission middleware.

## Global Constraints

- Selectable business types are exactly `education` and `labor`.
- `education` requires module `student`; `labor` requires module `worker`.
- `customer`, `candidate`, `service`, `recruitment`, and `general` remain compatibility-only and must not appear in tenant setup UI.
- Do not migrate legacy worker data from `student-management`.
- Worker profile/project/attendance/QR data must not use `Student`, `Batch`, or `Course` collections.
- Worker endpoints use `worker:read` and `worker:manage`, never `student:*`.
- Do not remove old customer/candidate source files in this plan.
- Run `yarn typecheck` after backend and frontend migration groups.

---

## File Structure

Backend config:
- Modify `server/config/business-types.ts`: restrict selectable/current business types to education/labor and compatibility fallback.
- Modify `src/config/businessTypes.ts`: mirror frontend business type behavior.
- Modify SuperAdmin tenant module UI files found by `rg "BUSINESS_TYPES|BUSINESS_TYPE_LABELS|getRequiredBusinessModule" src server`.
- Test existing config tests plus new two-type assertions.

Backend worker module:
- Existing `server/modules/worker-management/models/worker.model.ts`: worker profiles.
- Create `server/modules/worker-management/models/worker-project.model.ts`: worker projects and member IDs.
- Create `server/modules/worker-management/services/worker-project.service.ts`: project CRUD and membership.
- Move/adapt `server/modules/student-management/services/worker-attendance.service.ts` to `server/modules/worker-management/services/worker-attendance.service.ts` so it reads `WorkerProjectModel` and worker IDs.
- Create/move worker attendance controller/routes under `server/modules/worker-management`.
- Create `server/modules/worker-management/services/worker-qr-attendance.service.ts` by extracting worker mode behavior from student QR service.
- Modify `server/modules/worker-management/router.ts` to mount `/projects`, `/attendance`, and `/qr-attendance`.
- Modify `server/modules/student-management/router.ts` to stop mounting `/attendance/worker` for the worker workspace.

Frontend worker module:
- Modify/create `src/modules/worker-management/types.ts` for `Worker`, `WorkerProject`, `WorkerAttendanceLog`.
- Create `src/modules/worker-management/api/workerProjects.api.ts`.
- Create `src/modules/worker-management/api/workerAttendance.api.ts`.
- Modify `src/modules/worker-management/WorkerWorkspace.tsx` to route profile/project/attendance views to worker APIs.
- Copy/adapt `WorkerTimekeepingPanel.tsx`, `WorkerTimekeepingHistory.tsx`, and QR controls into `src/modules/worker-management/components` if reuse would otherwise import student business logic.
- Leave `src/modules/student-management` worker preset helper files in place unless they are directly mounted for labor tenants.

---

### Task 1: Restrict Business Types To Education And Labor

**Files:**
- Modify: `server/config/business-types.ts`
- Modify: `src/config/businessTypes.ts`
- Modify: SuperAdmin/module settings files located with `rg -n "BUSINESS_TYPES|BUSINESS_TYPE_LABELS|getRequiredBusinessModule|customer|candidate" src server -g "*.ts" -g "*.tsx"`
- Test: existing config tests found with `rg -n "businessType|filterModulesForBusinessType|filterEnabledTabs" src server -g "*.test.ts"`

**Interfaces:**
- Produces: `BUSINESS_TYPES = ["education", "labor"] as const`
- Produces: `BusinessType = "education" | "labor"`
- Produces: `resolveBusinessType(input, legacyPreset?)` returning only `education` or `labor`
- Produces: `filterModulesForBusinessType(input, businessType)` keeping common modules and exactly one business module

- [ ] **Step 1: Write failing config tests**

Add or update tests so the desired behavior is explicit:

```ts
import { describe, expect, it } from "vitest";
import { BUSINESS_TYPES, resolveBusinessType, filterModulesForBusinessType } from "./business-types";

describe("two business type policy", () => {
  it("only exposes education and labor as selectable business types", () => {
    expect(BUSINESS_TYPES).toEqual(["education", "labor"]);
  });

  it("falls compatibility-only business types back to education", () => {
    expect(resolveBusinessType("service")).toBe("education");
    expect(resolveBusinessType("recruitment")).toBe("education");
    expect(resolveBusinessType("general")).toBe("education");
    expect(resolveBusinessType(undefined, "customer")).toBe("education");
    expect(resolveBusinessType(undefined, "candidate")).toBe("education");
  });

  it("allows only student for education and worker for labor", () => {
    expect(filterModulesForBusinessType(["student", "worker", "chat"], "education")).toEqual(["student", "chat"]);
    expect(filterModulesForBusinessType(["student", "worker", "chat"], "labor")).toEqual(["worker", "chat"]);
  });
});
```

Mirror the same expectation in frontend config tests using `src/config/businessTypes.ts` and `src/config/modules.ts`.

- [ ] **Step 2: Run tests and verify failure**

Run focused config tests, for example:

```bash
yarn vitest run server/config/business-types.test.ts src/config/modules.test.ts --exclude "**/.worktrees/**" --exclude "**/.claude/**"
```

Expected before implementation: FAIL because `BUSINESS_TYPES` includes `service`, `recruitment`, or `general`, or because filtering still exposes customer/candidate compatibility types.

- [ ] **Step 3: Implement two-type config**

In backend config, use this shape:

```ts
export const BUSINESS_TYPES = ["education", "labor"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export const DEFAULT_BUSINESS_TYPE: BusinessType = "education";

const LEGACY_PRESET_BUSINESS_TYPE: Record<string, BusinessType> = {
  student: "education",
  worker: "labor",
  customer: "education",
  candidate: "education",
};

const REQUIRED_BUSINESS_MODULE: Record<BusinessType, ModuleKey> = {
  education: "student",
  labor: "worker",
};

const BUSINESS_MODULES = new Set<ModuleKey>(["student", "worker", "customer", "candidate"]);
```

Keep `ModuleKey` compatibility for customer/candidate, but do not expose those keys for education/labor.

- [ ] **Step 4: Update tenant setup UI**

Remove customer/candidate/service/recruitment/general from selectable labels and dropdowns. Keep code paths compiling by mapping unknown values through `resolveBusinessType`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
yarn vitest run server/config/business-types.test.ts src/config/modules.test.ts --exclude "**/.worktrees/**" --exclude "**/.claude/**"
yarn typecheck
```

Expected: PASS.

Commit:

```bash
git add server/config src/config src/pages src/components
git commit -m "Restrict business types to students and workers"
```

---

### Task 2: Add Worker Project Backend With Separate Collection

**Files:**
- Create: `server/modules/worker-management/interfaces/worker-project.interface.ts`
- Create: `server/modules/worker-management/models/worker-project.model.ts`
- Create: `server/modules/worker-management/services/worker-project.service.ts`
- Create: `server/modules/worker-management/controllers/worker-project.controller.ts`
- Create: `server/modules/worker-management/routes/worker-project.routes.ts`
- Modify: `server/modules/worker-management/router.ts`
- Test: `server/modules/worker-management/services/worker-project.service.test.ts`

**Interfaces:**
- Consumes: `WorkerScope = { companyCode: string; branchId?: string }` from `worker.service.ts`
- Produces: `WorkerProjectService.list/create/update/delete/addWorker/removeWorker`
- Produces endpoint base `/api/v1/worker-management/projects`

- [ ] **Step 1: Write failing service tests**

Create `worker-project.service.test.ts` with tests for query scope and normalization:

```ts
import { describe, expect, it } from "vitest";
import { buildWorkerProjectQuery, normalizeWorkerProjectInput } from "./worker-project.service";

describe("worker project service", () => {
  it("scopes projects by company and branch", () => {
    expect(buildWorkerProjectQuery({ companyCode: "ACME", branchId: "HN" })).toEqual({
      companyCode: "ACME",
      branchId: "HN",
      deletedAt: null,
    });
  });

  it("requires a project name and normalizes project defaults", () => {
    expect(() => normalizeWorkerProjectInput({ name: "" })).toThrow("Project name is required");
    expect(normalizeWorkerProjectInput({ name: " Site A ", code: " da-1 ", startTime: "", endTime: "" })).toMatchObject({
      name: "Site A",
      code: "DA-1",
      startTime: "08:00",
      endTime: "17:00",
      workerIds: [],
    });
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
yarn vitest run server/modules/worker-management/services/worker-project.service.test.ts --exclude "**/.worktrees/**" --exclude "**/.claude/**"
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement model and service**

Create `WorkerProjectModel` with fields: `companyCode`, `branchId`, `code`, `name`, `quota`, `workerIds`, `daysOfWeek`, `startTime`, `endTime`, `location`, `geoLocation`, `startDate`, `endDate`, `status`, `note`, `deletedAt`, timestamps. Use status values `planned`, `active`, `completed`.

Implement helpers:

```ts
export function buildWorkerProjectQuery(scope: WorkerScope) {
  return { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), deletedAt: null };
}

export function normalizeWorkerProjectInput(input: WorkerProjectInput) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Project name is required");
  return {
    name,
    code: String(input.code || "").trim().toUpperCase(),
    quota: input.quota === undefined || input.quota === "" ? 0 : Number(input.quota),
    workerIds: Array.isArray(input.workerIds) ? input.workerIds.map(String) : [],
    daysOfWeek: Array.isArray(input.daysOfWeek) ? input.daysOfWeek.map(Number) : [],
    startTime: String(input.startTime || "08:00"),
    endTime: String(input.endTime || "17:00"),
    location: String(input.location || "").trim(),
    startDate: String(input.startDate || ""),
    endDate: String(input.endDate || ""),
    status: ["planned", "active", "completed"].includes(String(input.status)) ? String(input.status) : "planned",
    note: String(input.note || "").trim(),
    geoLocation: input.geoLocation ?? null,
  };
}
```

- [ ] **Step 4: Implement controller and routes**

Use `worker:read` for GET and `worker:manage` for POST/PATCH/DELETE/member mutations. Mount routes:

```ts
workerManagementRouter.use("/projects", workerProjectRoutes);
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
yarn vitest run server/modules/worker-management/services/worker-project.service.test.ts --exclude "**/.worktrees/**" --exclude "**/.claude/**"
yarn typecheck
```

Expected: PASS.

Commit:

```bash
git add server/modules/worker-management
 git commit -m "Add worker project backend"
```

---

### Task 3: Move Worker Attendance Backend To Worker Management

**Files:**
- Create/modify: `server/modules/worker-management/services/worker-attendance.service.ts`
- Create/modify: `server/modules/worker-management/controllers/worker-attendance.controller.ts`
- Create/modify: `server/modules/worker-management/routes/worker-attendance.routes.ts`
- Create/modify: `server/modules/worker-management/models/worker-attendance-log.model.ts`
- Modify: `server/modules/worker-management/router.ts`
- Modify: `server/modules/student-management/router.ts`
- Test: `server/modules/worker-management/services/worker-attendance.logic.test.ts`

**Interfaces:**
- Consumes: `WorkerProjectModel` from Task 2
- Consumes: `WorkerModel` from existing worker profile module
- Produces: `WorkerAttendanceService.mark/listByProjectDate/listByProjectRange/adjust`
- Produces endpoints `/api/v1/worker-management/attendance`, `/attendance/mark`, `/attendance/:id`

- [ ] **Step 1: Move tests first**

Copy the current logic tests from `server/modules/student-management/services/worker-attendance.logic.test.ts` to `server/modules/worker-management/services/worker-attendance.logic.test.ts`. Update imports to:

```ts
import {
  assertWithinProjectRadius,
  calculateWorkedMinutes,
  resolveAttendanceStatus,
  vietnamMinutesOfDay,
  vietnamWorkDate,
  WorkerAttendanceError,
  DEFAULT_PROJECT_RADIUS_METERS,
} from "./worker-attendance.service";
```

Add an import isolation test:

```ts
import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

it("does not import student-management models for worker attendance", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "server/modules/worker-management/services/worker-attendance.service.ts"), "utf8");
  expect(source).not.toContain("student-management");
  expect(source).not.toContain("../models/batch.model");
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
yarn vitest run server/modules/worker-management/services/worker-attendance.logic.test.ts --exclude "**/.worktrees/**" --exclude "**/.claude/**"
```

Expected: FAIL because the worker-management attendance service does not exist or still imports student models.

- [ ] **Step 3: Implement worker-owned attendance service**

Move/adapt the existing attendance logic, replacing:

- `Batch` with `WorkerProjectModel`
- `batchId` with `projectId` in new public interfaces
- `studentId` with `workerId`
- `learnerIds` with `workerIds`

Keep stored field names in `WorkerAttendanceLogModel` as `workerId`, `projectId`, `companyCode`, `branchId`, `date`, `checkIn`, `checkOut`, `status`, `workedMinutes`, `note`.

- [ ] **Step 4: Implement controller/routes**

Controller reads `projectId` and `workerId`, derives scope from `req.user.companyCode` and `req.user.branchId`, and uses worker permissions. Do not import `STUDENT_AREA_PERMISSIONS`.

- [ ] **Step 5: Remove worker attendance mount from student router**

Delete or stop mounting this line from `server/modules/student-management/router.ts`:

```ts
studentManagementRouter.use("/attendance/worker", authMiddleware as unknown as RequestHandler, requireStudentModule, workerAttendanceRoutes);
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
yarn vitest run server/modules/worker-management/services/worker-attendance.logic.test.ts --exclude "**/.worktrees/**" --exclude "**/.claude/**"
yarn typecheck
```

Expected: PASS.

Commit:

```bash
git add server/modules/worker-management server/modules/student-management/router.ts
git commit -m "Move worker attendance backend"
```

---

### Task 4: Extract Worker QR Attendance Backend

**Files:**
- Create: `server/modules/worker-management/services/worker-qr-attendance.service.ts`
- Create: `server/modules/worker-management/controllers/worker-qr-attendance.controller.ts`
- Create: `server/modules/worker-management/routes/worker-qr-attendance.routes.ts`
- Modify: `server/modules/worker-management/router.ts`
- Modify: `server/modules/student-management/services/qr-attendance.service.ts`
- Modify: `server/modules/student-management/controllers/qr-attendance.controller.ts`
- Test: `server/modules/worker-management/services/worker-qr-attendance.service.test.ts`
- Test: keep or adapt `server/modules/student-management/services/qr-attendance.worker.test.ts` into worker-management

**Interfaces:**
- Consumes: `WorkerAttendanceService.mark`
- Consumes: `WorkerProjectModel`
- Produces: endpoints `/api/v1/worker-management/qr-attendance/session`, `/token`, `/status/:sessionId`, `/close/:sessionId`, and public checkin route if current public route needs worker token support

- [ ] **Step 1: Write failing QR worker tests**

Move worker QR tests under worker-management and assert:

```ts
expect(session.shared).toBe(true);
expect(session.mode).toBe("worker");
expect(QRAttendanceService.closeSession).not.toBeUsedForWorkerFlow;
```

Use concrete assertions from current `qr-attendance.worker.test.ts`: shared QR close does not call class attendance save, and checkin returns `kind` from worker attendance mark.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
yarn vitest run server/modules/worker-management/services/worker-qr-attendance.service.test.ts --exclude "**/.worktrees/**" --exclude "**/.claude/**"
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Extract worker QR service**

Create a worker-specific service instead of keeping `mode: "worker"` in student QR service. It should:

- always create shared tokens with token TTL equal to session TTL
- skip nonce consumption for shared QR
- allow second scan by same worker to become checkout through `WorkerAttendanceService.mark`
- never call `BatchService.saveAttendanceSession`
- use `WorkerProjectModel` membership and `WorkerModel` phone lookup

- [ ] **Step 4: Restore student QR service to class-only semantics**

Remove worker-specific `mode`, `shared`, and `WorkerAttendanceService` imports from `server/modules/student-management/services/qr-attendance.service.ts` unless needed for backward compatibility tests. Student QR should remain rotating 30s class attendance.

- [ ] **Step 5: Verify and commit**

Run:

```bash
yarn vitest run server/modules/worker-management/services/worker-qr-attendance.service.test.ts server/modules/student-management/services/qr-attendance*.test.ts --exclude "**/.worktrees/**" --exclude "**/.claude/**"
yarn typecheck
```

Expected: PASS.

Commit:

```bash
git add server/modules/worker-management server/modules/student-management/services/qr-attendance.service.ts server/modules/student-management/controllers/qr-attendance.controller.ts
git commit -m "Extract worker QR attendance backend"
```

---

### Task 5: Move Worker Frontend Flows To Worker Management APIs

**Files:**
- Modify: `src/modules/worker-management/types.ts`
- Modify: `src/modules/worker-management/api/workers.api.ts`
- Create: `src/modules/worker-management/api/workerProjects.api.ts`
- Create: `src/modules/worker-management/api/workerAttendance.api.ts`
- Modify: `src/modules/worker-management/WorkerWorkspace.tsx`
- Create: `src/modules/worker-management/components/WorkerProjectsPage.tsx`
- Create: `src/modules/worker-management/components/WorkerTimekeepingPanel.tsx`
- Create: `src/modules/worker-management/components/WorkerTimekeepingHistory.tsx`
- Test: `src/modules/worker-management/WorkerWorkspace.test.tsx`

**Interfaces:**
- Consumes backend endpoints from Tasks 2-4
- Produces frontend calls only to `/worker-management/workers`, `/worker-management/projects`, `/worker-management/attendance`, `/worker-management/qr-attendance`

- [ ] **Step 1: Write failing frontend endpoint tests**

Extend `WorkerWorkspace.test.tsx` so it asserts no worker flow calls student endpoints:

```tsx
expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/worker-management/workers"), expect.anything());
expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/v1/student-management"), expect.anything());
```

Add project/attendance interactions that click project and attendance tabs and assert endpoint prefixes include `/worker-management`.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
yarn vitest run src/modules/worker-management/WorkerWorkspace.test.tsx --exclude "**/.worktrees/**" --exclude "**/.claude/**"
```

Expected: FAIL if current worker workspace still lacks project/attendance flows or uses student-management scoped API.

- [ ] **Step 3: Implement worker API wrappers**

Use direct endpoint strings:

```ts
const WORKER_BASE = "/worker-management";
export const workerProjectsApi = {
  list: () => apiFetch(`${WORKER_BASE}/projects`),
  create: (payload: WorkerProjectInput) => apiFetch(`${WORKER_BASE}/projects`, { method: "POST", body: JSON.stringify(payload) }),
};
```

Do not call `setBusinessApiScope("worker")`.

- [ ] **Step 4: Implement workspace tabs**

Add tabs for profile, projects, and attendance. Reuse existing visual classes from `WorkerWorkspace.tsx`; keep first implementation functionally complete rather than redesigning.

- [ ] **Step 5: Verify and commit**

Run:

```bash
yarn vitest run src/modules/worker-management/WorkerWorkspace.test.tsx --exclude "**/.worktrees/**" --exclude "**/.claude/**"
yarn typecheck
```

Expected: PASS.

Commit:

```bash
git add src/modules/worker-management
git commit -m "Move worker frontend flows to worker APIs"
```

---

### Task 6: Remove Worker Top-Level Mounts From Student Management

**Files:**
- Modify: `src/modules/student-management/config/entityLabels.ts`
- Modify: `src/modules/student-management/hooks/useEntityLabel.ts` if it can still select worker for top-level student workspace
- Modify: student router/sidebar integration files found by `rg -n "setBusinessApiScope|entityPreset === 'worker'|preset === \"worker\"|worker-management" src/modules/student-management src -g "*.ts" -g "*.tsx"`
- Test: `src/modules/business-module-isolation.test.ts`
- Test: `server/router/module-route-guards.test.ts`

**Interfaces:**
- Produces: labor tenants enter `src/modules/worker-management`, not `src/modules/student-management` with preset worker
- Produces: `/api/v1/student-management/*` class/student routes remain education-only

- [ ] **Step 1: Write failing isolation tests**

Add tests:

```ts
expect(importsModule("src/modules/worker-management", "student-management/lib/api")).toEqual([]);
expect(importsModule("server/modules/worker-management", "student-management/models/student.model")).toEqual([]);
expect(importsModule("server/modules/worker-management", "student-management/models/batch.model")).toEqual([]);
```

Add route guard assertion:

```ts
assert.equal(resolveBusinessModuleKey("/api/v1/worker-management/projects"), "worker");
assert.equal(resolveBusinessModuleKey("/api/v1/student-management/batches"), "student");
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
yarn vitest run src/modules/business-module-isolation.test.ts server/router/module-route-guards.test.ts --exclude "**/.worktrees/**" --exclude "**/.claude/**"
```

Expected: FAIL until remaining imports/mounts are cleaned up.

- [ ] **Step 3: Remove top-level worker preset routing**

Keep helper files if needed for old compile paths, but remove active labor tenant routing through student workspace. Replace `setBusinessApiScope("worker")` usage with direct worker workspace routing or delete it if no longer needed.

- [ ] **Step 4: Verify full suite subset and commit**

Run:

```bash
yarn vitest run src/modules/business-module-isolation.test.ts server/router/module-route-guards.test.ts src/modules/worker-management/WorkerWorkspace.test.tsx --exclude "**/.worktrees/**" --exclude "**/.claude/**"
yarn typecheck
```

Expected: PASS.

Commit:

```bash
git add src server
git commit -m "Isolate student and worker module routing"
```

---

## Self-Review

- Spec coverage: Task 1 covers two business types and customer/candidate hidden compatibility. Tasks 2-4 cover worker-owned backend data/service/controller/router for profile-adjacent projects, attendance, and QR. Task 5 covers frontend worker flows using worker APIs. Task 6 covers removal of active worker mounts from student-management and isolation tests.
- Placeholder scan: no `TBD`, `TODO`, or open-ended implementation placeholders remain. Each task has concrete files, interfaces, test commands, and expected results.
- Type consistency: backend worker uses `Worker`, `WorkerProject`, `WorkerAttendanceLog`, `workerId`, and `projectId` consistently; legacy student names are only referenced as source migration targets to replace.
