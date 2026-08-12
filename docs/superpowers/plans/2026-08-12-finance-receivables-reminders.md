# Finance Receivables and Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây Finance thành nguồn dữ liệu công nợ mới, migration an toàn từ Retail, cung cấp API/UI Công nợ–Tuổi nợ–Nhắc nợ và giữ tương thích màn hình khách hàng Retail.

**Architecture:** Retail ghi order và domain event trong cùng transaction; Finance consumer ghi Receivable và ledger append-only. Backfill/reconcile hoàn tất trước cutover; adapter Retail chuyển đọc/command sang Finance. Nhắc nợ đọc duy nhất Finance Receivable, luôn có in-app và phát event cho Marketing khi khả dụng.

**Tech Stack:** TypeScript, Express, Mongoose transactions/indexes, React, Vitest, Node test runner, existing notification/module/permission infrastructure.

## Global Constraints

- Không sửa hoặc commit `.github/workflows/cd.yml` của người dùng.
- Finance không import hoặc ghi `RetailOrderModel`; Retail không import Finance model.
- Mọi query Finance lọc `companyCode`; dữ liệu chi nhánh lọc thêm `branchId` từ actor/guard.
- Không dual-write Retail ledger và Finance ledger cho giao dịch mới.
- Ledger append-only; sai bằng reversal, không update/delete entry.
- Integer VND; thu vượt balance bị chặn; adjustment/write-off/reversal bắt buộc lý do.
- Mỗi event/consumer/backfill/reminder delivery có unique idempotency key ở DB.
- Cutover chỉ bật sau backfill/reconcile không sai lệch.

---

### Task 1: Isolated Finance Worktree and Baseline

**Files:**
- Verify only; no production file changes.

**Interfaces:**
- Consumes: branch `develop` commit containing spec `0ef6fb94`.
- Produces: isolated branch `feature/finance-receivables-reminders` and clean worktree.

- [ ] **Step 1: Preserve user state and create isolated worktree**

Run `git status -sb`, verify only `.github/workflows/cd.yml` is dirty in the main checkout, then create `.worktrees/finance-receivables-reminders` from `develop` using the worktree skill. Do not stash or copy `cd.yml`.

- [ ] **Step 2: Verify baseline**

Run frontend Retail tests, backend Retail tests, `npm run typecheck`, and `npm run build`. Expected: all pass on the isolated branch.

### Task 2: Durable Domain Event Outbox

**Files:**
- Create: `server/integrations/shared/domain-event.model.ts`
- Create: `server/integrations/shared/event-types.ts`
- Create: `server/integrations/shared/event-bus.ts`
- Create: `server/integrations/shared/retry-policy.ts`
- Create: `server/integrations/shared/event-dispatcher.ts`
- Test: `server/integrations/shared/domain-event-bus.test.ts`

**Interfaces:**
- Produces: `publishDomainEvent(input, session?)`, `registerDomainConsumer(eventType, name, handler, options?)`, `dispatchPendingDomainEvents(deps?)`, `domainRetryDelay(attempt)`.

- [ ] **Step 1: RED — define retry, registration and persisted publish behavior**

Write tests asserting delays `[60000,300000,900000,3600000,21600000]`, duplicate consumer registration rejection, event payload persistence with session, and stable `eventId` uniqueness.

- [ ] **Step 2: Verify RED**

Run `npx tsx --test server/integrations/shared/domain-event-bus.test.ts`. Expected: module-not-found or missing export failures.

- [ ] **Step 3: GREEN — implement event contracts/outbox**

Define typed payloads for `retail.order.confirmed|paid|cancelled` and `finance.receivable.settled|overdue`; create unique/indexed Mongoose schema; implement registry and publish without invoking handlers synchronously.

- [ ] **Step 4: RED/GREEN — dispatcher claim and delivery states**

Add tests for atomic pending claim, done, skipped when module disabled/unregistered, retry scheduling, and failed after five attempts. Implement dependency-injected dispatcher so tests use a fake repository and module checker rather than Mongo.

- [ ] **Step 5: Verify and commit**

Run the focused test and `npm run typecheck`; commit `feat: add durable domain event outbox`.

### Task 3: Finance Module Registration, Scope and Permissions

**Files:**
- Create: `server/modules/finance/permissions.ts`
- Create: `server/modules/finance/contracts.ts`
- Create: `server/modules/finance/router.ts`
- Create: `server/modules/finance/middlewares/finance-scope.ts`
- Modify: `server/config/module-keys.ts`
- Modify: `server/config/permission-catalog.ts`
- Modify: `server/config/database.ts`
- Modify: `server/router/index.ts`
- Modify: `src/config/modules.ts`
- Test: `server/modules/finance/finance-access.test.ts`

