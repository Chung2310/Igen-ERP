# Thiết kế vận hành kỳ lương Việt Nam

## 1. Mục tiêu và phạm vi

Giai đoạn này xây dựng quy trình vận hành kỳ lương hoàn chỉnh trên nền dữ liệu và engine tính lương chi tiết của giai đoạn foundation. Phạm vi bắt đầu từ tạo kỳ, đồng bộ và khóa công; tiếp tục qua tính, rà soát, duyệt và chốt; kết thúc bằng thanh toán, công bố phiếu lương và xuất dữ liệu.

Thiết kế không lặp lại cấu hình hợp đồng, hồ sơ payroll, chính sách, danh mục khoản lương hoặc công thức thuế và bảo hiểm. Các phần đó là đầu vào bắt buộc từ kế hoạch `2026-07-30-vietnam-payroll-foundation.md`.

## 2. Nguyên tắc thiết kế

- Triển khai theo từng lát cắt nghiệp vụ chạy xuyên suốt thay vì hoàn thành toàn bộ backend rồi mới làm UI.
- `PayrollRun` là aggregate trung tâm của một kỳ lương.
- Dữ liệu công và kết quả tính đã chốt là snapshot bất biến.
- Kỳ đã chốt không được mở lại; sai sót được xử lý bằng kỳ bổ sung hoặc adjustment của kỳ sau.
- Mọi thao tác ghi quan trọng dùng optimistic concurrency và audit trước/sau.
- Tác vụ dài chạy dưới dạng job có thể tiếp tục theo dõi sau khi tải lại trang.
- Mọi dữ liệu được giới hạn theo `companyCode` và `branchId` theo quyền của người thực hiện.

## 3. Kiến trúc aggregate

### 3.1. PayrollRun

Mở rộng `PayrollRun` hiện có để chứa:

- Công ty, chi nhánh, khoảng ngày, tháng lương và loại kỳ `regular` hoặc `supplemental`.
- `version`, trạng thái workflow và trạng thái job hiện tại.
- Tham chiếu snapshot công đã khóa.
- Các dòng lương chi tiết theo nhân viên và `calculationRevision` đang dùng.
- Tổng thu nhập, bảo hiểm, thuế, thực nhận, chi phí doanh nghiệp, đã thanh toán và còn phải trả.
- Lỗi chặn, cảnh báo, xác nhận cảnh báo và lịch sử tính lại.
- Người tạo, rà soát, duyệt, chốt cùng thời điểm tương ứng.
- Checksum của snapshot và kết quả khi chốt.

Một công ty/chi nhánh không được có hai kỳ `regular` chồng khoảng ngày. Kỳ `supplemental` phải tham chiếu kỳ gốc hoặc ghi rõ lý do nghiệp vụ.

### 3.2. PayrollAttendanceSnapshot

Snapshot công lưu dữ liệu đã dùng để tính cho từng nhân viên:

- Công chuẩn, phút làm thực tế và công hưởng lương.
- Phép hưởng lương, nghỉ không lương, thiếu giờ và vắng mặt.
- Tăng ca đã duyệt theo nhóm ngày thường, ngày nghỉ, ngày lễ, ban đêm và tăng ca ban đêm.
- Nguồn dữ liệu, phiên bản nguồn và thời điểm khóa.

Sau khi khóa, thay đổi ở dữ liệu chấm công nguồn không tự sửa snapshot. Muốn lấy dữ liệu mới phải mở một kỳ chưa chốt về bước phù hợp theo state machine; không cho thay snapshot của kỳ đã `closed`.

### 3.3. PayrollAdjustment

Adjustment biểu diễn phụ cấp, thưởng, hoa hồng, khấu trừ, tạm ứng, truy lĩnh hoặc truy thu phát sinh theo kỳ. Mỗi bản ghi lưu định nghĩa khoản lương, số lượng, đơn giá, số tiền, lý do, tệp chứng từ, người tạo và trạng thái duyệt.

Adjustment đã được đưa vào revision tính lương phải được snapshot trong dòng lương. Thay đổi adjustment sau khi tính làm kỳ cần tính lại. Kỳ không được duyệt nếu còn adjustment chờ duyệt.

### 3.4. PayrollPayment

Mỗi lần thanh toán là một aggregate riêng, gồm phạm vi người nhận, số tiền từng nhân viên, ngày dự kiến/thực tế, phương thức, tài khoản nguồn, mã giao dịch, chứng từ, người lập, người xác nhận và `idempotencyKey`.

