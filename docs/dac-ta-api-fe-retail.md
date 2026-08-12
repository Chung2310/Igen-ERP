# Đặc tả API & Frontend — Module `retail`

> Đi kèm `dac-ta-model-retail.md` (đặc tả dữ liệu). Tài liệu này đặc tả **tầng API** và **tầng giao diện**: file đặt ở đâu, viết theo cấu trúc nào, nối vào file nào đang có, tận dụng component nào.
>
> Mọi đường dẫn đều là đường dẫn thật trong repo. Mọi pattern đều lấy từ `worker-management` — module mới nhất và sạch nhất hiện có.

---

# PHẦN A — BACKEND

## A1. Cây thư mục đầy đủ

```
server/modules/retail/
├─ router.ts                                   # gom route con, export retailRouter
├─ permissions.ts                              # export hằng mã quyền
├─ contracts.ts                                # RetailScope + resolve scope từ request
├─ config/
│  └─ retail-settings.ts                       # ngưỡng lệch ca, cho bán âm, hạn đổi trả, prefix mã
├─ interfaces/
│  ├─ retail-order.interface.ts
│  ├─ retail-invoice.interface.ts
│  ├─ cashier-shift.interface.ts
│  ├─ sales-return.interface.ts
│  └─ product-serial.interface.ts
├─ models/
│  ├─ retail-order.model.ts
│  ├─ retail-order-counter.model.ts
│  ├─ retail-invoice.model.ts
│  ├─ cashier-shift.model.ts
│  ├─ sales-return.model.ts
│  └─ product-serial.model.ts
├─ middlewares/
│  ├─ validate.middleware.ts                   # COPY NGUYÊN từ worker-management
│  └─ require-open-shift.middleware.ts         # A6 — chặn thao tác bán khi chưa mở ca
├─ validations/
│  ├─ retail-order.validation.ts
│  ├─ cashier-shift.validation.ts
│  ├─ sales-return.validation.ts
│  └─ common.validation.ts                     # objectIdSchema, idParamSchema, datePattern
├─ services/
│  ├─ retail-pricing.service.ts                # NGUỒN TÍNH TIỀN DUY NHẤT — thuần, không I/O
│  ├─ retail-order.service.ts                  # vòng đời đơn
│  ├─ retail-stock.service.ts                  # A3 — sinh StockLog idempotent
│  ├─ retail-invoice.service.ts                # A2 — phát hành, void, render
│  ├─ cashier-shift.service.ts                 # A6
│  ├─ sales-return.service.ts                  # A13
│  ├─ serial-tracking.service.ts               # B8
│  └─ thermal-print.service.ts                 # B3/B4 — dựng payload ESC/POS
├─ controllers/
│  ├─ retail-order.controller.ts
│  ├─ retail-invoice.controller.ts
│  ├─ cashier-shift.controller.ts
│  ├─ sales-return.controller.ts
│  └─ product-serial.controller.ts
├─ routes/
│  ├─ retail-order.routes.ts
│  ├─ retail-invoice.routes.ts
│  ├─ cashier-shift.routes.ts
│  ├─ sales-return.routes.ts
│  └─ product-serial.routes.ts
└─ utils/
   └─ order-code.ts                            # cấp mã nguyên tử qua counter
```

**Quy tắc phân tầng** (bám đúng `worker-management`):

| Tầng | Được làm | Cấm |
|---|---|---|
| `routes/` | khai báo path, gắn `requirePermission`, gắn `validate(schema)` | chứa logic |
| `controllers/` | lấy scope, gọi service, `res.json({ success, data })` | truy vấn Mongoose trực tiếp |
| `services/` | toàn bộ nghiệp vụ + truy vấn DB | đụng `req`/`res` |
| `models/` | schema + index | logic nghiệp vụ |

Controller **không** try/catch rồi tự trả lỗi — `next(error)` để `server/middleware/api-error-handler.ts` xử lý (giống `WorkerProjectController`).

---

## A2. Nối vào hệ thống — 6 file phải sửa

### 1) `server/config/module-keys.ts`

```ts
export const MODULE_KEYS = [
  "hr", "inventory", "resource", "chat", "student", "worker", "customer", "candidate",
  "retail",                              // ← thêm
] as const;
```

### 2) `src/config/modules.ts` — phải sửa **cùng lúc**

File này có comment `/** Đồng bộ với server/config/module-keys.ts */`. Thêm `"retail"` vào `MODULE_KEYS`, rồi bổ sung 4 map:

```ts
MODULE_LABELS.retail        = "Bán lẻ & POS";
MODULE_TAB_MAP.retail       = "BÁN LẺ";
TAB_MODULE_MAP["BÁN LẺ"]    = "retail";
MODULE_READ_PERMISSIONS["BÁN LẺ"] = ["retail:read", "retail:sell"];
```

