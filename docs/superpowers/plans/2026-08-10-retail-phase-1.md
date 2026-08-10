# Retail Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the opt-in retail foundation with settings, customers, cashier shifts, server-authoritative orders, transactional stock/payment/invoice handling, and the first two Retail workspace screens.

**Architecture:** Implement vertical slices inside an isolated `server/modules/retail` boundary and a lazy `src/modules/retail` workspace. Keep pricing pure, keep controllers thin, and execute every multi-document money/stock transition in a MongoDB transaction. Reuse shared authentication, module, branch, API-client, table/dialog, and inventory patterns.

**Tech Stack:** TypeScript 5.8, Express 4, Mongoose 9, Joi 18, React 19, Vite 6, Tailwind CSS 4, Vitest/Node test runner.

## Global Constraints

- The approved design is `docs/superpowers/specs/2026-08-10-retail-phase-1-design.md`.
- Retail is independent of business type and is disabled until explicitly listed in `enabledModules`.
- Only `retail:operate` and `retail:manager` are introduced; manager implies operate.
- All currency values are non-negative integer VND; tax/discount percentages range from 0 through 100 with at most two decimals.
- Every retail query is company-scoped; branch-owned records additionally require exact branch scope.
- Drafts never reserve stock; only exact-branch Products can be sold.
- Multi-document stock/money transitions require MongoDB transaction support and have no non-transactional fallback.
- Do not commit, push, create a branch/worktree, or open a PR unless the user separately authorizes it.

---

## File structure

Backend files are grouped by retail responsibility:

- `server/modules/retail/contracts.ts`: tenant/branch scope resolution.
- `server/modules/retail/permissions.ts`: the two permission constants and implication helper.
- `server/modules/retail/interfaces/*.ts`: persistence/service contracts by aggregate.
- `server/modules/retail/models/*.model.ts`: settings, customer/counter, shift, order/counter, invoice/counter, and idempotency records.
- `server/modules/retail/services/*.service.ts`: one service per aggregate plus pure pricing and transaction orchestration.
- `server/modules/retail/validations/*.validation.ts`: Joi request schemas.
- `server/modules/retail/controllers/*.controller.ts`: HTTP adapters only.
- `server/modules/retail/routes/*.routes.ts` and `router.ts`: permission-aware route composition.

Frontend files mirror the usable phase-1 slices:

- `src/modules/shared/lib/apiFetch.ts`: promoted authenticated API client.
- `src/modules/retail/types.ts` and `api/*.api.ts`: API contracts.
- `src/modules/retail/RetailTab.tsx`, `RetailWorkspace.tsx`, `retailTabPermissions.ts`: workspace shell.
- `src/modules/retail/pages/RetailCustomersPage.tsx` and focused customer components.
- `src/modules/retail/pages/RetailSettingsPage.tsx` and settings form.

### Task 1: Opt-in module registration and two-permission policy

**Files:**
- Modify: `server/config/module-keys.ts`
- Modify: `server/config/business-types.ts`
- Modify: `server/config/permission-catalog.ts`
- Modify: `server/middleware/require-module.ts`
- Modify: `server/router/index.ts`
- Modify: `server/errors/error-codes.ts`
- Modify: `server/model/company.model.ts`
- Create: `server/modules/retail/permissions.ts`
- Create: `server/modules/retail/contracts.ts`
- Create: `server/modules/retail/router.ts`
- Test: `server/config/retail-module-access.test.ts`
- Test: `server/modules/retail/contracts.test.ts`
- Modify test: `server/router/module-route-guards.test.ts`
- Modify: `src/config/modules.ts`
- Modify: `src/types/common.ts`
- Modify test: `src/modules/business-module-isolation.test.ts`

**Interfaces:**
- Produces: `RETAIL_OPERATE_PERMISSION`, `RETAIL_MANAGER_PERMISSION`, `hasRetailCapability(actor, capability)`, `retailScopeFromRequest(actor, requested)`, and `requireRetailBranch(scope)`.
- Produces: `resolveModuleAccess(..., "retail", ...)` that returns true only when retail is explicitly enabled.

