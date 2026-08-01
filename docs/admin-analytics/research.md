# Nghiên cứu: Trang Tổng quan riêng cho Admin (Phân tích & Báo cáo doanh thu)

> Tài liệu khảo sát, thiết kế và nhật ký triển khai.
> Nhánh: `feat/admin-analytics-dashboard`.

## 0. Tình trạng triển khai

| Giai đoạn | Trạng thái | Commit |
|---|---|---|
| Khảo sát & thiết kế | ✅ Xong | `d42df1c7` |
| GĐ 1 — Khung trang + gate bảo mật | ✅ Xong | `fe3ea5d7` |
| Mục 8.5 — Chuẩn hóa ngày thanh toán (`paidOn`) | ✅ Xong | `cc6995f7` |
| GĐ 2 — Doanh thu học phí theo thời gian | ✅ Xong | `42026a58` |
| GĐ 3 — Schema kho (`unitPrice`, `purpose`, `costPrice`) | ✅ Xong | working tree |
| GĐ 4 — Gộp 2 nguồn doanh thu + lãi gộp | ✅ Xong | working tree |
| GĐ 5 — Công nợ & chi phí | ⬜ Chưa làm | |
| GĐ 6 — Xuất báo cáo Excel/CSV | ⬜ Chưa làm | |

### Đã tạo

| File | Vai trò |
|---|---|
| `server/router/analytics.router.ts` | Gate `requireRole` ở **cấp router** + validation query |
| `server/controller/analytics.controller.ts` | `/meta`, `/revenue` |
| `server/service/analytics.service.ts` | `getMeta`, `getTuitionRevenue` |
| `server/modules/student-management/utils/payment-date.util.ts` | Parser ngày `DD/MM/YYYY` + `YYYY-MM-DD` |
| `server/scripts/backfill-payment-paid-on.ts` | Backfill `paidOn` (`yarn backfill:payment-paid-on`) |
| `src/pages/AnalyticsTab.tsx` | Trang báo cáo |
| `src/components/analytics/RevenueChart.tsx` | Biểu đồ cột doanh thu |
| `src/services/analyticsService.ts` | Client API |

Test: 23 test (4 gate API, 4 gate route, 8 parser ngày, 2 validation, 7 aggregation… một số file gộp nhiều nhóm). Aggregation mock Mongo nên chạy không cần DB.

### Phát hiện quan trọng trong lúc làm (không có trong khảo sát ban đầu)

**`getAllowedOwnerIds` thu hẹp theo `branchId` của chính người đăng nhập** (`auth.util.ts:79-83`). Nếu dùng lại hàm này cho báo cáo, **admin có gán chi nhánh sẽ chỉ thấy doanh thu chi nhánh mình** — trái với yêu cầu báo cáo toàn công ty. Vì vậy `analytics.service.ts` có `resolveCompanyOwnerIds` riêng, luôn ở phạm vi công ty. Đây là chỗ dễ bị "sửa lại cho thống nhất" nên đã ghi chú ngay trong code.

### Việc còn treo

- **Chưa xem biểu đồ chạy thật.** Cần MongoDB + dữ liệu `Payment` + tài khoản admin. Geometry và nhãn trục mới chỉ kiểm qua đọc code, `tsc` và `vite build`. Nên nhìn tận mắt trước khi merge.
- **`docs/` và `server/scripts/` đều nằm trong `.gitignore`** (dòng 46 và 21) nhưng vẫn có file được track — phải dùng `git add -f`. Hệ quả đã lộ ra: `server/scripts/reset-superadmin-totp.ts` được khai báo trong `package.json` mà **không có trong repo**, ai clone mới chạy sẽ lỗi.
- **Repo trộn 2 test runner trong cùng thư mục** — `services/payment-branch-isolation.test.ts` là vitest, `utils/*.test.ts` là `node:test`. Không có cách nào biết trước ngoài mở file ra xem.

## 1. Hiện trạng