Test đang canh: `src/modules/business-module-isolation.test.ts`, `src/router/business-module-routes.test.tsx`.

### 3) `server/config/permission-catalog.ts`

Thêm vào mảng `PERMISSION_CATALOG` (giữ đúng dạng `{ code, label, group }`):

```ts
{ code: "retail:read",             label: "Xem đơn bán lẻ",              group: "Bán lẻ" },
{ code: "retail:sell",             label: "Bán hàng tại quầy",           group: "Bán lẻ" },
{ code: "retail:discount",         label: "Áp giảm giá vượt hạn mức",    group: "Bán lẻ" },
{ code: "retail:cancel",           label: "Hủy đơn đã xác nhận",         group: "Bán lẻ" },
{ code: "retail:cancel-completed", label: "Hủy đơn đã hoàn tất",         group: "Bán lẻ", description: "Quyền nhạy cảm — đảo cả kho, công nợ và hoa hồng." },
{ code: "retail:cost:read",        label: "Xem giá vốn & lợi nhuận",     group: "Bán lẻ" },
{ code: "shift:operate",           label: "Mở/đóng ca thu ngân",         group: "Bán lẻ" },
{ code: "shift:approve",           label: "Duyệt chênh lệch ca",         group: "Bán lẻ", description: "Ca trưởng xác nhận chênh lệch tiền mặt cuối ca." },
{ code: "retail:return",           label: "Xử lý trả hàng từ khách",     group: "Bán lẻ" },
{ code: "serial:manage",           label: "Quản lý IMEI/Serial",         group: "Bán lẻ" },
```

### 4) `server/config/business-types.ts`

Khai báo loại hình doanh nghiệp nào được bật `retail` (bán lẻ, sửa chữa — không bật cho tenant lao động thuần).

### 5) `server/router/index.ts`

Thêm import cạnh các module khác (dòng ~12) và mount ở **cuối file**, ngay trên `workerManagementRouter`:

```ts
import { retailRouter } from "../modules/retail/router";

// Module Bán lẻ & POS
apiRouter.use("/", requireAuth as any, requireModule("retail"), retailRouter);
```

Đặt `requireModule` ở đây (không rải trong từng route) — đúng pattern của `worker`/`student`. Test canh: `server/router/module-route-guards.test.ts`.

### 6) `server/errors/error-codes.ts`

Thêm mã lỗi nghiệp vụ mới:

```ts
SHIFT_NOT_OPEN: "SHIFT_NOT_OPEN",
SHIFT_ALREADY_OPEN: "SHIFT_ALREADY_OPEN",
SHIFT_ALREADY_CLOSED: "SHIFT_ALREADY_CLOSED",
INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
ORDER_NOT_EDITABLE: "ORDER_NOT_EDITABLE",
ORDER_TOTAL_MISMATCH: "ORDER_TOTAL_MISMATCH",
OVERPAYMENT_NOT_ALLOWED: "OVERPAYMENT_NOT_ALLOWED",
RETURN_QUANTITY_EXCEEDED: "RETURN_QUANTITY_EXCEEDED",
RETURN_WINDOW_EXPIRED: "RETURN_WINDOW_EXPIRED",
SERIAL_NOT_AVAILABLE: "SERIAL_NOT_AVAILABLE",
SERIAL_COUNT_MISMATCH: "SERIAL_COUNT_MISMATCH",
```

Service ném lỗi bằng `AppError` (`server/errors/app-error.ts`), ví dụ:

```ts
throw new AppError({
  code: "INSUFFICIENT_STOCK",
  status: 409,
  message: "Sản phẩm không đủ tồn khả dụng.",
  details: { sku, available, requested },
});
```

`details` sẽ được FE dùng để hiển thị chính xác dòng hàng nào thiếu.

---

## A3. `permissions.ts` và `contracts.ts`

`server/modules/retail/permissions.ts`:

```ts
export const RETAIL_READ_PERMISSION = "retail:read";
export const RETAIL_SELL_PERMISSION = "retail:sell";
export const RETAIL_DISCOUNT_PERMISSION = "retail:discount";
export const RETAIL_CANCEL_PERMISSION = "retail:cancel";
export const RETAIL_CANCEL_COMPLETED_PERMISSION = "retail:cancel-completed";
export const RETAIL_COST_READ_PERMISSION = "retail:cost:read";
export const SHIFT_OPERATE_PERMISSION = "shift:operate";
export const SHIFT_APPROVE_PERMISSION = "shift:approve";
export const RETAIL_RETURN_PERMISSION = "retail:return";
export const SERIAL_MANAGE_PERMISSION = "serial:manage";
```

`server/modules/retail/contracts.ts` — **copy nguyên logic** `worker-management/contracts.ts`, chỉ đổi tên:

```ts
export type RetailScope = { companyCode: string; branchId?: string };
export class RetailScopeError extends Error { /* status 400 | 403 */ }
export function retailScopeFromActor(actor): RetailScope
export function retailScopeFromRequest(actor, requested): RetailScope
```

