# Worker–Student Full Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `worker-management` fully own its frontend and backend flows without changing the current worker UI, public API contracts, permissions, or user-visible behavior.

**Architecture:** Replace the current student-backed `shared-management` adapter one flow at a time. Each replacement is guarded by contract tests and uses the existing Worker, WorkerProject, WorkerAttendanceLog, and worker QR implementations; cleanup happens only after every worker tab has a worker-owned implementation.

**Tech Stack:** TypeScript 5.8, React 19, Express 4, Mongoose 9, Vitest 4, Testing Library, Vite 6.

## Global Constraints

- Do not migrate or delete legacy worker-preset data from student collections.
- Keep the four worker tabs, visual layout, modal lifecycle, loading states, toast behavior, and navigation unchanged.
- Replace student-named worker URLs with worker-owned resources (`workers`, `projects`, `attendance`, `qr-attendance`, `dashboard`, `notifications`) and keep method, request body semantics, HTTP status, response shape, and validation/error behavior unchanged; do not retain legacy aliases.
- Keep permissions exactly `worker:read` and `worker:manage`.
- Every worker query is scoped by `companyCode` and, when present, `branchId`.
- Worker code must not import student hooks, types, pages, models, services, or routers directly or through `shared-management`.
- Use TDD for every behavior change and commit after every task.

---

## File Structure

Backend worker ownership:

- `server/modules/worker-management/contracts.ts`: canonical worker response and scope helpers.
- `server/modules/worker-management/models/*`: worker-owned collections only.
- `server/modules/worker-management/services/*`: profile, project, attendance, QR, dashboard, and notification behavior.
- `server/modules/worker-management/routes/*`: public `/worker-management/*` contracts.
- `server/modules/worker-management/router.ts`: mounts only worker-owned routers.

Frontend worker ownership:

- `src/modules/worker-management/api/*`: direct worker endpoint calls; no global scope remapping.
- `src/modules/worker-management/hooks/*`: query/mutation state for each worker flow.
- `src/modules/worker-management/pages/*`: four worker-owned tab pages.
- `src/modules/worker-management/components/*`: worker-owned add/detail/project/attendance UI.
- `src/modules/worker-management/WorkerWorkspace.tsx`: shell and tab routing only.

Boundary enforcement:

- `src/modules/business-module-isolation.test.ts`: source dependency graph checks.
- `server/modules/worker-management/worker-module-isolation.test.ts`: backend router/model ownership checks.
- Remove business exports from `src/modules/shared-management` and `server/modules/shared-management` at final cutover.

---

### Task 1: Lock Worker Contracts and Strengthen Isolation Tests

**Files:**
- Create: `server/modules/worker-management/contracts.ts`
- Create: `server/modules/worker-management/worker-contract.test.ts`
- Create: `server/modules/worker-management/worker-module-isolation.test.ts`
- Modify: `src/modules/business-module-isolation.test.ts`
- Modify: `src/modules/worker-management/WorkerWorkspace.test.tsx`

**Interfaces:**
- Produces: `WorkerScope = { companyCode: string; branchId?: string }`
- Produces: `workerScopeFromActor(actor): WorkerScope`
- Produces: source-boundary tests consumed as the final cutover gate.

- [ ] **Step 1: Write failing backend boundary tests**

Assert that the worker router does not mount `sharedManagementRouter`, that backend shared-management does not export `studentManagementRouter`, and that all non-test worker files contain neither `student-management` nor `StudentModel`/`BatchModel` imports.

```ts
it("does not mount student routes under worker-management", () => {
  const source = read("server/modules/worker-management/router.ts");
  expect(source).not.toContain("sharedManagementRouter");
  expect(source).not.toContain("studentManagementRouter");
});
```

- [ ] **Step 2: Write failing frontend boundary tests**

```ts
expect(importsModule("src/modules/worker-management", "student-management")).toEqual([]);
expect(read("src/modules/worker-management/WorkerWorkspace.tsx")).not.toContain("shared-management/runtime");
expect(read("src/modules/worker-management/WorkerWorkspace.tsx")).not.toContain("setBusinessApiScope");
```

- [ ] **Step 3: Run tests and capture expected failures**

Run:

