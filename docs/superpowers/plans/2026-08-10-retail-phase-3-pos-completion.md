# Retail Phase 3 POS Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện POS với khách hàng, giảm giá, thuế, phí vận chuyển, kết quả giao dịch và bản in hóa đơn trình duyệt.

**Architecture:** Mở rộng reducer giỏ hàng thành nguồn trạng thái nhập liệu duy nhất ở frontend, còn `RetailOrderService` và `calculateOrderTotals` tiếp tục là nguồn tính tiền chính thức. Chia UI thành các component nhỏ cho khách hàng, điều chỉnh đơn và kết quả/in hóa đơn; mọi lần giữ hoặc thanh toán đều gửi cùng một payload chuẩn hóa.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Express, Mongoose, Node test runner, Tailwind CSS.

## Global Constraints

- Không thêm permission retail mới; `retail:manager` vẫn dành cho quản lý và cài đặt.
- Khách hàng dùng chung toàn công ty và không có trạng thái kích hoạt.
- Backend là nguồn tính tiền chính thức; frontend chỉ hiển thị dự kiến.
- VND là số nguyên; thuế từ 0 đến 100 với tối đa hai chữ số thập phân.
- Không tích hợp máy in chuyên dụng, dashboard, báo cáo nâng cao hoặc tồn kho chuyên sâu.

---

### Task 1: Chuẩn hóa kiểu dữ liệu và payload POS

**Files:**
- Modify: `src/modules/retail/types.ts`
- Modify: `src/modules/retail/hooks/retailCart.ts`
- Test: `src/modules/retail/hooks/retailCart.test.ts`

**Interfaces:**
- Produces: `RetailDiscountInput`, `RetailOrderInput`, `RetailOrderResult`, cart state chứa `customer`, `orderDiscount`, `taxRate`, `shippingFee` và line discount.

- [ ] **Step 1: Viết test thất bại cho state điều chỉnh và khôi phục draft**

```ts
it("keeps line and order adjustments while loading a held draft", () => {
  const state = retailCartReducer(empty, {
    type: "load",
    lines: [{ product, quantity: 2, discount: { type: "percent", value: 10 } }],
    orderDiscount: { type: "amount", value: 5_000 },
    taxRate: 8,
    shippingFee: 20_000,
  });
  expect(state.lines[0].discount.value).toBe(10);
  expect(state.shippingFee).toBe(20_000);
});
```

- [ ] **Step 2: Chạy `npx vitest run src/modules/retail/hooks/retailCart.test.ts` và xác nhận FAIL do action/state chưa có trường mới**
- [ ] **Step 3: Thêm type và reducer action `lineDiscount`, `orderDiscount`, `taxRate`, `shippingFee`, `customer`, `load`, `reset`**
- [ ] **Step 4: Chạy lại test và xác nhận PASS**
- [ ] **Step 5: Commit `feat: model retail pos adjustments`**

### Task 2: Bảo đảm backend lưu khách hàng và invoice snapshot đầy đủ

**Files:**
- Modify: `server/modules/retail/services/retail-order.service.ts`
- Modify: `server/modules/retail/services/retail-invoice.service.ts`
- Modify: `server/modules/retail/interfaces/retail-invoice.interface.ts`
- Modify: `server/modules/retail/models/retail-invoice.model.ts`
- Test: `server/modules/retail/services/retail-order.service.test.ts`
- Test: `server/modules/retail/services/retail-invoice.service.test.ts`

**Interfaces:**
- Consumes: `RetailOrderInput` tương đương payload frontend.
- Produces: draft có snapshot tên/số điện thoại khách ngay khi chọn; invoice snapshot có `taxRate`, `shippingFee`, payment rows, cashier và business date, không có `unitCost`.