Giữ nguyên hành vi quan trọng: `superadmin` được truyền `companyCode`/`branchId` tùy ý; user thường mà gửi scope khác của mình → ném `403`.

Khác biệt duy nhất so với worker: retail **bắt buộc `branchId`**. Đơn hàng luôn thuộc một chi nhánh cụ thể (tồn kho theo chi nhánh). Bổ sung:

```ts
export function requireBranch(scope: RetailScope): Required<RetailScope> {
  if (!scope.branchId) {
    throw new RetailScopeError("Vui lòng chọn chi nhánh bán hàng.", 400);
  }
  return scope as Required<RetailScope>;
}
```

---

## A4. Hợp đồng API đầy đủ

Prefix chung: `/api/v1/retail/...`. Tất cả trả `{ success: boolean, data: ... }` (đúng convention `WorkerProjectController`).

Query `companyCode` / `branchId` là **tùy chọn** với user thường (lấy từ token), **bắt buộc** với superadmin.

### A4.1. Đơn hàng — `routes/retail-order.routes.ts` → `/retail/orders`

| # | Method | Path | Quyền | Body / Query | Trả về | Lỗi đặc thù |
|---|---|---|---|---|---|---|
| 1 | GET | `/` | `retail:read` \| `retail:sell` | `?status&businessDateFrom&businessDateTo&customerId&salespersonId&shiftId&paymentStatus&q&page&limit` | `{ items, total, page, limit }` | — |
| 2 | GET | `/:id` | `retail:read` \| `retail:sell` | — | `RetailOrder` (strip `unitCost` nếu thiếu `retail:cost:read`) | `404 RESOURCE_NOT_FOUND` |
| 3 | POST | `/` | `retail:sell` | `CreateOrderDto` | `RetailOrder` (draft) | `400 VALIDATION_FAILED` |
| 4 | PATCH | `/:id` | `retail:sell` | `UpdateOrderDto` | `RetailOrder` | `409 ORDER_NOT_EDITABLE` |
| 5 | POST | `/:id/confirm` | `retail:sell` | `{ expectedGrandTotal, idempotencyKey }` | `{ order, invoice }` | `409 SHIFT_NOT_OPEN` / `INSUFFICIENT_STOCK` / `ORDER_TOTAL_MISMATCH` |
| 6 | POST | `/:id/payments` | `retail:sell` | `{ method, amount, reference? }` | `RetailOrder` | `409 OVERPAYMENT_NOT_ALLOWED` |
| 7 | POST | `/:id/cancel` | `retail:cancel` | `{ reason }` | `RetailOrder` | `403` nếu đơn `completed` mà thiếu `retail:cancel-completed` |
| 8 | POST | `/quote` | `retail:sell` | `QuoteDto` (giống items) | `{ subtotal, orderDiscount, taxAmount, grandTotal, lines[] }` | — |
| 9 | GET | `/:id/print-payload` | `retail:sell` | `?format=escpos\|html` | `{ payload }` | `404` |

**Endpoint số 8 (`/quote`) là mấu chốt.** POS gọi mỗi lần giỏ hàng đổi để lấy số tiền **do server tính**. FE tuyệt đối không tự cộng tiền hiển thị cho khách. Endpoint này thuần, không ghi DB, nên gọi liên tục vẫn an toàn.

**Endpoint số 5 (`/confirm`)** — hợp đồng chống lỗi tiền:

```ts
// Request
{ expectedGrandTotal: 1250000, idempotencyKey: "pos-a1b2c3-1723200000" }
```

Service so `expectedGrandTotal` với số tự tính. Lệch → `409 ORDER_TOTAL_MISMATCH` kèm `details: { expected, actual }`. Ngăn trường hợp giá sản phẩm đổi giữa lúc thu ngân đang bấm, khách trả sai số tiền.

`idempotencyKey` do FE sinh 1 lần cho mỗi lần bấm "Thanh toán", giữ nguyên khi retry. Chống tạo đơn trùng khi mạng chập chờn (yêu cầu B1: "mất kết nối… không tạo đơn trùng").

### A4.2. Ca thu ngân — `/retail/shifts`

| Method | Path | Quyền | Body | Trả về |
|---|---|---|---|---|
| GET | `/current` | `shift:operate` | — | `CashierShift \| null` — ca đang mở của chính user |
| GET | `/` | `retail:read` | `?businessDate&cashierId&status&page&limit` | danh sách |
| GET | `/:id` | `retail:read` | — | chi tiết + đơn trong ca |
| POST | `/open` | `shift:operate` | `{ openingFloat, terminalId? }` | `CashierShift` — `409 SHIFT_ALREADY_OPEN` |
| POST | `/:id/cash-movements` | `shift:operate` | `{ type, amount, reason }` | `CashierShift` |
| POST | `/:id/close` | `shift:operate` | `{ countedCash, methodCounts?, varianceReason? }` | `CashierShift` |
| POST | `/:id/approve` | `shift:approve` | `{ note? }` | `CashierShift` |

