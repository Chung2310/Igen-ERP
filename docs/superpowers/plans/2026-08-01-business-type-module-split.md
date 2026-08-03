# Business Type Module Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split student, worker, customer, and candidate into business-type-aware top-level modules, with labor tenants seeing only the new empty Worker module.

**Architecture:** Add shared backend/frontend business type filtering, persist `businessType` on tenant, route module visibility through that layer, keep `student-management` education-only, add independent minimal `worker-management`, and add customer/candidate shells.

**Tech Stack:** React + TypeScript + Vite, Express + Mongoose, Node test runner, Vitest.

## Global Constraints

- `businessType` is tenant-level and SuperAdmin-owned.
- Labor tenants must not see Student even when old `enabledModules` contains `student`.
- Worker starts empty; do not migrate/read preset-worker data from `student-management`.
- Old `entityPreset` is read-only compatibility for tenants missing `businessType`.
- Do not touch unrelated dirty file `server/modules/student-management/granular-permissions.test.ts` unless implementation genuinely needs it and user approves.

---

## File Structure

- Backend config: `server/config/module-keys.ts`, new `server/config/business-types.ts`, related tests.
- Tenant persistence: `server/model/company.model.ts`, `server/interface/company.interface.ts`, `server/super-admin/tenant-management.service.ts`.
- Auth/module exposure: `server/service/auth-profile-modules.ts`, `server/service/auth-company-modules.ts`, auth profile call sites.
- Permissions: `server/config/permission-catalog.ts`, new frontend helper `src/utils/businessModulePermissionPolicy.ts`.
- Worker backend: new `server/modules/worker-management` model/service/controller/router/tests, mount in `server/router/index.ts`.
- Frontend config/routes: `src/config/modules.ts`, new `src/config/businessTypes.ts`, `src/types/common.ts`, `src/router/route-config.tsx`, `src/pages/Sidebar.tsx`, active-tab fallback call sites.
- SuperAdmin UI: `src/pages/super-admin/tenants/TenantModuleDialog.tsx`, `src/services/superAdminTenantService.ts`.
- Frontend modules: new `src/modules/worker-management`, `src/modules/customer-management/CustomerManagementTab.tsx`, `src/modules/candidate-management/CandidateManagementTab.tsx`.

### Task 1: Backend Business Type And Module Compatibility

**Files:**
- Create: `server/config/business-types.ts`
- Create: `server/config/business-types.test.ts`
- Modify: `server/config/module-keys.ts`
- Modify: `server/model/company.model.ts`
- Modify: `server/interface/company.interface.ts`

**Interfaces:**
- Produces: `BusinessType`, `resolveBusinessType(input, legacyPreset?)`, `filterModulesForBusinessType(input, businessType)`, `getRequiredBusinessModule(businessType)`.
- Consumes: existing `sanitizeModuleKeys(input)`.

- [ ] **Step 1: Write the failing test**

Create `server/config/business-types.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { filterModulesForBusinessType, getRequiredBusinessModule, resolveBusinessType } from "./business-types";

test("legacy entity presets resolve to business types", () => {
  assert.equal(resolveBusinessType(undefined, "student"), "education");
  assert.equal(resolveBusinessType(undefined, "worker"), "labor");
  assert.equal(resolveBusinessType(undefined, "customer"), "service");
  assert.equal(resolveBusinessType(undefined, "candidate"), "recruitment");
});

test("business type filters incompatible business modules", () => {
  assert.deepEqual(filterModulesForBusinessType(["student", "worker", "hr", "chat"], "labor"), ["worker", "hr", "chat"]);
  assert.deepEqual(filterModulesForBusinessType(["student", "worker", "resource"], "education"), ["student", "resource"]);
});

test("required business module is forced into filtered module list", () => {
  assert.deepEqual(filterModulesForBusinessType(["hr"], "labor"), ["worker", "hr"]);
  assert.equal(getRequiredBusinessModule("general"), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test server/config/business-types.test.ts`
Expected: FAIL because `server/config/business-types.ts` does not exist.

- [ ] **Step 3: Implement backend module keys and business type helpers**

Set `MODULE_KEYS` in `server/config/module-keys.ts` to:

```ts
export const MODULE_KEYS = ["hr", "inventory", "resource", "chat", "student", "worker", "customer", "candidate"] as const;
```

Create `server/config/business-types.ts` with exact exports:

```ts
import { sanitizeModuleKeys, type ModuleKey } from "./module-keys";
export const BUSINESS_TYPES = ["education", "labor", "service", "recruitment", "general"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export const DEFAULT_BUSINESS_TYPE: BusinessType = "general";
const LEGACY_PRESET_BUSINESS_TYPE: Record<string, BusinessType> = { student: "education", worker: "labor", customer: "service", candidate: "recruitment" };
const REQUIRED_BUSINESS_MODULE: Record<BusinessType, ModuleKey | null> = { education: "student", labor: "worker", service: "customer", recruitment: "candidate", general: null };
const BUSINESS_MODULES = new Set<ModuleKey>(["student", "worker", "customer", "candidate"]);
export function isBusinessType(value: unknown): value is BusinessType { return typeof value === "string" && (BUSINESS_TYPES as readonly string[]).includes(value); }
export function resolveBusinessType(input: unknown, legacyPreset?: unknown): BusinessType { if (isBusinessType(input)) return input; if (typeof legacyPreset === "string" && LEGACY_PRESET_BUSINESS_TYPE[legacyPreset]) return LEGACY_PRESET_BUSINESS_TYPE[legacyPreset]; return DEFAULT_BUSINESS_TYPE; }
export function getRequiredBusinessModule(businessType: BusinessType): ModuleKey | null { return REQUIRED_BUSINESS_MODULE[businessType]; }
export function filterModulesForBusinessType(input: unknown, businessType: BusinessType): ModuleKey[] { const sanitized = sanitizeModuleKeys(input); const required = getRequiredBusinessModule(businessType); const filtered = sanitized.filter((key) => !BUSINESS_MODULES.has(key) || key === required); return required && !filtered.includes(required) ? [required, ...filtered] : filtered; }
```

- [ ] **Step 4: Persist `businessType` on company**

Add to `server/model/company.model.ts`:

```ts
businessType: { type: String, enum: ["education", "labor", "service", "recruitment", "general"], default: "general", index: true },
```

Add to `server/interface/company.interface.ts`:

```ts
businessType?: "education" | "labor" | "service" | "recruitment" | "general";
```

- [ ] **Step 5: Run tests and commit**

Run: `npx tsx --test server/config/business-types.test.ts server/service/auth-register-modules.test.ts`
Expected: PASS.

Commit:

```bash
git add server/config/module-keys.ts server/config/business-types.ts server/config/business-types.test.ts server/model/company.model.ts server/interface/company.interface.ts
git commit -m "feat: add business type module filtering"
```
### Task 2: Backend Tenant And Auth Module Filtering

**Files:**
- Modify: `server/super-admin/tenant-management.service.ts`
- Modify: `server/service/auth-profile-modules.ts`
- Modify: `server/service/auth-company-modules.ts`
- Modify: `server/service/auth-profile-modules.test.ts`
- Modify: `server/service/auth-company-modules.test.ts`
- Modify auth profile call sites found by `rg "resolveProfileEnabledModules|enabledModules" server/router server/controller server/service -n`

**Interfaces:**
- Consumes: `resolveBusinessType`, `filterModulesForBusinessType` from Task 1.
- Produces: tenant/auth profiles with `businessType` and business-filtered `enabledModules`.

- [ ] **Step 1: Write failing auth helper tests**

Add to `server/service/auth-profile-modules.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { resolveProfileEnabledModules } from "./auth-profile-modules";

test("labor profile hides student and forces worker", () => {
  assert.deepEqual(resolveProfileEnabledModules(["student", "hr"], "labor"), ["worker", "hr"]);
});

test("education profile hides worker and keeps student", () => {
  assert.deepEqual(resolveProfileEnabledModules(["worker", "student", "chat"], "education"), ["student", "chat"]);
});
```

Add to `server/service/auth-company-modules.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { resolveCompanyModuleUpdate } from "./auth-company-modules";

test("company module updates are filtered by business type", () => {
  assert.deepEqual(resolveCompanyModuleUpdate({ enabledModules: ["student", "worker", "resource"], businessType: "labor" }), ["worker", "resource"]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx tsx --test server/service/auth-profile-modules.test.ts server/service/auth-company-modules.test.ts`