- [ ] **Step 1: Write failing opt-in and permission tests**

```ts
test("retail is type-independent but requires explicit enablement", () => {
  const user = { role: "admin", companyCode: "ACME" };
  assert.equal(resolveModuleAccess(user, "retail", undefined, true, "education"), false);
  assert.equal(resolveModuleAccess(user, "retail", [], true, "labor"), false);
  assert.equal(resolveModuleAccess(user, "retail", ["retail"], true, "labor"), true);
});

test("manager capability implies operate", () => {
  assert.equal(hasRetailCapability({ permissions: ["retail:manager"] }, "operate"), true);
  assert.equal(hasRetailCapability({ permissions: ["retail:operate"] }, "manager"), false);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npx vitest run server/config/retail-module-access.test.ts server/modules/retail/contracts.test.ts server/router/module-route-guards.test.ts src/modules/business-module-isolation.test.ts`

Expected: FAIL because retail keys/helpers/router do not exist.

- [ ] **Step 3: Implement module keys, special opt-in access, permissions, scope, router shell, and errors**

Add `retail` to both key catalogs but keep it outside `BUSINESS_MODULES`. Make the module access resolver special-case missing/empty module arrays for retail only. Add exactly these catalog entries:

```ts
{ code: "retail:operate", label: "Vận hành bán lẻ", group: "Bán lẻ" },
{ code: "retail:manager", label: "Quản lý bán lẻ", group: "Bán lẻ" },
```

Implement manager implication in the retail middleware/helper rather than creating more permission codes. Mount `retailRouter` under authentication plus `requireModule("retail")`.

- [ ] **Step 4: Run focused tests and typecheck touched contracts**

Run: `npx vitest run server/config/retail-module-access.test.ts server/modules/retail/contracts.test.ts server/router/module-route-guards.test.ts src/modules/business-module-isolation.test.ts`

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Run: `git diff -- server/config server/middleware/require-module.ts server/modules/retail server/router/index.ts src/config/modules.ts src/types/common.ts`

Expected: only module/permission/scope shell changes; no detailed retail business logic yet.

### Task 2: Shared authenticated API client and Retail workspace shell

**Files:**
- Create: `src/modules/shared/lib/apiFetch.ts`
- Modify: `src/modules/worker-management/api/client.ts`
- Create: `src/modules/shared/lib/apiFetch.test.ts`
- Create: `src/modules/retail/RetailTab.tsx`
- Create: `src/modules/retail/RetailWorkspace.tsx`
- Create: `src/modules/retail/retailTabPermissions.ts`
- Modify: `src/router/route-config.tsx`
- Modify: `src/pages/Sidebar.tsx`
- Modify: `src/pages/Header.tsx`
- Test: `src/modules/retail/RetailWorkspace.test.tsx`
- Modify test: `src/router/business-module-routes.test.tsx`

**Interfaces:**
- Produces: `apiFetch<T>(endpoint, options)` with the existing refresh/error behavior.
- Produces: a `BÁN LẺ` workspace exposing `khach-hang` and `cai-dat` slugs according to permissions.

- [ ] **Step 1: Write failing client compatibility and workspace-access tests**

```ts
it("keeps workerApiFetch as an apiFetch compatibility export", async () => {
  expect(workerApiFetch).toBe(apiFetch);
});

it("shows settings only to retail managers", () => {
  expect(getAllowedRetailTabSlugs(["retail:operate"])).toEqual(["khach-hang"]);
  expect(getAllowedRetailTabSlugs(["retail:manager"])).toEqual(["khach-hang", "cai-dat"]);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/shared/lib/apiFetch.test.ts src/modules/retail/RetailWorkspace.test.tsx src/router/business-module-routes.test.tsx`

Expected: FAIL because shared client and retail workspace do not exist.