| Thành phần | Vị trí | Ghi chú |
|---|---|---|
| Trang tổng quan chung | `src/pages/DashboardTab.tsx` (849 dòng) | Dùng chung cho **mọi** vai trò |
| API tổng hợp | `GET /api/v1/dashboard/summary`, `/action-items` | `server/router/dashboard.router.ts` |
| Service tổng hợp | `server/service/dashboard.service.ts` (304 dòng) | Đã có `getProjectStats`, `getStudentStats` (có `tuitionAgg`, `outstandingDebt`), `getTimekeepingStats`, `getChatStats`, `getResourceStats` |
| Lọc theo quyền | `dashboard-module-access.ts` + `getEffectivePermissions` | Summary đã tự cắt bớt khối theo module bật/quyền user |

**Kết luận:** trang tổng quan hiện tại là *dashboard vận hành* (đếm số lượng, việc cần xử lý), **chưa có** trục thời gian, so sánh kỳ, hay bất kỳ chỉ số tài chính/doanh thu nào. Đây là khoảng trống cần lấp.

## 2. Nguồn dữ liệu doanh thu có sẵn trong DB

Đây là phần quan trọng nhất — quyết định báo cáo nào làm được ngay, cái nào cần bổ sung schema.

### Dòng tiền vào (doanh thu)

| Nguồn | Model | Trường dùng được | Đánh giá |
|---|---|---|---|
| **Học phí đã thu** | `student-management/models/payment.model.ts` (`Payment`) | `amount: Number`, `date: String`, `studentId`, `ownerId`, `branchId`, `createdAt` | ✅ **Nguồn doanh thu chuẩn nhất.** Có sẵn số tiền dạng Number, có owner + branch để scope. |
| Học phí trên hồ sơ học viên | `student.model.ts` | `fee: String`, `paidAmount: Number`, `paymentHistory[]`, `installmentStatus[]` (`amountDue`, `status`, `paidAt`) | ⚠️ `fee` là **String** → `dashboard.service.ts` đã phải có `parseFeeString()`. Dùng để tính **công nợ phải thu**, không nên dùng làm doanh thu ghi nhận. |
| Nạp ví / giao dịch cổng thanh toán | `transaction.model.ts` | `amount`, `type: deposit\|payment\|withdraw`, `status`, `createdAt`, `completedAt` | ⚠️ Là ví nội bộ theo `userId`, **không có `companyCode`** → khó quy về doanh thu doanh nghiệp. Xem mục Rủi ro. |
| **Xuất kho / bán hàng** | `stock-log.model.ts` + `product.model.ts` | `type: "xuất"`, `items[].quantity`, `companyCode`, `branchId`, `createdAt`; `Product.price: Number` (required) | ⚠️ Có giá sản phẩm nhưng **StockLog không snapshot giá tại thời điểm xuất**, và `"xuất"` gộp chung bán hàng lẫn xuất nội bộ. Xem mục 2.1 — bắt buộc bổ sung schema. |

### Dòng tiền ra (chi phí)

| Nguồn | Model | Ghi chú |
|---|---|---|
| **Lương** | `payroll-run.model.ts`, `payroll-payment.model.ts`, `payroll-line-read.service.ts` | ✅ Đầy đủ nhất — có kỳ lương, trạng thái, thanh toán. Cho phép tính "chi phí nhân sự / kỳ". |
| **Hoa hồng đối tác** | `student-management/models/partner.model.ts` → `payoutHistory[]` (`amount`, `date`) + `commission-level.model.ts` | ✅ Dùng được ngay. |

### 2.1 Doanh thu kho hàng — 4 vấn đề schema phải xử lý

Nghiệp vụ đã xác nhận doanh thu gồm **học phí/lao động + bán hàng từ kho**. Nhưng `StockLog` hiện tại được tạo qua CRUD tổng quát (`crud.controller.ts`), không có luồng bán hàng riêng, dẫn tới 4 thiếu sót:

