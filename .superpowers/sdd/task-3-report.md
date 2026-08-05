# Task 3 report: Connect Worker Profile UI to Worker API

## RED

Command:

```powershell
npx vitest run src/modules/worker-management/pages/WorkersPage.test.tsx src/modules/worker-management/WorkerWorkspace.test.tsx
```

Observed expected failures before implementation:

- `workerApi.list()` called `http://localhost:3000/api/v1/workers`, not `/api/v1/worker-management/workers`.
- `src/modules/worker-management/pages/WorkersPage.tsx` did not exist.
- `WorkerWorkspace` imported the shared `RecordsPage` rather than `./pages/WorkersPage`.

## GREEN

Focused verification:

```powershell
npx vitest run src/modules/worker-management/pages/WorkersPage.test.tsx src/modules/worker-management/hooks/useWorkers.test.tsx src/modules/worker-management/WorkerWorkspace.test.tsx
```

Result: 3 files passed, 13 tests passed.

Covered: direct authenticated list/create/update/delete worker URLs; loading/empty/error states; successful add closes its modal and opens detail; detail update; soft delete mutation; hook reload after every mutation; and worker-owned workspace tab import.

Typecheck:

- `npm run typecheck` could not find the worktree-local TypeScript wrapper (`node_modules/typescript/bin/tsc`).
- Equivalent root compiler command passed:

```powershell
node --max-old-space-size=4096 ..\..\node_modules\typescript\bin\tsc --noEmit
```

## Scope and concern

Only the Lao động/profile flow now uses worker-owned client, hook, page and modals. `WorkerWorkspace` still uses the shared runtime for the unconverted dashboard/project/notification tabs and their temporary API scope; their removal remains Task 4/6/7 work and was not expanded here. No student-management production imports or worker calls to `/students` or `/batches` were added.

## Task 3 review-fix wave (2026-08-05)

### Root causes and implemented fixes

1. **Real direct route wiring**
   - Root cause: the client used `/api/v1/worker-management/workers`, while the worker router exposed CRUD only at `/api/v1/workers`.
   - Added the worker-owned CRUD router at `/worker-management/workers` while preserving the legacy `/workers` mount and all existing project/attendance/shared mounts.
   - Added an HTTP route-wiring test that mounts the real `workerManagementRouter` at `/api/v1` and reaches the exact client URL.

2. **Typed scope propagation and enforcement**
   - Added the client `WorkerScope = { companyCode; branchId? }` contract.
   - `workerApi.list/create/update/delete` now put scope on every direct request as query parameters.
   - `useWorkers(scope)` forwards the same normalized scope through list and all mutations/reloads.
   - The server resolves requested scope against the authenticated actor: a superadmin must provide the selected company and may provide its selected branch; tenant users cannot override their authenticated company or branch. Invalid overrides return 403 before the service is invoked.

3. **Worker-preset UI parity**
   - Restored the existing header action order and classes for Export, Print, QR registration, and Add.
   - Restored status tabs, project selection, start/end date filters, search, loading/empty/error states, and the established table/action classes.
   - Restored Excel export, print-window behavior, QR registration lifecycle, status/project/date filtering, and worker-owned detail/update/delete flows.
   - Kept student-only tuition/import controls absent. Project summaries remain an optional Task 4 input; the profile page already filters direct worker `projectIds` without changing the unconverted project adapter.

4. **Modal lifecycle and validation**
   - The add modal is now conditionally mounted, so cancel/discard and reopen starts with a fresh form.
   - Worker-owned configurable required-field validation and duplicate email/phone/CCCD normalization run before create, retaining inline errors and toast behavior.
   - Success/error/loading labels, close ordering, and add-success-to-detail behavior remain unchanged.

5. **Dashboard profile navigation**
   - Restored the dashboard selection callback and maps the transitional dashboard record into the worker-owned detail modal.
   - Dashboard detail updates use the same direct worker endpoint and selected scope. No Task 4/6/7 adapter was otherwise converted.

### TDD evidence

RED command:

```powershell
node ..\..\node_modules\vitest\vitest.mjs run src/modules/worker-management/pages/WorkersPage.test.tsx src/modules/worker-management/hooks/useWorkers.test.tsx src/modules/worker-management/WorkerWorkspace.test.tsx server/modules/worker-management/routes/worker.routes.test.ts
```

Observed before implementation: **4 files failed; 11 failed / 13 passed tests**. Failures directly showed missing scope query parameters, hook calls without scope, the absent controls/filters, stale cancel/reopen form, missing configurable-required/duplicate behavior, dashboard selection no-op, and unsafe server scope override handling. The first five-file invocation including the initial full `apiRouter` integration fixture was terminated because importing the complete application router retained unrelated application handles; the route test was then focused on the real worker router mounted at the actual `/api/v1` integration boundary.

Final focused verification:

```powershell
node ..\..\node_modules\vitest\vitest.mjs run src/modules/worker-management/pages/WorkersPage.test.tsx src/modules/worker-management/hooks/useWorkers.test.tsx src/modules/worker-management/WorkerWorkspace.test.tsx server/modules/worker-management/routes/worker.routes.test.ts server/router/worker-management-routing.test.ts
```

