# Retail Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện sáu nhóm Retail dang dở theo thứ tự hóa đơn, công nợ, báo cáo, VIP, nhắc nợ và POS/offline, với mỗi milestone tự nghiệm thu được.

**Architecture:** Mỗi milestone bổ sung các model/service/route/API/component tập trung vào một trách nhiệm và giữ scope từ actor/guard hiện tại. Giao dịch tài chính dùng MongoDB transaction, idempotency dùng unique index, còn tác vụ hậu giao dịch dùng bản ghi công việc có thể retry. UI chỉ điều phối; PDF, ledger, reporting, retry và offline queue nằm trong service/adapter kiểm thử độc lập.

**Tech Stack:** TypeScript 5.8, React 19, Express 4, Mongoose 9, Vitest 4, Node test runner, Testing Library, Nodemailer 9, XLSX 0.18, IndexedDB browser API.

## Global Constraints

- Mọi bản ghi mới bắt buộc có `companyCode`, `branchId`, actor và timestamps phù hợp.
- API lấy company/branch scope từ `resolveRetailBranchScope`; không nhận quyền xem lợi nhuận hoặc scope tài chính từ body.
- Bút toán công nợ là append-only; sai thì reversal hoặc adjustment, không update/delete.
- Tiền là số nguyên VNĐ; transaction và idempotency phải được ép ở DB.
- Giao dịch offline chưa được server chấp nhận không được hiển thị là hoàn tất hoặc phát hành hóa đơn.
- Migration chỉ được tự động chạy ở `--dry-run`; `--apply` cần thao tác vận hành riêng.
- Mọi production behavior mới phải có test RED được quan sát trước khi viết implementation.
- Sau mỗi task chạy test mục tiêu; sau mỗi milestone chạy toàn bộ Retail frontend/backend, typecheck, build và `git diff --check`.
- Không stage file `docs/Kế hoạch thay đổi kèm ranking.md` đang bị người dùng xóa cục bộ.

---

## Milestone 1 — Hóa đơn nội bộ

### Task 1: Snapshot cửa hàng và cấu hình in

**Files:**
- Modify: `server/modules/retail/interfaces/retail-invoice.interface.ts`
- Modify: `server/modules/retail/models/retail-invoice.model.ts`
- Modify: `server/modules/retail/interfaces/retail-settings.interface.ts`
- Modify: `server/modules/retail/models/retail-settings.model.ts`
- Modify: `server/modules/retail/services/retail-settings.service.ts`
- Modify: `server/modules/retail/services/retail-invoice.service.ts`
- Test: `server/modules/retail/services/retail-settings.service.test.ts`
- Test: `server/modules/retail/services/retail-invoice.service.test.ts`
- Test: `server/modules/retail/models/retail-models.test.ts`

**Interfaces:**

```ts
export type RetailInvoicePaperSize = "A4" | "A5" | "80mm";
export type RetailInvoiceTemplate = "standard";
export interface RetailStoreSnapshot {
  legalName: string;
  taxCode?: string;
  storeName: string;
  branchCode: string;
  branchName: string;
  branchAddress?: string;
  branchPhone?: string;
}
```

- [ ] Add failing tests asserting settings defaults are `A4`/`standard`, invalid values are rejected, and invoice issuance snapshots branch/company fields.
- [ ] Run `npx tsx --test server/modules/retail/services/retail-settings.service.test.ts server/modules/retail/services/retail-invoice.service.test.ts server/modules/retail/models/retail-models.test.ts`; expect failures for missing fields.
- [ ] Add the exact types above, schema fields, defaults and validation; load company/branch inside the invoice transaction and write `snapshot.store` once.
- [ ] Re-run the command; expect all tests to pass.
- [ ] Commit only Task 1 files with `git commit -m "feat: snapshot retail invoice store details"`.

### Task 2: Server PDF renderer and download endpoint

