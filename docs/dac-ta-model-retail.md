# Đặc tả chi tiết Model — Module `retail`

> Phạm vi: các model thuộc `server/modules/retail/models/`, phục vụ A1 (đơn bán lẻ), A2 (hóa đơn nội bộ), A3 (tự động xuất/nhập kho), A6 (chốt ca thu ngân), A13 (trả hàng từ khách), B8 (IMEI/serial).
>
> Nguồn yêu cầu: `ke-hoach-trien-khai-chuc-nang-ban-le-ranking-chi-tiet timeline.md`

---

## 0. Quy ước chung toàn module

Áp dụng cho **mọi** model trong tài liệu này.

| Quy ước | Quyết định | Lý do |
|---|---|---|
| Tiền tệ | **Số nguyên VNĐ** (`Number`, `min: 0`, không thập phân) | Tránh sai số float khi cộng dồn doanh thu/công nợ. Tài liệu mục 8.7 xếp "tính toán tài chính (làm tròn)" vào nhóm phải review kỹ. |
| `companyCode` | `String, required, index` — có ở **mọi** collection | Bám multi-tenant hiện tại (`product.model.ts`, `stock-log.model.ts`) |
| `branchId` | `String, index` (**không** dùng `ObjectId`) | Đồng bộ với `product.branchId` và `stockLog.branchId` đang là `String`. Module retail join trực tiếp hai collection này nên phải cùng kiểu; dùng `ObjectId` như `worker-management` sẽ gây lệch. |
| Timestamps | `{ timestamps: true }` | Đồng bộ `worker-attendance-log.model.ts`, `branch.model.ts` |
| Xóa dữ liệu | **Không xóa cứng** bản ghi đã xác nhận. Chỉ chuyển trạng thái `cancelled`/`void` | Yêu cầu truy vết ở A1, A3, A13 |
| Người thực hiện | Lưu **cả** `userId` (String) và `userName` (snapshot) | Tên user đổi sau không làm sai chứng từ đã in |
| Múi giờ | Mọi mốc ngày kinh doanh lưu thêm `businessDate: String` dạng `YYYY-MM-DD` theo `server/config/timezone.ts` | A5/A6 chốt sổ theo ngày kinh doanh, không theo UTC |

**Nguyên tắc snapshot (quan trọng nhất):** đơn hàng lưu bản sao `unitPrice`, `unitCost`, `productName`, `sku` tại thời điểm tạo. Không bao giờ join ngược `Product` để tính lại tiền hoặc lợi nhuận — vì `product.price`/`product.costPrice` thay đổi theo thời gian sẽ làm báo cáo A5 của kỳ cũ sai.

---

## 1. `RetailOrder` — Đơn hàng bán lẻ (A1)

Bản ghi trung tâm. Kho (A3), hóa đơn (A2), công nợ (A4), ca bán (A6), hoa hồng (A9) và báo cáo (A5) đều lấy đơn làm nguồn.

### 1.1. Interface

`server/modules/retail/interfaces/retail-order.interface.ts`

```ts
export type RetailOrderStatus = "draft" | "confirmed" | "completed" | "cancelled";
export type RetailPaymentStatus = "unpaid" | "partial" | "paid" | "refunded";
export type RetailPaymentMethod = "cash" | "card" | "transfer" | "ewallet" | "debt";

export interface IRetailOrderItem {
  productId: string;
  sku: string;
  productName: string;      // snapshot
  unit: string;             // snapshot
  category?: string;        // snapshot — phục vụ A5 nhóm theo danh mục
  quantity: number;         // > 0
  unitPrice: number;        // snapshot giá bán
  unitCost: number;         // snapshot giá vốn — KHÔNG hiển thị cho thu ngân
  discountAmount: number;   // giảm giá tuyệt đối trên dòng, >= 0
  lineTotal: number;        // = quantity * unitPrice - discountAmount
  serialNumbers?: string[]; // B8 — độ dài phải bằng quantity nếu sản phẩm quản lý serial
  note?: string;
}

export interface IRetailOrderPayment {
  method: RetailPaymentMethod;
  amount: number;
  paidAt: Date;
  reference?: string;       // mã giao dịch thẻ / mã chuyển khoản
  receivedBy: string;       // userId
  receivedByName: string;
}

export interface IRetailOrder {
  orderCode: string;            // duy nhất theo company
  companyCode: string;
  branchId: string;
  shiftId?: string;             // A6 — ca phát sinh đơn

  customerId?: string;          // đơn khách lẻ để trống
  customerName?: string;
  customerPhone?: string;
  customerTier?: string;        // A8 — snapshot hạng tại thời điểm bán

  items: IRetailOrderItem[];

  subtotal: number;             // tổng lineTotal
  orderDiscount: number;        // giảm giá toàn đơn
  taxAmount: number;
  shippingFee: number;
  grandTotal: number;           // subtotal - orderDiscount + taxAmount + shippingFee
  totalCost: number;            // tổng quantity * unitCost — nguồn tính lợi nhuận A5

  payments: IRetailOrderPayment[];
  paidAmount: number;           // tổng payments.amount
  dueAmount: number;            // grandTotal - paidAmount
  paymentStatus: RetailPaymentStatus;
  dueDate?: Date;               // A4 — hạn thanh toán khi bán nợ

  status: RetailOrderStatus;
  businessDate: string;         // YYYY-MM-DD
  confirmedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;

  salespersonId: string;
  salespersonName: string;
  createdBy: string;
  createdByName: string;

  partnerId?: string;           // A9 — CTV/đại lý giới thiệu
  stockApplied: boolean;        // A3 — đã sinh stock log xuất hay chưa
  stockRevertedAt?: Date;       // A3 — đã hoàn tồn khi hủy
  version: number;              // optimistic lock

  createdAt: Date;
  updatedAt: Date;
}
```