Result: **5 files passed; 25/25 tests passed** in 4.13s.

Required root compiler:

```powershell
node --max-old-space-size=4096 ..\..\node_modules\typescript\bin\tsc --noEmit
```

Result: **PASS (exit 0)** in 25.2s.

Boundary/self-review:

- `git diff --check`: pass (only repository CRLF normalization warnings).
- No new student-management imports, `/students` calls, or `/batches` calls were introduced in the worker profile flow.
- Existing Task 4 project and Task 6 dashboard/notification adapters were not converted.
- The native `apply_patch` tool was unavailable because the managed Windows sandbox could not enforce the split writable-root profile. The task owner authorized `git apply` unified patches as the controlled fallback; no Set-Content/cat/scripted file writes were used.

## Task 3 remaining review fixes (2026-08-05)

### Root causes and fixes

1. **Legacy worker URL alias**
   - The worker router still mounted the same CRUD router at both `/workers` and the required `/worker-management/workers`.
   - Removed the legacy mount and added an HTTP regression test proving `/api/v1/workers` returns 404 without invoking `WorkerService.list`.

2. **Missing runtime inputs for the worker profile page**
   - The copied worker-owned page accepted project summaries and standard-field configuration, but `WorkerWorkspace` never supplied either prop.
   - Added a profile-tab-only transitional runtime adapter that obtains the existing project list and standard-field rules through `shared-management/runtime`, maps only worker-supported profile keys, and supplies both props to `WorkersPage`.
   - This intentionally does not convert the project endpoint/page ahead of Task 4 and introduces no direct student-management import in worker production code.

3. **Edit-modal validation parity**
   - `WorkerDetailModal` submitted edits without the configurable required-field and duplicate email/phone/CCCD checks used during creation.
   - Passed workers and profile-field rules from `WorkersPage`; edit submission now blocks missing configured fields and duplicate normalized values while excluding the current worker.

### TDD evidence

RED command:

```powershell
node ..\..\node_modules\vitest\vitest.mjs run server/router/worker-management-routing.test.ts src/modules/worker-management/WorkerWorkspace.test.tsx src/modules/worker-management/pages/WorkersPage.test.tsx
```

Observed before production changes: **3 files failed; 4 failed / 19 passed tests**. The legacy URL returned 200 instead of 404, workspace project/profile props were empty, and both invalid edit cases reached the update mutation.

Final focused verification:

```powershell
node ..\..\node_modules\vitest\vitest.mjs run src/modules/worker-management/pages/WorkersPage.test.tsx src/modules/worker-management/hooks/useWorkers.test.tsx src/modules/worker-management/WorkerWorkspace.test.tsx server/modules/worker-management/routes/worker.routes.test.ts server/router/worker-management-routing.test.ts
```

Result: **5 files passed; 29/29 tests passed**.

Required root compiler:

```powershell
node --max-old-space-size=4096 ..\..\node_modules\typescript\bin\tsc --noEmit
```

Result: **PASS (exit 0)**.

- `git diff --check`: pass (repository CRLF normalization warnings only).
- All edits used the authorized UTF-8 `git apply` fallback.

### Final review hardening

A fresh review found two additional stale-state paths after the runtime wiring:

- Dashboard edits called `workerApi.update` directly, so the workspace worker list used for duplicate checks did not reload.
- Switching superadmin company scope could briefly expose the previous company's projects and standard-field overrides.

RED verification produced **3 failed / 6 passed tests** across `WorkerWorkspace.test.tsx` and the new `useStandardFields.test.tsx`. The failures proved the hook update was bypassed and both prior-tenant data sets remained visible during an A-to-B transition.

Production fixes route dashboard saves through `useWorkers.updateWorker`, key project results by worker scope, render default standard fields until the current tenant's configuration resolves, and reject late responses from stale tenant requests.

Final focused verification:

```powershell
node ..\..\node_modules\vitest\vitest.mjs run src/modules/worker-management/pages/WorkersPage.test.tsx src/modules/worker-management/hooks/useWorkers.test.tsx src/modules/worker-management/WorkerWorkspace.test.tsx server/modules/worker-management/routes/worker.routes.test.ts
```

Result: **4 files passed; 31/31 tests passed**.

```powershell
node ..\..\node_modules\vitest\vitest.mjs run server/router/worker-management-routing.test.ts server/modules/worker-management/services/worker-project.service.test.ts
```

Result: **2 files passed; 5/5 tests passed**.

```powershell
node ..\..\node_modules\vitest\vitest.mjs run src/modules/student-management/hooks/useStandardFields.test.tsx
```

Result: **1 file passed; 1/1 test passed**.

Final independent review: **Ready; no Critical or Important issues**.
- Root TypeScript compiler: **PASS (exit 0)**.
- Final `git diff --check`: **PASS** (repository CRLF normalization warnings only).