**Interfaces:**
- Produces: `FinanceScope { companyCode; branchId }`, permissions `receivable:read|collect|adjust`, module key `finance`, mounted `/api/v1/finance`.

- [ ] **Step 1: RED — access catalog and actor-derived scope**

Test that Finance is a known module, permissions are registered/admin-granted, normal users cannot override body/query company or branch, and superadmin must supply explicit scope according to existing conventions.

- [ ] **Step 2: Verify RED**

Run `npx tsx --test server/modules/finance/finance-access.test.ts`. Expected: missing finance module/permission failures.

- [ ] **Step 3: GREEN — register Finance consistently**

Implement module/permission catalogs, scope middleware and empty authenticated router using existing `requireModule` and permission middleware patterns.

- [ ] **Step 4: Verify and commit**

Run focused test plus existing module-access tests; commit `feat: register finance module access`.

### Task 4: Receivable Models and Pure Ledger Rules

**Files:**
- Create: `server/modules/finance/interfaces/receivable.interface.ts`
- Create: `server/modules/finance/models/receivable.model.ts`
- Create: `server/modules/finance/models/receivable-entry.model.ts`
- Create: `server/modules/finance/services/receivable-rules.ts`
- Test: `server/modules/finance/services/receivable-rules.test.ts`
- Test: `server/modules/finance/models/receivable-models.test.ts`

**Interfaces:**
- Produces: `signedReceivableAmount`, `deriveReceivableStatus`, `assertReceivableOperation`, indexed Receivable/ReceivableEntry models.

- [ ] **Step 1: RED — model/index invariants**

Test paths, enums, unique source event/idempotency/reversal indexes, hot query indexes and absence of mutable ledger update helpers.

- [ ] **Step 2: RED — signed amount and status table**

Test charge/positive adjustment as positive; payment/refund/write-off as negative; reversal as negative of original; balances zero/open/partial/void/written-off; reject fractional/negative VND and overpayment.

- [ ] **Step 3: Verify RED**

Run both focused test files and confirm missing modules/exports.

- [ ] **Step 4: GREEN — implement minimal models and pure rules**

Implement exact schema/indexes from the Finance spec and pure functions consumed by the transaction service.

- [ ] **Step 5: Verify and commit**

Run focused tests and typecheck; commit `feat: model finance receivables ledger`.

### Task 5: Transactional Receivable Ledger Service

**Files:**
- Create: `server/modules/finance/services/receivable-ledger.service.ts`
- Create: `server/modules/finance/services/receivable-query.service.ts`
- Test: `server/modules/finance/services/receivable-ledger.service.test.ts`
- Test: `server/modules/finance/services/receivable-query.service.test.ts`

**Interfaces:**
- Produces: `openFromEvent`, `collect`, `adjust`, `writeOff`, `reverse`, `voidFromEvent`, `settleFromEvent`, `list`, `detail`, `aging`, `byCustomer`.

- [ ] **Step 1: RED — wished-for transactional repository interface**

Test open creates header+charge atomically, duplicate `sourceEventId` replays, payment updates cache/status, adjustment requires reason, write-off zeros balance, reversal preserves original, and any entry failure leaves header unchanged.

- [ ] **Step 2: RED — 20-operation invariant**

Use a deterministic sequence of collect/adjust/reverse operations and assert header balance equals sum of all signed entries after every operation.

- [ ] **Step 3: Verify RED**

Run ledger test; expected missing service exports.

- [ ] **Step 4: GREEN — implement dependency-injected transaction service**

Centralize all cache writes in this service, pass session to every model operation, catch only recognized duplicate-key replay, and publish settled after commit through an injected callback/outbox session as appropriate.

- [ ] **Step 5: RED/GREEN — scoped queries and aging**

Test company/branch filters, date/status/customer pagination, ledger chronological calculation, and exact aging buckets `0-30|31-60|61-90|over90`. Implement query service.

- [ ] **Step 6: Verify and commit**

Run all Finance model/service tests and typecheck; commit `feat: implement finance receivable ledger`.

### Task 6: Retail Publishers and Finance Consumers

**Files:**
- Create: `server/modules/finance/consumers/receivable.consumer.ts`
- Create: `server/modules/finance/consumers/index.ts`
- Modify: `server/modules/retail/services/retail-order.service.ts`
- Create or modify: `server/modules/retail/contracts.ts`
- Test: `server/modules/finance/consumers/receivable.consumer.test.ts`
- Test: `server/modules/retail/services/retail-order-events.test.ts`

**Interfaces:**
- Consumes: outbox and ledger service.
- Produces: snapshot-complete Retail events, Finance open/paid/cancel consumers, explicit Retail settlement contract/consumer without Finance model imports.

