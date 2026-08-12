# Retail Completion Design

## 1. Mục tiêu

Hoàn thiện sáu nhóm chức năng Retail đang có luồng chính nhưng chưa đạt đủ điều kiện nghiệm thu:

1. Hóa đơn bán lẻ nội bộ.
2. Công nợ khách hàng.
3. Báo cáo doanh thu và lợi nhuận.
4. Phân hạng khách hàng/VIP.
5. Nhắc công nợ quá hạn.
6. POS, barcode và hàng đợi offline.

Công việc được giao theo sáu milestone độc lập. Mỗi milestone phải tạo ra phần mềm sử dụng được và vượt qua cổng kiểm thử trước khi milestone tiếp theo bắt đầu.

## 2. Phạm vi và thứ tự

### Milestone 1 — Hóa đơn nội bộ

- Lưu snapshot đầy đủ thông tin công ty, cửa hàng và chi nhánh trên hóa đơn tại thời điểm phát hành.
- Cấu hình mẫu in và khổ giấy `A4`, `A5`, `80mm` theo chi nhánh.
- Xem trước, in bằng trình duyệt và tải PDF trực tiếp.
- In hoặc tải lại từ danh sách hóa đơn không tạo đơn, thanh toán, doanh thu hoặc số hóa đơn mới.
- Bổ sung test riêng cho thao tác in lại và tải PDF.

### Milestone 2 — Công nợ

- Tạo ledger append-only cho phát sinh nợ, thu nợ, điều chỉnh và đảo bút toán.
- Lưu lý do, actor, thời điểm, nguồn nghiệp vụ và idempotency key trên mỗi bút toán.
- Hiển thị lịch sử và số dư chạy theo từng khách hàng.
- Cho phép manager tạo bút toán điều chỉnh; bút toán đã ghi không được sửa hoặc xóa.
- Đối soát ledger với `dueAmount` trên đơn và cung cấp màn hình sai lệch.
- `dueAmount` tiếp tục phục vụ đọc nhanh nhưng được xem là snapshot có thể tái tạo từ ledger.

### Milestone 3 — Báo cáo

- Bổ sung chiều phân tích theo nhân viên, sản phẩm, SKU, nhóm hàng và thương hiệu.
- Bổ sung bảng sản phẩm bán chạy và bán chậm.
- Áp dụng các bộ lọc mới đồng nhất cho dashboard và file Excel.
- Giữ nguyên quy tắc chỉ manager được xem giá vốn và lợi nhuận.
- Đối soát định nghĩa doanh thu, hoàn tiền, công nợ và lợi nhuận với dữ liệu Analytics hiện có; các khác biệt phải được thể hiện thành kết quả đối soát, không tự động sửa dữ liệu nguồn.

### Milestone 4 — Phân hạng khách hàng/VIP

- Hỗ trợ kỳ xét hạng: toàn thời gian, 12 tháng gần nhất hoặc khoảng ngày cấu hình.
- Tự cập nhật hạng sau giao dịch ảnh hưởng đến doanh số thuần bằng tác vụ idempotent sau commit.
- Cho phép manager điều chỉnh hạng thủ công với lý do, ngày bắt đầu, ngày hết hạn và audit.
- Override còn hiệu lực được ưu tiên hơn hạng tính tự động; khi hết hạn, hệ thống quay về hạng tính toán.
- Bổ sung timeline tăng/giảm/override, bộ lọc danh sách và thống kê số khách, doanh thu, tần suất mua theo hạng.

### Milestone 5 — Nhắc công nợ

- Cấu hình theo chi nhánh: bật/tắt, tần suất, ngưỡng ngày quá hạn và danh sách vai trò/người nhận.
- Ghi run log cho mỗi lần scheduler hoặc manager kích hoạt.
- Ghi delivery log theo từng thông báo và người nhận, gồm trạng thái, số lần thử và lỗi cuối.
- Retry có giới hạn và backoff; unique key ngăn gửi trùng trong cùng chu kỳ nhắc.
- Hỗ trợ thông báo trong ứng dụng và email qua SMTP doanh nghiệp.
- Cung cấp màn hình lịch sử theo lần chạy, khách hàng và đơn hàng; manager có thể retry delivery thất bại.

### Milestone 6 — POS, barcode và offline

- Bổ sung bộ phím tắt có bảng trợ giúp và không xung đột khi nhập liệu trong form.
- Chuẩn hóa luồng HID scanner dựa trên chuỗi phím kết thúc bằng Enter, đồng thời giữ camera scanner hiện tại.
- Phát âm thanh và hiển thị trạng thái rõ ràng khi quét thành công, không tìm thấy hoặc quét trùng.
- Lưu draft và yêu cầu thanh toán chờ gửi trong IndexedDB bằng adapter có version schema rõ ràng.
- Mỗi yêu cầu thanh toán giữ một idempotency key cố định qua mọi lần retry.
- Đồng bộ hàng đợi tuần tự khi có mạng; trạng thái gồm `pending`, `syncing`, `failed`, `synced`.
- Giao dịch chưa được server chấp nhận phải hiển thị “chờ đồng bộ”, không hiển thị là bán thành công và không phát hành hóa đơn chính thức.