### 1.2. Schema

`server/modules/retail/models/retail-order.model.ts`

```ts
import { Schema, model } from "mongoose";
import { IRetailOrder } from "../interfaces/retail-order.interface";

const RetailOrderItemSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    sku: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    unit: { type: String, required: true, default: "Cái" },
    category: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0, default: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    serialNumbers: { type: [String], default: undefined },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const RetailOrderPaymentSchema = new Schema(
  {
    method: { type: String, enum: ["cash", "card", "transfer", "ewallet", "debt"], required: true },
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, required: true, default: Date.now },
    reference: { type: String, trim: true },
    receivedBy: { type: String, required: true },
    receivedByName: { type: String, required: true },
  },
  { _id: false }
);

const RetailOrderSchema = new Schema<IRetailOrder>(
  {
    orderCode: { type: String, required: true, trim: true },
    companyCode: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    shiftId: { type: String, index: true },

    customerId: { type: String, trim: true, index: true },
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    customerTier: { type: String, trim: true },

    items: { type: [RetailOrderItemSchema], required: true },

    subtotal: { type: Number, required: true, min: 0 },
    orderDiscount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, default: 0, min: 0 },

    payments: { type: [RetailOrderPaymentSchema], default: [] },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid", "refunded"],
      default: "unpaid",
      index: true,
    },
    dueDate: { type: Date },

    status: {
      type: String,
      enum: ["draft", "confirmed", "completed", "cancelled"],
      default: "draft",
      required: true,
      index: true,
    },
    businessDate: { type: String, required: true, index: true },
    confirmedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true },

    salespersonId: { type: String, required: true, index: true },
    salespersonName: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },

    partnerId: { type: String, trim: true, index: true },
    stockApplied: { type: Boolean, default: false, index: true },
    stockRevertedAt: { type: Date },
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Mã đơn duy nhất trong phạm vi doanh nghiệp.
RetailOrderSchema.index({ companyCode: 1, orderCode: 1 }, { unique: true });
// A5 — báo cáo doanh thu theo ngày/chi nhánh.
RetailOrderSchema.index({ companyCode: 1, branchId: 1, businessDate: -1, status: 1 });
// A6 — tổng hợp đơn theo ca.
RetailOrderSchema.index({ shiftId: 1, status: 1 });
// A4 — truy vấn công nợ quá hạn.
RetailOrderSchema.index({ companyCode: 1, paymentStatus: 1, dueDate: 1 });
// A3 — đối soát đơn đã xác nhận nhưng chưa sinh stock log.
RetailOrderSchema.index({ companyCode: 1, status: 1, stockApplied: 1 });

export const RetailOrderModel = model<IRetailOrder>("RetailOrder", RetailOrderSchema);
```

### 1.3. State machine

```
        ┌──────────────── cancel ────────────────┐
        │                                        ▼
     draft ──confirm──> confirmed ──pay full──> completed
        │                   │                     │
        │                   └──── cancel ─────────┘
        │                     (hoàn tồn A3)   (cancel cần quyền retail:cancel-completed)
        └── cancel (không tác động kho)
```

