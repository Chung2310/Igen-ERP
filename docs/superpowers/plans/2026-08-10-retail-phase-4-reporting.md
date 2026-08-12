# Retail Phase 4 Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm dashboard và Excel báo cáo retail theo chi nhánh cho doanh thu, thanh toán, ca, thu ngân và công nợ, với dữ liệu lợi nhuận chỉ dành cho manager.

**Architecture:** Backend chuẩn hóa một bộ lọc ngày và tổng hợp order/shift theo branch scope, sau đó project response theo capability. Dashboard và export dùng chung report model để bảo đảm số liệu khớp; frontend chỉ hiển thị dữ liệu backend và không tự tính lại chỉ số nghiệp vụ.

**Tech Stack:** Express, Mongoose aggregation, TypeScript, React 19, lightweight SVG/CSS charts, SheetJS `xlsx`, Node test runner, Vitest/Testing Library, Tailwind CSS.

## Global Constraints

- Không thêm permission ngoài `retail:operate` và `retail:manager`.
- Mọi dữ liệu chỉ thuộc chi nhánh đang chọn; không tổng hợp toàn công ty.
- Operator không được nhận cost, gross profit hoặc margin trong JSON và Excel.
- Khoảng báo cáo tính bằng `businessDate` Việt Nam và tối đa 366 ngày.
- Dashboard không polling; chỉ tải khi mở tab, đổi lọc hoặc bấm tải lại.
- Không tạo collection tổng hợp, báo cáo tùy biến, AI forecast, tồn kho nâng cao hoặc tích hợp thiết bị.

---

### Task 1: Chuẩn hóa khoảng ngày báo cáo

**Files:**
- Create: `server/modules/retail/services/retail-report-range.ts`
- Test: `server/modules/retail/services/retail-report-range.test.ts`

**Interfaces:**
- Produces: `parseRetailReportRange(input, today?): { from: string; to: string; days: string[] }`.

- [ ] **Step 1: Viết test đỏ cho mặc định hôm nay, preset 7/30 ngày, ngày nhuận và danh sách ngày bao gồm hai đầu**

```ts
assert.deepEqual(parseRetailReportRange({}, "2026-08-10"), { from: "2026-08-10", to: "2026-08-10", days: ["2026-08-10"] });
assert.equal(parseRetailReportRange({ preset: "7d" }, "2026-08-10").from, "2026-08-04");
```

- [ ] **Step 2: Thêm test đỏ cho sai `YYYY-MM-DD`, đảo ngày và khoảng 367 ngày**
- [ ] **Step 3: Chạy `node --import tsx --test server/modules/retail/services/retail-report-range.test.ts` và xác nhận FAIL do module chưa tồn tại**
- [ ] **Step 4: Cài parser dùng UTC date arithmetic để không lệch timezone và lỗi có `status: 400`**
- [ ] **Step 5: Chạy lại test, xác nhận PASS và commit `feat: validate retail report date ranges`**

### Task 2: Tổng hợp report model thuần và bảo vệ dữ liệu manager

**Files:**
- Create: `server/modules/retail/services/retail-report-metrics.ts`
- Test: `server/modules/retail/services/retail-report-metrics.test.ts`

**Interfaces:**
- Consumes: normalized order/shift rows và `days` từ Task 1.
- Produces: `buildRetailReportModel({ orders, shifts, days, today, includeProfit }): RetailReportModel`.
- Produces: `projectRetailReportForCapability(model, includeProfit)` loại bỏ ba trường nhạy cảm thay vì đặt bằng 0.

- [ ] **Step 1: Viết test đỏ cho gross/refund/net sales, active order count, average order, collected và due**
- [ ] **Step 2: Thêm test đơn cancelled có `orderCode` đối ứng gross và refund về net 0, còn expired draft bị loại**
- [ ] **Step 3: Thêm test payment mix chỉ cộng `amount`, time series bù ngày trống, cashier sorting ổn định**
- [ ] **Step 4: Thêm test debt grouping và overdue/due-today/upcoming theo `today`**
- [ ] **Step 5: Thêm test operator object không có `totalCost`, `grossProfit`, `grossMarginPercent`; manager có đúng giá trị**
- [ ] **Step 6: Chạy test để xác nhận RED, cài các pure reducer nhỏ rồi chạy GREEN**
- [ ] **Step 7: Commit `feat: calculate retail reporting metrics`**