| # | Vấn đề | Hệ quả nếu không sửa | Cách xử lý đề xuất |
|---|---|---|---|
| 1 | **`StockLog.items[]` không lưu đơn giá** (chỉ `productId`, `sku`, `productName`, `quantity`) | Phải join sang `Product.price` *hiện tại*. Sửa giá bán hôm nay → **doanh thu tháng trước tự động đổi theo**. Báo cáo tài chính không được phép như vậy. | Thêm `unitPrice: Number` + `lineTotal: Number` vào `StockLogItemSchema`, ghi snapshot lúc tạo phiếu |
| 2 | **`type: "xuất"` gộp mọi loại xuất kho** — bán hàng, xuất dùng nội bộ, hỏng/hủy, chuyển chi nhánh | Doanh thu bị **thổi phồng**: xuất 100 cái hàng hỏng cũng thành doanh thu | Thêm `purpose: "bán" \| "nội bộ" \| "hủy" \| "chuyển kho"`, chỉ `"bán"` tính vào doanh thu. Mặc định dữ liệu cũ = `"bán"` hay `"nội bộ"` cần nghiệp vụ chốt |
| 3 | **Không có giá vốn** — `Product` chỉ có `price` (giá bán) | Tính được doanh thu nhưng **không tính được lãi gộp** hàng hóa | Thêm `costPrice: Number` vào `Product`, và snapshot `unitCost` vào StockLog item |
| 4 | **Không có khách hàng / đối tượng mua** trên `StockLog` | Không làm được báo cáo doanh thu theo khách hàng | Chấp nhận bỏ qua ở GĐ 1, hoặc thêm `customerRef` sau |

**Migration:** dữ liệu `StockLog` cũ không có `unitPrice`. Hai lựa chọn — (a) backfill bằng `Product.price` hiện tại và **đánh dấu rõ là số ước tính**, hoặc (b) báo cáo doanh thu kho chỉ tính từ ngày triển khai. Khuyến nghị **(b)** cho con số chính thức, kèm (a) hiển thị riêng dưới nhãn "ước tính (dữ liệu trước MM/YYYY)" — không trộn hai loại vào cùng một đường biểu đồ.

### Chốt phạm vi khả thi

- **Làm được ngay (không đổi schema):** doanh thu học phí theo thời gian, công nợ phải thu, chi phí lương, chi hoa hồng, doanh thu theo chi nhánh / khóa học / đối tác giới thiệu.
- **Cần bổ sung schema trước khi làm:** doanh thu bán hàng từ kho (4 mục ở 2.1).
- **Loại khỏi phạm vi:** `Transaction` (thiếu `companyCode`, là ví nội bộ theo user — không phải doanh thu doanh nghiệp).

## 3. Kiến trúc đề xuất

### 3.1 Tách trang riêng, không nhồi vào `DashboardTab`

Đề xuất **tab mới** thay vì thêm sub-tab vào Tổng quan:

- Tab: `"PHÂN TÍCH & BÁO CÁO"` — path `/phan-tich`
- Lý do: `DashboardTab.tsx` đã 849 dòng và dùng chung mọi role; nhét thêm logic tài chính + điều kiện ẩn/hiện vào đó sẽ làm rối và dễ rò rỉ dữ liệu qua các nhánh render.

### 3.2 Ẩn với user thường — phải làm **3 tầng**

Chỉ ẩn ở sidebar là không đủ (user gõ thẳng URL `/phan-tich` vẫn vào được, và API vẫn trả dữ liệu).

**Tầng 1 — Sidebar** (`src/pages/Sidebar.tsx`): thêm menu item trong nhánh `if (role === "superadmin" || role === "admin")` đã có sẵn ở dòng ~122 (cùng chỗ đang push `"QUẢN TRỊ USER"`).

**Tầng 2 — Router** (`src/router/route-config.tsx`): dùng đúng cơ chế `canAccess` đã có — `AppRouterView.tsx:17` sẽ render "Bạn không có quyền truy cập khu vực này." nếu fail.

```ts
{
  tab: "PHÂN TÍCH & BÁO CÁO",
  component: lazy(() => import("../pages/AnalyticsTab")),
  canAccess: (u) => u.role === "superadmin" || u.role === "admin",
}
```

**Tầng 3 — API (bắt buộc, là tầng thật sự bảo vệ dữ liệu)**: router mới `server/router/analytics.router.ts` gắn `requireAuth` + `requireRole(["admin", "superadmin"])` (`server/middleware/auth.ts:146`). Không có tầng này thì user thường vẫn `curl` được số liệu doanh thu.

### 3.3 Phân quyền: thuần role

Nghiệp vụ đã chốt **`branch_owner` dùng trang Tổng quan chung**, không vào trang phân tích. Vậy gate đơn giản nhất là đúng nhất:

```ts
requireRole(["admin", "superadmin"])   // server/middleware/auth.ts:146
```

