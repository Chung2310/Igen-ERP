# Thiết kế popup quản lý module doanh nghiệp

Ngày: 2026-07-22

## Mục tiêu

Trong mục **Quản lý doanh nghiệp** của trang Super Admin, khi người dùng nhấn vào một thẻ doanh nghiệp, hệ thống mở popup để xem thông tin doanh nghiệp và thay đổi các module được cấp cho doanh nghiệp đó.

## Phạm vi giao diện

- Toàn bộ thẻ doanh nghiệp là vùng có thể nhấn để mở popup.
- Popup hiển thị tên, mã doanh nghiệp, email chủ sở hữu, trạng thái vòng đời và số người dùng.
- Các trường thông tin doanh nghiệp chỉ đọc, không có ô nhập hoặc thao tác chỉnh sửa.
- Danh sách module hiển thị dưới dạng checkbox:
  - Module đang bật được tích sẵn.
  - Module đang tắt không được tích.
  - Super Admin có thể tích hoặc bỏ tích module.
- Popup có nút đóng/hủy và nút **Lưu thay đổi**.
- Không cho lưu khi không còn module nào được chọn.

## Luồng dữ liệu

1. Khi nhấn thẻ doanh nghiệp, giao diện lưu doanh nghiệp đang chọn và mở popup.
2. Popup gọi API chi tiết doanh nghiệp để lấy dữ liệu mới nhất, bao gồm thống kê và `enabledModules`.
3. Trạng thái checkbox được khởi tạo từ `enabledModules`; dữ liệu thiếu theo quy ước tương thích hiện tại được hiểu là bật toàn bộ module.
4. Khi lưu, popup gọi API cập nhật module hiện có cùng lý do thay đổi, mật khẩu xác nhận và mã TOTP theo cơ chế hành động đặc quyền hiện tại.
5. Sau khi lưu thành công, giao diện tải lại danh sách doanh nghiệp, hiển thị thông báo thành công và đóng popup.

## Thành phần và thay đổi dự kiến

- Tạo popup quản lý module riêng trong khu vực `src/pages/super-admin/tenants/`.
- `TenantListPage` quản lý trạng thái doanh nghiệp đang chọn, mở/đóng popup và tải lại danh sách sau khi cập nhật.
- Tái sử dụng `superAdminTenantService.detail` và `superAdminTenantService.updateModules`; không tạo endpoint mới.
- Không dùng `TenantDetailPage` làm màn hình điều hướng cho thao tác này; phần logic module phù hợp sẽ được tách hoặc dùng lại để tránh hai cách xử lý khác nhau.

## Trạng thái và xử lý lỗi

- Hiển thị trạng thái tải khi đang lấy chi tiết doanh nghiệp.
- Vô hiệu hóa nút lưu khi chưa chọn module, thiếu lý do, đang lưu hoặc dữ liệu chưa tải xong.
- Lỗi tải/lưu được hiển thị ngay trong popup, kèm correlation ID nếu API trả về.
- Đóng popup không lưu sẽ bỏ toàn bộ thay đổi checkbox chưa gửi.
- Có thể đóng bằng nút đóng, nút hủy và phím Escape; khi nhấn ra ngoài lớp nền, popup đóng nếu không đang lưu.

## Khả năng truy cập và bố cục

- Popup dùng ngữ nghĩa `dialog`, có tiêu đề liên kết qua `aria-labelledby`.
- Checkbox có nhãn rõ ràng và thao tác được bằng bàn phím.
- Nội dung cuộn được trên màn hình thấp; bố cục một cột trên mobile và nhiều cột cho danh sách module ở màn hình rộng.

## Kiểm thử

- Nhấn thẻ doanh nghiệp mở đúng popup và tải đúng chi tiết.
- Thông tin doanh nghiệp hiển thị nhưng không thể chỉnh sửa.
- Module bật/tắt được phản ánh đúng bằng checkbox.
- Thay đổi checkbox và lưu gửi đúng danh sách module, sau đó đóng popup và tải lại danh sách.
- Không thể lưu danh sách module rỗng.
- Lỗi tải/lưu vẫn giữ popup mở và hiển thị thông báo.
- Nút đóng, nút hủy và phím Escape hoạt động đúng.

## Ngoài phạm vi

- Chỉnh sửa tên, mã, email chủ sở hữu hoặc trạng thái doanh nghiệp trong popup.
- Thêm module mới hoặc thay đổi danh mục module chuẩn.
- Thay đổi API hoặc mô hình dữ liệu module hiện có.
- Cập nhật realtime cho người dùng đang đăng nhập trong doanh nghiệp.