```powershell
npx vitest run src/modules/business-module-isolation.test.ts src/modules/worker-management/WorkerWorkspace.test.tsx server/modules/worker-management/worker-module-isolation.test.ts
```

Expected: FAIL on current shared-management imports and router mount.

- [ ] **Step 4: Add contract helpers without changing routes**

```ts
export type WorkerScope = { companyCode: string; branchId?: string };

export function workerScopeFromActor(actor: { companyCode?: unknown; branchId?: unknown }): WorkerScope {
  const companyCode = String(actor.companyCode || "").trim().toUpperCase();
  if (!companyCode) throw new Error("Company scope is required");
  const branchId = String(actor.branchId || "").trim();
  return { companyCode, ...(branchId ? { branchId } : {}) };
}
```

- [ ] **Step 5: Record cutover assertions without committing skipped tests and commit baseline**

Focused contract tests must pass. Store the cutover assertions in the Task 7 brief/progress ledger; do not add or commit skipped tests. Commit:

```powershell
git add server/modules/worker-management src/modules/business-module-isolation.test.ts src/modules/worker-management/WorkerWorkspace.test.tsx
git commit -m "test: lock worker module contracts"
```

---

### Task 2: Complete Worker Profile Backend Contract

**Files:**
- Modify: `server/modules/worker-management/interfaces/worker.interface.ts`
- Modify: `server/modules/worker-management/models/worker.model.ts`
- Modify: `server/modules/worker-management/services/worker.service.ts`
- Modify: `server/modules/worker-management/controllers/worker.controller.ts`
- Create: `server/modules/worker-management/routes/worker.routes.test.ts`
- Modify: `server/modules/worker-management/services/worker.service.test.ts`

**Interfaces:**
- Consumes: `WorkerScope` from `contracts.ts`.
- Produces: `{ workers: Worker[] }`, `{ worker: Worker }` with existing status codes 200/201/404.
- Produces Worker fields required by current UI: `_id`, `fullName`, `phone`, `email`, `status`, `note`, `branchId`, `address`, `birthday`, `idCard`, `registrationDate`, `customFields`, timestamps.

- [ ] **Step 1: Write failing service and route tests**

Cover tenant/branch query, optional profile fields, lowercase email, soft delete, 404, `worker:read`, and `worker:manage`. Assert unknown student-only fields are not persisted.

```ts
expect(normalizeWorkerInput({ fullName: " A ", address: " HN ", birthday: "2000-01-01" }))
  .toMatchObject({ fullName: "A", address: "HN", birthday: "2000-01-01", status: "active" });
```

- [ ] **Step 2: Run tests and verify failure**

```powershell
npx vitest run server/modules/worker-management/services/worker.service.test.ts server/modules/worker-management/routes/worker.routes.test.ts
```

Expected: FAIL because optional UI fields are absent and route contracts are not covered.

- [ ] **Step 3: Extend Worker schema and normalization minimally**

Add only current worker UI fields listed in Interfaces. Keep `companyCode`, `branchId`, `deletedAt`, timestamps, and text index `{ fullName: "text", phone: "text" }`.

- [ ] **Step 4: Use one scope helper in every controller action**

Replace local scope construction with `workerScopeFromActor((req as any).user || {})` and preserve response bodies/statuses.

- [ ] **Step 5: Verify and commit**

```powershell
npx vitest run server/modules/worker-management/services/worker.service.test.ts server/modules/worker-management/routes/worker.routes.test.ts
npm run typecheck
git add server/modules/worker-management
git commit -m "feat: complete worker profile contract"
```

---

### Task 3: Connect Worker Profile UI to Worker API

**Files:**
- Modify: `src/modules/worker-management/types.ts`
- Modify: `src/modules/worker-management/api/workers.api.ts`
- Create: `src/modules/worker-management/hooks/useWorkers.ts`
- Create: `src/modules/worker-management/pages/WorkersPage.tsx`
- Create: `src/modules/worker-management/components/AddWorkerModal.tsx`
- Create: `src/modules/worker-management/components/WorkerDetailModal.tsx`
- Modify: `src/modules/worker-management/WorkerWorkspace.tsx`
- Create: `src/modules/worker-management/pages/WorkersPage.test.tsx`
- Modify: `src/modules/worker-management/WorkerWorkspace.test.tsx`