Expected: FAIL because signatures do not accept business type.

- [ ] **Step 3: Update auth module helpers**

`server/service/auth-profile-modules.ts` must export:

```ts
import { type ModuleKey } from "../config/module-keys";
import { filterModulesForBusinessType, resolveBusinessType, type BusinessType } from "../config/business-types";
export function resolveProfileEnabledModules(input: unknown, businessTypeInput?: unknown, legacyPreset?: unknown): ModuleKey[] { return filterModulesForBusinessType(input, resolveBusinessType(businessTypeInput, legacyPreset)); }
export function resolveProfileBusinessType(input: unknown, legacyPreset?: unknown): BusinessType { return resolveBusinessType(input, legacyPreset); }
```

`server/service/auth-company-modules.ts` must export:

```ts
import { type ModuleKey } from "../config/module-keys";
import { filterModulesForBusinessType, resolveBusinessType } from "../config/business-types";
export function resolveCompanyModuleUpdate(updateData: { enabledModules?: unknown; businessType?: unknown; legacyEntityPreset?: unknown; [key: string]: unknown }): ModuleKey[] | undefined { if (updateData.enabledModules === undefined) return undefined; return filterModulesForBusinessType(updateData.enabledModules, resolveBusinessType(updateData.businessType, updateData.legacyEntityPreset)); }
```

- [ ] **Step 4: Update tenant service**

In `server/super-admin/tenant-management.service.ts`:

- Add `businessType?: BusinessType` to `TenantRecord`.
- Add `businessType?: string` to `TenantCreateInput` while keeping `entityPreset?: string` for compatibility.
- In `create`, compute `const businessType = resolveBusinessType(v.businessType, v.entityPreset);` and `const enabledModules = filterModulesForBusinessType(v.enabledModules, businessType);`.
- Save `businessType` on tenant create.
- Remove create-time `ModuleSettings.findOneAndUpdate` for entity preset.
- Change `updateModules` to accept `{ enabledModules?: unknown; businessType?: unknown }`, filter modules by target business type, and update both fields.

- [ ] **Step 5: Update auth profile call sites**

Run: `rg "resolveProfileEnabledModules|enabledModules" server/router server/controller server/service -n`

Where profile responses are built, include:

```ts
businessType: company?.businessType ?? "general",
enabledModules: resolveProfileEnabledModules(company?.enabledModules, company?.businessType, legacyEntityPreset),
```

- [ ] **Step 6: Run tests and commit**

Run: `npx tsx --test server/service/auth-profile-modules.test.ts server/service/auth-company-modules.test.ts server/service/auth-register-modules.test.ts`
Expected: PASS.

Commit:

```bash
git add server/super-admin/tenant-management.service.ts server/service/auth-profile-modules.ts server/service/auth-company-modules.ts server/service/auth-profile-modules.test.ts server/service/auth-company-modules.test.ts server/service/auth-register-modules.test.ts
git commit -m "feat: filter tenant modules by business type"
```

### Task 3: Permission Catalog Split

**Files:**
- Create: `server/config/business-permission-catalog.test.ts`
- Create: `src/utils/businessModulePermissionPolicy.ts`
- Modify: `server/config/permission-catalog.ts`
- Modify: `src/utils/studentPermissionPolicy.ts`
- Modify: `src/utils/studentPermissionPolicy.test.ts`

**Interfaces:**
- Produces: `student:*`, `worker:*`, `customer:*`, `candidate:*` umbrella permissions.
- Consumes: module visibility filtering from Tasks 1-2.

- [ ] **Step 1: Write failing permission catalog test**

Create `server/config/business-permission-catalog.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSION_CODES } from "./permission-catalog";

test("business modules have separate umbrella permissions", () => {
  for (const code of ["student:read", "student:manage", "worker:read", "worker:manage", "customer:read", "customer:manage", "candidate:read", "candidate:manage"]) assert.ok(PERMISSION_CODES.includes(code), `${code} missing`);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test server/config/business-permission-catalog.test.ts`
Expected: FAIL because worker/customer/candidate permissions are missing.

