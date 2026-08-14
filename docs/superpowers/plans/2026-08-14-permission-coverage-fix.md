# Project-Wide Permission Coverage Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Bảo vệ đầy đủ API và UI bằng catalog quyền chuẩn module:read / module:manage, không để route mutation hoặc dữ liệu nhạy cảm bypass authorization.

**Architecture:** Giữ catalog hai cấp; manage bao hàm read qua expandEffectivePermissions. Backend là nguồn enforcement duy nhất, chạy permission sau authentication và trước controller; module, tenant, branch và object scope là các lớp riêng. Frontend chỉ dùng cùng mã canonical để ẩn/hiện tab và action.

## Global Constraints

- Không thêm quyền thao tác chi tiết vào canonical catalog.
- Không dùng role name hoặc frontend locked state thay cho backend permission guard.
- Giữ legacy aliases để normalize dữ liệu cũ.
- Public webhook/OAuth/QR routes phải nằm trong allowlist ngoại lệ và có xác thực riêng.
- Không đưa .pnpm-store/ hoặc thay đổi không liên quan vào commit.

### Task 1: Tạo inventory và test contract cho route authorization

**Files:** Create server/config/permission-route-inventory.ts and its test; modify server/config/permission-catalog.ts only if needed.

- [ ] Write failing tests asserting every mutation route has auth plus a canonical permission, every permission string exists in the catalog, and public exceptions are explicitly allowlisted.
- [ ] Run: npx vitest run server/config/permission-route-inventory.test.ts. Confirm failure against current gaps.
- [ ] Implement a controlled source scanner that reports file, method, path, and missing guard.
- [ ] Re-run the focused test; expected zero unclassified findings once all listed route fixes are applied.
- [ ] Commit: test(auth): inventory protected routes.

### Task 2: Bịt CRUD generic và leave/training/workflow permissions

**Files:** server/router/crud.router.ts, server/controller/crud.controller.ts, focused CRUD permission tests.

- [ ] Add failing tests for training-courses, training-enrollments, workflows and hr-leave-templates mutations without hr/timekeeping manage.
- [ ] Verify failure with npx vitest run server/router/crud-permission.test.ts.
- [ ] Add explicit read/manage mappings; make unknown supported models fail closed instead of falling through to next.
- [ ] Preserve self-submit leave behavior while denying cross-employee approval/edit/delete.
- [ ] Run existing CRUD/controller tests and commit: fix(auth): close generic CRUD permission gaps.

### Task 3: Secure Google Drive, resources and shared media boundaries

**Files:** server/router/google-drive.router.ts, server/router/media.router.ts if classification requires it, focused route tests.

- [ ] Add failing tests proving resource read can read but cannot upload, delete, move, rename, create, or update group permissions.
- [ ] Run focused Google Drive and media permission tests to confirm current bypasses.
- [ ] Add resource:read to Drive reads and resource:manage to Drive mutations; preserve ownership and room checks.
- [ ] Keep authenticated personal media utilities and explicitly public proxies only in the allowlist.
- [ ] Run resource access tests and commit: fix(auth): enforce resource permissions on drive routes.

### Task 4: Normalize recruitment, analytics and HR contract authorization

**Files:** server/router/recruitment.router.ts, server/router/analytics.router.ts, server/router/hr-contract.router.ts, focused tests.

- [ ] Add failing tests for recruitment read versus manage, dashboard permission on analytics, and hr:manage on contract mutations.
- [ ] Run the focused router tests and record expected failures.
- [ ] Split recruitment read/mutation guards; replace analytics role-only gate with canonical dashboard permission; replace contract access:manage mutations with hr:manage.
- [ ] Run existing recruitment, analytics and contract tests and commit: fix(auth): align recruitment analytics and HR permissions.

### Task 5: Secure notifications and access administration

**Files:** server/router/notification.router.ts, server/controller/notification.controller.ts, permission/role-permission routers, focused tests.

- [ ] Add failing tests for own notification self-service, administrative notification creation, company isolation, and access permission behavior.
- [ ] Run focused tests and confirm unauthenticated or read-only mutation failures are currently absent.
- [ ] Split self-service notification behavior from broadcast creation or add a canonical manage guard; validate recipients and company scope. Keep super-admin control-plane role exceptions explicitly documented.
- [ ] Run user-access and notification tests and commit: fix(auth): protect notification and access administration.

### Task 6: Align frontend permission mappings and action visibility

**Files:** src/config/modules.ts, src/pages/Sidebar.tsx, relevant workspace/page action guards, affected tests.

- [ ] Add failing tests for retail/finance/recruitment read-only users and duplicate or missing sidebar mappings.
- [ ] Run affected frontend permission tests.
- [ ] Correct MODULE_READ_PERMISSIONS; derive mutation action visibility from canonical manage permissions; retain server enforcement.
- [ ] Run affected tests and typecheck; commit: fix(ui): align module actions with canonical permissions.

### Task 7: Close remaining route inventory findings

**Files:** Each router reported by the inventory test; inventory allowlist only for verified public endpoints; corresponding tests.

- [ ] Run npx vitest run server/config/permission-route-inventory.test.ts.
- [ ] Classify every finding as protected read, protected mutation, authenticated self-service, tenant-scoped control-plane, or public signed callback.
- [ ] Add auth, canonical permission and ownership/scope checks to every non-exception.
- [ ] Re-run until zero missing guards and zero unknown permission codes; commit: test(auth): close remaining route coverage findings.

### Task 8: Full verification and handoff

**Files:** No production changes unless verification exposes a gap.

- [ ] Run npx vitest run server/config server/router server/middleware server/modules/finance server/modules/retail server/modules/student-management src/utils src/config src/modules.
- [ ] Run npm run typecheck.
- [ ] Run npm run build.
- [ ] Run git diff --check and inspect git status; confirm no .pnpm-store/ or unrelated files are staged.
- [ ] Record exact results, intentional role/public exceptions, and any permission normalization migration required before merge.