- [ ] **Step 1: Viết test thất bại xác nhận khách hàng hợp lệ được tra theo `companyCode` cả khi đơn đã thanh toán đủ**
- [ ] **Step 2: Viết test thất bại xác nhận invoice snapshot có phí vận chuyển, thanh toán, thu ngân và loại bỏ giá vốn**
- [ ] **Step 3: Chạy `node --import tsx --test --test-force-exit server/modules/retail/services/retail-order.service.test.ts server/modules/retail/services/retail-invoice.service.test.ts` và xác nhận FAIL**
- [ ] **Step 4: Tạo helper `resolveOrderCustomer(scope, customerId, session)`; dùng khi create/update/confirm, xóa snapshot khách khi bỏ chọn**
- [ ] **Step 5: Mở rộng interface/schema/snapshot hóa đơn bằng các trường đã nêu, giữ snapshot immutable**
- [ ] **Step 6: Chạy lại hai file test và xác nhận PASS**
- [ ] **Step 7: Commit `feat: preserve retail customer and receipt snapshots`**

### Task 3: Xây dựng customer picker dùng chung công ty

**Files:**
- Create: `src/modules/retail/components/pos/CustomerPicker.tsx`
- Create: `src/modules/retail/components/pos/CustomerPicker.test.tsx`
- Reuse: `src/modules/retail/api/retailCustomers.api.ts`

**Interfaces:**
- Props: `{ scope: RetailScope; value: RetailCustomer | null; onChange(customer: RetailCustomer | null): void }`.

- [ ] **Step 1: Viết component test mock `retailCustomersApi.list` và kiểm tra debounce tìm theo tên/số điện thoại/mã**
- [ ] **Step 2: Thêm test chọn kết quả và nút “Bỏ chọn” trả `null`**
- [ ] **Step 3: Chạy `npx vitest run src/modules/retail/components/pos/CustomerPicker.test.tsx` và xác nhận FAIL do component chưa tồn tại**
- [ ] **Step 4: Cài component với combobox accessible, trạng thái loading/empty/error và debounce 200 ms**
- [ ] **Step 5: Chạy lại test và xác nhận PASS**
- [ ] **Step 6: Commit `feat: add retail pos customer picker`**

### Task 4: Xây dựng editor giảm giá và tổng kết đơn

**Files:**
- Create: `src/modules/retail/components/pos/DiscountInput.tsx`
- Create: `src/modules/retail/components/pos/OrderAdjustments.tsx`
- Create: `src/modules/retail/components/pos/OrderAdjustments.test.tsx`
- Modify: `src/modules/retail/hooks/retailCart.ts`

**Interfaces:**
- `DiscountInput` nhận `{ label, value, onChange }` và trả `{ type: "amount" | "percent"; value: number }`.
- `OrderAdjustments` nhận discount/thuế/phí cùng callback cập nhật.

- [ ] **Step 1: Viết test đổi loại giảm giá, nhập giá trị, thuế hai số thập phân và phí VND nguyên**
- [ ] **Step 2: Chạy test riêng và xác nhận FAIL**
- [ ] **Step 3: Cài input có `min=0`, percent `max=100`, chuẩn hóa số rỗng thành 0; lỗi backend vẫn do trang cha hiển thị**
- [ ] **Step 4: Chạy lại test và xác nhận PASS**
- [ ] **Step 5: Commit `feat: add retail order adjustment controls`**

### Task 5: Tích hợp payload thống nhất vào POS và draft

**Files:**
- Create: `src/modules/retail/hooks/retailOrderInput.ts`
- Create: `src/modules/retail/hooks/retailOrderInput.test.ts`
- Modify: `src/modules/retail/pages/RetailPosPage.tsx`
- Modify: `src/modules/retail/components/pos/PaymentDialog.tsx`
- Modify: `src/modules/retail/api/retailOrders.api.ts`

**Interfaces:**
- Produces: `buildRetailOrderInput(cart): RetailOrderInput` dùng chung cho quote/create/update.
- `PaymentDialog` nhận customer đã chọn thay vì ô nhập ID thô; chỉ nhận due date khi còn nợ.