**Blind count — thực hiện ở tầng service, không ở FE:**

```ts
// cashier-shift.service.ts
function serializeShift(shift, actor) {
  const canSeeExpected =
    shift.status !== "open" ||
    shift.countedCash != null ||
    actor.permissions.includes("shift:approve");

  if (!canSeeExpected) {
    const { expectedCash, methodTotals, totalRevenue, ...safe } = shift;
    return { ...safe, methodTotals: methodTotals.map(m => ({ method: m.method })) };
  }
  return shift;
}
```

Thu ngân mở DevTools cũng không thấy số kỳ vọng. Viết test khẳng định response không chứa key `expectedCash`.

### A4.3. Hóa đơn — `/retail/invoices`

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/` | `retail:read` | `?orderId&issuedFrom&issuedTo&status` |
| GET | `/:id` | `retail:read` | payload **đã strip `unitCost`** ở mọi vai trò |
| GET | `/:id/pdf` | `retail:read` | `Content-Type: application/pdf` |
| POST | `/:id/print` | `retail:sell` | tăng `printCount`, trả payload máy in |
| POST | `/:id/void` | `retail:cancel` | `{ reason }` |

### A4.4. Trả hàng — `/retail/returns`

| Method | Path | Quyền |
|---|---|---|
| GET | `/` | `retail:read` |
| GET | `/:id` | `retail:read` |
| GET | `/returnable/:orderId` | `retail:return` | trả về từng dòng kèm `soldQty`, `returnedQty`, `returnableQty` |
| POST | `/` | `retail:return` | tạo nháp |
| POST | `/:id/confirm` | `retail:return` | hoàn tồn + hoàn tiền |
| POST | `/:id/cancel` | `retail:return` |

`GET /returnable/:orderId` tồn tại để FE **không phải tự tính** số còn được trả. Server tính `returnableQty = soldQty - Σ đã trả`, FE chỉ hiển thị và giới hạn input `max`.

### A4.5. Serial — `/retail/serials`

| Method | Path | Quyền |
|---|---|---|
| GET | `/` | `retail:read` | `?productId&status&q` |
| GET | `/lookup/:serialNumber` | `retail:sell` | tra nhanh khi quét — trả kèm lịch sử bán, hạn bảo hành |
| POST | `/bulk` | `serial:manage` | nhập serial hàng loạt khi nhập kho |
| PATCH | `/:id` | `serial:manage` |

---

## A5. Ba service cần đặc tả kỹ

### `retail-pricing.service.ts` — hàm thuần, không I/O

```ts
export function calculateOrderTotals(input: PricingInput): PricingResult
```

Không nhận `req`, không truy vấn DB, không đọc `Date.now()`. Nhận đủ dữ liệu qua tham số. Lý do: đây là chỗ dễ sai nhất (tài liệu gốc mục 8.7 xếp "tính toán tài chính" vào nhóm phải review kỹ), và hàm thuần thì test được 50 case trong vài giây, không cần dựng DB.

Thứ tự tính **bắt buộc cố định** — đổi thứ tự là lệch tiền:

```
1. lineTotal   = round(quantity * unitPrice) - discountAmount   (mỗi dòng)
2. subtotal    = Σ lineTotal
3. sau chiết khấu = subtotal - orderDiscount
4. taxAmount   = round(sau chiết khấu * taxRate)
5. grandTotal  = sau chiết khấu + taxAmount + shippingFee
```

Làm tròn về **số nguyên VNĐ ở mỗi dòng**, không tròn ở cuối. Dùng `Math.round`.

Được gọi từ **cả** `POST /quote` và `POST /:id/confirm` — một nguồn sự thật, không có đường nào tính tiền khác.

### `retail-stock.service.ts` — A3

```ts
export async function applyOrderStockOut(order, actor): Promise<void> {
  const idempotencyKey = `order:${order._id}:out`;
  try {
    await StockLogModel.create({
      type: "xuất",
      purpose: "bán",
      refType: "retail-order",
      refId: String(order._id),
      idempotencyKey,
      items: order.items.map(toStockItem),
      /* ... */
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) return;   // ← lần ghi trước đã thành công
    throw error;
  }
  await decrementProductStock(order.items, order.branchId);
  await RetailOrderModel.updateOne({ _id: order._id }, { stockApplied: true });
}
```

Bắt `E11000` và **coi là thành công** — đó là toàn bộ cơ chế chống trừ kho hai lần. Không dùng `findOne` rồi `create`: hai request song song đều thấy "chưa có" và cùng ghi.

### `require-open-shift.middleware.ts` — A6

```ts
export async function requireOpenShift(req, res, next) {
  const scope = requireBranch(retailScopeFromRequest(req.user, req.query));
  const shift = await CashierShiftModel.findOne({
    companyCode: scope.companyCode,
    branchId: scope.branchId,
    cashierId: req.user.uid,
    status: "open",
  });
  if (!shift) {
    return next(new AppError({
      code: "SHIFT_NOT_OPEN", status: 409,
      message: "Bạn chưa mở ca bán hàng.",
    }));
  }
  (req as any).currentShift = shift;
  next();
}
```

Gắn vào route `confirm` và `payments`. FE bắt mã `SHIFT_NOT_OPEN` để mở thẳng modal mở ca.

---

## A6. Swagger

Tạo `server/swagger/retail.swagger.ts` theo mẫu `server/swagger/crud.swagger.ts`, đăng ký trong `server/swagger/index.ts`.

---

# PHẦN B — FRONTEND

## B1. Cây thư mục

```
src/modules/retail/
├─ RetailTab.tsx                    # entry — route-config trỏ vào đây
├─ RetailWorkspace.tsx              # khung sub-tab (mẫu WorkerWorkspace.tsx)
├─ types.ts                         # mirror interface BE
├─ retailPermissionPolicy.ts        # canSell / canSeeCost / canApproveShift...
├─ api/
│  ├─ client.ts                     # re-export workerApiFetch — xem B3
│  ├─ retailOrders.api.ts
│  ├─ shifts.api.ts
│  ├─ invoices.api.ts
│  ├─ returns.api.ts
│  └─ serials.api.ts
├─ hooks/
│  ├─ useRetailCart.ts              # state giỏ hàng + debounce gọi /quote
│  ├─ useCurrentShift.ts            # ca đang mở, poll nhẹ
│  ├─ useRetailOrders.ts            # danh sách + filter + phân trang
│  ├─ useBarcodeScanner.ts          # B2 — bắt keystroke máy quét HID
│  └─ useReturnableLines.ts
├─ pages/
│  ├─ PosPage.tsx                   # B1 — màn bán hàng
│  ├─ OrdersPage.tsx                # A1 — danh sách/tra cứu đơn
│  ├─ ShiftPage.tsx                 # A6
│  ├─ ReturnsPage.tsx               # A13
│  └─ RetailDashboardPage.tsx       # A5 rút gọn
└─ components/
   ├─ CartPanel.tsx
   ├─ CartLineRow.tsx
   ├─ ProductPickerPanel.tsx
   ├─ CustomerPickerModal.tsx
   ├─ PaymentModal.tsx
   ├─ SerialInputModal.tsx
   ├─ ReceiptPreview.tsx
   ├─ OpenShiftModal.tsx
   ├─ CloseShiftModal.tsx
   ├─ OrderDetailDrawer.tsx
   └─ ReturnModal.tsx
```

## B2. Nối vào app — 4 file phải sửa

### 1) `src/types/common.ts`

```ts
export type TabType =
  | "QUẢN LÝ LAO ĐỘNG"
  | ...
  | "BÁN LẺ";        // ← thêm
```

### 2) `src/router/route-config.tsx`

```ts
{
  tab: "BÁN LẺ",
  component: lazy(() => import("../modules/retail/RetailTab")),
  canAccess: (userProfile) =>
    userProfile.role === "superadmin" ||
    userProfile.role === "admin" ||
    Boolean(
      userProfile.permissions?.includes("*") ||
      userProfile.permissions?.some((p) => p.startsWith("retail:") || p.startsWith("shift:")),
    ),
},
```

### 3) `src/config/modules.ts` — đã nêu ở A2 mục 2

### 4) `src/pages/Sidebar.tsx` — thêm mục "Bán lẻ", icon `ShoppingCart` (lucide-react, đã dùng khắp dự án)

## B3. Tầng gọi API

**Không viết `fetch` mới.** `src/modules/worker-management/api/client.ts` đã xử lý đầy đủ: gắn `Authorization`, tự refresh token khi `401`, phát `window.dispatchEvent(new Event("unauthorized"))`, và ném `ApiClientError` có `code` — chính là mã lỗi từ `server/errors/error-codes.ts`.

Việc `retail` cần cái đó nghĩa là nên **nâng client này thành dùng chung**:

```
Bước 1: chuyển src/modules/worker-management/api/client.ts
        → src/modules/shared/lib/apiFetch.ts  (đặt cạnh src/modules/shared/lib/api.ts đã có)
        đổi tên workerApiFetch → apiFetch
Bước 2: worker-management/api/client.ts giữ lại 1 dòng re-export
        → không phải sửa 8 file api của worker
Bước 3: retail/api/client.ts import từ shared
```

Đây là refactor 15 phút, tránh nhân bản 60 dòng logic refresh-token.

File API viết theo mẫu `workers.api.ts` — object export, mỗi method nhận `scope` cuối:

```ts
// src/modules/retail/api/retailOrders.api.ts
import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailOrder, RetailScope, QuoteResult, CartLineInput } from "../types";