## 3. Kiến trúc chung

Mỗi milestone tách model, service, route/API và component theo một trách nhiệm. Các file trang chỉ điều phối state và trình bày; quy tắc tài chính, idempotency, retry, PDF và queue nằm trong service hoặc adapter có thể kiểm thử độc lập.

Mọi bản ghi mới phải có `companyCode`, `branchId`, actor tạo/cập nhật và timestamp phù hợp. API lấy scope từ actor/guard Retail hiện tại, không tin scope tài chính gửi trong body. Permission mới chỉ được thêm khi mô hình `retailOperate`/`retailManage` hiện tại không biểu diễn được yêu cầu; thiết kế này không yêu cầu permission mới.

Các thao tác ghi đồng thời vào đơn, thanh toán, tồn kho, ledger hoặc lịch sử hạng dùng MongoDB transaction. Tác vụ chạy sau commit dùng outbox hoặc bản ghi công việc idempotent để lỗi job không rollback giao dịch bán hàng đã hợp lệ.

Idempotency được ép bằng unique index trong cơ sở dữ liệu. Kiểm tra service chỉ giúp trả lỗi dễ hiểu và không thay thế unique constraint.

## 4. Mô hình dữ liệu và invariant

### 4.1 Hóa đơn và cấu hình in

Invoice snapshot bổ sung tên pháp lý, mã số thuế nếu có, tên cửa hàng, mã/tên/địa chỉ/điện thoại chi nhánh. Snapshot không thay đổi khi cài đặt hoặc thông tin chi nhánh đổi sau đó.

Retail settings lưu `invoicePaperSize` và `invoiceTemplate`. Giá trị hợp lệ ban đầu là `A4`, `A5`, `80mm` và `standard`; schema cho phép bổ sung template sau này mà không thay đổi snapshot cũ.

PDF được tạo từ invoice snapshot phía server. Endpoint tải PDF yêu cầu cùng branch scope và quyền như xem hóa đơn, trả `application/pdf` và tên file đã sanitize.

### 4.2 Ledger công nợ

Mỗi entry có loại `charge`, `payment`, `adjustment`, `reversal`; số tiền nguyên VNĐ; chiều tăng/giảm xác định bởi loại; tham chiếu khách hàng, đơn và entry bị đảo nếu có. Unique idempotency key nằm trong company scope.

Không có endpoint update/delete entry. Điều chỉnh bắt buộc lý do và quyền manager. Reversal tham chiếu đúng một entry gốc và không được đảo cùng entry nhiều lần.

Số dư khách hàng bằng tổng có dấu của ledger. Job đối soát so sánh số dư theo đơn với `dueAmount`, ghi kết quả chạy và sai lệch nhưng không tự sửa. Việc sửa chỉ diễn ra qua bút toán hợp lệ hoặc một migration được duyệt riêng.

### 4.3 Báo cáo

Các dòng đơn giữ snapshot dimension cần thiết để báo cáo lịch sử không thay đổi khi catalog đổi. Truy vấn hiện tại được mở rộng bằng aggregation có company, branch và date match ở stage đầu tiên.

“Bán chạy” sắp theo số lượng thuần giảm dần rồi doanh thu thuần giảm dần. “Bán chậm” chỉ gồm sản phẩm có phát sinh bán trong kỳ, sắp theo số lượng thuần tăng dần rồi doanh thu thuần tăng dần; không suy luận hàng không bán nếu chưa có snapshot tồn đầu/cuối kỳ đáng tin cậy.

### 4.4 Hạng khách hàng

Cấu hình hạng lưu `evaluationWindow`. Lịch sử hạng ghi nguồn `automatic`, `manual`, `expiry`, hạng trước/sau, lý do, actor và khoảng hiệu lực khi có.

Một manual override đang hiệu lực quyết định hạng hiển thị. Tác vụ tính lại vẫn cập nhật hạng tự động nền để khi override hết hạn hệ thống có kết quả sẵn.

### 4.5 Nhắc nợ

Run log lưu loại kích hoạt, cấu hình snapshot, thời gian bắt đầu/kết thúc, tổng candidate và thống kê delivery. Delivery log lưu channel, recipient, order, customer, cycle key, trạng thái và lịch sử attempt.

Retry chỉ áp dụng cho lỗi tạm thời. Validation, thiếu địa chỉ email hoặc permission không hợp lệ là lỗi vĩnh viễn. SMTP secret lấy từ cơ chế cấu hình môi trường hiện có và không được trả về frontend hoặc ghi vào log.

### 4.6 Offline queue

Queue chỉ lưu payload tối thiểu cần đồng bộ, scope nhận từ phiên đăng nhập, idempotency key và metadata trạng thái. Payload nhạy cảm không được đưa vào localStorage. Khi logout hoặc đổi company/branch, queue không được tự gửi dưới scope mới.

Server luôn tính lại giá, quyền, tồn và tính hợp lệ tại thời điểm đồng bộ. Nếu dữ liệu đã thay đổi, item chuyển `failed` với lỗi nghiệp vụ để người dùng xử lý; client không tự thay đổi payload tài chính rồi retry.