**Interfaces:**
- `useWorkers(scope): { workers; loading; error; createWorker; updateWorker; deleteWorker; reload }`.
- Direct calls: `/api/v1/worker-management/workers` and `/workers/:id`.
- Preserve existing worker-list visual classes and add/detail modal lifecycle.

- [ ] **Step 1: Write failing API and page tests**

Assert direct URLs, auth headers, list/loading/empty/error states, add success closes modal and reloads, detail update reloads, and delete uses soft-delete endpoint.

```ts
expect(fetchMock).toHaveBeenCalledWith(
  expect.stringContaining("/api/v1/worker-management/workers"),
  expect.objectContaining({ headers: expect.any(Headers) }),
);
```

- [ ] **Step 2: Run tests and verify failure**

```powershell
npx vitest run src/modules/worker-management/pages/WorkersPage.test.tsx src/modules/worker-management/WorkerWorkspace.test.tsx
```

Expected: FAIL because workspace still uses `useStudents` and student modals.

- [ ] **Step 3: Implement direct worker API wrapper and hook**

Use a constant `WORKER_BASE = "/worker-management/workers"`; do not import `student-management/lib/api`. Move generic authenticated fetch into `src/modules/worker-management/api/client.ts` if the existing `shared-management/api.ts` still re-exports student code.

- [ ] **Step 4: Copy current visual markup into worker-owned page/modals**

Preserve classes, labels, button order, modal close behavior and toast text. Replace Student names/types with Worker and remove fee/exam-only controls not visible in current worker preset.

- [ ] **Step 5: Switch only the Lao động tab and verify**

```powershell
npx vitest run src/modules/worker-management/pages/WorkersPage.test.tsx src/modules/worker-management/WorkerWorkspace.test.tsx
npm run typecheck
git add src/modules/worker-management
git commit -m "feat: connect worker profiles to worker API"
```

---

### Task 4: Complete Worker Project Ownership and UI

**Files:**
- Modify: `server/modules/worker-management/models/worker-project.model.ts`
- Modify: `server/modules/worker-management/services/worker-project.service.ts`
- Modify: `server/modules/worker-management/services/worker-project.service.test.ts`
- Modify: `src/modules/worker-management/api/workerProjects.api.ts`
- Create: `src/modules/worker-management/hooks/useWorkerProjects.ts`
- Create: `src/modules/worker-management/pages/WorkerProjectsPage.tsx`
- Create: `src/modules/worker-management/pages/WorkerProjectsPage.test.tsx`
- Modify: `src/modules/worker-management/WorkerWorkspace.tsx`

**Interfaces:**
- `WorkerProject.workerIds` references model `Worker`.
- Membership mutations reject worker not found in the same `companyCode`/`branchId`.
- UI keeps current Dự án table/cards, create/edit/delete/member actions and status labels.

- [ ] **Step 1: Write failing relation and contract tests**

Assert schema ref is `Worker`, cross-company/cross-branch membership is rejected as not found, deleted workers cannot be added, and direct frontend calls use `/worker-management/projects`.

- [ ] **Step 2: Run tests and verify failure**

```powershell
npx vitest run server/modules/worker-management/services/worker-project.service.test.ts src/modules/worker-management/pages/WorkerProjectsPage.test.tsx
```

Expected: FAIL because schema currently references `User` and workspace uses student BatchesPage.

- [ ] **Step 3: Change project membership to Worker**

Set `workerIds: [{ type: Schema.Types.ObjectId, ref: "Worker" }]`. Validate every added ID with `WorkerModel.findOne({ _id, ...buildWorkerQuery(scope) })` before mutation.

- [ ] **Step 4: Implement worker-owned project hook/page**

Use existing `workerProjectsApi`; change its internal endpoint arguments from remapped `/batches` to direct `/worker-management/projects`.

- [ ] **Step 5: Verify and commit**

```powershell
npx vitest run server/modules/worker-management/services/worker-project.service.test.ts src/modules/worker-management/pages/WorkerProjectsPage.test.tsx
npm run typecheck
git add server/modules/worker-management src/modules/worker-management
git commit -m "feat: isolate worker projects"
```

---

### Task 5: Connect Worker Attendance and QR End to End