- [ ] **Step 3: Promote the client and add the lazy workspace shell**

Move the worker client logic unchanged to `apiFetch.ts`, export compatibility aliases from the worker file, add the tab/sidebar/header mapping, and lazy-load placeholder page components for the two approved subtabs. Do not expose future POS/order/shift tabs.

- [ ] **Step 4: Run focused frontend tests**

Run: `npx vitest run src/modules/shared/lib/apiFetch.test.ts src/modules/retail/RetailWorkspace.test.tsx src/router/business-module-routes.test.tsx`

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Run: `git diff -- src/modules/shared src/modules/worker-management/api/client.ts src/modules/retail src/router/route-config.tsx src/pages/Sidebar.tsx src/pages/Header.tsx`

Expected: worker callers remain source-compatible and only two Retail subtabs exist.

### Task 3: Branch retail settings backend

**Files:**
- Create: `server/modules/retail/interfaces/retail-settings.interface.ts`
- Create: `server/modules/retail/models/retail-settings.model.ts`
- Create: `server/modules/retail/services/retail-settings.service.ts`
- Create: `server/modules/retail/validations/retail-settings.validation.ts`
- Create: `server/modules/retail/controllers/retail-settings.controller.ts`
- Create: `server/modules/retail/routes/retail-settings.routes.ts`
- Modify: `server/modules/retail/router.ts`
- Test: `server/modules/retail/services/retail-settings.service.test.ts`
- Test: `server/modules/retail/routes/retail-settings.routes.test.ts`

**Interfaces:**
- Produces: `DEFAULT_RETAIL_SETTINGS` and `getResolvedRetailSettings(scope)`.
- Produces: `updateRetailSettings(scope, input, actor)` restricted to manager capability.

- [ ] **Step 1: Write failing default, validation, branch isolation, and permission tests**

```ts
assert.deepEqual(await getResolvedRetailSettings({ companyCode: "ACME", branchId: "B1" }), {
  companyCode: "ACME", branchId: "B1", allowNegativeStock: false,
  maxDiscountPercent: 0, defaultTaxRate: 0, varianceReasonThreshold: 0,
  orderPrefix: "DH", invoicePrefix: "HD",
});
```

Also assert that `8.555` tax, negative threshold, invalid prefix, cross-branch read, and operator update are rejected.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npx vitest run server/modules/retail/services/retail-settings.service.test.ts server/modules/retail/routes/retail-settings.routes.test.ts`

Expected: FAIL with missing model/service/routes.

- [ ] **Step 3: Implement settings schema, defaults, validation, service, controller, and routes**

Use a unique `{ companyCode: 1, branchId: 1 }` index. Missing data returns resolved defaults; update uses upsert and returns the resolved persisted record. Joi enforces integer VND, two-decimal percentage precision, and uppercase alphanumeric prefixes of 1-8 characters.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run server/modules/retail/services/retail-settings.service.test.ts server/modules/retail/routes/retail-settings.routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Run: `git diff -- server/modules/retail/interfaces server/modules/retail/models server/modules/retail/services server/modules/retail/validations server/modules/retail/controllers server/modules/retail/routes`

Expected: settings are branch-scoped and manager-only for writes.

### Task 4: Settings frontend slice

**Files:**
- Create: `src/modules/retail/types.ts`
- Create: `src/modules/retail/api/retailSettings.api.ts`
- Create: `src/modules/retail/pages/RetailSettingsPage.tsx`
- Create: `src/modules/retail/components/RetailSettingsForm.tsx`
- Test: `src/modules/retail/pages/RetailSettingsPage.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `useBranch`, `RetailSettings` API.
- Produces: branch-aware settings read/edit UI.

- [ ] **Step 1: Write failing UI tests**