**Files:**
- Create: `server/modules/retail/services/retail-invoice-pdf.service.ts`
- Create: `server/modules/retail/services/retail-invoice-pdf.service.test.ts`
- Modify: `server/modules/retail/controllers/retail-invoice.controller.ts`
- Modify: `server/modules/retail/routes/retail-invoice.routes.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

```ts
export interface RetailInvoicePdfResult { buffer: Buffer; filename: string }
export async function renderRetailInvoicePdf(
  invoice: IRetailInvoice,
  paperSize: RetailInvoicePaperSize,
): Promise<RetailInvoicePdfResult>;
```

- [ ] Add failing Node tests that parse the produced PDF header, verify Vietnamese store text is present through the renderer text calls, verify sanitized filename, scoped lookup, permission guard and `application/pdf` response headers.
- [ ] Run `npx tsx --test server/modules/retail/services/retail-invoice-pdf.service.test.ts`; expect module-not-found failure.
- [ ] Install `pdfkit` and its type package, bundle one Unicode font asset under `server/modules/retail/assets/`, implement `renderRetailInvoicePdf`, `GET /retail/invoices/:id/pdf`, and error forwarding.
- [ ] Re-run the target test; expect pass with no open stream handles.
- [ ] Commit renderer, route, dependency lock and font license with `git commit -m "feat: download retail invoice pdf"`.

### Task 3: Invoice print/download UI

**Files:**
- Modify: `src/modules/retail/types.ts`
- Modify: `src/modules/retail/api/retailInvoices.api.ts`
- Create: `src/modules/retail/api/retailInvoices.api.test.ts`
- Modify: `src/modules/retail/components/pos/ReceiptPrintView.tsx`
- Modify: `src/modules/retail/components/pos/ReceiptPrintView.test.tsx`
- Modify: `src/modules/retail/pages/RetailInvoicesPage.tsx`
- Create: `src/modules/retail/pages/RetailInvoicesPage.test.tsx`
- Modify: `src/modules/retail/pages/RetailSettingsPage.tsx`
- Modify: `src/modules/retail/pages/RetailSettingsPage.test.tsx`

**Interfaces:**

```ts
downloadPdf(scope: RetailScope, invoiceId: string, signal?: AbortSignal): Promise<void>;
```

- [ ] Add failing Vitest tests for paper/template settings, store details on receipt, list-row preview/reprint, PDF download, loading/error state and URL cleanup.
- [ ] Run `npx vitest run src/modules/retail/api/retailInvoices.api.test.ts src/modules/retail/components/pos/ReceiptPrintView.test.tsx src/modules/retail/pages/RetailInvoicesPage.test.tsx src/modules/retail/pages/RetailSettingsPage.test.tsx`; expect missing controls/API failures.
- [ ] Implement the typed download helper and UI controls; reuse invoice detail without calling order confirmation or invoice issuance endpoints.
- [ ] Re-run target tests, then run the milestone gate commands at the end of this plan.
- [ ] Commit with `git commit -m "feat: complete retail invoice printing"`.

## Milestone 2 — Công nợ

### Task 4: Append-only receivable ledger

**Files:**
- Create: `server/modules/retail/interfaces/retail-receivable.interface.ts`
- Create: `server/modules/retail/models/retail-receivable-entry.model.ts`
- Create: `server/modules/retail/services/retail-receivable-ledger.service.ts`
- Create: `server/modules/retail/services/retail-receivable-ledger.service.test.ts`
- Modify: `server/modules/retail/services/retail-order.service.ts`
- Modify: `server/modules/retail/services/retail-order.service.test.ts`

**Interfaces:**

```ts
export type RetailReceivableEntryType = "charge" | "payment" | "adjustment" | "reversal";
export interface PostReceivableEntryInput {
  type: RetailReceivableEntryType;
  customerId: string;
  orderId?: string;
  amount: number;
  reason?: string;
  reversesEntryId?: string;
  idempotencyKey: string;
}
export function signedReceivableAmount(type: RetailReceivableEntryType, amount: number): number;
export async function postReceivableEntry(scope: RetailBranchScope, input: PostReceivableEntryInput, actor: any, session: ClientSession): Promise<IRetailReceivableEntry>;
```

- [ ] Add failing tests for signed amounts, integer validation, required adjustment reason, unique idempotency, one reversal per entry and absence of update/delete methods.
- [ ] Run `npx tsx --test server/modules/retail/services/retail-receivable-ledger.service.test.ts`; expect missing module failure.
- [ ] Implement schema/index/service, then post `charge` on confirmation, `payment` on collection and reversing entries on cancellation inside the existing order transaction.
- [ ] Extend order service tests to assert ledger calls use deterministic keys and the same session; run both test files until green.
- [ ] Commit with `git commit -m "feat: add retail receivable ledger"`.

### Task 5: Ledger queries, adjustment API and customer UI

**Files:**
- Create: `server/modules/retail/controllers/retail-receivable.controller.ts`
- Create: `server/modules/retail/routes/retail-receivable.routes.ts`
- Modify: `server/modules/retail/router.ts`
- Create: `server/modules/retail/services/retail-receivable-query.service.ts`
- Create: `server/modules/retail/services/retail-receivable-query.service.test.ts`
- Create: `src/modules/retail/api/retailReceivables.api.ts`
- Create: `src/modules/retail/components/customers/RetailReceivableHistory.tsx`
- Create: `src/modules/retail/components/customers/RetailReceivableHistory.test.tsx`
- Modify: `src/modules/retail/pages/RetailCustomersPage.tsx`
- Modify: `src/modules/retail/types.ts`

**Interfaces:**

```ts
GET /retail/receivables/customers/:customerId?type=&from=&to=&page=&limit=
POST /retail/receivables/adjustments
POST /retail/receivables/:entryId/reversal
```

- [ ] Write failing backend tests for branch/customer scope, running balance, pagination and manager-only mutation; write failing UI tests for filters, adjustment confirmation and error states.
- [ ] Run the two target runners; expect route/component failures.
- [ ] Implement query/controller/routes/API/component with server-derived scope and manager guard on adjustment/reversal.
- [ ] Re-run target tests and all Task 4 ledger tests.
- [ ] Commit with `git commit -m "feat: expose retail receivable history"`.

### Task 6: Reconciliation and ledger backfill

**Files:**
- Create: `server/modules/retail/models/retail-receivable-reconciliation.model.ts`
- Create: `server/modules/retail/services/retail-receivable-reconciliation.service.ts`
- Create: `server/modules/retail/services/retail-receivable-reconciliation.service.test.ts`
- Create: `server/scripts/backfill-retail-receivables.ts`
- Create: `server/scripts/backfill-retail-receivables.test.ts`
- Modify: `server/modules/retail/routes/retail-receivable.routes.ts`
- Create: `src/modules/retail/components/customers/RetailReceivableReconciliation.tsx`

**Interfaces:**

```ts
export interface ReconciliationDifference { orderId: string; snapshotDue: number; ledgerDue: number; difference: number }
export async function reconcileRetailReceivables(scope: RetailBranchScope, actor: any): Promise<IRetailReceivableReconciliation>;
```

- [ ] Add failing tests proving reconciliation reports but never mutates orders, and backfill defaults to dry-run with deterministic entry keys.
- [ ] Run target Node tests; expect missing modules.
- [ ] Implement run/result persistence, manager endpoints, UI result table and CLI flags `--dry-run`/`--apply` where absence of `--apply` cannot write.
- [ ] Run fixture dry-run and assert created count remains zero; run milestone gate.
- [ ] Commit with `git commit -m "feat: reconcile retail receivables"`.

## Milestone 3 — Báo cáo

### Task 7: Report dimensions and product metrics

**Files:**
- Modify: `server/modules/retail/interfaces/retail-order.interface.ts`
- Modify: `server/modules/retail/models/retail-order.model.ts`
- Modify: `server/modules/retail/services/retail-product.service.ts`
- Modify: `server/modules/retail/services/retail-order.service.ts`
- Modify: `server/modules/retail/services/retail-report-metrics.ts`
- Modify: `server/modules/retail/services/retail-report-metrics.test.ts`
- Modify: `server/modules/retail/services/retail-report.service.ts`
- Modify: `server/modules/retail/services/retail-report.service.test.ts`

**Interfaces:**

```ts
export interface RetailProductReportRow { productId: string; sku: string; productName: string; category?: string; brand?: string; netQuantity: number; netSales: number; profit?: number }
```

- [ ] Add failing reducer/repository tests for product, SKU, category, brand, salesperson filters and deterministic top/slow sorting.
- [ ] Run target Node tests; expect missing filter/row fields.
- [ ] Snapshot `brand` and normalized category at order creation; extend aggregation/reducer while preserving operator profit redaction.
- [ ] Re-run target tests and order tests.
- [ ] Commit with `git commit -m "feat: report retail product performance"`.

### Task 8: Report filters, tables and export

**Files:**
- Modify: `server/modules/retail/services/retail-report-export.service.ts`
- Modify: `server/modules/retail/services/retail-report-export.service.test.ts`
- Modify: `server/service/analytics.service.ts`
- Modify: `server/service/analytics-revenue.test.ts`
- Modify: `src/modules/retail/api/retailReports.api.ts`
- Modify: `src/modules/retail/api/retailReports.api.test.ts`
- Modify: `src/modules/retail/components/reports/RetailReportFilters.tsx`
- Modify: `src/modules/retail/components/reports/RetailReportTables.tsx`
- Modify: `src/modules/retail/pages/RetailReportsPage.tsx`
- Modify: `src/modules/retail/pages/RetailReportsPage.test.tsx`
- Modify: `src/modules/retail/types.ts`

**Interfaces:**

```ts
export interface RetailReportFilters { from: string; to: string; salespersonId?: string; productId?: string; sku?: string; category?: string; brand?: string }
export interface RetailAnalyticsReconciliation { retailNetSales: number; analyticsNetSales: number; difference: number; matched: boolean }
```

- [ ] Add failing API/UI/export tests proving filters survive URL/export, top/slow tables show the selected range, spreadsheet formula escaping remains active and operators never receive profit; add a failing service test that returns both Retail and Analytics net sales plus their difference without mutating either source.
- [ ] Run target Vitest and Node tests; expect missing controls/worksheets.
- [ ] Implement filter controls, query whitelist, report tables, two product worksheets and a read-only `RetailAnalyticsReconciliation` result using the exact interfaces above.
- [ ] Re-run tests and the milestone gate.
- [ ] Commit with `git commit -m "feat: complete retail product reports"`.

## Milestone 4 — Phân hạng VIP

### Task 9: Evaluation window and automatic refresh job

**Files:**
- Modify: `server/modules/retail/interfaces/retail-settings.interface.ts`
- Modify: `server/modules/retail/models/retail-settings.model.ts`
- Modify: `server/modules/retail/services/retail-settings.service.ts`
- Create: `server/modules/retail/models/retail-customer-tier-job.model.ts`
- Create: `server/modules/retail/services/retail-customer-tier.service.ts`
- Create: `server/modules/retail/services/retail-customer-tier.service.test.ts`
- Modify: `server/modules/retail/services/retail-order.service.ts`

**Interfaces:**

```ts
export type RetailTierEvaluationWindow = { type: "lifetime" } | { type: "rolling12Months" } | { type: "custom"; from: string; to: string };
export async function enqueueTierRefresh(scope: RetailBranchScope, customerId: string, sourceKey: string, session: ClientSession): Promise<void>;
export async function processTierRefreshJob(jobId: string): Promise<void>;
```

- [ ] Add failing tests for all three windows, refund/cancel exclusion, unique source key and retry-safe history.
- [ ] Run target Node tests; expect missing service/types.
- [ ] Implement settings validation, unique job model, enqueue inside transaction and post-commit processing entry point.
- [ ] Re-run tests including customer/order services.
- [ ] Commit with `git commit -m "feat: refresh retail tiers after sales"`.

### Task 10: Manual override, timeline and tier analytics

**Files:**
- Modify: `server/modules/retail/models/retail-customer-tier-history.model.ts`
- Modify: `server/modules/retail/services/retail-customer.service.ts`
- Modify: `server/modules/retail/services/retail-customer.service.test.ts`
- Modify: `server/modules/retail/controllers/retail-customer.controller.ts`
- Modify: `server/modules/retail/routes/retail-customer.routes.ts`
- Modify: `src/modules/retail/api/retailCustomers.api.ts`
- Create: `src/modules/retail/components/customers/RetailCustomerTierPanel.tsx`
- Create: `src/modules/retail/components/customers/RetailCustomerTierPanel.test.tsx`
- Modify: `src/modules/retail/pages/RetailCustomersPage.tsx`
- Modify: `src/modules/retail/types.ts`

**Interfaces:**

```ts
POST /retail/customers/:id/tier-overrides
GET /retail/customers/:id/tier-history
GET /retail/customers/tier-summary?from=&to=&tier=
```

- [ ] Add failing tests for manager-only override, reason/dates, expiry fallback, tier filters and summary counts/net sales/frequency.
- [ ] Run target Node/Vitest tests; expect missing endpoints/panel.
- [ ] Extend history schema with source/effective interval/actor, implement endpoints and panel, and add tier filter to customer list.
- [ ] Re-run tests and milestone gate.
- [ ] Commit with `git commit -m "feat: complete retail customer tiers"`.

## Milestone 5 — Nhắc công nợ

### Task 11: Reminder settings, run and delivery logs

**Files:**
- Modify: `server/modules/retail/interfaces/retail-settings.interface.ts`
- Modify: `server/modules/retail/models/retail-settings.model.ts`
- Create: `server/modules/retail/models/retail-debt-reminder-run.model.ts`
- Create: `server/modules/retail/models/retail-debt-reminder-delivery.model.ts`
- Modify: `server/modules/retail/services/retail-debt-reminder.service.ts`
- Modify: `server/modules/retail/services/retail-debt-reminder.service.test.ts`

**Interfaces:**

```ts
export interface RetailDebtReminderSettings { enabled: boolean; frequencyHours: number; overdueDays: number; recipientUserIds: string[]; recipientRoles: string[]; emailEnabled: boolean; maxAttempts: number }
```

- [ ] Add failing tests for validation, configuration snapshot, run statistics, unique cycle delivery and temporary/permanent failure classification.
- [ ] Run reminder/settings Node tests; expect missing models/fields.
- [ ] Implement schemas/indexes and refactor the scheduler to create run/delivery records before dispatch.
- [ ] Re-run tests.
- [ ] Commit with `git commit -m "feat: track retail debt reminder runs"`.

### Task 12: SMTP adapter and bounded retry

**Files:**
- Create: `server/modules/retail/services/retail-reminder-mailer.ts`
- Create: `server/modules/retail/services/retail-reminder-mailer.test.ts`
- Create: `server/modules/retail/services/retail-reminder-retry.service.ts`
- Create: `server/modules/retail/services/retail-reminder-retry.service.test.ts`
- Modify: `server.ts`

**Interfaces:**

```ts
export interface RetailReminderMailer { send(input: { to: string; subject: string; text: string }): Promise<{ messageId: string }> }
export function nextReminderAttemptAt(attempt: number, now: Date): Date;
```

- [ ] Add failing tests for SMTP configuration redaction, deterministic exponential backoff, max attempts and no retry for permanent errors.
- [ ] Run target tests; expect missing adapters.
- [ ] Implement a Nodemailer adapter from environment configuration and hourly retry worker protected by atomic delivery claims.
- [ ] Re-run tests and confirm logs never contain SMTP password.
- [ ] Commit with `git commit -m "feat: email retail debt reminders"`.

### Task 13: Reminder configuration/history UI

**Files:**
- Create: `server/modules/retail/controllers/retail-debt-reminder.controller.ts`
- Create: `server/modules/retail/routes/retail-debt-reminder.routes.ts`
- Modify: `server/modules/retail/router.ts`
- Create: `src/modules/retail/api/retailDebtReminders.api.ts`
- Create: `src/modules/retail/pages/RetailDebtRemindersPage.tsx`
- Create: `src/modules/retail/pages/RetailDebtRemindersPage.test.tsx`
- Modify: `src/modules/retail/RetailWorkspace.tsx`
- Modify: `src/modules/retail/retailTabPermissions.ts`
- Modify: `src/modules/retail/retailTabPermissions.test.ts`

**Interfaces:**

```ts
GET /retail/debt-reminders/runs
GET /retail/debt-reminders/runs/:id
POST /retail/debt-reminders/run
POST /retail/debt-reminders/deliveries/:id/retry
```

- [ ] Add failing route/UI tests for manager access, run list/detail, manual run, eligible retry and error/loading/empty states.
- [ ] Run target tests; expect missing page/routes.
- [ ] Implement route/controller/API/page and reuse the existing manage permission instead of adding a new permission.
- [ ] Re-run tests and milestone gate.
- [ ] Commit with `git commit -m "feat: manage retail debt reminders"`.

## Milestone 6 — POS, barcode và offline

### Task 14: POS shortcuts and scan feedback

**Files:**
- Create: `src/modules/retail/hooks/useRetailPosShortcuts.ts`
- Create: `src/modules/retail/hooks/useRetailPosShortcuts.test.tsx`
- Create: `src/modules/retail/hooks/retailScannerInput.ts`
- Create: `src/modules/retail/hooks/retailScannerInput.test.ts`
- Create: `src/modules/retail/components/pos/PosShortcutHelp.tsx`
- Create: `src/modules/retail/components/pos/ScanFeedback.tsx`
- Modify: `src/modules/retail/pages/RetailPosPage.tsx`
- Modify: `src/modules/retail/pages/RetailPosPage.test.tsx`

**Interfaces:**

```ts
export interface RetailPosShortcutActions { focusSearch(): void; openPayment(): void; holdDraft(): void; openScanner(): void; openHelp(): void }
export function createHidScannerBuffer(options: { timeoutMs: number; minLength: number; onScan(code: string): void }): { keydown(event: KeyboardEvent): void; reset(): void };
```

- [ ] Add failing tests for shortcuts, ignoring editable fields, HID Enter termination, timeout reset, and text/icon/audio feedback for success/not-found/duplicate.
- [ ] Run target Vitest files; expect missing hooks/components.
- [ ] Implement hooks/components with audio generated from Web Audio API and a silent fallback when unavailable.
- [ ] Re-run tests.
- [ ] Commit with `git commit -m "feat: improve retail pos scanning"`.

### Task 15: IndexedDB queue adapter

**Files:**
- Create: `src/modules/retail/offline/retailOfflineQueue.ts`
- Create: `src/modules/retail/offline/retailOfflineQueue.test.ts`
- Create: `src/modules/retail/offline/retailOfflineSync.ts`
- Create: `src/modules/retail/offline/retailOfflineSync.test.ts`

**Interfaces:**

```ts
export type RetailOfflineStatus = "pending" | "syncing" | "failed" | "synced";
export interface RetailOfflineOrder { id: string; companyCode: string; branchId: string; userId: string; idempotencyKey: string; payload: unknown; status: RetailOfflineStatus; attempts: number; lastError?: string; createdAt: string; updatedAt: string }
export interface RetailOfflineQueue { put(item: RetailOfflineOrder): Promise<void>; list(scope: RetailScope & { userId: string }): Promise<RetailOfflineOrder[]>; claimNext(scope: RetailScope & { userId: string }): Promise<RetailOfflineOrder | null>; update(id: string, patch: Partial<RetailOfflineOrder>): Promise<void>; remove(id: string): Promise<void> }
```

- [ ] Add failing tests using a small fake IndexedDB implementation for schema upgrade, scope isolation, FIFO atomic claim and stable idempotency key.
- [ ] Run target Vitest files; expect missing modules.
- [ ] Implement native IndexedDB adapter and sync coordinator that queries idempotency status before resending ambiguous `syncing` items.
- [ ] Re-run tests.
- [ ] Commit with `git commit -m "feat: queue retail orders offline"`.

### Task 16: Offline POS integration and queue panel

**Files:**
- Create: `src/modules/retail/components/pos/RetailOfflineQueuePanel.tsx`
- Create: `src/modules/retail/components/pos/RetailOfflineQueuePanel.test.tsx`
- Modify: `src/modules/retail/pages/RetailPosPage.tsx`
- Modify: `src/modules/retail/pages/RetailPosPage.test.tsx`
- Modify: `src/modules/retail/api/retailOrders.api.ts`
- Modify: `src/modules/retail/types.ts`

**Interfaces:**

```ts
export interface RetailOfflineSyncResult { itemId: string; status: "synced" | "failed"; orderId?: string; invoiceId?: string; error?: string }
```

- [ ] Add failing UI tests proving network failure queues the fixed payload, labels it “Chờ đồng bộ”, reconnect syncs FIFO, business errors remain failed, retry/remove are scoped, and no success dialog appears before server acceptance.
- [ ] Run target Vitest tests; expect missing queue panel/integration.
- [ ] Integrate the queue with POS submit/reconnect lifecycle and render status counts, last error, retry and remove draft actions.
- [ ] Re-run tests, then execute the final gate below.
- [ ] Commit with `git commit -m "feat: complete retail pos offline flow"`.

## Milestone and Final Gates

After every milestone, and once more after Task 16:

```powershell
npx vitest run src/modules/retail src/config/retail-default-modules.test.ts
npx tsx --test server/modules/retail/**/*.test.ts server/config/retail-module-access.test.ts
npm run typecheck
npm run build
git diff --check
```

Expected results: both test commands exit `0` with zero failures; typecheck and build exit `0`; `git diff --check` prints nothing. If a command fails, stop the milestone and use `superpowers:systematic-debugging` before changing production code.

For migration verification:

```powershell
npx tsx server/scripts/backfill-retail-receivables.ts --dry-run --company TEST --branch TEST
```

Expected result: summary prints scanned/convertible/skipped/error counts and explicitly reports `writes: 0`.

## Final Documentation

- Update `docs/retail-cac-phan-chua-hoan-thanh.md` only after final gates pass, moving each completed item out of “một phần”.
- Add SMTP environment names, scheduler behavior, retry policy, PDF font license, offline queue recovery and migration dry-run instructions to `docs/dac-ta-api-fe-retail.md`.
- Record real SMTP/HID device validation separately. Automated adapter tests do not claim real-environment certification.
