# Finance Navigation Visibility Design

## Mục tiêu

Khi doanh nghiệp bật module `finance`, người dùng nhìn thấy mục **Tài chính** nhất quán trong Sidebar và menu Header, thay vì chỉ truy cập được bằng URL `/tai-chinh`.

## Hành vi

- Thêm tab `TÀI CHÍNH` vào nhóm **Vận hành** của Sidebar, dùng icon `Landmark` và nhãn `Tài chính`.
- Thêm cùng tab vào danh sách điều hướng và cấu hình tiêu đề/icon của Header.
- Giữ `filterEnabledTabs` làm nguồn quyết định module: mục Tài chính chỉ xuất hiện khi `userProfile.enabledModules` chứa `finance`.
- Giữ `MODULE_READ_PERMISSIONS` làm nguồn quyết định quyền. Admin/superadmin hoặc người có `*` truy cập được; user thường cần ít nhất một trong `receivable:read`, `receivable:collect`, `receivable:adjust`.
- Khi module đã bật nhưng user thiếu quyền, Sidebar tiếp tục dùng trạng thái khóa giống các module nghiệp vụ khác; router vẫn là lớp bảo vệ cuối.
- Không thay đổi route `/tai-chinh`, Finance workspace, API, dữ liệu tenant hoặc trạng thái cutover.

## Kiểm thử

- Regression test xác nhận Sidebar có khai báo tab Finance.
- Test cấu hình xác nhận Finance bị lọc khi tenant chưa bật và được giữ khi tenant bật.
- Test Header/navigation xác nhận tab Finance có trong danh sách điều hướng.
- Chạy test liên quan, `npm run typecheck` và `git diff --check` trước khi commit bản sửa.