- [ ] **Step 1: Viết test builder cho khách lẻ, khách chọn, giảm giá dòng/toàn đơn, thuế và phí**
- [ ] **Step 2: Chạy test builder và xác nhận FAIL**
- [ ] **Step 3: Cài builder thuần và type response confirm `{ order, invoice }`**
- [ ] **Step 4: Tách `RetailPosPage` thành các đoạn JSX dễ đọc; gắn CustomerPicker, line DiscountInput, OrderAdjustments và quote debounce**
- [ ] **Step 5: Khi mở draft, ánh xạ `discountAmount` thành amount discount và khôi phục order fields/customer snapshot; mọi save/checkout gọi builder duy nhất**
- [ ] **Step 6: Chạy test retail frontend và `npm run typecheck`**
- [ ] **Step 7: Commit `feat: complete retail pos order editing`**

### Task 6: Màn hình thành công và bản in hóa đơn

**Files:**
- Create: `src/modules/retail/components/pos/CheckoutSuccessDialog.tsx`
- Create: `src/modules/retail/components/pos/ReceiptPrintView.tsx`
- Create: `src/modules/retail/components/pos/ReceiptPrintView.test.tsx`
- Modify: `src/modules/retail/pages/RetailPosPage.tsx`
- Modify: `src/modules/retail/types.ts`

**Interfaces:**
- Props kết quả: `{ result: RetailOrderResult; onNewOrder(): void; onClose(): void }`.
- `ReceiptPrintView` chỉ nhận `RetailInvoice`, không nhận cart state.

- [ ] **Step 1: Viết test receipt hiển thị invoice snapshot và không render `unitCost`/giá vốn**
- [ ] **Step 2: Viết test success dialog hiển thị mã đơn, mã hóa đơn, tổng/đã thu/tiền thừa và gọi `window.print()`**
- [ ] **Step 3: Chạy hai test và xác nhận FAIL**
- [ ] **Step 4: Cài receipt semantic table và CSS `@media print`, khổ hẹp với fallback A4**
- [ ] **Step 5: Giữ confirm result trong POS; chỉ reset giỏ khi người dùng chọn “Đơn mới”, không reset trước khi có thể in**
- [ ] **Step 6: Chạy lại test và xác nhận PASS**
- [ ] **Step 7: Commit `feat: add retail checkout receipt printing`**

### Task 7: Kiểm thử tích hợp, hồi quy và hoàn thiện

**Files:**
- Create or Modify: `src/modules/retail/pages/RetailPosPage.test.tsx`
- Modify only if failures expose a defect: files from Tasks 1–6.

**Interfaces:**
- Verifies the complete POS flow without adding production interfaces.

- [ ] **Step 1: Viết integration test chọn khách, thêm hàng, chỉnh giảm giá/thuế/phí, nhận quote, thanh toán và mở receipt**
- [ ] **Step 2: Thêm test backend validation error không làm mất cart và idempotency recovery hiển thị kết quả đã hoàn tất**
- [ ] **Step 3: Chạy `npx vitest run src/modules/retail` và sửa tối thiểu cho đến PASS**
- [ ] **Step 4: Chạy toàn bộ backend retail tests bằng `node --import tsx --test --test-force-exit server/modules/retail/services/*.test.ts server/modules/retail/models/*.test.ts server/modules/retail/contracts.test.ts server/config/retail-module-access.test.ts server/router/module-route-guards.test.ts server/config/business-types.test.ts server/service/auth-register-modules.test.ts`**
- [ ] **Step 5: Chạy `npm run typecheck`, `npm run build`, `git diff --check` và xác nhận tất cả exit 0**
- [ ] **Step 6: Rà lại permission bằng `rg -n 'retail:(read|sell|discount|cancel|cost|return)' server src` và xác nhận không sinh quyền mới**
- [ ] **Step 7: Commit `test: cover retail phase three pos flow`**