**Files:**
- Modify: `server/modules/worker-management/services/worker-attendance.service.ts`
- Modify: `server/modules/worker-management/services/worker-qr-attendance.service.ts`
- Modify: related worker service tests
- Modify: `src/modules/worker-management/api/workerAttendance.api.ts`
- Create: `src/modules/worker-management/components/WorkerTimekeepingPanel.tsx`
- Create: `src/modules/worker-management/components/WorkerTimekeepingHistory.tsx`
- Create: `src/modules/worker-management/components/WorkerQrAttendance.tsx`
- Create: `src/modules/worker-management/components/WorkerAttendance.test.tsx`

**Interfaces:**
- Direct endpoints: `/worker-management/attendance/*` and `/worker-management/qr-attendance/*`.
- Attendance requires Worker membership in WorkerProject under the same scope.
- Preserve geofence, check-in/check-out toggle, duplicate rules, manual adjustment and QR session lifecycle.

- [ ] **Step 1: Add failing data-invariant tests**

Cover non-member, wrong tenant/branch, soft-deleted worker/project, expired/closed QR, duplicate check-in, second valid scan as checkout, and manual adjustment permissions.

- [ ] **Step 2: Add failing frontend endpoint and state tests**

Assert no `/attendance/worker`, `/batches`, student QR page, or scope remapping is used.

- [ ] **Step 3: Run tests and verify failures**

```powershell
npx vitest run server/modules/worker-management/services/worker-attendance.logic.test.ts server/modules/worker-management/services/worker-qr-attendance.service.test.ts src/modules/worker-management/components/WorkerAttendance.test.tsx
```

- [ ] **Step 4: Enforce Worker/WorkerProject membership and direct API URLs**

Reuse existing calculations unchanged. Change only model lookup and endpoint ownership; preserve status strings and error messages captured by baseline tests.

- [ ] **Step 5: Verify and commit**

```powershell
npx vitest run server/modules/worker-management/services/worker-attendance.logic.test.ts server/modules/worker-management/services/worker-qr-attendance.service.test.ts src/modules/worker-management/components/WorkerAttendance.test.tsx
npm run typecheck
git add server/modules/worker-management src/modules/worker-management
git commit -m "feat: isolate worker attendance and QR"
```

---

### Task 6: Replace Dashboard and Notification Adapters

**Files:**
- Create: `server/modules/worker-management/services/worker-dashboard.service.ts`
- Create: `server/modules/worker-management/routes/worker-dashboard.routes.ts`
- Create: `server/modules/worker-management/services/worker-notification.service.ts`
- Create: `server/modules/worker-management/routes/worker-notification.routes.ts`
- Modify: `server/modules/worker-management/router.ts`
- Create: `src/modules/worker-management/api/workerDashboard.api.ts`
- Create: `src/modules/worker-management/api/workerNotifications.api.ts`
- Create: `src/modules/worker-management/pages/WorkerDashboardPage.tsx`
- Create: `src/modules/worker-management/pages/WorkerNotificationsPage.tsx`
- Test: corresponding backend/frontend test files.

**Interfaces:**
- Preserve current dashboard view model and notification list/send contracts captured in Task 1.
- Dashboard counts only Worker/WorkerProject/WorkerAttendanceLog.
- Notifications target worker records and retain existing SMTP behavior/error handling.

- [ ] **Step 1: Write failing dashboard and notification contract tests**

Lock response keys, empty state values, tenant/branch scope, read/manage permissions, send payload, toast and post-send refresh.

- [ ] **Step 2: Run tests and verify failures**

```powershell
npx vitest run server/modules/worker-management/services/worker-dashboard.service.test.ts server/modules/worker-management/services/worker-notification.service.test.ts src/modules/worker-management/pages/WorkerDashboardPage.test.tsx src/modules/worker-management/pages/WorkerNotificationsPage.test.tsx
```

- [ ] **Step 3: Implement worker-owned services/routes/pages**

Copy calculation and visual behavior from baseline, replacing only data sources and domain names. Reuse company SMTP service; do not import student notification service.

- [ ] **Step 4: Switch remaining workspace tabs and verify**

```powershell
npx vitest run server/modules/worker-management src/modules/worker-management
npm run typecheck
git add server/modules/worker-management src/modules/worker-management
git commit -m "feat: isolate worker dashboard and notifications"
```

