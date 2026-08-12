# Finance Receivables and Reminders Design

## 1. Mục tiêu

Xây module `finance` độc lập cho hai phạm vi đầu tiên của `docs/dac-ta-module-finance.md`:

1. A4 — công nợ khách hàng với ledger append-only.
2. A12 — quét và nhắc công nợ quá hạn.

Finance trở thành nguồn dữ liệu công nợ đích. Retail tiếp tục hoạt động trong giai đoạn chuyển tiếp qua adapter tương thích; không tạo hai nguồn dữ liệu cùng được phép ghi lâu dài. Tab `TÀI CHÍNH` cung cấp Công nợ, Tuổi nợ và Nhắc nợ; trang khách hàng Retail giữ tổng dư nợ và liên kết mở Finance.

Không thuộc phạm vi đợt này: A7 chi phí, A11 tài sản cố định, SMS/ZNS, công nợ sửa chữa chưa có nguồn event, và xóa ngay API/model công nợ Retail cũ.

## 2. Ràng buộc hiện trạng

- Retail hiện có `RetailReceivableEntry`, ledger, điều chỉnh, reversal, đối soát và nhắc nợ riêng.
- Hạ tầng outbox tổng quát trong đặc tả liên kết chưa tồn tại; `inventory-event-bus.ts` chỉ là bus in-memory chuyên dụng và không đủ cho tác động tài chính.
- Finance không được ghi trực tiếp `RetailOrder`; Retail không được ghi trực tiếp model Finance.
- Mọi scope tài chính lấy `companyCode` và `branchId` từ actor/guard, không tin scope trong body.
- Thay đổi `.github/workflows/cd.yml` hiện có trong checkout chính là thay đổi của người dùng và không thuộc phạm vi.

## 3. Kiến trúc chuyển đổi

Triển khai theo chiến lược song song có kiểm soát:

1. Tạo outbox/event dispatcher dùng chung.
2. Tạo Finance models, ledger service, consumers và API.
3. Retail publish sự kiện trong transaction nghiệp vụ.
4. Backfill dữ liệu Retail hiện có sang Finance bằng khóa nguồn ổn định.
5. Đối soát số dư theo khoản, đơn, khách hàng và chi nhánh.
6. Chuyển UI/API đọc sang Finance qua adapter tương thích.
7. Chỉ ngừng đường ghi công nợ Retail cũ sau khi backfill và đối soát không còn sai lệch.

Trong cửa sổ migration, một giao dịch chỉ có một đường ghi logic. Không dual-write trực tiếp hai collection trong service Retail. Retail ghi order và outbox; Finance consumer ghi Receivable/ledger. Adapter Retail chỉ đọc hoặc chuyển tiếp command sang Finance.

## 4. Hạ tầng domain event

Tạo tại `server/integrations/shared/`:

- `domain-event.model.ts`: outbox bền vững, `eventId` unique, payload snapshot, delivery theo consumer.
- `event-types.ts`: hợp đồng typed cho `retail.order.confirmed`, `retail.order.paid`, `retail.order.cancelled`, `finance.receivable.settled`, `finance.receivable.overdue`.
- `event-bus.ts`: `publish(event, session?)` và `registerConsumer(...)`.
- `event-dispatcher.ts`: claim delivery nguyên tử, retry `1m, 5m, 15m, 1h, 6h`, tối đa 5 lần.
- `retry-policy.ts`: hàm thuần tính lần retry kế tiếp.

`publish` nhận Mongo session để event được ghi cùng transaction với order. Payload Retail chứa đủ snapshot: order/customer/branch, tổng nợ, hạn nợ, actor và thời điểm; consumer không query lại order để dựng trạng thái quá khứ.

Module Finance tắt làm delivery `skipped`, không làm thất bại giao dịch Retail. Mỗi consumer vẫn phải idempotent bằng unique `sourceEventId`; trạng thái delivery không thay thế idempotency ở collection đích.

## 5. Mô hình công nợ Finance

### 5.1. Receivable

Header chứa nguồn, khách hàng, ngày phát sinh/hạn, trạng thái và các cache đọc nhanh:

- `originalAmount`, `paidAmount`, `adjustedAmount`, `balance`.
- `status`: `open`, `partially_paid`, `settled`, `void`, `written_off`.
- `daysOverdue`, `lastReminderAt`, `reminderCount`.
- `reminderSuspendedUntil`, `reminderSuspendReason`.
- `sourceType`, `sourceId`, `sourceCode`, `sourceEventId`.