- [ ] **Step 1: RED — event payload contracts**

Test confirm publishes only after order transaction data is ready and includes customer/due/actor snapshot; paid includes amount/transaction key; cancel includes remaining debt and refund snapshot.

- [ ] **Step 2: Verify RED and implement Retail publishers**

Run focused Retail event test, observe missing publish calls, then implement publish with the existing Mongo session.

- [ ] **Step 3: RED — replay-safe Finance consumers**

Test confirm paid-in-full skip, debt without customer/dueDate validation error, duplicate event replay, paid entry, and cancel reversal/void without deleting original entries.

- [ ] **Step 4: GREEN — consumers and registration**

Implement one consumer module with injected ledger methods; register once from Finance router/bootstrap and guard by module key.

- [ ] **Step 5: RED/GREEN — Finance settled to Retail**

Test `finance.receivable.settled` calls an explicit Retail contract and remains idempotent without Finance importing Retail model. Implement the contract boundary.

- [ ] **Step 6: Verify and commit**

Run Finance consumer, Retail order and stock/order tests; commit `feat: connect retail orders to finance receivables`.

### Task 7: Finance Receivable API

**Files:**
- Create: `server/modules/finance/validations/receivable.validation.ts`
- Create: `server/modules/finance/controllers/receivable.controller.ts`
- Create: `server/modules/finance/routes/receivable.routes.ts`
- Modify: `server/modules/finance/router.ts`
- Modify: `server/errors/error-codes.ts`
- Test: `server/modules/finance/receivable-api.test.ts`

**Interfaces:**
- Produces: `/finance/receivables` list/detail/aging/by-customer and payment/adjust/write-off/suspend/reverse commands.

- [ ] **Step 1: RED — route and guard matrix**

Test every route, `read|collect|adjust` guard assignment, body scope ignored, and controller forwarding to error middleware.

- [ ] **Step 2: RED — validation/error semantics**

Test integer VND, max balance enforcement in service, payment methods, mandatory reasons, ISO dates and documented error codes.

- [ ] **Step 3: Verify RED, implement API, verify GREEN**

Run focused API tests before and after implementation.

- [ ] **Step 4: Commit**

Run all Finance backend tests and commit `feat: expose finance receivable api`.

### Task 8: Backfill, Reconciliation and Cutover Adapter

**Files:**
- Create: `server/scripts/backfill-finance-receivables.ts`
- Test: `server/scripts/backfill-finance-receivables.test.ts`
- Create: `server/modules/finance/services/receivable-reconciliation.service.ts`
- Create: `server/modules/finance/config/finance-cutover.ts`
- Modify: Retail receivable API/services to delegate through an adapter.
- Test: `server/modules/finance/services/finance-retail-adapter.test.ts`

**Interfaces:**
- Produces: `--dry-run|--apply|--reconcile`, stable legacy keys, mismatch report, feature-controlled Retail adapter.

- [ ] **Step 1: RED — CLI and deterministic mapping**

Test separated scope args, no writes in dry-run, stable keys from Retail entry/order, replay skip, malformed debt reporting and zero auto-repair.

- [ ] **Step 2: GREEN — backfill implementation**

Implement batched reads/writes and summary `{scanned, convertible, created, skipped, errors, writes}`; apply uses Finance ledger service.

- [ ] **Step 3: RED/GREEN — reconciliation and adapter**

Test totals by company/branch/customer/order, detailed mismatch output, Finance-first reads after cutover, Finance command delegation and fallback before cutover without dual-write.

- [ ] **Step 4: Verify dry-run and commit**

Run script dry-run against configured environment if available (otherwise fixture test proves zero writes), focused tests and typecheck; commit `feat: migrate retail debt to finance`.

### Task 9: Overdue Reminder Engine

**Files:**
- Create: `server/modules/finance/models/reminder-run.model.ts`
- Create: `server/modules/finance/models/reminder-delivery.model.ts`
- Create: `server/modules/finance/config/finance-settings.ts`
- Create: `server/modules/finance/services/overdue-reminder.service.ts`
- Create: `server/modules/finance/jobs/overdue-scan.job.ts`
- Test: `server/modules/finance/services/overdue-reminder.service.test.ts`

**Interfaces:**
- Produces: `runOverdueScan(scope, trigger, actor?)`, `retryReminderDelivery`, scheduler registration and `finance.receivable.overdue` events.

- [ ] **Step 1: RED — eligibility and cycle keys**

Test Vietnam/business timezone boundaries, open/partial only, positive balance, settled/void/suspended exclusion, reminder interval and stable company/branch/cycle/receivable/channel key.

- [ ] **Step 2: RED — delivery behavior**

