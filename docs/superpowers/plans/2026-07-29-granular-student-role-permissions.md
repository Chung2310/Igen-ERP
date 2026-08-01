# Granular Student Role Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backward-compatible granular permissions for every student-management area and present system/custom roles with clear Vietnamese titles and permission descriptions.

**Architecture:** Keep `student:read` and `student:manage` as operational umbrella permissions, then enforce area-specific permissions through a shared OR-based permission policy on backend and frontend. Configuration permissions remain independent from the umbrella. The backend catalog is canonical; the frontend mirrors it only as an offline fallback and presentation layer.

**Tech Stack:** TypeScript, Express, React 19, Mongoose, Node test runner with `tsx`, Vitest.

## Global Constraints

- Preserve existing role codes and existing role-permission assignments.
- Preserve current company and branch isolation behavior.
- `student:manage` covers operational areas but does not grant custom-field, module-settings, or SMTP configuration.
- Backend authorization is mandatory; frontend visibility is supplementary.
- New permission seeding must be idempotent.

---

### Task 1: Canonical permission catalog and policy helpers

**Files:**
- Modify: `server/config/permission-catalog.ts`
- Modify: `server/middleware/auth.ts`
- Create: `server/middleware/student-permission-policy.test.ts`
- Modify: `src/utils/permissionUtils.ts`
- Create: `src/utils/studentPermissionPolicy.ts`
- Create: `src/utils/studentPermissionPolicy.test.ts`

**Interfaces:**
- Produces backend `requireAnyPermission(codes: string[])` as an alias with explicit OR semantics over `requirePermission`.
- Produces frontend `canReadStudentArea(permissions, area)` and `canManageStudentArea(permissions, area)`.
- Produces a canonical entry for each permission code from the approved design.

- [ ] **Step 1: Write failing backend catalog/policy tests**

Assert that all approved codes exist exactly once with Vietnamese `label`, `group`, and `description`; assert OR authorization, `*`, unauthenticated 401, and unauthorized 403 behavior.

- [ ] **Step 2: Run test to verify RED**

Run: `node --import tsx --test --test-force-exit server/middleware/student-permission-policy.test.ts`

Expected: FAIL because granular catalog entries, descriptions, or helper do not exist.

- [ ] **Step 3: Implement catalog and backend helper**

Extend `PermissionCatalogEntry` with `description?: string`, add all approved permissions, and export:

```ts
export const requireAnyPermission = (permissions: string[]) => requirePermission(permissions);
```

- [ ] **Step 4: Run backend test to verify GREEN**

Run the command from Step 2; expected PASS.

- [ ] **Step 5: Write failing frontend policy tests**

Cover umbrella read/manage inheritance, granular manage-implies-read, cross-area denial, and configuration permissions not inherited from `student:manage`.

- [ ] **Step 6: Run frontend policy test to verify RED**

Run: `node --import tsx --test --test-force-exit src/utils/studentPermissionPolicy.test.ts`

Expected: FAIL because the policy module does not exist.

- [ ] **Step 7: Implement frontend policy and synchronized translations**

Use a typed area mapping whose operational read arrays include `student:read`, `student:manage`, area read, and area manage; operational manage arrays include `student:manage` and area manage. Configuration arrays include only their own permission and `*`.

- [ ] **Step 8: Run both policy test files and commit**

Expected: PASS.

Commit: `feat: add granular student permission policies`

### Task 2: Enforce granular permissions on backend routes

**Files:**
- Modify: `server/modules/student-management/router.ts`
- Modify: `server/modules/student-management/routes/student.routes.ts`
- Modify: `server/modules/student-management/routes/course.routes.ts`
- Modify: `server/modules/student-management/routes/batch.routes.ts`
- Modify: `server/modules/student-management/routes/exam.routes.ts`
- Modify: `server/modules/student-management/routes/payment.routes.ts`
- Modify: `server/modules/student-management/routes/notification.routes.ts`
- Modify: `server/modules/student-management/routes/resource.routes.ts`
- Modify: `server/modules/student-management/routes/assignment.routes.ts`
- Modify: `server/modules/student-management/routes/upload.routes.ts`
- Modify: `server/modules/student-management/routes/custom-field.routes.ts`
- Modify: `server/modules/student-management/routes/module-settings.routes.ts`
- Modify: `server/router/company-email.router.ts`
- Create: `server/modules/student-management/granular-permissions.test.ts`

**Interfaces:**
- Consumes: `requireAnyPermission` from Task 1.
- Produces route-level read and mutation-level manage enforcement for every approved area.

- [ ] **Step 1: Write failing route contract tests**

Assert each mount and mutation route contains the matching granular permission plus its approved umbrella fallback. Assert custom fields, module settings, and SMTP use only their independent configuration permission and no hard-coded role guard.

- [ ] **Step 2: Run test to verify RED**

Run: `node --import tsx --test --test-force-exit server/modules/student-management/granular-permissions.test.ts`

Expected: FAIL because routes still use only `student:*` or hard-coded roles.

- [ ] **Step 3: Replace route guards**

