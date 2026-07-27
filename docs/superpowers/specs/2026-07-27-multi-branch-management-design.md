# Thiết kế: Quản lý nhiều chi nhánh

## Mục tiêu

Cho phép một doanh nghiệp quản lý nhiều chi nhánh trong cùng tenant. Mỗi nhân viên thuộc đúng một chi nhánh tại một thời điểm. Chủ doanh nghiệp có thể đổi chi nhánh đang xem từ dropdown toàn cục trên Header; toàn bộ dữ liệu nghiệp vụ sẽ sử dụng chi nhánh đang chọn.

## Mô hình dữ liệu

Thêm collection `Branch` với các trường: `companyCode`, `code`, `name`, `address`, `phone`, `managerId`, `locationConfig`, `isActive`, `createdAt`, `updatedAt`.

Mở rộng `User` bằng `branchId` và giữ `companyCode` để bảo đảm tenant isolation. Mỗi user thông thường phải có đúng một `branchId`; superadmin không bị giới hạn bởi chi nhánh. Tạo `BranchTransfer` để lưu lịch sử điều chuyển nhân viên giữa các chi nhánh, gồm nhân viên, chi nhánh cũ/mới, người thực hiện, lý do và thời điểm.

Các resource phát sinh tại chi nhánh sẽ có cả `companyCode` và `branchId`. Dữ liệu cấu hình dùng chung cấp công ty như module, danh mục dùng chung và Credit không gắn chi nhánh. Cấu hình vị trí, ngày làm việc, ca làm và các thiết lập vận hành có thể ghi đè theo chi nhánh.

## Scope và phân quyền

Backend dùng một helper scope thống nhất để xác định `companyCode` và `branchId`, không để từng module tự diễn giải query. Mọi API phải kiểm tra tenant trước, sau đó kiểm tra branch scope.

- Superadmin: xem và quản lý mọi công ty, mọi chi nhánh.
- Chủ doanh nghiệp/admin cấp công ty: xem và quản lý mọi chi nhánh thuộc công ty; được đổi chi nhánh từ Header.
- Manager: mặc định chỉ truy cập chi nhánh được phân công.
- Nhân viên: chỉ truy cập dữ liệu chi nhánh của mình và dữ liệu cá nhân.

API không tin `branchId` do client gửi nếu người dùng không có quyền trên chi nhánh đó. Khi admin công ty chọn chi nhánh, server vẫn phải xác minh chi nhánh thuộc `companyCode` trong token.

## Active branch toàn cục

Thêm `BranchContext` hoặc state tương đương ở cấp App, chứa danh sách chi nhánh, `activeBranchId`, trạng thái loading và hàm đổi chi nhánh. Header hiển thị dropdown ngay phía trên khu vực Credit cho owner/admin cấp công ty.

Khi đổi chi nhánh:

1. Cập nhật `activeBranchId` và lưu lựa chọn vào localStorage theo user/company.
2. Phát sự kiện hoặc cập nhật context để các module hủy/reload request hiện tại.
3. Reset các filter nhân viên, selection và dữ liệu tạm không còn hợp lệ.
4. Tất cả request nghiệp vụ dùng active branch thông qua API client/context chung.
5. Hiển thị tên chi nhánh đang hoạt động để tránh thao tác nhầm.

Nhân viên và manager không có dropdown chuyển chi nhánh; active branch của họ luôn là branchId trong profile.

## Phạm vi module

Các module HR, sơ đồ tổ chức, chấm công, ca làm, nghỉ phép và payroll bắt buộc lọc theo branch. Kho, sản phẩm, nhập xuất, CRM, dự án và Kanban cũng có branch scope; các entity có thể chia sẻ cấp công ty phải có cờ/phạm vi rõ ràng. Đào tạo, lịch, quy trình, chat, tài liệu và báo cáo hỗ trợ lựa chọn dữ liệu cấp chi nhánh hoặc tổng hợp toàn công ty theo quyền.

Dashboard có hai chế độ: chi nhánh đang chọn và tổng hợp toàn công ty. Báo cáo phải ghi rõ phạm vi dữ liệu và không cộng trùng các giao dịch giữa các chi nhánh.

## Credit

Credit là số dư dùng chung toàn công ty, không bị thay đổi khi chuyển chi nhánh. Header vẫn tải số dư theo `companyCode`; lịch sử giao dịch và nạp tiền cũng thuộc công ty. Nếu cần phân tích chi phí theo chi nhánh, giao dịch ghi thêm `branchId` tùy chọn tại thời điểm phát sinh nhưng không tách số dư.

## Migration và an toàn dữ liệu

Dữ liệu hiện tại chưa có chi nhánh được đưa vào chi nhánh mặc định của công ty, ví dụ `MAIN`. User cũ được gán vào branch mặc định. Migration phải idempotent, có kiểm tra số lượng trước/sau và không xóa dữ liệu gốc.

Không cho xóa chi nhánh còn user hoặc resource phát sinh; chỉ cho khóa chi nhánh và yêu cầu chuyển dữ liệu/user sang chi nhánh khác. Điều chuyển user phải cập nhật các dữ liệu tương lai theo quy tắc nghiệp vụ, không sửa lịch sử chấm công/payroll đã chốt.

## Kiểm thử và triển khai

- Unit test cho branch scope, permission matrix, active branch persistence và migration idempotency.
- Integration test ngăn truy cập chéo công ty/chéo chi nhánh.
- Test các API CRUD đại diện cho HR, attendance, payroll, inventory, CRM và reports.
- Test UI Header: owner đổi branch làm reload dữ liệu; manager/employee không thấy dropdown.
- Chạy typecheck, lint, build và migration dry-run trước khi triển khai production.

Triển khai theo các phase: nền tảng Branch + scope; identity/permission + Header context; migration; cập nhật module nghiệp vụ; báo cáo/tổng hợp; kiểm thử và rollout.