Unique index bảo vệ `receivableCode`, `sourceEventId` và một khoản hiệu lực trên mỗi nguồn. Query nóng có index theo company/status/dueDate và company/customer/status.

### 5.2. ReceivableEntry

Ledger append-only với các loại `charge`, `payment`, `adjustment`, `refund`, `write_off`, `reversal`.

- Amount có dấu: charge/tăng nợ dương; payment/refund/giảm nợ âm.
- `balanceAfter` chỉ dùng đối soát/hiển thị.
- Adjustment, write-off và reversal bắt buộc lý do.
- Không có endpoint update/delete entry.
- Đảo bút toán tạo entry mới, trỏ `reversalOfEntryId`; mỗi entry chỉ bị đảo một lần.

Chỉ `receivable-ledger.service.ts` được cập nhật cache trên Receivable. Chèn entry và cập nhật header nằm trong cùng transaction. Invariant: `balance === Σ entries.amount`, `paidAmount >= 0`, không thu vượt balance và trạng thái được suy ra từ balance/loại kết thúc.

## 6. Consumer và luồng nghiệp vụ

### Xác nhận đơn có nợ

Retail publish `retail.order.confirmed`. Finance bỏ qua đơn trả đủ; đơn nợ phải có customer và dueDate hợp lệ. Consumer tạo Receivable và charge entry trong một transaction. Event lặp trả thành công mà không tạo thêm dữ liệu.

### Thu nợ

Thu từ Finance tạo payment entry. Khi balance về 0, Finance publish `finance.receivable.settled`. Retail consumer duy nhất của event này cập nhật snapshot `dueAmount/paymentStatus` theo hợp đồng Retail, idempotent và không cho Finance import model Retail.

Trong giai đoạn tương thích, command thu từ UI/API Retail được adapter gọi vào contract Finance; không ghi ledger Retail mới.

### Retail thu thêm hoặc trả đủ tại màn hình đơn

Retail publish `retail.order.paid` với số tiền và định danh giao dịch. Finance tạo payment tương ứng hoặc settle phần còn lại, idempotent theo event.

### Hủy đơn

Retail publish `retail.order.cancelled`. Finance tạo reversal cho phần charge còn hiệu lực và chuyển khoản sang `void`; không xóa hoặc sửa entry lịch sử. Nếu đã thu tiền, luồng hủy Retail phải cung cấp snapshot refund để ledger Finance phản ánh đúng, không tự giả định số tiền.

### Event chưa có nguồn

`retail.return.confirmed` và `repair.ticket.completed` được khai type/contract nếu cần tránh phá schema sau này, nhưng chưa đăng consumer hoạt động cho đến khi module nguồn được triển khai.

## 7. Migration, backfill và chuyển nguồn

Script `server/scripts/backfill-finance-receivables.ts` có ba chế độ:

- `--dry-run`: đọc và báo số khoản/entry sẽ tạo, bỏ qua, lỗi và sai lệch; không ghi.
- `--apply`: tạo Finance Receivable/entries với idempotency key ổn định từ Retail entry/order.
- `--reconcile`: so sánh tổng theo order, customer, branch và company; xuất chi tiết sai lệch, không tự sửa.

Mỗi bản ghi backfill lưu `legacySource`/khóa nguồn xác định, có unique index. Script chạy lại không nhân đôi. Dữ liệu âm, thiếu customer/source hoặc chuỗi ledger không khớp bị đưa vào danh sách lỗi để xử lý thủ công; không đoán và không tự cân bằng.

Điều kiện cutover:

- Không còn lỗi backfill chưa phân loại.
- Sai lệch tổng theo mọi cấp bằng 0.
- Event mới đã được dispatcher xử lý ổn định.
- Adapter Retail và UI Finance đọc cùng kết quả.
- Có cờ cấu hình cutover/rollback; rollback chỉ đổi nguồn đọc/command routing, không xóa dữ liệu Finance.

## 8. Nhắc nợ quá hạn

Job chạy mỗi ngày lúc 08:15 theo timezone doanh nghiệp, đồng thời hỗ trợ chạy tay có quyền.

1. Lọc `open|partially_paid`, `balance > 0`, dueDate trước đầu ngày hiện tại.
2. Bỏ qua khoản đang tạm hoãn.
3. Bỏ qua khoản đã được nhắc trong `reminderIntervalDays`.
4. Tính `daysOverdue` theo ngày nghiệp vụ.
5. Tạo run/delivery record idempotent theo company/branch/chu kỳ/receivable/kênh.
6. Publish `finance.receivable.overdue` và tạo thông báo in-app cho người có `receivable:read` theo scope.
7. Chỉ sau khi enqueue/publish thành công mới cập nhật `lastReminderAt` và `reminderCount`.