const BASE = "/retail/orders";
const scopeParams = (s: RetailScope) => ({ companyCode: s.companyCode, branchId: s.branchId });

export const retailOrderApi = {
  async quote(lines: CartLineInput[], orderDiscount: number, scope: RetailScope) {
    return apiFetch<QuoteResult>(`${BASE}/quote`, {
      method: "POST",
      body: JSON.stringify({ items: lines, orderDiscount }),
      params: scopeParams(scope),
    });
  },

  async confirm(id: string, expectedGrandTotal: number, idempotencyKey: string, scope: RetailScope) {
    return apiFetch<{ order: RetailOrder; invoice: RetailInvoice }>(`${BASE}/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ expectedGrandTotal, idempotencyKey }),
      params: scopeParams(scope),
    });
  },
  // list / getDetail / create / update / addPayment / cancel ...
};
```

## B4. Component tận dụng được — **không viết lại**

| Cần gì | Dùng cái đã có | Đường dẫn |
|---|---|---|
| Chọn sản phẩm có tìm kiếm | `SearchableSelect` | `src/components/inventory/SearchableSelect.tsx` |
| Thẻ số liệu tổng quan | `SummaryCard` | `src/components/inventory/SummaryCard.tsx` |
| Thẻ sản phẩm trong lưới POS | `ProductCard` | `src/components/inventory/ProductCard.tsx` |
| Xác nhận hủy đơn / đóng ca | `ConfirmDialog` | `src/components/common/ConfirmDialog.tsx` |
| Phân trang danh sách đơn | `Pagination` | `src/components/common/Pagination.tsx` |
| Modal thêm khách hàng nhanh | `EntityAddModal` | `src/modules/shared/components/EntityAddModal.tsx` |
| Điều hướng sub-tab qua `?sub=` | `useSubTabRouter` | `src/hooks/useSubTabRouter.ts` |
| Debounce ô tìm kiếm + gọi `/quote` | `useDebouncedValue` | `src/hooks/useDebouncedValue.ts` |
| Layout POS theo màn hình quầy | `useMediaQuery` | `src/hooks/useMediaQuery.ts` |
| Quyền hiện tại | `useAuth().hasPermission(code)` | `src/context/AuthContext.tsx` |
| Chi nhánh đang chọn | `useBranch()` | `src/context/BranchContext.tsx` |
| Danh sách sản phẩm + tồn | `inventoryProductService` | `src/services/inventoryProductService.ts` |
| Lịch sử kho của đơn | `inventoryStockLogService` | `src/services/inventoryStockLogService.ts` |
| Toast kết quả thao tác | `ToastContainer` | `src/pages/Toast.tsx` |
| Realtime cập nhật đơn/ca | `socketService` | `src/services/socketService.ts` |

`RetailWorkspace.tsx` sao chép cấu trúc `WorkerWorkspace.tsx`: mảng `SUB_TABS` `{ slug, value, label, icon }`, `lazy()` từng page, `useSubTabRouter`.

```ts
const SUB_TABS = [
  { slug: "ban-hang",  value: "BÁN HÀNG",  label: "Bán hàng",  icon: ShoppingCart },
  { slug: "don-hang",  value: "ĐƠN HÀNG",  label: "Đơn hàng",  icon: ReceiptText },
  { slug: "ca-ban",    value: "CA BÁN",    label: "Ca bán",    icon: Clock },
  { slug: "tra-hang",  value: "TRẢ HÀNG",  label: "Trả hàng",  icon: Undo2 },
  { slug: "tong-quan", value: "TỔNG QUAN", label: "Tổng quan", icon: LayoutDashboard },
];
```

Sub-tab lọc theo quyền trước khi render — mẫu `getAllowedWorkerTabSlugs` trong `src/modules/worker-management/workerTabPermissions.ts`.

---

## B5. Đặc tả từng màn hình

### B5.1. `PosPage.tsx` — Bán hàng (B1, B2, A1)

**Bố cục** — 2 cột trên desktop (`useMediaQuery`), 1 cột + giỏ hàng dạng sheet trên tablet dọc:

```
┌───────────────────────────────┬──────────────────────────┐
│ [ô quét/tìm SKU]  ← autofocus │ Khách: [chọn] [+ mới]    │
│                               │ ─────────────────────────│
│  ProductPickerPanel           │ CartPanel                │
│  lưới ProductCard             │  CartLineRow × n         │
│  lọc theo danh mục            │  (tên, SL ±, đơn giá,    │
│                               │   giảm giá, thành tiền)  │
│                               │ ─────────────────────────│
│                               │ Tạm tính      1.200.000  │
│                               │ Giảm giá đơn     -50.000 │
│                               │ Thuế                   0 │
│                               │ TỔNG CỘNG     1.150.000  │
│                               │ [  THANH TOÁN (F9)  ]    │
└───────────────────────────────┴──────────────────────────┘
```

**Luồng dữ liệu:**

| Sự kiện | Gọi | Ghi chú |
|---|---|---|
| Mở trang | `shiftApi.getCurrent()` | `null` → hiện `OpenShiftModal`, khóa toàn trang |
| Mở trang | `inventoryProductService.list({ branchId })` | cache trong `useRetailCart` |
| Quét mã | `useBarcodeScanner` | xem dưới |
| Giỏ đổi | `retailOrderApi.quote()` — debounce 250ms | **mọi số tiền hiển thị lấy từ response này** |
| Bấm Thanh toán | `PaymentModal` mở | |
| Xác nhận trả tiền | `create()` → `confirm()` | |
| Confirm xong | `ReceiptPreview` + tự gọi `invoices/:id/print` | |

**`useBarcodeScanner` (B2) — chi tiết:**

Máy quét HID gõ phím rất nhanh rồi `Enter`. Phân biệt với gõ tay bằng khoảng cách thời gian:

```ts
// buffer ký tự; nếu 2 phím cách nhau > 50ms → coi là gõ tay, reset buffer.
// gặp Enter và buffer.length >= 4 → là mã quét.
```

Xử lý kết quả:
- Tìm thấy SKU, đã có trong giỏ → **tăng số lượng** (yêu cầu B2)
- Tìm thấy, chưa có → thêm dòng mới
- Không thấy → toast đỏ + **kêu bíp** (`new Audio`), không mở modal chặn luồng
- Sản phẩm quản lý serial → mở `SerialInputModal`

**Xử lý lỗi — map mã lỗi BE sang hành vi FE:**

| `error.code` | Hành vi |
|---|---|
| `SHIFT_NOT_OPEN` | mở `OpenShiftModal` ngay, không hiện toast lỗi khô khan |
| `INSUFFICIENT_STOCK` | tô đỏ đúng dòng trong giỏ, hiện `details.available` |
| `ORDER_TOTAL_MISMATCH` | gọi lại `/quote`, hiện banner "Giá đã thay đổi, vui lòng xác nhận lại" |
| `OVERPAYMENT_NOT_ALLOWED` | báo tại ô nhập tiền trong `PaymentModal` |
| lỗi mạng khi `confirm` | **retry cùng `idempotencyKey`**, tối đa 2 lần, rồi mới báo lỗi |

**Ẩn giá vốn:** `hasPermission("retail:cost:read")` sai → không render cột giá vốn/lợi nhuận. BE cũng đã strip — hai lớp.

**Phím tắt** (quầy dùng bàn phím nhanh hơn chuột): `F9` thanh toán, `F4` chọn khách, `F2` focus ô quét, `Esc` đóng modal, `Delete` xóa dòng đang chọn.

### B5.2. `ShiftPage.tsx` — Ca bán (A6)

Ba trạng thái hiển thị:

**a) Chưa có ca** → nút lớn "Mở ca", `OpenShiftModal` nhập `openingFloat`, `terminalId`.

**b) Ca đang mở** →
- Thẻ `SummaryCard`: giờ mở, thu ngân, quỹ đầu ca, số đơn
- **Không hiển thị doanh thu/tiền kỳ vọng** — BE không trả (blind count)
- Nút "Thu/chi giữa ca" → `cash-movements`
- Nút "Đóng ca" → `CloseShiftModal`

**c) `CloseShiftModal` — 2 bước, không gộp:**