| Chuyển | Điều kiện | Tác động |
|---|---|---|
| `draft → confirmed` | có ≥1 dòng hàng; tồn khả dụng đủ (trừ khi bật bán âm); ca đang mở | **Trừ kho** (A3), khóa `items`, gán `orderCode` chính thức, sinh hóa đơn A2 |
| `confirmed → completed` | `dueAmount === 0` | Đóng đơn, tính hoa hồng A9, tính lại hạng KH A8 |
| `confirmed → cancelled` | quyền `retail:cancel` | **Hoàn tồn**, hủy hóa đơn, đảo hoa hồng |
| `completed → cancelled` | quyền `retail:cancel-completed` + bắt buộc `cancelReason` | như trên + đảo công nợ |
| `draft → cancelled` | luôn được | Không tác động kho |

Sau `confirmed`, **không cho sửa `items`**. Muốn đổi hàng phải dùng `SalesReturn` (A13).

### 1.4. Bất biến (invariant) — viết test cho từng dòng

1. `lineTotal === quantity * unitPrice - discountAmount` với mọi dòng.
2. `subtotal === Σ items.lineTotal`.
3. `grandTotal === subtotal - orderDiscount + taxAmount + shippingFee`, và `grandTotal >= 0`.
4. `paidAmount === Σ payments.amount`.
5. `dueAmount === grandTotal - paidAmount`, và `dueAmount >= 0` (không cho thu quá).
6. `totalCost === Σ (quantity * unitCost)`.
7. `paymentStatus` là hàm thuần của `(paidAmount, grandTotal)`: `0 → unpaid`, `0 < x < grandTotal → partial`, `=== grandTotal → paid`. Không cho set tay.
8. `status === "confirmed" | "completed"` ⟹ `stockApplied === true`.
9. `dueAmount > 0` ⟹ bắt buộc có `customerId` và `dueDate` (không bán nợ cho khách lẻ).
10. `serialNumbers.length === quantity` nếu sản phẩm bật quản lý serial.

### 1.5. Ghi chú triển khai

- Toàn bộ số tiền do **`retail-pricing.service.ts` tính lại ở server**. Số client gửi lên chỉ dùng để đối chiếu; lệch thì trả `409` chứ không nhận số của client.
- `version` tăng mỗi lần đổi trạng thái; API dùng `findOneAndUpdate({ _id, version })` để chặn hai thu ngân thao tác cùng đơn.

---

## 2. `RetailOrderCounter` — Bộ sinh mã đơn

Không dùng `count()+1` (đua race, và số nhảy lùi khi hủy đơn).

```ts
export interface IRetailOrderCounter {
  companyCode: string;
  branchId: string;
  scope: string;      // "YYYYMM" hoặc "ALL" tùy cấu hình
  prefix: string;     // "HD", "DH"...
  seq: number;
}

const RetailOrderCounterSchema = new Schema<IRetailOrderCounter>({
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  scope: { type: String, required: true },
  prefix: { type: String, required: true, default: "HD" },
  seq: { type: Number, required: true, default: 0 },
});

RetailOrderCounterSchema.index(
  { companyCode: 1, branchId: 1, scope: 1 },
  { unique: true }
);
```

Cấp mã bằng một thao tác nguyên tử:

```ts
const c = await RetailOrderCounterModel.findOneAndUpdate(
  { companyCode, branchId, scope },
  { $inc: { seq: 1 }, $setOnInsert: { prefix } },
  { new: true, upsert: true }
);
// HD-CN01-202608-000123
const orderCode = `${c.prefix}-${branchCode}-${scope}-${String(c.seq).padStart(6, "0")}`;
```

Mã chỉ cấp khi `draft → confirmed`. Đơn nháp dùng `_id` để tham chiếu, tránh thủng dãy số khi khách bỏ giỏ.

---

## 3. `RetailInvoice` — Hóa đơn bán lẻ nội bộ (A2)

Tách khỏi `RetailOrder` vì: một đơn có thể in lại nhiều lần, số chứng từ có dãy riêng, và sau này C1 (hóa đơn điện tử pháp lý) gắn vào đây chứ không gắn vào đơn.

