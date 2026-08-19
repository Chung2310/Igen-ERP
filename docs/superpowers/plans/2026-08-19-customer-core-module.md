# Customer Core Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the independently owned, company-wide Customer module foundation with tenant wiring, customer persistence, CRUD/search contracts, HTTP API, and a usable customer workspace.

**Architecture:** `server/modules/customer-management` owns active Customer persistence and exports plain-data contracts; Retail remains untouched until the later POS integration milestone. The frontend `src/modules/customer-management` consumes `/customers` directly and replaces its placeholder with a list/detail workspace.

**Tech Stack:** TypeScript 5.8, Express 4, Mongoose 9, React 19, Vite 6, Node test runner, Testing Library, Tailwind CSS.

## Global Constraints

- Customer data and phone uniqueness are scoped by `companyCode`, never by branch.
- The existing module key is `customer` and the only permissions are `customer:read` and `customer:manage`.
- Referenced customers are deactivated, never physically deleted.
- An inactive customer remains directly readable but is excluded from default and POS-style active searches.
- Customer module contracts return plain data and never expose Mongoose models or documents.
- No Retail model may be imported from `server/modules/customer-management` in this milestone.
- VAT profiles, Retail projections, debt collection, tiers, Excel jobs, POS cutover, and legacy archival are separate follow-up plans.

---

## File Structure

- `server/config/module-keys.ts`: registers the tenant-level `customer` module.
- `src/config/modules.ts`: registers the corresponding frontend module, tab, label, option, and read permissions.
- `server/config/permission-catalog.ts`: registers the two Customer permissions.
- `server/router/index.ts`: mounts the authenticated Customer router.
- `server/modules/customer-management/interfaces/customer.interface.ts`: public domain types.
- `server/modules/customer-management/models/customer.model.ts`: Customer persistence and indexes.
- `server/modules/customer-management/models/customer-counter.model.ts`: company-wide permanent code sequence.
- `server/modules/customer-management/customer-errors.ts`: stable HTTP/domain errors.
- `server/modules/customer-management/customer-normalization.ts`: pure validation and normalization.
- `server/modules/customer-management/customer.service.ts`: CRUD and paginated query orchestration.
- `server/modules/customer-management/contracts.ts`: typed plain-data lookup/search/quick-create boundary.
- `server/modules/customer-management/customer.controller.ts`: request/response adapter and company scope resolution.
- `server/modules/customer-management/router.ts`: permission-protected HTTP surface.
- `src/modules/customer-management/types.ts`: frontend DTOs and input/query types.
- `src/modules/customer-management/customerApi.ts`: typed API adapter.
- `src/modules/customer-management/CustomerWorkspace.tsx`: module shell and list/detail state.
- `src/modules/customer-management/components/CustomerList.tsx`: filters, table, and pagination.
- `src/modules/customer-management/components/CustomerFormDialog.tsx`: create/edit UI.
- `src/modules/customer-management/components/CustomerDetailDrawer.tsx`: profile detail and status actions.
- `src/modules/customer-management/CustomerManagementTab.tsx`: stable re-export entry point.

### Task 1: Register module and permissions

**Files:**
- Modify: `server/config/module-keys.ts`
- Modify: `src/config/modules.ts`
- Modify: `server/config/permission-catalog.ts`
- Modify: `server/router/module-route-guards.test.ts`
- Modify: `server/config/permission-catalog-cleanup.test.ts`
- Modify: `src/config/modules.test.ts`

**Interfaces:**
- Produces: module key `customer`; permissions `customer:read`, `customer:manage`; tab mapping `QUẢN LÝ KHÁCH HÀNG`.

- [ ] **Step 1: Add failing configuration tests**