Không cần thêm mã quyền `analytics:read` vào `permission-catalog.ts`. Đây chính xác là cách `"QUẢN TRỊ USER"` đang làm (`route-config.tsx:56`, `Sidebar.tsx:122`) — bám theo tiền lệ có sẵn thay vì tạo cơ chế thứ hai.

**Hệ quả tích cực về scope dữ liệu:** vì chỉ admin/superadmin xem, mọi truy vấn luôn ở phạm vi **toàn công ty**. Không cần logic lọc `branchId` theo người dùng — bỏ được toàn bộ nhóm lỗi rò rỉ dữ liệu chéo chi nhánh mà `payment-branch-isolation.test.ts` / `crud-branch-scope.test.ts` đang phải canh. `branchId` chỉ còn là **bộ lọc tùy chọn trên UI** để admin bóc tách, không phải ràng buộc bảo mật.

Nếu sau này kế toán cần xem báo cáo, nâng cấp lên permission-based là sửa một dòng — không cần thiết kế trước cho tình huống chưa xảy ra.

## 4. Thiết kế API

```
GET /api/v1/analytics/meta                     # ✅ đã có — tình trạng sẵn sàng từng nguồn
GET /api/v1/analytics/revenue?from=&to=&granularity=day|week|month   # ✅ đã có
GET /api/v1/analytics/receivables?asOf=        # GĐ 5
GET /api/v1/analytics/expenses?from=&to=       # GĐ 5
GET /api/v1/analytics/pnl?from=&to=            # GĐ 5 — gộp revenue - expenses
GET /api/v1/analytics/breakdown?dimension=branch|course|partner|status&from=&to=   # GĐ 4
GET /api/v1/analytics/export?format=xlsx|csv&report=...             # GĐ 6
```

`/meta` không nằm trong thiết kế ban đầu, thêm vào khi làm GĐ 1: UI cần biết nguồn
nào chưa đủ dữ liệu để **ẩn khối đó kèm lý do**, thay vì vẽ số 0 — số 0 trong báo
cáo tài chính bị đọc là "không có doanh thu", khác hẳn "chưa có dữ liệu".

Tất cả đi qua `requireAuth` → `requireRole(["admin","superadmin"])`, và **luôn** ép `companyCode` từ `req.user` vào query — không bao giờ nhận `companyCode` từ client. `branchId` trên query string chỉ là bộ lọc hiển thị, không phải ranh giới bảo mật (xem 3.3).

Thêm tham số `source=tuition|goods|all` để tách/gộp hai dòng doanh thu.

### Response shape đề xuất (revenue)

```ts
{
  status: "success",
  data: {
    range: { from, to, granularity },
    total: number,
    previousTotal: number,          // kỳ liền trước, cùng độ dài
    growthPct: number | null,       // null khi chưa có kỳ trước — KHÔNG phải 0
    series: [{ bucket: "2026-07-01", amount: number, count: number }],
    excludedRecords: number,        // giao dịch thiếu paidOn, không xếp được vào kỳ nào
    currency: "VND"
  }
}
```

Hai điểm khác thiết kế ban đầu, đều để tránh đọc sai số liệu:

- **`growthPct` có thể là `null`.** Ban đầu định để `number`. Nhưng khi kỳ trước
  bằng 0 thì trả `0` sẽ bị đọc là "không tăng trưởng", trong khi sự thật là "chưa
  có gì để so". UI hiển thị chữ thay vì con số trong trường hợp này.
- **Thêm `excludedRecords`.** Giao dịch thiếu `paidOn` bị loại khỏi mọi kỳ. Không
  báo ra thì báo cáo thiếu tiền mà không ai biết tại sao.

Chi tiết cài đặt: kỳ so sánh dùng `$lt` (không phải `$lte`) tại biên dưới, nếu
không thì thời điểm giao nhau giữa hai kỳ bị đếm hai lần.

## 5. Nội dung trang

**Hàng KPI (5 thẻ):** Tổng doanh thu (± % so kỳ trước) · Doanh thu học phí · Doanh thu bán hàng · Công nợ phải thu · Lợi nhuận gộp.