### Task 3: Repository, service và API báo cáo theo branch

**Files:**
- Create: `server/modules/retail/services/retail-report.service.ts`
- Create: `server/modules/retail/services/retail-report.service.test.ts`
- Create: `server/modules/retail/controllers/retail-report.controller.ts`
- Create: `server/modules/retail/routes/retail-report.routes.ts`
- Modify: `server/modules/retail/router.ts`
- Modify: `server/modules/retail/models/retail-order.model.ts`

**Interfaces:**
- Produces: `RetailReportService.summary(scope, query, includeProfit)`.
- Endpoint: `GET /retail/reports/summary?companyCode&branchId&from&to&preset`.

- [ ] **Step 1: Viết test pipeline builder bắt đầu bằng `$match: { companyCode, branchId, businessDate }` và không nhận scope từ body**
- [ ] **Step 2: Viết route contract test operator/manager đều dùng endpoint nhưng controller truyền `includeProfit` từ `hasEffectiveRetailCapability(actor, "manager")`**
- [ ] **Step 3: Chạy test và xác nhận RED**
- [ ] **Step 4: Cài repository query với `.lean()`/aggregation chỉ project các trường report cần; bổ sung index `{ companyCode: 1, branchId: 1, businessDate: 1, status: 1 }` nếu index hiện tại không khớp chiều query**
- [ ] **Step 5: Mount route sau authentication/module guard sẵn có, dùng operate middleware hiện tại**
- [ ] **Step 6: Chạy backend retail tests và typecheck, xác nhận PASS**
- [ ] **Step 7: Commit `feat: expose branch retail reporting api`**

### Task 4: Excel export an toàn và đúng quyền

**Files:**
- Create: `server/modules/retail/services/retail-report-export.service.ts`
- Create: `server/modules/retail/services/retail-report-export.service.test.ts`
- Modify: `server/modules/retail/controllers/retail-report.controller.ts`
- Modify: `server/modules/retail/routes/retail-report.routes.ts`

**Interfaces:**
- Produces: `buildRetailReportWorkbook(model, { includeProfit, branchCode }): { buffer: Buffer; filename: string }`.
- Endpoint: `GET /retail/reports/export` trả MIME XLSX và attachment filename.

- [ ] **Step 1: Viết test đỏ đọc workbook buffer bằng SheetJS và kiểm tra 6 sheet đúng thứ tự**
- [ ] **Step 2: Thêm test operator workbook không có nhãn/cột lợi nhuận, manager workbook có; tiền là cell number**
- [ ] **Step 3: Thêm test `escapeSpreadsheetCell("=CMD()") === "'=CMD()"` cho `=`, `+`, `-`, `@`**
- [ ] **Step 4: Chạy test xác nhận RED; cài workbook builder dùng `XLSX.utils.aoa_to_sheet` và `XLSX.write(..., { type: "buffer" })`**
- [ ] **Step 5: Controller lấy branch code từ branch model đã scope, không tin query filename; export gọi cùng summary service**
- [ ] **Step 6: Chạy test và typecheck, xác nhận PASS; commit `feat: export protected retail reports`**

### Task 5: Frontend types, API và quyền subtab Báo cáo

**Files:**
- Modify: `src/modules/retail/types.ts`
- Create: `src/modules/retail/api/retailReports.api.ts`
- Create: `src/modules/retail/api/retailReports.api.test.ts`
- Modify: `src/modules/retail/retailTabPermissions.ts`
- Modify: `src/modules/retail/retailTabPermissions.test.ts`
- Modify: `src/modules/retail/RetailWorkspace.tsx`