```ts
export interface IRetailInvoice {
  invoiceNo: string;              // dãy riêng, KHÁC orderCode
  orderId: string;
  orderCode: string;
  companyCode: string;
  branchId: string;

  snapshot: {                     // đóng băng nội dung tại lúc phát hành
    customerName: string;
    customerPhone?: string;
    items: IRetailOrderItem[];    // KHÔNG chứa unitCost — xem mục 3.2
    subtotal: number;
    orderDiscount: number;
    taxAmount: number;
    grandTotal: number;
    amountInWords: string;        // "Một triệu hai trăm nghìn đồng"
  };

  issuedAt: Date;
  issuedBy: string;
  issuedByName: string;

  status: "issued" | "void";
  voidedAt?: Date;
  voidReason?: string;

  printCount: number;
  lastPrintedAt?: Date;

  externalInvoiceId?: string;     // C1 — mã hóa đơn điện tử sau này
  externalStatus?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

Index:

```ts
RetailInvoiceSchema.index({ companyCode: 1, invoiceNo: 1 }, { unique: true });
// Ràng buộc 1-1: mỗi đơn chỉ có tối đa 1 hóa đơn còn hiệu lực.
RetailInvoiceSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { status: "issued" } }
);
RetailInvoiceSchema.index({ companyCode: 1, issuedAt: -1 });
```

### 3.1. Quy tắc

- Phát hành **tự động** khi đơn `confirmed`. Không cho nhập tay nội dung.
- `snapshot` là bất biến. Sửa đơn ⟹ `void` hóa đơn cũ, phát hành hóa đơn mới, `invoiceNo` mới.
- In lại chỉ tăng `printCount` + `lastPrintedAt`, **không** đổi `invoiceNo` (yêu cầu A2: "in lại khi mất hóa đơn").
- Partial unique index ở trên chính là cơ chế kỹ thuật đảm bảo "quy tắc một-một" mà A2 yêu cầu.

### 3.2. Không đưa `unitCost` vào snapshot hóa đơn

Hóa đơn được in/gửi cho khách. Giá vốn lọt ra ngoài là rò rỉ dữ liệu kinh doanh. Service render phải strip trường này; viết test khẳng định payload trả về không chứa `unitCost`.

---

## 4. `CashierShift` — Ca thu ngân (A6)

```ts
export type ShiftStatus = "open" | "closed" | "reconciled";

export interface IShiftMethodTotal {
  method: RetailPaymentMethod;
  expectedAmount: number;   // hệ thống tính
  countedAmount?: number;   // thu ngân đếm — chỉ có ở tiền mặt là bắt buộc
  varianceAmount?: number;  // countedAmount - expectedAmount
}

export interface ICashMovement {
  type: "in" | "out";       // nộp thêm quỹ / rút tiền giữa ca
  amount: number;
  reason: string;
  at: Date;
  by: string;
  byName: string;
}

export interface ICashierShift {
  shiftCode: string;
  companyCode: string;
  branchId: string;
  terminalId?: string;          // mã quầy/máy POS

  cashierId: string;
  cashierName: string;

  openingFloat: number;         // quỹ đầu ca
  openedAt: Date;
  openedBy: string;

  cashMovements: ICashMovement[];

  orderCount: number;
  totalRevenue: number;         // tổng grandTotal đơn hợp lệ trong ca
  totalRefund: number;          // A13 — hoàn tiền trong ca
  methodTotals: IShiftMethodTotal[];

  expectedCash: number;         // openingFloat + thu tiền mặt + in - out - hoàn tiền mặt
  countedCash?: number;
  varianceAmount?: number;      // countedCash - expectedCash
  varianceReason?: string;

  status: ShiftStatus;
  businessDate: string;
  closedAt?: Date;
  closedBy?: string;