```
Bước 1: nhập số thực đếm        Bước 2: sau khi submit
┌──────────────────────┐        ┌──────────────────────────────┐
│ Tiền mặt đếm được    │        │ Kỳ vọng      3.450.000       │
│ [____________]  đ    │   →    │ Thực đếm     3.430.000       │
│                      │        │ Chênh lệch     -20.000  ⚠   │
│ (KHÔNG hiện số nào   │        │ Lý do [_________________]    │
│  của hệ thống)       │        │ (bắt buộc khi vượt ngưỡng)   │
└──────────────────────┘        └──────────────────────────────┘
```

Bước 1 gửi `countedCash` lên; response mới chứa `expectedCash`. Đúng tinh thần blind count — FE không giữ sẵn số kỳ vọng để lỡ lộ.

**d) Ca đã đóng, có chênh lệch** → user có `shift:approve` thấy nút "Xác nhận chênh lệch".

### B5.3. `OrdersPage.tsx` — Đơn hàng (A1)

- Bộ lọc: khoảng ngày (mặc định hôm nay), trạng thái, trạng thái thanh toán, thu ngân, ô tìm mã đơn/tên khách (`useDebouncedValue`)
- Bảng: mã đơn, giờ, khách, số món, tổng tiền, đã trả, còn nợ, trạng thái (badge màu), thu ngân
- `Pagination` ở chân
- Click dòng → `OrderDetailDrawer` (drawer phải, không rời trang): dòng hàng, lịch sử thanh toán, link hóa đơn, link stock log, nút In lại / Thu thêm / Hủy / Tạo phiếu trả
- Nút "Hủy" chỉ hiện khi `hasPermission("retail:cancel")`; đơn `completed` cần thêm `retail:cancel-completed`
- Cột lợi nhuận chỉ hiện với `retail:cost:read`