Trạng thái payment là `draft -> confirmed`, `draft -> cancelled` hoặc `confirmed -> reversed`. Payment đã xác nhận không được sửa. Sai sót được đảo bằng `reversed`, sau đó tạo payment mới.

### 3.5. PayrollAudit và PayslipPublication

`PayrollAudit` lưu mọi chuyển trạng thái, đồng bộ, khóa, tính lại, thay đổi adjustment, duyệt, chốt, thanh toán và công bố phiếu lương. Bản ghi gồm actor, thời điểm, dữ liệu trước/sau, lý do và correlation ID.

`PayslipPublication` lưu thời điểm công bố/thu hồi, phạm vi nhân viên và người thao tác. Thu hồi chỉ thay đổi quyền truy cập, không thay đổi nội dung phiếu lương.

## 4. State machine kỳ lương

Luồng chính:

```text
draft
  -> attendance_locked
  -> calculated
  -> reviewed
  -> approved
  -> closed
  -> partially_paid
  -> paid
```

Quy tắc chuyển trạng thái:

- `draft`: cho phép đồng bộ lại danh sách nhân viên và dữ liệu công.
- `attendance_locked`: snapshot công đã bất biến; cho phép bắt đầu tính.
- `calculated`: có revision kết quả hợp lệ; cho phép tính lại, xử lý cảnh báo và adjustment.
- `reviewed`: người rà soát xác nhận dữ liệu; thay đổi có ảnh hưởng tiền đưa kỳ về `calculated`.
- `approved`: đủ điều kiện chốt; từ chối duyệt đưa kỳ về `calculated` và bắt buộc có lý do.
- `closed`: snapshot và dòng lương chỉ đọc, có checksum; không cho quay về trạng thái trước.
- `partially_paid` và `paid`: được suy ra từ tổng payment `confirmed` chưa bị `reversed`.

Chỉ kỳ `draft` được đồng bộ công lại. Kỳ `calculated` được tính lại từ snapshot công đã khóa; không thay snapshot. Việc cần lấy dữ liệu công mới phải tạo lại kỳ trước khi duyệt hoặc tạo kỳ bổ sung nếu kỳ gốc đã chốt.

## 5. Luồng tạo kỳ và khóa công

1. Người có quyền tạo kỳ chọn công ty, chi nhánh, khoảng ngày và loại kỳ.
2. Hệ thống kiểm tra khoảng kỳ trùng và tạo `PayrollRun` ở `draft`.
3. Đồng bộ lấy nhân viên có hợp đồng hiệu lực trong kỳ, kể cả nhân viên chỉ hiệu lực một phần kỳ.
4. Hệ thống kiểm tra công, phép và tăng ca chưa duyệt, dữ liệu thiếu hoặc nguồn đã thay đổi.
5. Người dùng xử lý lỗi và có thể đồng bộ lại khi kỳ còn `draft`.
6. Khóa công tạo snapshot bất biến, ghi audit và chuyển kỳ sang `attendance_locked`.

API:

```text
POST /payroll/runs
POST /payroll/runs/:id/sync-attendance
POST /payroll/runs/:id/lock-attendance
GET  /payroll/runs/:id/issues
```

## 6. Luồng tính, rà soát, duyệt và chốt

Resolver chọn hợp đồng, điều khoản lương, hồ sơ payroll, người phụ thuộc, chính sách và các khoản thường xuyên theo ngày hiệu lực. Nếu mức lương đổi giữa kỳ, dữ liệu được chia thành các segment trước khi gọi engine foundation.

Mỗi lần tính thành công tạo một `calculationRevision`. Revision mới thay revision đang dùng nhưng revision cũ vẫn được tham chiếu trong audit. Tính thất bại không ghi đè kết quả đang dùng.

Người rà soát xử lý lỗi/cảnh báo, duyệt adjustment và xác nhận các cảnh báo được phép bỏ qua. Chỉ kỳ không còn lỗi chặn hoặc adjustment chờ duyệt mới chuyển sang `reviewed`.

Chỉ kỳ `reviewed` mới được duyệt. Nếu công ty bật phân tách nhiệm vụ, người tạo không được là người duyệt. Từ chối duyệt đưa kỳ về `calculated` và lưu lý do.

Chốt kỳ kiểm tra lại version, checksum, lỗi và trạng thái; sau đó ghi checksum cuối, khóa snapshot cùng dòng lương và chuyển sang `closed`.