Test in-app always queued, Marketing disabled gives skipped not failed, publish success updates reminder cache, failure does not advance lastReminderAt, retry/backoff and duplicate cycle suppression.

- [ ] **Step 3: Verify RED, implement engine/models/job, verify GREEN**

Use existing scheduler and notification service; do not add cron dependency or send SMS/ZNS directly.

- [ ] **Step 4: Commit**

Run Finance reminder and existing Retail reminder regression tests; commit `feat: schedule finance overdue reminders`.

### Task 10: Reminder API and Finance Frontend Shell

**Files:**
- Create: `server/modules/finance/controllers/reminder.controller.ts`
- Create: `server/modules/finance/routes/reminder.routes.ts`
- Create: `src/modules/finance/FinanceTab.tsx`
- Create: `src/modules/finance/FinanceWorkspace.tsx`
- Create: `src/modules/finance/api/financeReceivables.api.ts`
- Create: `src/modules/finance/api/financeReminders.api.ts`
- Modify: application tab/router registrations.
- Test: `server/modules/finance/reminder-api.test.ts`
- Test: `src/modules/finance/FinanceTab.test.tsx`

**Interfaces:**
- Produces: Finance tab and `cong-no|tuoi-no|nhac-no` routes; reminder history/run/retry API.

- [ ] **Step 1: RED — reminder route guards and payloads**

Test read history/detail, manual run, retry, scope derivation and permission guards.

- [ ] **Step 2: GREEN — reminder API**

Implement controllers/routes with dependency injection and existing API response conventions.

- [ ] **Step 3: RED — Finance tab visibility and subroutes**

Test module enablement, permission-based visibility, default `cong-no` and deep links for all three pages.

- [ ] **Step 4: GREEN — shell and typed APIs**

Implement lazy-loaded Finance tab/workspace and API clients; pages may now render loading/empty/error states connected to real endpoints.

- [ ] **Step 5: Verify and commit**

Run focused server/frontend tests and typecheck; commit `feat: add finance workspace`.

### Task 11: Receivables, Aging and Reminder Pages

**Files:**
- Create: `src/modules/finance/pages/ReceivablesPage.tsx`
- Create: `src/modules/finance/pages/AgingReportPage.tsx`
- Create: `src/modules/finance/pages/FinanceRemindersPage.tsx`
- Create: `src/modules/finance/components/ReceivableDetailDrawer.tsx`
- Modify: `src/modules/retail/pages/RetailCustomersPage.tsx` and/or customer tier/debt components for deep link.
- Test: matching `.test.tsx` files under `src/modules/finance/` and Retail compatibility test.

**Interfaces:**
- Consumes: typed Finance APIs.
- Produces: usable list/aging/detail/actions/reminder management UI and Retail customer deep link.

- [ ] **Step 1: RED — list/aging states**

Test loading, error, empty, pagination/filter, overdue badge, four exact aging cards and drill-down query.

- [ ] **Step 2: GREEN — list and aging pages**

Reuse existing `Pagination`, summary cards, debounced filters and branch/auth hooks.

- [ ] **Step 3: RED — immutable ledger drawer actions**

Test no edit/delete controls, reversal only with adjust permission, collect max balance, required reasons, suspend-until validation and source link.

- [ ] **Step 4: GREEN — drawer and commands**

Implement accessible dialogs/forms and refresh query/detail after successful commands.

- [ ] **Step 5: RED/GREEN — reminder page and Retail link**

Test run log/delivery/retry/manual run and Retail customer link preserving customer id; implement both.

- [ ] **Step 6: Verify and commit**

Run all Finance frontend tests plus Retail customer tests; commit `feat: complete finance receivable ui`.

### Task 12: Final Verification and Cutover Readiness

**Files:**
- Modify only files required by failures proven in this task, with a failing regression test first.

**Interfaces:**
- Produces: evidence that implementation and migration gates pass; does not enable production cutover without a real zero-mismatch report.

- [ ] **Step 1: Finance/Retail backend gate**

Run all `server/modules/finance/**/*.test.ts`, Retail backend tests, event integration tests and backfill tests. Expected: 0 failures.

- [ ] **Step 2: Frontend gate**

Run all `src/modules/finance`, Retail frontend and module-config tests. Expected: 0 failures.

- [ ] **Step 3: Static/build gate**

Run `npm run typecheck`, `npm run build`, and `git diff --check`. Expected: exit 0.

- [ ] **Step 4: Migration gate**

Run backfill dry-run and reconciliation in the target environment. Record counts; do not set cutover true unless errors and mismatches equal zero.

- [ ] **Step 5: Review and branch completion**

Request code review, address only verified findings with TDD, rerun all gates, then use `finishing-a-development-branch` to present merge/push/keep options.