  approvedBy?: string;          // ca trưởng xác nhận chênh lệch
  approvedByName?: string;
  approvedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

Index — điểm mấu chốt của A6:

```ts
// "Chỉ cho một ca hợp lệ đang mở theo người/quầy".
// Partial unique index là cách duy nhất ép ở tầng DB, không phụ thuộc check ở service.
CashierShiftSchema.index(
  { companyCode: 1, branchId: 1, cashierId: 1 },
  { unique: true, partialFilterExpression: { status: "open" } }
);
CashierShiftSchema.index({ companyCode: 1, branchId: 1, businessDate: -1 });
CashierShiftSchema.index({ companyCode: 1, status: 1 });
```

### 4.1. Quy tắc

| Yêu cầu A6 | Cách hiện thực |
|---|---|
| Blind count | `expectedCash` **không** được trả về API cho vai trò thu ngân trước khi `countedCash` đã ghi. Lọc ở tầng service theo quyền, không dựa vào FE ẩn. |
| Bắt buộc lý do khi lệch | `varianceReason` required khi `abs(varianceAmount) > threshold` (`config/retail-settings.ts`) |
| Khóa sau đóng ca | `status !== "open"` ⟹ mọi update bị chặn, trừ luồng `approve` có audit |
| Đơn phải nằm trong ca | `RetailOrder.confirm` yêu cầu ca đang mở; không có ca → `409 SHIFT_NOT_OPEN` |

`totalRevenue`, `methodTotals` **tính lại từ `RetailOrder`** lúc đóng ca, không cộng dồn tăng dần — cộng dồn sẽ lệch vĩnh viễn nếu một lần ghi thất bại.

---

## 5. `SalesReturn` — Trả hàng từ khách (A13)

Phiếu độc lập, **không** sửa đơn gốc.

```ts
export type SalesReturnStatus = "draft" | "confirmed" | "cancelled";
export type RefundMethod = "cash" | "transfer" | "exchange" | "credit";

export interface ISalesReturnItem {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;        // lấy từ đơn gốc, không nhập tay
  unitCost: number;
  refundAmount: number;
  serialNumbers?: string[];
  reason: string;
  restock: boolean;         // false khi hàng hỏng không nhập lại kho
}

export interface ISalesReturn {
  returnCode: string;
  companyCode: string;
  branchId: string;
  shiftId?: string;

  orderId: string;          // bắt buộc — không có trả hàng "không đơn"
  orderCode: string;
  customerId?: string;
  customerName?: string;

  items: ISalesReturnItem[];
  totalRefund: number;
  refundMethod: RefundMethod;
  refundReference?: string;

  status: SalesReturnStatus;
  businessDate: string;
  confirmedAt?: Date;
  stockApplied: boolean;

  createdBy: string;
  createdByName: string;
  approvedBy?: string;
  note?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

```ts
SalesReturnSchema.index({ companyCode: 1, returnCode: 1 }, { unique: true });
SalesReturnSchema.index({ orderId: 1 });
SalesReturnSchema.index({ companyCode: 1, branchId: 1, businessDate: -1 });
```

### 5.1. Quy tắc

1. **Không trả vượt.** Với mỗi `productId`: `Σ quantity` của tất cả `SalesReturn` `confirmed` trên cùng `orderId` `<=` `quantity` trong đơn gốc. Kiểm tra trong transaction lúc confirm, không kiểm ở FE.
2. `unitPrice` **copy từ đơn gốc**. Không cho client gửi giá — nếu không sẽ hoàn tiền cao hơn giá đã bán.
3. Kiểm tra thời hạn đổi trả: `now - order.confirmedAt <= returnWindowDays` (cấu hình).
4. `restock === true` ⟹ sinh stock log **nhập**; `false` ⟹ không tác động tồn nhưng vẫn hoàn tiền.
5. Không sửa/xóa stock log gốc của đơn bán — sinh log mới chiều ngược lại.
6. Confirm phiếu trả ⟹ đảo hoa hồng A9 và trừ doanh thu khỏi báo cáo A5 của kỳ tương ứng.

---

## 6. `ProductSerial` — IMEI/Serial (B8)

```ts
export type SerialStatus = "in_stock" | "sold" | "returned" | "defective" | "transferred";

export interface IProductSerial {
  serialNumber: string;      // IMEI hoặc serial
  productId: string;
  sku: string;
  companyCode: string;
  branchId: string;

  status: SerialStatus;

  inboundStockLogId?: string;
  orderId?: string;          // đơn đã bán
  orderCode?: string;
  soldAt?: Date;
  returnId?: string;

