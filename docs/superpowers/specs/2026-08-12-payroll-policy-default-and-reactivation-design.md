# Thiết kế hotfix công thức lương mặc định và tái áp dụng

## Mục tiêu

- Cho phép áp dụng lại công thức đã ngưng áp dụng.
- Không cho tính hoặc cập nhật bảng lương khi kỳ được chọn không có công thức active phù hợp.
- Tạo công thức lương mặc định cho doanh nghiệp mới và tự bổ sung an toàn cho doanh nghiệp cũ chưa từng có công thức.

## Tái áp dụng công thức retired

- Công thức có trạng thái `retired` hiển thị các hành động `Nhân bản`, `Áp dụng` và `Xóa` cho người có quyền quản lý.
- Backend cho phép kích hoạt công thức từ `draft` hoặc `retired`.
- Khi kích hoạt lại, xóa `retiredBy`, chuyển trạng thái sang `active`, cập nhật `activatedBy` và `activatedAt`.
- Nếu thời gian hiệu lực chồng công thức active khác, dùng nguyên luồng popup xác nhận và transaction thay thế đã có.
- Audit kích hoạt ghi đúng trạng thái trước là `retired` hoặc `draft`.

## Công thức mặc định

Tạo hàm idempotent `ensureDefaultPayrollPolicy(companyCode, actorId, effectiveFrom)` dùng cấu hình `DEFAULT_VIETNAM_PAYROLL_POLICY` hiện có làm nguồn duy nhất.

- Mã cố định: `vn-default`.
- Tên hiển thị tiếng Việt theo cấu hình mặc định hiện có.
- Trạng thái: `active`.
- `effectiveFrom`: ngày tạo doanh nghiệp, chuẩn hóa về đầu ngày UTC.
- `companyCode`: doanh nghiệp được khởi tạo.
- `createdBy` và `activatedBy`: actor tạo doanh nghiệp hoặc `system` trong luồng lazy seed.
- `activatedAt`: thời điểm tạo bản ghi.
- Không sao chép các trường hệ thống `version` và wildcard company từ constant.

Hàm chỉ tạo mặc định khi doanh nghiệp chưa có bất kỳ công thức nào. Việc kiểm tra và tạo dùng thao tác nguyên tử/idempotent để các request đồng thời không tạo trùng.

## Điểm gọi seed

- Sau khi tạo doanh nghiệp thành công trong luồng đăng ký trực tiếp.
- Sau khi tạo tenant thành công trong luồng Super Admin.
- Khi tải danh sách công thức: nếu danh sách rỗng, lấy `createdAt` của doanh nghiệp và gọi ensure để hỗ trợ doanh nghiệp cũ, sau đó trả danh sách mới.

Việc seed chạy sau khi doanh nghiệp và tài khoản quản trị đã được tạo. Nếu seed thất bại, không rollback doanh nghiệp đã khởi tạo; ghi lỗi để theo dõi và để cơ chế lazy seed tự phục hồi khi người dùng mở bảng lương. Cách này tránh trường hợp client nhận lỗi rồi retry nhưng bị chặn vì doanh nghiệp thực tế đã tồn tại.

## Điều kiện xử lý bảng lương

### Giao diện

`PayrollTab` tải danh sách công thức cùng dữ liệu kỳ. Một công thức hợp lệ khi:

- `status === "active"`;
- `effectiveFrom` không sau ngày cuối của tháng được chọn;
- `effectiveTo` không trước ngày đầu của tháng được chọn.

Nút `Tính lương` hoặc `Cập nhật bảng lương` chỉ bật khi có ít nhất một công thức hợp lệ. Nếu không có, nút vẫn hiển thị nhưng bị vô hiệu hóa và có chú thích `Cần áp dụng công thức lương cho kỳ này`.

Sau khi người dùng thay đổi công thức trong `PayrollPolicyManager`, component báo cho `PayrollTab` tải lại danh sách để trạng thái nút cập nhật ngay, không cần tải lại trang.

### Backend

Luồng xử lý/tính kỳ lương phải tìm công thức active phù hợp. Nếu không có, trả lỗi nghiệp vụ `PAYROLL_POLICY_REQUIRED` với HTTP 409 và không tạo hoặc cập nhật payroll run.

Không dùng `DEFAULT_VIETNAM_PAYROLL_POLICY` làm fallback âm thầm trong phép tính kỳ lương. Constant chỉ còn là template để seed dữ liệu.

## Doanh nghiệp cũ

- Chưa có bất kỳ công thức nào: tự tạo một công thức mặc định khi danh sách được tải lần đầu.
- Đã có draft, active hoặc retired: không tự tạo thêm.
- Nếu chỉ có draft/retired hoặc active không bao phủ kỳ đang chọn, người dùng phải chủ động áp dụng một công thức; nút bảng lương bị khóa cho đến lúc đó.

## Xử lý lỗi và tính nhất quán

- Unique index `(companyCode, code)` ngăn bản ghi mặc định trùng; duplicate do race được đọc lại và coi là thành công.
- Mọi truy vấn giới hạn theo `companyCode`.
- Lỗi tải công thức không được diễn giải thành “không có công thức”; giao diện hiển thị lỗi và khóa thao tác bảng lương.
- Không thay đổi hay tính lại kỳ lương đã chốt.

## Kiểm thử

- Action test: retired có nút `activate`.
- Service/controller test: kích hoạt lại retired và xóa `retiredBy`.
- Service test: ensure tạo đúng dữ liệu từ default template, dùng ngày tạo doanh nghiệp và không tạo khi đã có công thức.
- Race test: duplicate khi ensure được coi là thành công và không tạo bản ghi thứ hai.
- Test hai luồng tạo doanh nghiệp đều gọi ensure.
- Test lazy seed doanh nghiệp cũ và không seed khi đã có draft/retired.
- Unit/component test xác định công thức bao phủ tháng và khóa/mở nút xử lý bảng lương.
- Backend test `PAYROLL_POLICY_REQUIRED` xảy ra trước khi tạo/cập nhật run.
- Kiểm thử hồi quy kích hoạt thay thế, popup xác nhận, tính lương và typecheck.

## Tiêu chí hoàn thành

- Công thức retired có thể được áp dụng lại.
- Doanh nghiệp mới luôn có một công thức active mặc định từ ngày tạo.
- Doanh nghiệp cũ chưa từng có công thức được seed đúng một lần khi mở cấu hình/bảng lương.
- Không thể xử lý bảng lương nếu kỳ không có công thức active phù hợp ở cả UI và API.
- Không còn fallback tính lương âm thầm bằng constant mặc định.