```ts
assert.ok(MODULE_KEYS.includes("customer" as any));
assert.ok(DEFAULT_MODULE_KEYS.includes("customer" as any));
assert.deepEqual(
  PERMISSION_CATALOG.filter((item) => item.feature === "customer").map((item) => item.code).sort(),
  ["customer:manage", "customer:read"],
);
expect(MODULE_TAB_MAP.customer).toBe("QUẢN LÝ KHÁCH HÀNG");
expect(MODULE_READ_PERMISSIONS["QUẢN LÝ KHÁCH HÀNG"]).toEqual(["customer:read", "customer:manage"]);
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `node --import tsx --test server/config/permission-catalog-cleanup.test.ts server/router/module-route-guards.test.ts && npx vitest run src/config/modules.test.ts`

Expected: FAIL because `customer` is absent from module keys/catalog/mappings.

- [ ] **Step 3: Add `customer` to both module registries and permission catalog**

Add `customer` to both `MODULE_KEYS` arrays, keep it enabled by default, add `feature("customer", "Khách hàng", "Khách hàng")`, and wire:

```ts
customer: "Khách hàng",
customer: "QUẢN LÝ KHÁCH HÀNG",
"QUẢN LÝ KHÁCH HÀNG": "customer",
"QUẢN LÝ KHÁCH HÀNG": ["customer:read", "customer:manage"],
{ key: "customer", label: MODULE_LABELS.customer, moduleKeys: ["customer"] },
```

- [ ] **Step 4: Run focused tests and verify pass**

Run the Step 2 command.

Expected: all selected tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/config/module-keys.ts src/config/modules.ts server/config/permission-catalog.ts server/router/module-route-guards.test.ts server/config/permission-catalog-cleanup.test.ts src/config/modules.test.ts
git commit -m "feat(customer): register module and permissions"
```

### Task 2: Implement Customer model and pure validation

**Files:**
- Create: `server/modules/customer-management/interfaces/customer.interface.ts`
- Create: `server/modules/customer-management/models/customer.model.ts`
- Create: `server/modules/customer-management/models/customer-counter.model.ts`
- Create: `server/modules/customer-management/customer-errors.ts`
- Create: `server/modules/customer-management/customer-normalization.ts`
- Create: `server/modules/customer-management/customer-normalization.test.ts`
- Create: `server/modules/customer-management/models/customer.model.test.ts`

**Interfaces:**
- Produces: `CustomerStatus`, `CustomerType`, `Gender`, `ICustomer`, `CustomerInput`, `normalizeCustomerInput`, `normalizePhone`, `formatCustomerCode`, `CustomerError`.

- [ ] **Step 1: Write failing normalization tests**

```ts
test("normalizes a company-wide customer identity", () => {
  assert.deepEqual(normalizeCustomerInput({
    name: "  Nguyễn Văn A ", phone: "+84 901-234-567", email: " A@EXAMPLE.COM ",
    type: "regular", gender: "male", dateOfBirth: "1990-02-03",
  }), {
    name: "Nguyễn Văn A", phone: "+84 901-234-567", normalizedPhone: "84901234567",
    email: "a@example.com", type: "regular", gender: "male",
    dateOfBirth: new Date("1990-02-03T00:00:00.000Z"), status: "active",
  });
});

test("requires name and phone", () => {
  assert.throws(() => normalizeCustomerInput({ name: "", phone: "" }), /bắt buộc/);
});

test("formats a permanent customer code", () => {
  assert.equal(formatCustomerCode(" igen ", 12), "KH-IGEN-000012");
});
```

- [ ] **Step 2: Run normalization tests and verify failure**

Run: `node --import tsx --test server/modules/customer-management/customer-normalization.test.ts`

Expected: FAIL with missing module errors.

- [ ] **Step 3: Define types and minimal pure implementation**

```ts
export type CustomerStatus = "active" | "inactive";
export type CustomerType = "regular" | "vat";
export type Gender = "male" | "female" | "other";

export interface ICustomer {
  companyCode: string;
  customerCode: string;
  type: CustomerType;
  name: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  address?: string;
  notes?: string;
  status: CustomerStatus;
  source: "manual" | "pos" | "import";
  createdBy: string;
  createdByName: string;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
}
```

Implement strict allowed values, a real calendar-date check, lowercase email, digit-only normalized phone, trimmed optional strings, default `regular`, and default `active`. `CustomerError` carries `code`, `status`, and Vietnamese `message`.

- [ ] **Step 4: Add model index tests**

Assert the schema contains unique indexes `{ companyCode: 1, customerCode: 1 }` and `{ companyCode: 1, normalizedPhone: 1 }`, plus list indexes for status/name and `version` default `0`.

- [ ] **Step 5: Implement models and rerun tests**

Run: `node --import tsx --test server/modules/customer-management/customer-normalization.test.ts server/modules/customer-management/models/customer.model.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/modules/customer-management
git commit -m "feat(customer): add customer domain model"
```

### Task 3: Implement company-scoped CRUD service and contracts

**Files:**
- Create: `server/modules/customer-management/customer.service.ts`
- Create: `server/modules/customer-management/contracts.ts`
- Create: `server/modules/customer-management/customer.service.test.ts`
- Create: `server/modules/customer-management/contracts.test.ts`