Mount read routes with arrays such as:

```ts
requireAnyPermission(["student:read", "student:manage", "course:read", "course:manage"])
```

Protect mutations with arrays such as:

```ts
requireAnyPermission(["student:manage", "course:manage"])
```

Use only `custom-field:manage`, `student-settings:manage`, and `company-smtp:manage` for the independent configuration routes.

- [ ] **Step 4: Run route contract and existing route tests**

Run the new contract test plus `partner-permissions.test.ts` and `custom-field.routes.test.ts` with a local non-production `JWT_ACCESS_SECRET`; expected PASS.

- [ ] **Step 5: Commit**

Commit: `feat: enforce granular student route permissions`

### Task 3: Gate student-management tabs and actions in the frontend

**Files:**
- Modify: `src/config/modules.ts`
- Modify: `src/modules/student-management/StudentManagementTab.tsx`
- Modify: relevant pages under `src/modules/student-management/pages/`
- Modify: `src/modules/student-management/custom-fields/permissions.ts`
- Modify: `src/components/settings/ErpConfigTab.tsx`
- Modify: `src/components/settings/StudentManagementErpSettings.tsx`
- Create: `src/modules/student-management/granular-permission-ui.test.ts`

**Interfaces:**
- Consumes frontend policy helpers from Task 1 and `AuthContext.hasPermission`/profile permissions.
- Produces permission-filtered sub-tabs, mutation controls, and configuration cards.

- [ ] **Step 1: Write failing UI contract tests**

Assert sub-tabs map to their area read permission, mutation controls map to manage permission, configuration cards no longer compare role strings, and the no-access state is present.

- [ ] **Step 2: Run test to verify RED**

Run: `node --import tsx --test --test-force-exit src/modules/student-management/granular-permission-ui.test.ts`

Expected: FAIL because tabs and admin settings still depend on broad access or role names.

- [ ] **Step 3: Implement permission-filtered navigation and controls**

Filter `SUB_TAB_ROUTES` using the shared area policy, redirect an inaccessible active sub-tab to the first accessible tab, pass `canManage` into page components, and hide or disable create/update/delete/send/upload controls. Replace `role === "admin"` checks for the approved configuration surfaces with the matching permission.

- [ ] **Step 4: Add explicit no-access state**

Render “Bạn chưa được cấp quyền sử dụng chức năng này” without calling area APIs when no sub-tab is allowed.

- [ ] **Step 5: Run UI contract and existing branch-aware tests**

Expected: PASS with branch request behavior unchanged.

- [ ] **Step 6: Commit**

Commit: `feat: gate student management UI by area permission`

### Task 4: Clarify role titles and permission assignment UI

**Files:**
- Modify: `src/utils/permissionUtils.ts`
- Modify: `src/components/user-admin/RoleModal.tsx`
- Create: `src/components/user-admin/rolePresentation.ts`
- Create: `src/components/user-admin/rolePresentation.test.ts`

**Interfaces:**
- Produces `getRoleDisplayName(role, customName?)` for all approved system role codes.
- Produces deterministic permission grouping and paired read/manage ordering.

- [ ] **Step 1: Write failing role presentation tests**

Assert Vietnamese names for `superadmin`, `admin`, `branch_owner`, `manager`, `user`, `staff`, `teacher`, and `accountant`; custom names win; permission groups and read/manage ordering follow the design.

- [ ] **Step 2: Run test to verify RED**

Run: `node --import tsx --test --test-force-exit src/components/user-admin/rolePresentation.test.ts`

Expected: FAIL for missing mappings and presentation helper.

- [ ] **Step 3: Implement role and permission presentation**

Keep database/API slugs unchanged. Show Vietnamese title, description, and technical code; mark umbrella permissions as “Toàn bộ module”; sort read before manage for each area and group by business domain.

- [ ] **Step 4: Implement manage-implies-read selection behavior**

When selecting an area manage permission, include its read permission in UI state; when removing read while manage is selected, keep effective read semantics visible. Do not auto-select configuration permissions from `student:manage`.

- [ ] **Step 5: Run presentation tests and commit**

Expected: PASS.

Commit: `feat: clarify role and permission titles`

### Task 5: Regression verification and documentation

**Files:**
- Modify only test files if verification reveals a test-specific setup issue.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified behavior and a clean worktree ready for review.

- [ ] **Step 1: Run targeted backend and frontend tests**

Run all new tests, existing student route permission tests, custom-field tests with a test JWT secret, branch-isolation tests, and Vitest permission tests with the correct runner. Expected: zero failures.

- [ ] **Step 2: Run static verification**

Run: `npm run typecheck`

Run: `npm run build`

Run: `git diff --check`

Expected: all exit 0.

- [ ] **Step 3: Review requirements against the design**

Confirm catalog completeness, backward compatibility, configuration separation, branch isolation, Vietnamese role titles, readable groups/descriptions, and absence of approved hard-coded admin checks.

- [ ] **Step 4: Commit any verification-only corrections**

Commit only if corrections were required, using a scoped message.