API:

```text
POST  /payroll/runs/:id/calculate
POST  /payroll/runs/:id/recalculate
POST  /payroll/runs/:id/review
POST  /payroll/runs/:id/approve
POST  /payroll/runs/:id/reject
POST  /payroll/runs/:id/close
PATCH /payroll/runs/:id/lines/:employeeId/adjustments
```

## 7. Thanh toán

Thanh toán chỉ được tạo cho kỳ từ `closed` trở đi. Một payment có thể bao phủ toàn kỳ, một nhóm nhân viên hoặc một nhân viên. Tổng tiền phân bổ cho mỗi nhân viên không được vượt số còn phải trả, trừ thao tác đảo payment đã xác nhận.

`idempotencyKey` là duy nhất trong phạm vi công ty và thao tác thanh toán. Gửi lại cùng key và cùng payload trả về kết quả cũ; cùng key nhưng payload khác trả lỗi xung đột.

Trạng thái `partially_paid` xuất hiện khi tổng thanh toán hợp lệ lớn hơn 0 nhưng nhỏ hơn tổng thực nhận. `paid` chỉ xuất hiện khi mọi dòng hợp lệ đã được thanh toán đủ. Payment `reversed` làm hệ thống tính lại trạng thái kỳ.

API:

```text
POST /payroll/runs/:id/payments
POST /payroll/payments/:id/confirm
POST /payroll/payments/:id/cancel
POST /payroll/payments/:id/reverse
GET  /payroll/runs/:id/payments
```

## 8. Phiếu lương và xuất dữ liệu

Phiếu lương lấy hoàn toàn từ snapshot của revision đã chốt. Nội dung gồm thông tin nhân viên và ngân hàng đã snapshot, công và tăng ca, từng khoản thu nhập, bảo hiểm nhân viên, thuế, khấu trừ, thực nhận và trạng thái thanh toán.

HR được xem bản nháp từ `calculated`. Nhân viên chỉ được xem phiếu của chính mình sau khi công bố. Công bố hoặc thu hồi không sửa snapshot và được audit.

Hệ thống xuất bốn loại Excel:

- Bảng lương chi tiết.
- Tổng hợp bảo hiểm.
- Tổng hợp thuế TNCN.
- Danh sách chuyển khoản ngân hàng.

Mỗi lượt xuất lưu loại báo cáo, bộ lọc, người xuất, thời điểm và checksum kỳ. Dữ liệu ngân hàng chỉ có trong file của người được cấp quyền thanh toán. CSV cũ tiếp tục hoạt động trong giai đoạn chuyển đổi.

API:

```text
POST /payroll/runs/:id/payslips/publish
POST /payroll/runs/:id/payslips/unpublish
GET  /payroll/runs/:id/payslips/:employeeId
GET  /payroll/runs/:id/exports/:type
GET  /employee/me/payslips
```

## 9. Giao diện vận hành

`PayrollTab` gồm:

- Danh sách kỳ lương theo chi nhánh, tháng và trạng thái.
- Wizard hiển thị bước hiện tại, điều kiện hoàn tất và tác vụ tiếp theo.
- Bảng dòng lương có cột cấu hình, tìm kiếm, lọc lỗi/cảnh báo và hàng tổng hợp.
- Ngăn chi tiết nhân viên gồm công, thu nhập, bảo hiểm, thuế, khấu trừ, payment và lịch sử adjustment.
- Hàng đợi rà soát lỗi, cảnh báo và adjustment.
- Màn hình duyệt/chốt có bản tổng hợp, xác nhận và lý do nghiệp vụ.
- Tab thanh toán, phiếu lương và xuất báo cáo.

Đồng bộ, tính lương và xuất Excel chạy dưới dạng job. UI polling trạng thái job, hiển thị tiến độ và kết quả lỗi theo nhân viên. Việc tải lại trang không hủy job hoặc làm mất khả năng theo dõi.

## 10. Phân quyền và bảo mật dữ liệu

Quyền tối thiểu:

- `payroll:read`
- `payroll:prepare`
- `payroll:review`
- `payroll:approve`
- `payroll:close`
- `payroll:pay`
- `payroll:publish_payslip`
- `payroll:self_read`

Mọi truy vấn và mutation kiểm tra `companyCode`, `branchId` và permission ở backend. Dữ liệu trả về được giới hạn theo quyền: số tài khoản, mã số thuế, mức lương và chi tiết thuế không được dựa vào việc UI tự ẩn.

