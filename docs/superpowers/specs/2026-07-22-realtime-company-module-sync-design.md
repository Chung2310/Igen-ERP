# Thiết kế đồng bộ module doanh nghiệp realtime

Ngày: 2026-07-22

## Mục tiêu

Khi Super Admin thay đổi module của một doanh nghiệp, các tài khoản đang đăng nhập thuộc doanh nghiệp đó phải nhận cấu hình mới ngay mà không cần tải lại trang. Nếu module đang mở vừa bị tắt, người dùng được chuyển về **Tổng quan** và nhận thông báo rõ ràng.

## Kiến trúc

Tái sử dụng Socket.IO và room `company:<companyCode>` hiện có. Sau khi cập nhật module thành công, backend xóa cache phân quyền module rồi phát sự kiện `company_modules_updated` tới room doanh nghiệp. `AuthContext` nhận sự kiện, cập nhật `userProfile.enabledModules`; các thành phần hiện có như Sidebar, Dashboard và `resolveEnabledTab` tự phản ứng với state mới.

Không thêm polling định kỳ mới và không yêu cầu tải lại toàn trang.

## Backend

- Luồng cập nhật module chỉ phát sự kiện sau khi database đã lưu thành công.
- Xóa cache của `requireModule` cho đúng `companyCode` trước khi phát sự kiện để API và giao diện chuyển trạng thái đồng thời.
- Phát qua `emitToCompany(companyCode, "company_modules_updated", payload)` để hoạt động cả khi dùng Redis adapter và nhiều instance.
- Payload chuẩn hóa:

```ts
type CompanyModulesUpdatedEvent = {
  companyCode: string;
  enabledModules: ModuleKey[];
};
```

- Không phát sự kiện nếu cập nhật database thất bại.
- Không đưa thông tin nhạy cảm, mật khẩu, TOTP hoặc lý do quản trị vào payload.

## Frontend

- `AuthContext` đăng ký listener `company_modules_updated` khi có người dùng hợp lệ.
- Chỉ áp dụng sự kiện khi `payload.companyCode` trùng `userProfile.companyCode`.
- Lọc `enabledModules` theo danh mục module chuẩn trước khi cập nhật state.
- Cập nhật cả `user` và `userProfile` để tránh hai bản dữ liệu đăng nhập lệch nhau.
- Hiện toast: **“Quyền truy cập module của doanh nghiệp vừa được cập nhật.”**
- Khi socket kết nối hoặc kết nối lại, gọi `refreshProfile()`/`authService.getMe()` và cập nhật state để bù cho sự kiện có thể bị bỏ lỡ lúc mất kết nối.
- Việc cập nhật state làm Sidebar và Dashboard render lại ngay.
- `App.tsx` tiếp tục dùng `resolveEnabledTab`; nếu tab hiện tại bị tắt, tự chuyển sang **Tổng quan** mà không cần thêm cơ chế điều hướng khác.

## Luồng sự kiện

1. Super Admin lưu danh sách module mới.
2. Backend xác thực hành động đặc quyền và cập nhật company.
3. Backend xóa cache phân quyền module của company.
4. Backend phát `company_modules_updated` đến room của company.
5. Các client đang kết nối cập nhật profile trong bộ nhớ.
6. Sidebar/Dashboard ẩn hoặc hiện module theo state mới.
7. Nếu user đang ở module vừa tắt, App chuyển về **Tổng quan** và toast được hiển thị.

## Xử lý lỗi và phục hồi

- Nếu cập nhật module thất bại, không xóa cache và không phát sự kiện thành công giả.
- Nếu Socket.IO chưa khởi tạo, cập nhật database vẫn thành công; client sẽ đồng bộ khi kết nối lại hoặc khi khôi phục phiên.
- Listener bỏ qua payload sai định dạng hoặc không đúng company.
- Khi refresh profile lúc reconnect thất bại, giữ profile hiện tại và để lần reconnect/refresh tiếp theo thử lại; không đăng xuất user chỉ vì lỗi đồng bộ tạm thời.

## Kiểm thử

- Backend: cập nhật thành công xóa cache và phát đúng room, event, payload.
- Backend: cập nhật thất bại không phát sự kiện.
- Frontend: event đúng company cập nhật module trong profile và hiện toast.
- Frontend: event company khác hoặc payload không hợp lệ bị bỏ qua.
- Frontend: reconnect gọi `/auth/me` và áp dụng profile mới.
- Điều hướng: module hiện tại bị tắt được chuyển về **Tổng quan**.
- Hồi quy: helper lọc sidebar vẫn giữ các tab cố định và chỉ hiển thị module được bật.

## Ngoài phạm vi

- Realtime cho các thay đổi thông tin doanh nghiệp khác như tên hoặc email chủ sở hữu.
- Gửi notification lưu trữ trong database.
- Thay đổi mô hình dữ liệu module hoặc phân quyền module theo từng user.
- Thêm polling nền mới.