Test default rendering, manager edit/save, inline validation, branch change reload, and operator read-only behavior. Mock `retailSettingsApi.get`/`update` rather than `fetch`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/retail/pages/RetailSettingsPage.test.tsx`

Expected: FAIL because page/API do not exist.

- [ ] **Step 3: Implement typed API and focused settings form**

Use numeric inputs for percentages/VND, checkbox for negative stock, uppercase prefix normalization, inline API errors, and reload state from update response. The branch comes from BranchContext and is always sent as scope.

- [ ] **Step 4: Run focused UI tests**

Run: `npx vitest run src/modules/retail/pages/RetailSettingsPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Run: `git diff -- src/modules/retail`

Expected: settings edits are impossible for operate-only users in both UI and API.

### Task 5: Company-wide retail customers backend

**Files:**
- Create: `server/modules/retail/interfaces/retail-customer.interface.ts`
- Create: `server/modules/retail/models/retail-customer.model.ts`
- Create: `server/modules/retail/models/retail-customer-counter.model.ts`
- Create: `server/modules/retail/services/retail-customer.service.ts`
- Create: `server/modules/retail/validations/retail-customer.validation.ts`
- Create: `server/modules/retail/controllers/retail-customer.controller.ts`
- Create: `server/modules/retail/routes/retail-customer.routes.ts`
- Modify: `server/modules/retail/router.ts`
- Test: `server/modules/retail/services/retail-customer.service.test.ts`
- Test: `server/modules/retail/routes/retail-customer.routes.test.ts`

**Interfaces:**
- Produces: `createCustomer`, `updateCustomer`, `listCustomers`, `getCustomerDetail`.
- Customer detail initially returns zeroed derived totals/history until order models land; Task 10 replaces the query adapter with real aggregation.

- [ ] **Step 1: Write failing customer identity and isolation tests**

Assert `KH-ACME-000001`, atomic concurrent numbering, company-wide visibility across B1/B2, origin branch preservation, normalized phone uniqueness inside ACME, same phone allowed in another company, update support, and no DELETE route.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run server/modules/retail/services/retail-customer.service.test.ts server/modules/retail/routes/retail-customer.routes.test.ts`

Expected: FAIL because customer slice does not exist.

- [ ] **Step 3: Implement customer model/counter/service/API**

Use a unique company counter and a partial unique normalized-phone index. Search escaped text against customerCode/name/normalized phone, paginate deterministically, and never expose delete. Validate email/phone lengths without inventing a status field.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run server/modules/retail/services/retail-customer.service.test.ts server/modules/retail/routes/retail-customer.routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Run: `git diff -- server/modules/retail`

Expected: customer profile scope is company-wide; only origin metadata is branch-specific.

### Task 6: Customer management frontend slice

**Files:**
- Modify: `src/modules/retail/types.ts`
- Create: `src/modules/retail/api/retailCustomers.api.ts`
- Create: `src/modules/retail/pages/RetailCustomersPage.tsx`
- Create: `src/modules/retail/components/RetailCustomerFormModal.tsx`
- Create: `src/modules/retail/components/RetailCustomerDetailDrawer.tsx`
- Test: `src/modules/retail/pages/RetailCustomersPage.test.tsx`

**Interfaces:**
- Produces: searchable paginated customer table, create/edit flow, detail/summary/history drawer.

- [ ] **Step 1: Write failing page tests**

Cover debounced search, pagination, create, edit, no delete/status controls, detail summary rendering, and branch transaction filter without filtering profile visibility.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/modules/retail/pages/RetailCustomersPage.test.tsx`

Expected: FAIL because page components/API are missing.

- [ ] **Step 3: Implement the customer UI using shared components**

Reuse Pagination, Confirm/Dialog or modal conventions, Toast, `useDebouncedValue`, and BranchContext. Display contact fields and derived sales/collection/debt/history from the detail response. Do not add active/deactivate/delete actions.

- [ ] **Step 4: Run focused frontend tests**

