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