## 5. Luồng UI

### 5.1 Hóa đơn

Trang cài đặt có lựa chọn khổ giấy và template. Chi tiết và danh sách hóa đơn cung cấp xem trước, in, tải PDF. Trạng thái tải và lỗi PDF hiển thị riêng, không đóng dialog hiện tại khi lỗi.

### 5.2 Công nợ

Hồ sơ khách có tab công nợ gồm số dư, lịch sử phân trang, filter loại/ngày và running balance. Manager có form điều chỉnh với xác nhận. Trang đối soát hiển thị lần chạy gần nhất và drill-down sai lệch.

### 5.3 Báo cáo

Filter mới hỗ trợ tìm kiếm/chọn nhiều giá trị ở mức phù hợp, đồng bộ với URL và export. Bảng top/slow có phân trang hoặc giới hạn rõ ràng và thể hiện khoảng ngày đang xem.

### 5.4 VIP

Danh sách khách lọc theo hạng. Hồ sơ có timeline và override card. Dashboard hạng thể hiện số khách, doanh thu thuần và tần suất mua trong cùng kỳ lọc.

### 5.5 Nhắc nợ

Settings chứa cấu hình schedule/recipient. Trang lịch sử hiển thị run list, run detail, delivery status và retry action chỉ khi delivery đủ điều kiện.

### 5.6 POS

Shortcut help có thể mở từ POS. Scan feedback có cả text/icon để không phụ thuộc âm thanh. Queue panel hiển thị số item theo trạng thái, lỗi cuối và thao tác retry/remove draft; item tài chính đã gửi nhưng chưa rõ kết quả phải query idempotency status trước khi gửi lại.

## 6. Xử lý lỗi và quan sát vận hành

- Validation trả lỗi nghiệp vụ cụ thể và status HTTP phù hợp qua middleware hiện tại.
- Transaction thất bại không để lại ledger, invoice, stock movement hoặc history một phần.
- PDF, SMTP, outbox và offline sync có trạng thái retry được; UI không hiển thị thành công giả.
- Scheduler và reconciliation có distributed lock hoặc unique run key để tránh chạy trùng.
- Log vận hành chứa correlation/idempotency key nhưng không chứa secret, thông tin thẻ hoặc payload nhạy cảm.

## 7. Migration và tương thích

Schema mới phải tương thích với dữ liệu cũ. Invoice cũ thiếu store snapshot dùng fallback hiển thị được đánh dấu là dữ liệu legacy; không ghi ngược snapshot hiện tại vào lịch sử nếu không có nguồn xác minh.

Backfill ledger, report dimension hoặc tier history phải có lệnh `--dry-run` và `--apply`. Dry-run báo tổng bản ghi, bản ghi có thể chuyển đổi, bị bỏ qua và lỗi mẫu. Không tự chạy `--apply` trên dữ liệu thật trong quá trình phát triển.

API hiện có giữ tương thích trừ khi spec implementation chỉ ra phiên bản hoặc migration client cụ thể. Field mới ưu tiên optional trong giai đoạn đọc dữ liệu cũ và bắt buộc với bản ghi mới tại service boundary.

## 8. Kiểm thử và cổng milestone

Mỗi hành vi mới thực hiện theo red-green-refactor: test được viết trước, chạy và thất bại đúng vì thiếu hành vi, sau đó mới thêm production code tối thiểu.

Mỗi milestone phải có:

- Unit test cho model invariant, service, validation và pure calculation.
- Test route/controller cho scope, permission, idempotency và error propagation.
- Test UI cho happy path, loading, empty state, validation và lỗi server.
- Regression test toàn bộ Retail frontend và backend.
- `npm run typecheck` thành công.
- `npm run build` thành công.
- `git diff --check` không báo lỗi.

Migration phải được thử dry-run bằng fixture. SMTP, HID scanner và hành vi reconnect offline có automated adapter/queue tests. Nghiệm thu với SMTP hoặc thiết bị thật được ghi thành bước môi trường riêng vì cần tài khoản và phần cứng bên ngoài; thiếu môi trường thật không được che giấu bằng kết quả mock.

## 9. Ngoài phạm vi

- Trả hàng khách/NCC, IMEI/serial, CTV/hoa hồng và các nhóm “chưa triển khai” khác.
- Hóa đơn điện tử pháp lý, SMS/Zalo, sàn thương mại điện tử và driver ESC/POS.
- Tự động sửa sai lệch công nợ hoặc Analytics không có phê duyệt nghiệp vụ.
- Xác nhận giao dịch offline thành công trước khi server chấp nhận.

## 10. Điều kiện hoàn thành

Sáu milestone được coi là hoàn thành khi toàn bộ luồng trong phạm vi có model/service/API/UI cần thiết, migration hoặc fallback cho dữ liệu cũ, tài liệu vận hành, và vượt qua cổng kiểm thử của từng milestone lẫn regression cuối cùng. Các bước cần SMTP hoặc thiết bị thật phải có biên bản kết quả môi trường; nếu chưa có môi trường, trạng thái được ghi rõ là chờ nghiệm thu tích hợp thay vì tuyên bố hoàn thành.