Run: `npx vitest run src/modules/retail/pages/RetailCustomersPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Run: `git diff -- src/modules/retail`

Expected: complete Customer subtab with no undeclared customer lifecycle behavior.

### Task 7: Cashier shift aggregate and reconciliation API

**Files:**
- Create: `server/modules/retail/interfaces/cashier-shift.interface.ts`
- Create: `server/modules/retail/models/cashier-shift.model.ts`
- Create: `server/modules/retail/services/cashier-shift.service.ts`
- Create: `server/modules/retail/middleware/require-open-shift.middleware.ts`
- Create: `server/modules/retail/validations/cashier-shift.validation.ts`
- Create: `server/modules/retail/controllers/cashier-shift.controller.ts`
- Create: `server/modules/retail/routes/cashier-shift.routes.ts`
- Modify: `server/modules/retail/router.ts`
- Test: `server/modules/retail/services/cashier-shift.service.test.ts`
- Test: `server/modules/retail/routes/cashier-shift.routes.test.ts`

**Interfaces:**
- Produces: `getCurrentShift`, `openShift`, `addCashMovement`, `closeShift`, `approveShift`, and `requireOpenShift`.
- Produces: shift business date inherited by later order/payment calls.

- [ ] **Step 1: Write failing shift state/concurrency tests**

Assert one open shift per cashier, one per non-empty terminal, different empty terminals allowed, opening-date preservation after midnight, blind serialization, cash movement math, variance reason threshold, immutable closed shifts, and manager approval.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run server/modules/retail/services/cashier-shift.service.test.ts server/modules/retail/routes/cashier-shift.routes.test.ts`

Expected: FAIL because shift aggregate is missing.

- [ ] **Step 3: Implement shift aggregate and routes**

Use partial unique indexes for open cashier/terminal records. Keep expected totals hidden before count. Define aggregation through an injected/order-payment query interface so Task 10 can connect real transactions without coupling the shift model to controller code.

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run server/modules/retail/services/cashier-shift.service.test.ts server/modules/retail/routes/cashier-shift.routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Run: `git diff -- server/modules/retail`

Expected: shift state machine and blind-count response are enforced server-side.

### Task 8: Pure retail pricing service

**Files:**
- Create: `server/modules/retail/interfaces/retail-pricing.interface.ts`
- Create: `server/modules/retail/services/retail-pricing.service.ts`
- Test: `server/modules/retail/services/retail-pricing.service.test.ts`

**Interfaces:**
- Produces: `calculateOrderTotals(input: PricingInput): PricingResult`.
- Input contains authoritative product snapshots, discount representation, order discount, tax rate, shipping fee, and maximum discount percent.

- [ ] **Step 1: Write the pricing test matrix before implementation**

Include at least 20 explicit cases covering integer-VND rounding, percent/VND line discount, percent/VND order discount, combined discount cap, split line quantities, 8.5% tax, 0/100 boundaries, shipping, discount exceeding line/subtotal, negative inputs, percentage precision, and `totalCost` snapshot.

- [ ] **Step 2: Run pricing tests and verify failure**

Run: `npx vitest run server/modules/retail/services/retail-pricing.service.test.ts`

Expected: FAIL because `calculateOrderTotals` is missing.

- [ ] **Step 3: Implement the minimal pure calculation**

The function must not import Mongoose, request types, settings models, or the clock. Normalize every discount to integer VND, enforce combined cap against pre-discount merchandise value, round tax with `Math.round`, and return immutable computed line snapshots.

- [ ] **Step 4: Run pricing tests**

Run: `npx vitest run server/modules/retail/services/retail-pricing.service.test.ts`

Expected: all pricing cases PASS.

- [ ] **Step 5: Mutation-oriented review checkpoint**

Temporarily reason through changing calculation order (tax before discount, rounding at end) and confirm existing tests would fail; add a test if either mutation could survive.

### Task 9: Order, invoice, payment, refund, and idempotency models