**Biểu đồ:**
1. **Cột chồng — doanh thu theo thời gian, tách 2 lớp học phí / bán hàng.** Đây là biểu đồ chính: nó trả lời trực tiếp câu hỏi "tiền đến từ đâu" mà cấu trúc 2 nguồn doanh thu đặt ra. Kèm đường kỳ trước để so sánh.
2. Cột chồng — doanh thu theo chi nhánh.
3. Thanh ngang — doanh thu theo khóa học / theo nhóm sản phẩm (`Product.category`).
4. Thanh ngang — Top 10 đối tác giới thiệu theo doanh thu mang về.
5. Aging công nợ — quá hạn 0–30 / 31–60 / 60+ ngày, từ `installmentStatus[].status !== "Đã thu"`.
6. Phễu — trạng thái học viên (`"Chờ KSK"` → `"Đã đậu"`) kèm giá trị tiền mỗi bước.

**Lãi gộp** = (học phí thu) + (doanh thu hàng − giá vốn hàng) − lương − hoa hồng. Chỉ hiển thị được sau khi có `costPrice` (mục 2.1 #3); trước đó ẩn thẻ này thay vì hiện số sai.

**Bảng:** chi tiết giao dịch có phân trang + xuất Excel/CSV.

**Bộ lọc:** khoảng ngày (kế thừa ngữ nghĩa `day|week|year|custom` đã có ở `dashboard.controller.ts:14`), chi nhánh, khóa học.

> Khi dựng biểu đồ nên chạy skill `dataviz` trước để thống nhất bảng màu / kiểu trục với phần còn lại của app.

## 6. Rủi ro & điểm cần quyết định

1. **`fee` là String** (`course.model.ts:14`, `student.model.ts:88`). `parseFeeString()` trong `dashboard.service.ts:60` là giải pháp chữa cháy. Với báo cáo tài chính, sai số parse là không chấp nhận được → nên **chỉ tính doanh thu từ `Payment.amount` (Number)**, còn `fee` chỉ dùng cho công nợ và phải có test cho các định dạng chuỗi thực tế đang nằm trong DB.
2. **Snapshot giá kho (mục 2.1 #1) là rủi ro cao nhất của cả tính năng.** Nếu phát hành báo cáo khi vẫn join giá hiện tại, số liệu quá khứ sẽ âm thầm thay đổi mỗi lần ai đó sửa giá sản phẩm — sai lệch không có dấu vết, rất khó phát hiện. Phải xong `unitPrice` snapshot **trước** khi bật doanh thu kho.
3. **`Transaction` không có `companyCode`** → loại khỏi phạm vi (đã chốt).
4. **Hiệu năng.** 6 biểu đồ = nhiều `$group` trên `Payment`/`Student`/`StockLog`. Cần: index `{ ownerId: 1, date: 1 }` và `{ branchId: 1, date: 1 }` trên `Payment` (hiện chỉ có index đơn lẻ), index `{ companyCode: 1, type: 1, createdAt: 1 }` trên `StockLog`, và cache kết quả (Redis đã có sẵn — xem `redis/`).
5. **`Payment.date` là String** (`YYYY-MM-DD`?) trong khi `createdAt` là Date. Phải chọn **một** trục thời gian và ghi rõ. Khuyến nghị dùng `date` (ngày nghiệp vụ thu tiền) nhưng cần kiểm tra format thực tế trong DB trước.
6. **Tiền tệ.** `wallet.model.ts` mặc định `USD`, học phí thực tế là VND. Báo cáo phải chốt một đơn vị và không trộn.

## 7. Kế hoạch triển khai

**Giai đoạn 1 — Khung + bảo mật — ✅ xong (`fe3ea5d7`)**

Gate `requireRole` được gắn ở **cấp router** (`.use()`) thay vì từng route, để endpoint thêm về sau được bảo vệ mặc định — không phụ thuộc người viết có nhớ gắn middleware hay không. Test khẳng định đúng tính chất đó, không chỉ test endpoint hiện có.

- `src/types/common.ts`: thêm `"PHÂN TÍCH & BÁO CÁO"` vào `TabType`
- `src/seo/seo-config.ts`: thêm entry `path: "/phan-tich"`
- `src/router/route-config.tsx`: route + `canAccess`
- `src/pages/Sidebar.tsx`: menu item trong nhánh admin (~dòng 122)
- `server/router/analytics.router.ts` (`requireAuth` + `requireRole`) + đăng ký ở `server/router/index.ts`
- **Test:** user thường / `branch_owner` gọi API → 403; gõ thẳng `/phan-tich` → chặn ở router (theo mẫu `superAdminRoute.test.ts`, `module-route-guards.test.ts`)

**Giai đoạn 2 — Doanh thu học phí — ✅ xong (`42026a58`)**

Aggregation trên `Payment.paidOn`, KPI + biểu đồ cột, so sánh kỳ trước. Biểu đồ một chuỗi nên bỏ legend; màu lấy từ slot categorical 1 và đã **chạy validator** (đạt lightness, chroma, contrast trên cả nền sáng lẫn nền tối) thay vì ước lượng bằng mắt.

**Giai đoạn 3 — Schema kho — ✅ xong:**
- `StockLogItemSchema`: thêm `unitPrice`, `lineTotal`, `unitCost`
- `StockLogSchema`: thêm `purpose`
- `ProductSchema`: thêm `costPrice`
- Cập nhật luồng tạo phiếu xuất để ghi snapshot
- Index `{ companyCode: 1, type: 1, createdAt: 1 }`
- Chốt mốc "doanh thu kho tính từ ngày X"

Server tự tra Product theo `companyCode` + `branchId` và ghi snapshot, không tin
giá do client gửi lên. Phiếu xuất mới, kể cả import Excel, bắt buộc có
`purpose`; phiếu lịch sử vẫn để trống. Mốc doanh thu kho bắt đầu từ
phiếu có snapshot; không backfill giá cho dữ liệu cũ.

**Giai đoạn 4 — Gộp doanh thu — ✅ xong:** biểu đồ cột chồng 2 nguồn, breakdown theo nhóm sản phẩm, lãi gộp hàng hóa. Chỉ phiếu `xuất` có `purpose = bán` được tính; doanh thu và giá vốn lấy từ snapshot trên từng dòng. Dòng thiếu giá bán bị loại và được cảnh báo; nếu bất kỳ dòng bán nào thiếu giá vốn thì KPI lãi gộp bị ẩn thay vì báo số thấp sai lệch.

**Giai đoạn 5 — Công nợ & chi phí:** aging từ `installmentStatus`, lương từ payroll, hoa hồng từ `partner.payoutHistory`, P&L đầy đủ.

**Giai đoạn 6 — Xuất báo cáo:** Excel/CSV (tham khảo `payroll-export.service.ts`).

## 8. Quyết định đề xuất

Nguyên tắc xuyên suốt: **báo cáo tài chính thà thiếu còn hơn sai theo hướng lạc quan.** Doanh thu bị thổi phồng dẫn tới quyết định kinh doanh sai và gần như không ai phát hiện ra; doanh thu thiếu thì thấy ngay và sửa được.

### 8.1 Trục thời gian — đã triển khai bằng `paidOn` (tốt hơn `createdAt`)

> **Cập nhật so với đề xuất ban đầu.** Ban đầu định gom nhóm theo `createdAt`.
> Khi triển khai đã làm thẳng phương án đúng hơn: thêm hẳn `paidOn: Date` và
> backfill từ `date`. Lý do: `createdAt` là lúc *nhập liệu*, nên phiếu nhập lùi
> ngày (thu tiền cuối tháng, nhập đầu tháng sau) sẽ rơi sai kỳ. `paidOn` giữ đúng
> *ngày thu tiền*. Phần phân tích bên dưới vẫn giữ nguyên vì nó giải thích vì sao
> không được dùng `Payment.date`.

`Payment.date` được ghi qua `toDisplayDate()` (`src/modules/student-management/lib/utils.ts:68-75`) từ `AddPaymentModal.tsx:141`, tức lưu dạng **`DD/MM/YYYY`**. Validation phía server chỉ là `Joi.string().required()` (`payment.validation.ts:15`) — không ràng buộc format, nên DB nhiều khả năng lẫn cả `YYYY-MM-DD` (dữ liệu import/cũ) lẫn `DD/MM/YYYY`.

Chuỗi `DD/MM/YYYY` **không so sánh được theo thứ tự** (`"02/01/2026" < "15/12/2025"` về mặt chuỗi), nên mọi `$gte`/`$lte` lọc khoảng ngày trên trường này đều cho kết quả sai lặng lẽ.

**Quyết định:** gom nhóm và lọc theo `createdAt` (Date thật, có sẵn nhờ `timestamps: true`). `date` chỉ dùng để hiển thị.

**Hệ quả cần biết:** `createdAt` là lúc *nhập liệu*, `date` là *ngày thu tiền thực tế*. Với phiếu nhập lùi ngày (thu tiền cuối tháng, nhập đầu tháng sau) hai mốc lệch nhau → doanh thu rơi sai kỳ. Khắc phục đúng đắn: thêm `paidOn: Date` vào `Payment`, ghi song song từ nay, backfill bằng cách parse `date` (parse được cả hai format vì `DD/MM` vs `YYYY-MM` phân biệt được qua độ dài phần đầu). Đưa vào GĐ 2.

### 8.2 `StockLog` cũ: **không gán mặc định**, để `purpose: undefined`

Không chọn "bán" (thổi phồng doanh thu) cũng không chọn "nội bộ" (bịa ra một sự thật khác). Cả hai đều là **bịa dữ liệu lịch sử**.

**Quyết định:** `purpose` không có default. Phiếu cũ để trống = "chưa phân loại", **không tính vào doanh thu**, và UI hiện banner *"N phiếu xuất kho chưa phân loại — chưa được tính vào doanh thu"* kèm link tới màn phân loại hàng loạt. Admin tự quyết định phân loại tới đâu; con số luôn trung thực về chính giới hạn của nó.

Phiếu tạo **từ sau khi triển khai** thì `purpose` là **bắt buộc** — chặn ngay tại nguồn để vấn đề không tái diễn.

### 8.3 Doanh thu kho: tính từ ngày triển khai, không backfill giá

Nhất quán với 8.2. Backfill `unitPrice` bằng `Product.price` hiện tại tạo ra những con số **trông như số thật nhưng là suy đoán** — nguy hiểm hơn ô trống, vì không ai nhớ nó là ước tính sau vài tháng.

**Quyết định:** biểu đồ doanh thu kho bắt đầu từ mốc triển khai, phần trước đó hiển thị vùng xám có nhãn *"chưa có dữ liệu giá"*.

### 8.4 `costPrice`: có làm, nhưng lùi sang GĐ 4

Lãi gộp là chỉ số admin thực sự cần. Nhưng nó phụ thuộc `costPrice` + snapshot `unitCost`, mà hai thứ này lại phụ thuộc luồng nhập kho. Làm sau khi doanh thu đã chạy đúng.

**Quyết định:** GĐ 1–3 **ẩn hẳn** thẻ Lợi nhuận gộp (không hiện số 0, không hiện "—" gây hiểu nhầm là lãi bằng 0). Bật lên ở GĐ 4.

### 8.5 Việc nên làm ngay, độc lập với dashboard — ✅ phần `Payment` đã xong (`cc6995f7`)

Ba thứ dưới đây là **nợ kỹ thuật đang âm thầm sinh dữ liệu bẩn** mỗi ngày. Sửa sớm thì lượng dữ liệu phải vá về sau càng ít:

1. ✅ Siết `payment.validation.ts` — regex format ngày thay vì `Joi.string()`.
2. ✅ Thêm `paidOn: Date` (có index) vào `Payment`, ghi khi tạo + script backfill.
3. ✅ Thêm `purpose` (required) + `unitPrice`/`lineTotal` snapshot vào luồng tạo `StockLog` — GĐ 3.

Kể cả khi trang phân tích bị hoãn, ba việc này vẫn đáng làm.

**Ghi chú khi làm mục 1–2:** chỉ có đúng **một** luồng tạo giao dịch
(`AddPaymentModal.tsx:135`) và nó gửi `DD/MM/YYYY`, nên siết validation không phá
vỡ gì. Cũng **không có luồng update** nào sửa `date`, nên `paidOn` không thể lệch
khỏi `date` về sau. Parser dùng UTC để ngày không trôi theo múi giờ máy chủ, và
từ chối ngày tràn (`31/02` → `null`) thay vì để `Date` âm thầm quy đổi sang tháng sau.