## 11. Lỗi, cảnh báo và tính nhất quán

Lỗi nghiệp vụ trả cấu trúc ổn định:

```ts
interface PayrollIssue {
  code: string;
  message: string;
  runId: string;
  employeeId?: string;
  field?: string;
  severity: "blocking" | "warning";
  remediation: string;
}
```

Lỗi chặn gồm thiếu hợp đồng hoặc mức lương hiệu lực, thiếu chính sách, công/đơn chưa duyệt, khoảng hiệu lực chồng nhau, adjustment chờ duyệt, số tiền không hợp lệ và lệch checksum.

Cảnh báo gồm thiếu mã số thuế hoặc tài khoản ngân hàng, mức đóng khác thường, khoản miễn thuế vượt giới hạn, thực nhận biến động lớn và khấu trừ vượt thu nhập. Cảnh báo chỉ được bỏ qua khi loại cảnh báo cho phép và người dùng có quyền rà soát; xác nhận phải lưu lý do.

Mọi mutation nhận `expectedVersion`. Xung đột trả mã lỗi ổn định và bản version mới nhất để UI yêu cầu tải lại. Job thất bại được retry an toàn theo idempotency key; không tạo hai revision hoặc hai payment do retry.

## 12. Kiểm thử

### Unit test

- State machine và các chuyển trạng thái không hợp lệ.
- Resolver dữ liệu theo ngày hiệu lực và chia segment giữa kỳ.
- Tính tổng payment, đảo payment và trạng thái `partially_paid`/`paid`.
- Checksum, idempotency và phân loại lỗi/cảnh báo.

### Integration test

- API toàn luồng, validation, optimistic concurrency và audit.
- Company/branch scope và từng permission.
- Retry job không tạo revision, export hoặc payment trùng.
- Kỳ đóng không thể bị sửa qua bất kỳ endpoint mutation nào.

### UI test

- Wizard phản ánh đúng trạng thái và điều kiện còn thiếu.
- Nút thao tác bị khóa theo trạng thái, permission và job đang chạy.
- Bảng dòng lương, ngăn chi tiết, xử lý issue và adjustment.
- Thanh toán nhiều đợt, công bố phiếu và quyền nhân viên tự xem.

### Acceptance và regression

- Toàn luồng từ tạo kỳ đến thanh toán đủ, gồm một lần tính lại và một payment bị đảo.
- Từ chối duyệt rồi sửa adjustment và duyệt lại.
- Kỳ bổ sung xử lý sai sót sau chốt mà không sửa kỳ gốc.
- Phiếu lương và bốn loại Excel đối chiếu đúng snapshot.
- Kỳ lương cũ và CSV cũ vẫn đọc/xuất được qua adapter tương thích.

## 13. Chia giai đoạn triển khai

### Phase 2A: Tạo kỳ, đồng bộ và khóa công

Hoàn thiện aggregate kỳ, state machine ban đầu, snapshot công, issue preflight, job đồng bộ và wizard bước đầu.

### Phase 2B: Tính chi tiết và rà soát

Tích hợp engine foundation, resolver hiệu lực, calculation revision, adjustment, cảnh báo và giao diện dòng lương.

### Phase 2C: Duyệt, chốt và audit

Hoàn thiện review/approve/reject/close, phân tách nhiệm vụ, checksum, optimistic concurrency và audit đầy đủ.

### Phase 2D: Thanh toán

Thêm payment nhiều đợt, idempotency, confirm/cancel/reverse, chứng từ và bảng chuyển khoản.

### Phase 2E: Phiếu lương và báo cáo

Thêm công bố/thu hồi, self-service, PDF phiếu lương, bốn loại Excel và adapter xuất CSV cũ.

## 14. Điều kiện tiên quyết và ngoài phạm vi

Phase 2 yêu cầu các interface, model và calculator trong `2026-07-30-vietnam-payroll-foundation.md` đã hoàn tất. Có thể xây state machine và snapshot trước, nhưng không thể hoàn thành Phase 2B nếu chưa có engine foundation.

Ngoài phạm vi gồm chuyển khoản trực tiếp qua ngân hàng, nộp hồ sơ trực tiếp cho cơ quan thuế/bảo hiểm, chữ ký số pháp lý, hạch toán kế toán tự động và trình tạo công thức tùy ý.