**Files:**
- Create: `server/modules/retail/interfaces/retail-order.interface.ts`
- Create: `server/modules/retail/interfaces/retail-invoice.interface.ts`
- Create: `server/modules/retail/models/retail-order.model.ts`
- Create: `server/modules/retail/models/retail-order-counter.model.ts`
- Create: `server/modules/retail/models/retail-invoice.model.ts`
- Create: `server/modules/retail/models/retail-invoice-counter.model.ts`
- Create: `server/modules/retail/models/retail-idempotency.model.ts`
- Test: `server/modules/retail/models/retail-models.test.ts`

**Interfaces:**
- Produces persistent order/payment/refund snapshots and counter allocation functions consumed by Task 10.

- [ ] **Step 1: Write failing schema/invariant tests**

Assert compound unique counters, monthly scope, invoice active uniqueness, idempotency-key uniqueness, payment methods excluding debt, cash tender/change validation shape, payment/refund shift/business-date fields, and no invoice `unitCost` path.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run server/modules/retail/models/retail-models.test.ts`

Expected: FAIL because models are missing.

- [ ] **Step 3: Implement focused schemas and indexes**

Keep embedded line/payment/refund schemas `_id: false`, timestamps enabled on aggregates, and optimistic `version`. Separate order/invoice counters by `{ companyCode, branchId, scope }`. Store client idempotency attempts in a dedicated uniquely indexed record that can return the committed order/invoice IDs.

- [ ] **Step 4: Run model tests**

Run: `npx vitest run server/modules/retail/models/retail-models.test.ts`

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Run: `git diff -- server/modules/retail/interfaces server/modules/retail/models`

Expected: models encode approved decisions and contain no return/serial phase-2 schema.

### Task 10: Transactional quote/draft/confirm/collect/cancel APIs and stock integration

**Files:**
- Modify: `server/interface/stock-log.interface.ts`
- Modify: `server/model/stock-log.model.ts`
- Create: `server/modules/retail/services/retail-stock.service.ts`
- Create: `server/modules/retail/services/retail-invoice.service.ts`
- Create: `server/modules/retail/services/retail-order.service.ts`
- Create: `server/modules/retail/validations/retail-order.validation.ts`
- Create: `server/modules/retail/controllers/retail-order.controller.ts`
- Create: `server/modules/retail/controllers/retail-invoice.controller.ts`
- Create: `server/modules/retail/routes/retail-order.routes.ts`
- Create: `server/modules/retail/routes/retail-invoice.routes.ts`
- Modify: `server/modules/retail/router.ts`
- Modify: `server/modules/retail/services/cashier-shift.service.ts`
- Modify: `server/modules/retail/services/retail-customer.service.ts`
- Test: `server/modules/retail/services/retail-order.service.test.ts`
- Test: `server/modules/retail/services/retail-order-concurrency.test.ts`
- Test: `server/modules/retail/routes/retail-order.routes.test.ts`

**Interfaces:**
- Produces: `quoteOrder`, `createDraft`, `updateDraft`, `confirmOrder`, `collectOrderPayment`, `cancelOrder`, invoice list/detail.
- Connects shift aggregation and customer derived history to committed orders/payments/refunds.

- [ ] **Step 1: Write failing quote/draft tests**

Assert server product lookup, exact company/branch product filter, legacy branchless product rejection, authoritative prices, draft mutability, no stock reservation, settings-driven discount/tax/negative-stock rules, and mismatch details.

- [ ] **Step 2: Run quote/draft tests and verify failure**

Run: `npx vitest run server/modules/retail/services/retail-order.service.test.ts -t "quote|draft"`

Expected: FAIL because order service is missing.

- [ ] **Step 3: Implement quote and draft paths**

Controllers validate and scope; the service loads settings/products and delegates all arithmetic to `calculateOrderTotals`. Draft persistence stores computed snapshots but assigns no order number and changes no Product/StockLog.

- [ ] **Step 4: Write failing transaction/concurrency tests**

Use two parallel promises and a transaction-capable test double/integration database. Assert one stock decrement, one `order:{id}:out` log, one order number, one invoice, and one initial payment set for duplicate same-key confirmation. Assert a different key/version cannot reconfirm the draft. Assert insufficient stock rolls back all records when negative stock is off and succeeds to negative when on.

- [ ] **Step 5: Extend StockLog and implement transactional confirmation**

Add `refType`, `refId`, `idempotencyKey` plus the unique partial index. In `session.withTransaction`, claim idempotency, require the current shift, recalculate totals, validate debt/customer/due date and split payment/tender rules, atomically decrement stock, allocate codes, write StockLog, persist payment snapshots, issue invoice, and commit final state. Return the prior committed response on a same-key retry.

- [ ] **Step 6: Run confirmation and concurrency tests**

Run: `npx vitest run server/modules/retail/services/retail-order.service.test.ts server/modules/retail/services/retail-order-concurrency.test.ts`

Expected: PASS with race assertions executed, not skipped.

- [ ] **Step 7: Write failing later-collection and cancellation/refund tests**

Cover required open shift, partial-to-completed transition, debt not accepted as method, applied overpayment rejection, cash change, operator cancellation boundary, manager completed cancellation, required reason, stock reversal idempotency, explicit refund distribution, immutable original payments, and cash refund effect on current shift.

- [ ] **Step 8: Implement collection and cancellation/refund transactions**

Later collection and refund each inherit current shift/business date. Cancellation writes `order:{id}:revert`, restores exact-branch product stock, preserves initial payment audit, records refunds, and changes payment/order status without deleting invoice/order/stock history.

- [ ] **Step 9: Connect customer and shift derived aggregations**

Customer detail aggregates company-wide orders with optional branch transaction filter. Shift close aggregates gross sales, collected, new debt, refund, net collected, method totals, and expected cash from transaction snapshots carrying its shift ID.

- [ ] **Step 10: Run all backend retail tests**

Run: `npx vitest run server/modules/retail server/router/module-route-guards.test.ts server/config/retail-module-access.test.ts`

Expected: PASS.

- [ ] **Step 11: Review checkpoint**

Run: `git diff -- server/model/stock-log.model.ts server/interface/stock-log.interface.ts server/modules/retail`

Expected: all stock/money multi-model writes occur with a session; no fallback sequence exists.

### Task 11: Cross-cutting frontend/backend verification and hardening

**Files:**
- Modify tests as failures identify: retail test files created above only.
- Modify docs if actual API names differ: `docs/superpowers/specs/2026-08-10-retail-phase-1-design.md`

**Interfaces:**
- Produces: a verified phase-1 implementation with no known spec gaps.

- [ ] **Step 1: Run the complete targeted suite**

Run: `npx vitest run server/modules/retail server/config/retail-module-access.test.ts server/router/module-route-guards.test.ts src/modules/retail src/modules/shared/lib/apiFetch.test.ts src/modules/business-module-isolation.test.ts src/router/business-module-routes.test.tsx`

Expected: PASS, no skipped retail race/isolation tests.

- [ ] **Step 2: Run full typecheck**

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: Vite and server bundle both complete successfully.

- [ ] **Step 4: Inspect permission and tenant leakage mechanically**

Run: `rg -n 'retail:(read|sell|discount|cancel|cost|return)|shift:|serial:' server/modules/retail src/modules/retail server/config/permission-catalog.ts`

Expected: no obsolete detailed retail permission codes.

Run: `rg -n 'find\(|findOne\(|updateOne\(|findOneAndUpdate\(' server/modules/retail/services`

Expected: manually verify every persistence query includes company scope and branch scope where owned.

- [ ] **Step 5: Inspect final diff and preserve unrelated user changes**

Run: `git status --short` then `git diff --check` then `git diff --stat`.

Expected: no whitespace errors; the pre-existing deleted ranking document remains untouched; no generated `dist` files are intentionally included.

- [ ] **Step 6: Final evidence report**

Report exact test/typecheck/build commands and outcomes, changed-file groups, deferred phase items, MongoDB transaction deployment requirement, and any residual risks. Do not claim completion if any required command failed.