  warrantyMonths?: number;
  warrantyExpiresAt?: Date;  // D-group (bảo hành) sẽ dùng

  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

```ts
// Serial là định danh vật lý — không được trùng trong cùng doanh nghiệp,
// kể cả khác chi nhánh (hàng có thể điều chuyển).
ProductSerialSchema.index({ companyCode: 1, serialNumber: 1 }, { unique: true });
ProductSerialSchema.index({ companyCode: 1, productId: 1, status: 1 });
ProductSerialSchema.index({ orderId: 1 });
```

Quy tắc: chỉ serial `status === "in_stock"` và đúng `branchId` của đơn mới được bán. Bán xong → `sold`; trả hàng `restock: true` → `returned` rồi `in_stock`; `restock: false` → `defective`.

---

## 7. Liên kết với `StockLog` hiện có (A3)

Không tạo collection kho mới. Bổ sung **3 trường** vào `server/model/stock-log.model.ts`:

```ts
// Thêm vào StockLogSchema:
refType: { type: String, enum: ["retail-order", "sales-return", "supplier-return"], index: true },
refId:   { type: String, index: true },
idempotencyKey: { type: String, index: true },

// Chặn trừ/hoàn kho hai lần ở tầng DB — đây là bảo vệ thật sự,
// không phải check "đã tồn tại chưa?" ở service (vẫn đua race).
StockLogSchema.index(
  { companyCode: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);
```

Khóa idempotency:

| Nghiệp vụ | `idempotencyKey` |
|---|---|
| Xác nhận đơn | `order:{orderId}:out` |
| Hủy đơn, hoàn tồn | `order:{orderId}:revert` |
| Trả hàng từ khách | `return:{returnId}:in` |

Retry lần hai ném `E11000 duplicate key` → service bắt lỗi này và coi là **thành công** (thao tác trước đã ghi). Đây là cách duy nhất đúng cho yêu cầu A3 "thao tác lặp không làm trừ kho hai lần"; dùng `findOne` rồi `insert` vẫn hở khi hai request vào cùng lúc.

`partialFilterExpression` bắt buộc — nếu thiếu, hàng nghìn stock log cũ không có `idempotencyKey` sẽ đụng nhau ở giá trị `null`.

---

## 8. Sơ đồ quan hệ

```
                        ┌──────────────────┐
                        │ RetailOrderCounter│  (cấp orderCode nguyên tử)
                        └────────┬─────────┘
                                 │
   Product ──snapshot──▶ ┌───────▼────────┐ ◀──shiftId── CashierShift
   (giá, giá vốn)        │  RetailOrder   │                  (A6)
                         └───┬────┬───┬───┘
                             │    │   │
              1-1 (issued)   │    │   └──orderId──▶ SalesReturn (A13)
              ┌──────────────┘    │                      │
              ▼                   │                      │
       RetailInvoice (A2)         │                      │
              │                   │                      │
              └── externalInvoiceId ─▶ C1 (sau này)       │
                                  │                      │
                    refType/refId │                      │ refType/refId
                                  ▼                      ▼
                            ┌──────────────────────────────┐
                            │  StockLog (đã có) + idem key │
                            └──────────────────────────────┘
                                  ▲
                                  │ serialNumbers
                            ProductSerial (B8)
```

---

## 9. Thứ tự dựng model

| # | Model | Phụ thuộc | Ước lượng |
|---|---|---|---|
| 1 | Mở rộng `StockLog` (`refType`, `refId`, `idempotencyKey`) | — | 0.5 ngày |
| 2 | `RetailOrderCounter` | — | 0.5 ngày |
| 3 | `RetailOrder` | 1, 2 | 2 ngày |
| 4 | `CashierShift` | 3 | 1 ngày |
| 5 | `RetailInvoice` | 3 | 1 ngày |
| 6 | `SalesReturn` | 3, 1 | 1 ngày |
| 7 | `ProductSerial` | 3 | 1 ngày |

Model 1–4 thuộc Giai đoạn 1 (P0). Model 6–7 đẩy sang P2 theo timeline.

---

## 10. Checklist test bắt buộc trước khi merge

- [ ] Xác nhận đơn hai lần đồng thời → chỉ 1 stock log xuất (test race thật, hai promise song song)
- [ ] Hủy rồi xác nhận lại → tồn kho về đúng số ban đầu
- [ ] Mở ca thứ hai cho cùng thu ngân → bị DB từ chối (`E11000`), không phải chỉ lỗi ở service
- [ ] Đổi `product.price` sau khi bán → báo cáo A5 kỳ cũ **không** đổi
- [ ] Tổng `grandTotal` đơn hợp lệ trong ca === `methodTotals` cộng lại
- [ ] Trả hàng vượt số lượng đơn gốc → bị chặn, kể cả khi gửi 2 request song song
- [ ] Payload hóa đơn trả về client **không** chứa `unitCost`
- [ ] Thu ngân gọi API ca đang mở → response **không** chứa `expectedCash`
- [ ] Bán serial đã `sold` → bị chặn
- [ ] Mọi query đều lọc `companyCode` (test cross-tenant leak, theo pattern `worker-module-isolation.test.ts`)