---

### Task 7: Remove Student Adapters and Worker Preset Routing

**Files:**
- Modify: `server/modules/worker-management/router.ts`
- Delete: `server/modules/shared-management/router.ts`
- Delete or reduce to primitives: `src/modules/shared-management/runtime.ts`, `components.ts`, `pages/*`, `api.ts`
- Modify: `src/modules/student-management/StudentManagementTab.tsx`
- Modify: `src/modules/student-management/lib/api.ts`
- Modify: `src/modules/student-management/config/entityLabels.ts`
- Modify: `src/modules/business-module-isolation.test.ts`
- Modify: `server/modules/worker-management/worker-module-isolation.test.ts`

**Interfaces:**
- Worker router mounts only `/workers`, `/projects`, `/attendance`, `/qr-attendance`, `/dashboard`, `/notifications`.
- Student API client no longer has `BusinessApiScope` or worker endpoint remapping.
- Student workspace no longer branches on preset `worker`.

- [ ] **Step 1: Enable all isolation tests from Task 1**

Remove temporary skips. Run and confirm failures identify every remaining adapter/import.

- [ ] **Step 2: Remove backend shared router mount**

Delete `workerManagementRouter.use("/worker-management", sharedManagementRouter)` and remove server shared router if no consumer remains.

- [ ] **Step 3: Remove frontend shared business exports and global scope**

Delete worker use of `setBusinessApiScope`, `setEntityPreset`, student hooks/types/pages/modals. Retain only genuinely domain-neutral presentational primitives with neutral props.

- [ ] **Step 4: Remove active worker preset branches from student workspace**

Student tab labels/routes always use student behavior. Keep legacy persisted data untouched and do not run migrations/deletes.

- [ ] **Step 5: Run isolation and regression tests, then commit**

```powershell
npx vitest run src/modules/business-module-isolation.test.ts src/modules/worker-management server/modules/worker-management src/modules/student-management/settings-relocation.test.ts server/modules/student-management/services/student-worker-isolation.test.ts
npm run typecheck
git add src server
git commit -m "refactor: complete student worker separation"
```

---

### Task 8: Full Verification and Cutover Audit

**Files:**
- Modify only if verification exposes a contract regression.
- Record audit results in commit message; do not add generated build artifacts.

**Interfaces:**
- Produces a clean worker/student boundary and verified production build.

- [ ] **Step 1: Scan forbidden dependencies**

```powershell
rg -n "student-management|useStudents|useBatches|setBusinessApiScope|setEntityPreset" src/modules/worker-management server/modules/worker-management
rg -n "preset === \"worker\"|entityLabel\.preset === \"worker\"" src/modules/student-management
```

Expected: no production-code matches.

- [ ] **Step 2: Run full focused suites**

```powershell
npx vitest run src/modules/worker-management server/modules/worker-management src/modules/business-module-isolation.test.ts server/modules/student-management/services/student-worker-isolation.test.ts
```

Expected: all pass, zero failures.

- [ ] **Step 3: Run repository verification**

```powershell
npm run typecheck
npm run build
git diff --check
git status --short --branch
```

Expected: typecheck/build exit 0, no whitespace errors, only intentional source/test changes committed.

- [ ] **Step 4: Perform manual smoke checklist**

Verify all four tabs, worker create/edit/delete, project CRUD/member assignment, attendance check-in/out/history/adjustment, QR lifecycle, dashboard empty/data states, notification send/error, permission read/manage, and company/branch isolation.

- [ ] **Step 5: Commit any verification-only corrections separately**

```powershell
git add src/modules/worker-management server/modules/worker-management src/modules/student-management server/modules/student-management
git commit -m "fix: preserve worker workflow contracts"
```

## Self-Review

- Spec coverage: Tasks 1–7 cover baseline contracts, worker-owned profile/project/attendance/QR/dashboard/notification flows, adapter cleanup, no migration, permission preservation and module isolation. Task 8 covers all completion gates.
- Placeholder scan: no TBD/TODO or unspecified implementation steps remain.
- Type consistency: all worker relations use `Worker`, `WorkerProject`, `WorkerAttendanceLog`, `workerId`, `projectId`, `companyCode`, and optional `branchId` consistently.