**Interfaces:**
- Consumes: `CustomerModel`, `CustomerCounterModel`, normalization and errors from Task 2.
- Produces:

```ts
export type CustomerScope = { companyCode: string };
export type CustomerActor = { id: string; name: string };
export type CustomerListQuery = {
  q?: string; status?: "active" | "inactive"; type?: "regular" | "vat";
  page?: number; limit?: number;
};
export type CustomerBrief = {
  customerId: string; customerCode: string; name: string; phone: string;
  type: CustomerType; status: CustomerStatus;
};
export async function searchActiveCustomers(scope: CustomerScope, q: string, limit?: number): Promise<CustomerBrief[]>;
export async function getCustomerBrief(scope: CustomerScope, customerId: string, options?: { includeInactive?: boolean }): Promise<CustomerBrief | null>;
export async function quickCreateCustomer(scope: CustomerScope, input: { name: string; phone: string }, actor: CustomerActor): Promise<CustomerBrief>;
```

- [ ] **Step 1: Write failing service tests with injected repositories**

Cover company-only filters, escaped literal search, default active list, explicit inactive list, permanent duplicate-phone rejection, code allocation, optimistic update `{ _id, companyCode, version }`, deactivate/reactivate transitions, and a maximum list limit of 100.

- [ ] **Step 2: Run service tests and verify failure**

Run: `node --import tsx --test server/modules/customer-management/customer.service.test.ts server/modules/customer-management/contracts.test.ts`

Expected: FAIL with missing service/contracts.

- [ ] **Step 3: Implement the minimal service**

Expose `list`, `create`, `detail`, `update`, and `setStatus`. Translate Mongo duplicate-key errors on `normalizedPhone` to `CUSTOMER_PHONE_EXISTS`; translate stale version matches to `CUSTOMER_VERSION_CONFLICT`; never accept `companyCode`, code, totals, status, creator, or version from editable input.

- [ ] **Step 4: Implement contracts over service/repository functions**

`searchActiveCustomers` always filters `status: "active"`, caps limit at 20, and returns only `CustomerBrief`. `getCustomerBrief` excludes inactive records unless explicitly requested. `quickCreateCustomer` uses the same unique identity and code sequence as full creation.

- [ ] **Step 5: Rerun focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/modules/customer-management
git commit -m "feat(customer): add customer service contracts"
```

### Task 4: Expose permission-protected Customer HTTP API

**Files:**
- Create: `server/modules/customer-management/customer.controller.ts`
- Create: `server/modules/customer-management/router.ts`
- Create: `server/modules/customer-management/customer.routes.test.ts`
- Modify: `server/router/index.ts`
- Modify: `server/router/module-route-guards.test.ts`

**Interfaces:**
- Consumes: Customer service operations from Task 3 and `requirePermission`.
- Produces:

```text
GET    /api/customers?q&status&type&page&limit       customer:read
GET    /api/customers/search?q&limit                 customer:read
POST   /api/customers                                customer:manage
POST   /api/customers/quick                          customer:manage
GET    /api/customers/:id                            customer:read
PATCH  /api/customers/:id                            customer:manage
POST   /api/customers/:id/activate                   customer:manage
POST   /api/customers/:id/deactivate                 customer:manage
```

- [ ] **Step 1: Write failing route contract tests**

Inspect router layers to prove route/method ordering (`/search` and `/quick` before `/:id`) and permission assignment. Add a mount assertion matching:

```ts
apiRouter.use("/customers", requireAuth as any, requireModule("customer"), customerRouter);
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --import tsx --test server/modules/customer-management/customer.routes.test.ts server/router/module-route-guards.test.ts`

Expected: FAIL because the router is absent.

- [ ] **Step 3: Implement scope and actor adapters**

For normal users, derive uppercase `companyCode` only from `req.user`. For superadmin, require `query.companyCode`. Never accept a branch restriction. Map `CustomerError.status`; pass unexpected errors to Express error middleware.

- [ ] **Step 4: Implement and mount routes**

Use `requirePermission("customer:read")` for reads and `requirePermission("customer:manage")` for mutations. Return `{ success: true, data }`, with create/quick responses using HTTP 201.

- [ ] **Step 5: Rerun focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/modules/customer-management server/router/index.ts server/router/module-route-guards.test.ts
git commit -m "feat(customer): expose customer API"
```