### B5.4. `ReturnsPage.tsx` + `ReturnModal.tsx` (A13)

`ReturnModal` mở từ đơn gốc:
1. Gọi `GET /retail/returns/returnable/:orderId`
2. Bảng từng dòng: đã bán / đã trả / **còn được trả**
3. Input số lượng `max = returnableQty` (server vẫn kiểm lại — FE chỉ là tiện dụng)
4. Mỗi dòng: checkbox "Nhập lại kho" (`restock`) + ô lý do
5. Chọn hình thức hoàn: tiền mặt / chuyển khoản / đổi hàng / công nợ
6. Xác nhận → `POST /` rồi `POST /:id/confirm`

### B5.5. `RetailDashboardPage.tsx` (A5 rút gọn)

4 `SummaryCard`: doanh thu hôm nay, số đơn, giá trị đơn trung bình, lợi nhuận gộp (ẩn nếu thiếu `retail:cost:read`). Biểu đồ doanh thu 7 ngày + top 10 sản phẩm. Dùng lại pattern của `src/components/analytics`, gọi API analytics mở rộng — không viết pipeline riêng ở FE.

---

## B6. Realtime

`src/services/socketService.ts` đã có sẵn. Ba sự kiện nên phát từ BE:

| Event | Ai nghe | Tác dụng |
|---|---|---|
| `retail:order-confirmed` | `OrdersPage`, `RetailDashboardPage` | chèn đơn mới vào đầu danh sách |
| `retail:shift-closed` | quản lý | badge "có ca chờ duyệt" |
| `inventory:stock-changed` | `PosPage` | cập nhật tồn hiển thị trên `ProductCard` |