**Interfaces:**
- Produces: `RetailReport`, `RetailReportFilters`, `retailReportsApi.summary(scope, filters)` và `retailReportsApi.export(scope, filters)`.
- Adds tab slug `bao-cao` cho operate và manager.

- [ ] **Step 1: Viết test đỏ tab permissions chứng minh operator và manager đều thấy `bao-cao`, chỉ manager thấy `cai-dat`**
- [ ] **Step 2: Viết API test kiểm tra params luôn gồm scope; export dùng authenticated `fetch` theo pattern `src/services/analyticsService.ts`, xử lý blob/content-disposition và lỗi API**
- [ ] **Step 3: Chạy Vitest xác nhận RED**
- [ ] **Step 4: Thêm types/API, lazy `RetailReportsPage`, icon chart và route mapping trong workspace**
- [ ] **Step 5: Chạy test và typecheck xác nhận PASS; commit `feat: register retail reporting workspace`**

### Task 6: Dashboard filters, KPIs, charts và tables

**Files:**
- Create: `src/modules/retail/pages/RetailReportsPage.tsx`
- Create: `src/modules/retail/pages/RetailReportsPage.test.tsx`
- Create: `src/modules/retail/components/reports/RetailReportFilters.tsx`
- Create: `src/modules/retail/components/reports/RetailKpiGrid.tsx`
- Create: `src/modules/retail/components/reports/RetailSalesCharts.tsx`
- Create: `src/modules/retail/components/reports/RetailReportTables.tsx`

**Interfaces:**
- Page consumes `RetailReport` from Task 5; child components are presentational and never recompute backend metrics.

- [ ] **Step 1: Viết page test đỏ cho mặc định hôm nay, preset 7/30 ngày, custom range và reload giữ filter**
- [ ] **Step 2: Thêm test operator không render giá vốn/lợi nhuận/tỷ suất khi API không trả trường; manager render khi có**
- [ ] **Step 3: Thêm test empty state có KPI 0, error giữ dữ liệu cũ, export failure không xóa dashboard**
- [ ] **Step 4: Chạy test xác nhận RED**
- [ ] **Step 5: Cài filter/header và fetch state với request sequence để response cũ không ghi đè response mới**
- [ ] **Step 6: Cài KPI grid, biểu đồ SVG/CSS không thêm dependency, payment mix và ba bảng cashier/shift/debt với responsive overflow**
- [ ] **Step 7: Cài skeleton theo khối, retry và export download; chạy test/typecheck xác nhận PASS**
- [ ] **Step 8: Commit `feat: add retail branch reporting dashboard`**

### Task 7: Hồi quy và cổng hoàn tất

**Files:**
- Modify only when a failing test proves a defect: files from Tasks 1–6.

**Interfaces:**
- Không tạo interface production mới.

- [ ] **Step 1: Chạy toàn bộ backend retail tests và sửa tối thiểu cho đến 0 failure**

```powershell
node --import tsx --test --test-force-exit server/modules/retail/services/*.test.ts server/modules/retail/models/*.test.ts server/modules/retail/contracts.test.ts server/config/retail-module-access.test.ts server/router/module-route-guards.test.ts server/config/business-types.test.ts server/service/auth-register-modules.test.ts
```

- [ ] **Step 2: Chạy `npx vitest run src/modules/retail src/config/retail-default-modules.test.ts src/modules/shared/lib/apiFetch.test.ts src/router/business-module-routes.test.tsx src/modules/business-module-isolation.test.ts`**
- [ ] **Step 3: Chạy `npm run typecheck`, `npm run build`, `git diff --check`**
- [ ] **Step 4: Chạy `rg -n 'retail:(read|sell|discount|cancel|cost|return|report)' server src` và xác nhận không sinh permission mới**
- [ ] **Step 5: Rà JSON/Excel fixtures để xác nhận operator không có cost/profit/margin**
- [ ] **Step 6: Commit `test: cover retail phase four reporting` nếu có thay đổi test cuối**