Module Marketing tắt không làm run thất bại: delivery marketing là `skipped`, thông báo in-app vẫn hoạt động. SMS/ZNS không được gửi trực tiếp từ Finance. Retry/backoff áp dụng cho delivery tạm thời; lỗi permanent không retry. Manager có thể retry delivery thất bại nhưng unique cycle key vẫn ngăn gửi trùng.

## 9. API và quyền

Quyền mới:

- `receivable:read`
- `receivable:collect`
- `receivable:adjust`

API `/api/v1/finance/receivables` theo đặc tả:

- Danh sách, chi tiết kèm ledger, aging, tổng theo khách.
- Thu tiền, điều chỉnh, write-off, tạm hoãn nhắc và đảo entry.
- Run/history/retry nhắc nợ đặt dưới `/api/v1/finance/reminders`.

Validation chuẩn hóa integer VND dương, ISO date, payment method, lý do và pagination. Error code gồm `RECEIVABLE_ALREADY_SETTLED`, `PAYMENT_EXCEEDS_BALANCE`, `ADJUSTMENT_REASON_REQUIRED`, `ENTRY_ALREADY_REVERSED` và lỗi scope/not-found hiện hành.

## 10. Frontend

Đăng ký module key `finance`, tab `TÀI CHÍNH`, route và permission đồng bộ backend/frontend.

Ba sub-tab đầu:

- `cong-no`: danh sách khoản, tìm kiếm/lọc, badge quá hạn, pagination và drawer chi tiết.
- `tuoi-no`: 4 bucket 0–30, 31–60, 61–90, >90 ngày, tổng và drill-down.
- `nhac-no`: run log, delivery status, chạy tay, retry và tạm hoãn.

`ReceivableDetailDrawer` hiển thị nguồn, khách, hạn, tổng phát sinh/đã thu/điều chỉnh/còn nợ và ledger mới nhất trước. Ledger không có edit/delete. Action được ẩn/khóa theo quyền; server vẫn là lớp bảo vệ cuối.

Trang khách Retail hiển thị Finance balance qua adapter và liên kết sâu tới `TÀI CHÍNH/cong-no?customerId=...`. Không sao chép logic tính số dư về frontend Retail.

## 11. Đối soát nền và quan sát vận hành

Job reconcile hằng đêm so cache header với tổng ledger và ghi run result. Nó không tự sửa cache. Sai lệch tạo notification cho admin/finance manager với receivable id và chênh lệch.

Các chỉ số cần log: event pending/failed/skipped, consumer latency, backfill counts, reconciliation mismatch, reminder queued/sent/skipped/failed và retry count. Không log số điện thoại đầy đủ hoặc payload nhạy cảm.

## 12. Kiểm thử và cổng hoàn thành

- Model/index/permission/route tests.
- Property-style test chuỗi 20 thao tác ledger: balance cache bằng tổng entry.
- Consumer replay test cho confirm/paid/cancel.
- Transaction test: entry và header cùng thành công hoặc cùng rollback.
- Validation thu vượt, adjustment thiếu lý do, reversal lặp và khoản settled.
- Backfill dry-run/apply/re-run/reconcile tests.
- Job nhắc chạy lặp cùng chu kỳ chỉ một delivery; settled/suspended bị loại.
- Marketing tắt vẫn có in-app và delivery skipped.
- UI tests cho danh sách, aging, drawer, thu tiền, điều chỉnh, tạm hoãn, run và retry.
- Adapter compatibility tests cho trang khách Retail.
- Full Finance/Retail tests, typecheck, production build, `git diff --check` và migration dry-run đạt trước cutover.

## 13. Phân chia milestone

### Milestone 1 — Nền tảng và công nợ

Outbox/dispatcher, module registration, permissions, Finance models/ledger, Retail publishers/consumer settle, API, backfill/reconcile, adapter và UI Công nợ/Tuổi nợ.

### Milestone 2 — Nhắc nợ

Finance settings, scheduler/manual run, run/delivery logs, in-app/event delivery, suspend/retry, UI Nhắc nợ và kiểm thử vận hành.

Không cutover giữa chừng nếu Milestone 1 chưa qua backfill/reconcile. Milestone 2 chỉ đọc Finance Receivable, không đọc ledger Retail cũ.