---

## B7. Thứ tự làm

| # | Việc | Phụ thuộc | Ngày |
|---|---|---|---|
| 1 | Nâng `client.ts` lên `shared/lib/apiFetch.ts` | — | 0.5 |
| 2 | Đăng ký module (6 file BE + 4 file FE) + test guard | 1 | 1 |
| 3 | Models + `retail-pricing.service` + test hàm thuần | 2 | 2 |
| 4 | API đơn hàng (`/quote`, `/`, `/confirm`) + `retail-stock.service` | 3 | 2.5 |
| 5 | API + UI ca thu ngân | 4 | 2 |
| 6 | `PosPage` + `useRetailCart` + `useBarcodeScanner` | 4, 5 | 3 |
| 7 | `OrdersPage` + `OrderDetailDrawer` | 4 | 1.5 |
| 8 | Hóa đơn A2 + in nhiệt B3 | 4 | 2 |
| 9 | UAT tại quầy thật | tất cả | 1.5 |

Tổng ~16 ngày — khớp ước lượng ~14 ngày của Giai đoạn 1 trong tài liệu gốc, cộng 2 ngày cho bước refactor client dùng chung.

---

## B8. Checklist trước khi merge

**Backend**
- [ ] Mọi query lọc `companyCode` — test cross-tenant theo mẫu `worker-module-isolation.test.ts`
- [ ] `retail-pricing.service` là hàm thuần, có ≥20 case test (làm tròn, giảm giá 0, giảm giá vượt tạm tính)
- [ ] `confirm` gọi 2 lần song song cùng `idempotencyKey` → 1 đơn, 1 stock log
- [ ] Response ca đang mở của thu ngân **không** chứa `expectedCash`
- [ ] Response hóa đơn **không** chứa `unitCost` ở mọi vai trò
- [ ] Route mount đúng dưới `requireModule("retail")` — cập nhật `module-route-guards.test.ts`
- [ ] Mọi mã quyền dùng trong `routes/` đều có trong `PERMISSION_CATALOG`

**Frontend**
- [ ] Không có phép cộng tiền nào trong `.tsx` — mọi số từ `/quote`
- [ ] Thiếu `retail:cost:read` → không có cột giá vốn/lợi nhuận nào render
- [ ] `SHIFT_NOT_OPEN` mở modal mở ca, không phải toast lỗi
- [ ] Rút mạng giữa lúc `confirm` → retry không tạo đơn thứ hai
- [ ] Quét lại mã đã có → tăng số lượng, không thêm dòng trùng
- [ ] Test `business-module-isolation` cập nhật cho tab `BÁN LẺ`
- [ ] POS thao tác được đủ luồng bằng bàn phím, không cần chuột
```