- [ ] **Step 3: Split permission catalog entries**

In `server/config/permission-catalog.ts`, replace combined student/worker labels with separate entries for:

```ts
student:read, student:manage, worker:read, worker:manage, customer:read, customer:manage, candidate:read, candidate:manage
```

Use groups `H?c viên`, `Lao d?ng`, `Khách hàng`, `?ng viên`. Keep `RETIRED_STUDENT_PERMISSIONS` unchanged.

- [ ] **Step 4: Add frontend permission helper**

Create `src/utils/businessModulePermissionPolicy.ts`:

```ts
export type BusinessModuleKey = "student" | "worker" | "customer" | "candidate";
export function canReadBusinessModule(permissions: readonly string[], module: BusinessModuleKey): boolean { return permissions.includes("*") || permissions.includes(`${module}:read`) || permissions.includes(`${module}:manage`); }
export function canManageBusinessModule(permissions: readonly string[], module: BusinessModuleKey): boolean { return permissions.includes("*") || permissions.includes(`${module}:manage`); }
```

Update comments/copy in `src/utils/studentPermissionPolicy.ts` so student policy no longer mentions worker.

- [ ] **Step 5: Run tests and commit**

Run: `npx tsx --test server/config/business-permission-catalog.test.ts`
Run: `yarn test src/utils/studentPermissionPolicy.test.ts`
Expected: PASS.

Commit:

```bash
git add server/config/permission-catalog.ts server/config/business-permission-catalog.test.ts src/utils/businessModulePermissionPolicy.ts src/utils/studentPermissionPolicy.ts src/utils/studentPermissionPolicy.test.ts
git commit -m "feat: split business module permissions"
```
### Task 4: Frontend Business Type Config And Module Filtering

**Files:**
- Create: `src/config/businessTypes.ts`
- Modify: `src/config/modules.ts`
- Modify: `src/config/modules.test.ts`
- Modify: `src/types/common.ts`

**Interfaces:**
- Produces: frontend `BusinessType`, `filterEnabledTabs(tabs, enabledModules, businessType)`, `resolveEnabledTab(tab, enabledModules, businessType)`.
- Consumes: `businessType` from `UserProfile`.

- [ ] **Step 1: Write failing frontend config tests**

Add to `src/config/modules.test.ts`:

```ts
it("hides student for labor tenants and shows worker", () => {
  expect(filterEnabledTabs(["QU?N LÝ H?C VIÊN", "QU?N LÝ LAO Ð?NG", "NHÂN S?"] as any, ["student", "worker", "hr"], "labor" as any)).toEqual(["QU?N LÝ LAO Ð?NG", "NHÂN S?"]);
});

it("redirects incompatible business tabs to overview", () => {
  expect(resolveEnabledTab("QU?N LÝ H?C VIÊN" as any, ["student", "worker"], "labor" as any)).toBe("T?NG QUAN");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `yarn test src/config/modules.test.ts`
Expected: FAIL because worker tab/business type support is missing.

- [ ] **Step 3: Create frontend business type config**

Create `src/config/businessTypes.ts`:

```ts
import type { ModuleKey } from "./modules";
export const BUSINESS_TYPES = ["education", "labor", "service", "recruitment", "general"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export const DEFAULT_BUSINESS_TYPE: BusinessType = "general";
const REQUIRED_BUSINESS_MODULE: Record<BusinessType, ModuleKey | null> = { education: "student", labor: "worker", service: "customer", recruitment: "candidate", general: null };
const BUSINESS_MODULES = new Set<ModuleKey>(["student", "worker", "customer", "candidate"]);
export function isBusinessType(value: unknown): value is BusinessType { return typeof value === "string" && (BUSINESS_TYPES as readonly string[]).includes(value); }
export function resolveBusinessType(value: unknown): BusinessType { return isBusinessType(value) ? value : DEFAULT_BUSINESS_TYPE; }
export function getRequiredBusinessModule(type: BusinessType): ModuleKey | null { return REQUIRED_BUSINESS_MODULE[type]; }
export function isModuleAllowedForBusinessType(key: ModuleKey, type: BusinessType): boolean { const required = getRequiredBusinessModule(type); return !BUSINESS_MODULES.has(key) || key === required; }
```

- [ ] **Step 4: Update frontend module config and types**

In `src/config/modules.ts`:

- Add module keys `worker`, `customer`, `candidate`.
- Add labels `Qu?n lý lao d?ng`, `Qu?n lý khách hàng`, `Qu?n lý ?ng viên`.
- Add tab maps for `QU?N LÝ LAO Ð?NG`, `QU?N LÝ KHÁCH HÀNG`, `QU?N LÝ ?NG VIÊN`.
- Add read permission map entries: `worker -> worker:read/worker:manage`, `customer -> customer:read/customer:manage`, `candidate -> candidate:read/candidate:manage`.
- Update `filterEnabledTabs` and `resolveEnabledTab` to accept `businessTypeInput?: unknown` and require both enabled module and `isModuleAllowedForBusinessType(moduleKey, businessType)`.

In `src/types/common.ts`, add new `TabType` values and `businessType?: "education" | "labor" | "service" | "recruitment" | "general"` to `UserProfile` and `CompanyProfile`.

- [ ] **Step 5: Run tests and commit**

Run: `yarn test src/config/modules.test.ts`
Expected: PASS.

Commit:

```bash
git add src/config/businessTypes.ts src/config/modules.ts src/config/modules.test.ts src/types/common.ts
git commit -m "feat: add frontend business module filtering"
```

### Task 5: SuperAdmin Tenant Business Type UI

**Files:**
- Modify: `src/pages/super-admin/tenants/TenantModuleDialog.tsx`
- Modify: `src/pages/super-admin/tenants/TenantModuleDialog.test.tsx`
- Modify: `src/services/superAdminTenantService.ts`

**Interfaces:**
- Consumes: `BusinessType`, `getRequiredBusinessModule`, `isModuleAllowedForBusinessType` from Task 4.
- Produces: `updateModules(code, { enabledModules, businessType, reason })` requests.

- [ ] **Step 1: Write failing dialog test**

Add to `TenantModuleDialog.test.tsx`:

```tsx
it("auto-selects worker and hides student when business type is labor", async () => {
  render(<TenantModuleDialog code="ACME" onClose={() => {}} onSaved={() => {}} />);
  await screen.findByText("Thông tin và module");
  await userEvent.selectOptions(screen.getByLabelText("Lo?i hình doanh nghi?p"), "labor");
  expect(screen.queryByText("Qu?n lý h?c viên")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Qu?n lý lao d?ng")).toBeChecked();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `yarn test src/pages/super-admin/tenants/TenantModuleDialog.test.tsx`
Expected: FAIL because dialog still uses entity preset.

- [ ] **Step 3: Update service types**

In `src/services/superAdminTenantService.ts`, add `businessType?: BusinessType` to `Tenant`, replace create input `entityPreset` with `businessType?: BusinessType`, and require `businessType` in `updateModules` input.

- [ ] **Step 4: Replace entity preset selector**

In `TenantModuleDialog.tsx`:

- Remove `getModuleSettings`, `updateModuleSettings`, and `getEntityPresetOptions` imports.
- Add `BusinessType` imports from `src/config/businessTypes`.
- Add local `BUSINESS_TYPE_LABELS` with labels for education/labor/service/recruitment/general.
- Load `businessType` from `result.tenant.businessType || "general"`.
- Filter rendered checkboxes to `isModuleAllowedForBusinessType(key, businessType)`.
- Auto-add and disable the required module from `getRequiredBusinessModule(businessType)`.
- Save only `superAdminTenantService.updateModules(code, { enabledModules: selected, businessType, reason: "C?p nh?t c?u hình lo?i hình và module" })`.

- [ ] **Step 5: Run tests and commit**

Run: `yarn test src/pages/super-admin/tenants/TenantModuleDialog.test.tsx src/config/modules.test.ts`
Expected: PASS.

Commit:

```bash
git add src/pages/super-admin/tenants/TenantModuleDialog.tsx src/pages/super-admin/tenants/TenantModuleDialog.test.tsx src/services/superAdminTenantService.ts
git commit -m "feat: manage tenant business type modules"
```

### Task 6: Frontend Routes, Sidebar, Customer And Candidate Shells

**Files:**
- Modify: `src/router/route-config.tsx`
- Modify: `src/pages/Sidebar.tsx`
- Modify: `src/App.tsx` or whichever file calls `resolveEnabledTab`
- Create: `src/pages/Sidebar.business-modules.test.tsx`
- Create: `src/modules/customer-management/CustomerManagementTab.tsx`
- Create: `src/modules/candidate-management/CandidateManagementTab.tsx`

**Interfaces:**
- Consumes: `businessType` on `userProfile` and `filterEnabledTabs(..., businessType)`.
- Produces: top-level routes for worker/customer/candidate.

- [ ] **Step 1: Write failing sidebar test**

Create `src/pages/Sidebar.business-modules.test.tsx` by mocking `useAuth` to return `{ role: "admin", enabledModules: ["student", "worker", "hr"], businessType: "labor", permissions: ["*"] }`. Assert `Lao d?ng` is visible and `H?c viên` is not.

- [ ] **Step 2: Run test to verify failure**

Run: `yarn test src/pages/Sidebar.business-modules.test.tsx`
Expected: FAIL because Sidebar only has student.

- [ ] **Step 3: Add route and sidebar entries**

Add lazy routes in `src/router/route-config.tsx` for:

```ts
"QU?N LÝ LAO Ð?NG" -> ../modules/worker-management/WorkerManagementTab
"QU?N LÝ KHÁCH HÀNG" -> ../modules/customer-management/CustomerManagementTab
"QU?N LÝ ?NG VIÊN" -> ../modules/candidate-management/CandidateManagementTab
```

In `src/pages/Sidebar.tsx`, remove `useEntityLabel`, stop renaming student, add menu items for worker/customer/candidate, and call `filterEnabledTabs(..., userProfile?.businessType)`.

- [ ] **Step 4: Add customer/candidate shell modules**

Create `CustomerManagementTab.tsx` with heading `Qu?n lý khách hàng` and empty state `Chua có d? li?u khách hàng.`.

Create `CandidateManagementTab.tsx` with heading `Qu?n lý ?ng viên` and empty state `Chua có d? li?u ?ng viên.`.

- [ ] **Step 5: Update active-tab fallback**

Run: `rg "resolveEnabledTab|filterEnabledTabs" src -n`
Pass `userProfile?.businessType` at every call site that resolves tabs.

- [ ] **Step 6: Run tests and commit**

Run: `yarn test src/pages/Sidebar.business-modules.test.tsx src/config/modules.test.ts`
Expected: PASS.

Commit:

```bash
git add src/router/route-config.tsx src/pages/Sidebar.tsx src/App.tsx src/modules/customer-management/CustomerManagementTab.tsx src/modules/candidate-management/CandidateManagementTab.tsx src/pages/Sidebar.business-modules.test.tsx
git commit -m "feat: route business type modules"
```
### Task 7: Worker Backend Minimal CRUD Module

**Files:**
- Create: `server/modules/worker-management/interfaces/worker.interface.ts`
- Create: `server/modules/worker-management/models/worker.model.ts`
- Create: `server/modules/worker-management/services/worker.service.ts`
- Create: `server/modules/worker-management/services/worker.service.test.ts`
- Create: `server/modules/worker-management/controllers/worker.controller.ts`
- Create: `server/modules/worker-management/routes/worker.routes.ts`
- Create: `server/modules/worker-management/router.ts`
- Create: `server/modules/worker-management/permissions.ts`
- Modify: `server/router/index.ts`

**Interfaces:**
- Produces API under `/api/v1/workers`: `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`.
- Consumes: authenticated `companyCode`, optional `branchId`, `worker:read`, `worker:manage`, and `requireModule("worker")`.

- [ ] **Step 1: Write failing worker service test**

Create `server/modules/worker-management/services/worker.service.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkerQuery, normalizeWorkerInput } from "./worker.service";

test("buildWorkerQuery scopes workers by company and branch", () => {
  assert.deepEqual(buildWorkerQuery({ companyCode: "ACME", branchId: "B1" }), { companyCode: "ACME", branchId: "B1", deletedAt: null });
  assert.deepEqual(buildWorkerQuery({ companyCode: "ACME" }), { companyCode: "ACME", deletedAt: null });
});

test("normalizeWorkerInput trims required fields", () => {
  assert.deepEqual(normalizeWorkerInput({ fullName: " Nguyen Van A ", phone: " 090 ", status: "active" }), { fullName: "Nguyen Van A", phone: "090", status: "active" });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test server/modules/worker-management/services/worker.service.test.ts`
Expected: FAIL because worker module does not exist.

- [ ] **Step 3: Create worker model and service**

Create an `IWorker` interface with `companyCode`, `branchId`, `fullName`, `phone`, `email`, `status: "active" | "inactive" | "placed"`, `note`, timestamps, and `deletedAt`.

Create `WorkerModel` with Mongoose schema fields matching the interface and index `{ companyCode: 1, branchId: 1, deletedAt: 1 }`.

Create `WorkerService` with:

```ts
export type WorkerScope = { companyCode: string; branchId?: string };
export type WorkerInput = { fullName?: unknown; phone?: unknown; email?: unknown; status?: unknown; note?: unknown; branchId?: unknown };
export function buildWorkerQuery(scope: WorkerScope) { return { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), deletedAt: null }; }
export function normalizeWorkerInput(input: WorkerInput) { const fullName = String(input.fullName || "").trim(); if (!fullName) throw Error("Worker full name is required"); const status = ["active", "inactive", "placed"].includes(String(input.status)) ? String(input.status) : "active"; return { fullName, ...(input.phone !== undefined ? { phone: String(input.phone || "").trim() } : {}), ...(input.email !== undefined ? { email: String(input.email || "").trim().toLowerCase() } : {}), status, ...(input.note !== undefined ? { note: String(input.note || "").trim() } : {}), ...(input.branchId !== undefined ? { branchId: String(input.branchId || "").trim() } : {}) }; }
```

Add class methods `list(scope)`, `create(scope, input)`, `update(scope, id, input)`, and `delete(scope, id)` using soft delete.

- [ ] **Step 4: Create controller, permissions, router**

Create `permissions.ts`:

```ts
export const WORKER_READ_PERMISSION = "worker:read";
export const WORKER_MANAGE_PERMISSION = "worker:manage";
```

Create controller methods that derive scope from `req.user.companyCode` and `req.user.branchId`, return `{ workers }` or `{ worker }`, and return 404 when update/delete cannot find a record.

Create routes with auth and permission middleware. If `requirePermission` is not exported from `server/middleware/auth.ts`, run `rg "requirePermission" server -n` and follow the existing permission middleware pattern.

Create `server/modules/worker-management/router.ts` mounting worker routes at `/workers`.

- [ ] **Step 5: Mount backend route**

In `server/router/index.ts`, import `workerManagementRouter` and mount:

```ts
apiRouter.use("/", requireAuth as any, requireModule("worker"), workerManagementRouter);
```

Place it near the student module mount.

- [ ] **Step 6: Run tests and commit**

Run: `npx tsx --test server/modules/worker-management/services/worker.service.test.ts server/router/module-route-guards.test.ts`
Expected: PASS.

Commit:

```bash
git add server/modules/worker-management server/router/index.ts
git commit -m "feat: add worker management backend"
```

### Task 8: Worker Frontend Minimal CRUD

**Files:**
- Create: `src/modules/worker-management/types.ts`
- Create: `src/modules/worker-management/api/workers.api.ts`
- Create: `src/modules/worker-management/WorkerManagementTab.tsx`
- Create: `src/modules/worker-management/WorkerManagementTab.test.tsx`

**Interfaces:**
- Consumes: `/api/v1/workers` from Task 7 and `canManageBusinessModule(permissions, "worker")` from Task 3.
- Produces: top-level Worker page with minimal list/create/edit/delete.

- [ ] **Step 1: Write failing Worker UI test**

Create `WorkerManagementTab.test.tsx` mocking `useAuth` to return `worker:read` and `worker:manage`, mocking `workerApi.list` to resolve `[]`, rendering `<WorkerManagementTab />`, and asserting `Qu?n lý lao d?ng` plus `Chua có lao d?ng nào.`.

- [ ] **Step 2: Run test to verify failure**

Run: `yarn test src/modules/worker-management/WorkerManagementTab.test.tsx`
Expected: FAIL because frontend worker module does not exist.

- [ ] **Step 3: Create types and API client**

Create `types.ts` with:

```ts
export type WorkerStatus = "active" | "inactive" | "placed";
export type Worker = { _id: string; fullName: string; phone?: string; email?: string; status: WorkerStatus; note?: string; branchId?: string };
export type WorkerInput = Pick<Worker, "fullName" | "phone" | "email" | "status" | "note" | "branchId">;
```

Create `api/workers.api.ts` with `list`, `create`, `update`, `delete` methods against `/api/v1/workers` using the existing student API client/error pattern from `src/modules/student-management/lib/api.ts`.

- [ ] **Step 4: Build `WorkerManagementTab`**

Implement:

- Heading `Qu?n lý lao d?ng`.
- Empty state `Chua có lao d?ng nào.`.
- Table columns `H? tên`, `S? di?n tho?i`, `Email`, `Tr?ng thái`.
- Add/edit form fields `fullName`, `phone`, `email`, `status`, `note`.
- Add/edit/delete actions only when `canManageBusinessModule(userProfile?.permissions || [], "worker")`.
- Loading and error states matching nearby page style.

- [ ] **Step 5: Run tests and commit**

Run: `yarn test src/modules/worker-management/WorkerManagementTab.test.tsx`
Expected: PASS.

Commit:

```bash
git add src/modules/worker-management
git commit -m "feat: add worker management UI"
```

### Task 9: End-To-End Module Visibility Verification

**Files:**
- Modify: `server/router/module-route-guards.test.ts`
- Create: `src/router/business-module-routes.test.tsx`
- Modify: `src/pages/Sidebar.business-modules.test.tsx`

**Interfaces:**
- Consumes all previous tasks.
- Produces regression coverage for labor sees Worker and not Student.

- [ ] **Step 1: Add backend guard regression**

In `server/router/module-route-guards.test.ts`, add a case following existing helper style that `requireModule("student")` rejects when effective modules contain only `worker`, and `requireModule("worker")` allows the same request.

- [ ] **Step 2: Add frontend route fallback test**

Create `src/router/business-module-routes.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { filterEnabledTabs, resolveEnabledTab } from "../config/modules";

describe("business module routing", () => {
  it("labor tenants cannot resolve to student tab", () => {
    expect(resolveEnabledTab("QU?N LÝ H?C VIÊN" as any, ["student", "worker"], "labor" as any)).toBe("T?NG QUAN");
  });

  it("labor tenants keep worker tab", () => {
    expect(filterEnabledTabs(["QU?N LÝ H?C VIÊN", "QU?N LÝ LAO Ð?NG"] as any, ["student", "worker"], "labor" as any)).toEqual(["QU?N LÝ LAO Ð?NG"]);
  });
});
```

- [ ] **Step 3: Run focused verification**

Run:

```bash
npx tsx --test server/config/business-types.test.ts server/service/auth-profile-modules.test.ts server/service/auth-company-modules.test.ts server/modules/worker-management/services/worker.service.test.ts server/router/module-route-guards.test.ts
yarn test src/config/modules.test.ts src/pages/Sidebar.business-modules.test.tsx src/modules/worker-management/WorkerManagementTab.test.tsx src/router/business-module-routes.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run broader verification**

Run: `yarn test`
Expected: PASS. If existing unrelated tests fail, record the exact failing test names and rerun the focused suite from Step 3.

- [ ] **Step 5: Commit**

```bash
git add server/router/module-route-guards.test.ts src/router/business-module-routes.test.tsx src/pages/Sidebar.business-modules.test.tsx
git commit -m "test: cover business module visibility"
```

## Self-Review Notes

- Spec coverage: business type source of truth, labor-only Worker visibility, no worker migration, separate permissions, SuperAdmin UX, routing fallback, worker empty-data module, customer/candidate shell scope.
- Placeholder scan: no TBD/TODO/implement-later instructions. Customer/Candidate CRUD is explicitly out of first implementation and shells are defined.
- Type consistency: backend and frontend both use `BusinessType`; worker API path is `/api/v1/workers`; module keys are `student`, `worker`, `customer`, `candidate`.