### Task 5: Add typed frontend API and core workspace

**Files:**
- Create: `src/modules/customer-management/types.ts`
- Create: `src/modules/customer-management/customerApi.ts`
- Create: `src/modules/customer-management/customerApi.test.ts`
- Create: `src/modules/customer-management/components/CustomerList.tsx`
- Create: `src/modules/customer-management/components/CustomerFormDialog.tsx`
- Create: `src/modules/customer-management/components/CustomerDetailDrawer.tsx`
- Create: `src/modules/customer-management/CustomerWorkspace.tsx`
- Create: `src/modules/customer-management/CustomerWorkspace.test.tsx`
- Modify: `src/modules/customer-management/CustomerManagementTab.tsx`

**Interfaces:**
- Consumes: Task 4 API.
- Produces: default `CustomerWorkspace` through the existing tab entry.

- [ ] **Step 1: Write failing API adapter tests**

Verify query encoding and bodies for list/create/update/status endpoints, including `version` on update and status mutations.

- [ ] **Step 2: Write failing workspace tests**

Using Testing Library and a mocked API, prove initial company-wide active load, debounced search, status/type filters, pagination, detail opening, `customer:read` read-only behavior, `customer:manage` mutation controls, conflict reload messaging, and Vietnamese empty/error states.

- [ ] **Step 3: Run frontend tests and verify failure**

Run: `npx vitest run src/modules/customer-management/customerApi.test.ts src/modules/customer-management/CustomerWorkspace.test.tsx`

Expected: FAIL because the new modules do not exist and the entry is still a placeholder.

- [ ] **Step 4: Implement DTOs and API adapter**

Define `Customer`, `CustomerInput`, `CustomerListQuery`, and `PaginatedCustomers`; use `apiFetch` and send `companyCode` only for the existing superadmin context behavior.

- [ ] **Step 5: Implement focused UI components**

Keep list orchestration in `CustomerWorkspace`; keep table/filter rendering, form state, and drawer rendering in their named components. Search must use the existing `useDebouncedValue`. Preserve form input on API failure. Replace `CustomerManagementTab.tsx` with:

```ts
export { default } from "./CustomerWorkspace";
```

- [ ] **Step 6: Rerun focused tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/customer-management
git commit -m "feat(customer): add customer workspace"
```

### Task 6: Core milestone regression verification

**Files:**
- Modify only files required to correct failures caused by Tasks 1-5.

**Interfaces:**
- Verifies all Task 1-5 outputs together.

- [ ] **Step 1: Run all Customer and configuration tests**

Run: `node --import tsx --test server/modules/customer-management/**/*.test.ts server/config/permission-catalog-cleanup.test.ts server/router/module-route-guards.test.ts`

Expected: PASS.

- [ ] **Step 2: Run frontend Customer/config tests**

Run: `npx vitest run src/modules/customer-management src/config/modules.test.ts src/config/retail-default-modules.test.ts`

Expected: PASS.

- [ ] **Step 3: Run repository typecheck and production build**

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0 and Vite/server bundles generated.

- [ ] **Step 4: Confirm dependency boundaries**

Run: `rg -n "modules/retail|RetailCustomerModel|RetailOrderModel" server/modules/customer-management src/modules/customer-management`

Expected: no output.

- [ ] **Step 5: Review staged scope and commit any verification fixes**

```bash
git status --short
git diff --check
git add server/config/module-keys.ts server/config/permission-catalog.ts server/router/index.ts server/router/module-route-guards.test.ts server/modules/customer-management src/config/modules.ts src/config/modules.test.ts src/config/retail-default-modules.test.ts src/modules/customer-management
git commit -m "fix(customer): complete core module verification"
```

Skip the final commit when verification required no fixes.

## Follow-up Plans

After this core milestone passes, write and execute separate plans in this order:

1. `customer-vat-pos-snapshots` — VAT profiles, draft references, invoice snapshots, and POS selection.
2. `customer-retail-projections-and-collections` — company-wide orders, receivables, and idempotent debt collection contracts.
3. `customer-automatic-tiers` — company-owned tier settings, event refresh, and recalculation jobs.
4. `customer-excel-jobs` — import validation/confirmation/error workbook and filtered export.
5. `customer-complete-workspace` — detail sections, VAT, debt, tier, and job UIs.
6. `customer-pos-cutover-and-legacy-archive` — Customer contract cutover, migration dry-run/apply, and full regression suite.
