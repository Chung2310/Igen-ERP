# Thiết kế phân hệ Đối tác độc lập trên sidebar

## Bối cảnh

Trang Quản lý Đối tác & Cộng tác viên hiện là một sub-tab của Quản lý Học viên/Lao động. Giao diện, API và quyền truy cập đều nằm trong `student-management`: route `/partners` yêu cầu module `student` và quyền `student:read`; các mutation tiếp tục dùng `student:manage`.

Yêu cầu mới là đưa Đối tác thành một mục độc lập trên sidebar chính, đặt gần Nhân sự, sử dụng được cho mọi loại hình doanh nghiệp và được bảo vệ bằng quyền riêng.

## Mục tiêu

- Thêm mục `Đối tác` độc lập vào sidebar chính, ngay sau `Nhân sự`.
- Admin và Super Admin có toàn quyền Đối tác.
- Vai trò khác cần `partner:read` để truy cập và `partner:manage` để thay đổi dữ liệu.
- Đối tác không còn phụ thuộc việc doanh nghiệp bật module Học viên/Lao động.
- Xóa sub-tab Đối tác khỏi Quản lý Học viên/Lao động để chỉ còn một lối điều hướng.
- Giữ nguyên toàn bộ dữ liệu đối tác, lịch sử giới thiệu, hoa hồng và API payload hiện có.

## Phương án

### 1. Tab ứng dụng độc lập, tái sử dụng trang hiện có — lựa chọn

Thêm `ĐỐI TÁC` vào `TabType`, route ứng dụng và sidebar. Tạo một page wrapper mỏng để dùng lại `PartnersPage`; thêm quyền riêng ở frontend và backend; bỏ sub-tab cũ.

Ưu điểm: giải quyết đúng ranh giới quyền/module, ít chạm vào nghiệp vụ và dữ liệu, dễ kiểm thử. Nhược điểm: mã giao diện Đối tác tạm thời vẫn nằm trong thư mục `student-management`.

### 2. Di chuyển vật lý toàn bộ mã Đối tác

Chuyển page, modal, type và API helper sang module mới.

Ưu điểm: cấu trúc thư mục sạch. Nhược điểm: thay đổi nhiều import và dependency nhưng không mang lại hành vi mới; rủi ro hồi quy cao hơn.

### 3. Shortcut sidebar tới sub-tab cũ

Thêm nút sidebar nhưng vẫn mở Quản lý Học viên tại `?sub=doi-tac`.

Ưu điểm: ít code. Nhược điểm: tiếp tục phụ thuộc module và quyền Học viên, tạo hai cấu trúc điều hướng cho cùng chức năng và không đáp ứng yêu cầu quyền độc lập.

## Thiết kế điều hướng

### Tab ứng dụng

Thêm `ĐỐI TÁC` vào union `TabType` và `APP_ROUTES`. Route dùng một `PartnersTab` lazy-loaded. Wrapper chịu trách nhiệm cung cấp ngữ cảnh công ty/chi nhánh cần thiết cho `PartnersPage` mà không nhân bản UI hoặc logic nghiệp vụ.

Sidebar thêm mục:

- label kỹ thuật: `ĐỐI TÁC`;
- title hiển thị: `Đối tác`;
- icon: `Handshake`;
- group: `operations`;
- vị trí: ngay sau `NHÂN SỰ`.

Mục sidebar không bị lọc bởi `enabledModules`, vì Đối tác áp dụng cho mọi doanh nghiệp. Người không có quyền xem vẫn nhìn thấy mục ở trạng thái khóa, theo pattern hiện tại của sidebar.

### Loại bỏ lối cũ

Xóa `ĐỐI TÁC`, slug `doi-tac`, import `PartnersPage` và nhánh render tương ứng khỏi `StudentManagementTab`.

Nếu người dùng mở URL cũ của Quản lý Học viên với `?sub=doi-tac`, `useSubTabRouter` không tìm thấy route và resolve về `TỔNG QUAN`. Không giữ redirect ngầm sang module mới vì app hiện điều hướng theo tab state, không có route URL ổn định để bảo đảm redirect đúng trong mọi ngữ cảnh.

## Thiết kế quyền

### Permission catalog

Thêm hai quyền:

- `partner:read`: xem danh sách, chi tiết, số liệu và lịch sử Đối tác.
- `partner:manage`: tạo, cập nhật, xóa, nhập Excel, cấu hình level hoa hồng và ghi nhận chi trả.

Hai quyền xuất hiện trong catalog backend, seed permission và bản dịch/nhóm quyền frontend. Admin và Super Admin được toàn quyền theo cơ chế wildcard hoặc role bypass hiện hành. Các role khác chỉ có quyền khi được cấp rõ ràng.

### Sidebar và route frontend

`MODULE_READ_PERMISSIONS["ĐỐI TÁC"]` dùng `partner:read`. Sidebar hiển thị khóa khi người dùng không có quyền. Route/app content phải tiếp tục resolve về trang an toàn nếu có điều hướng trực tiếp mà không đủ quyền; không chỉ dựa vào trạng thái disabled của nút.

### Hành động trong trang

`PartnersPage` tính `canManagePartners` từ role/quyền:

- Admin/Super Admin: `true`.
- Các role khác: `hasPermission("partner:manage")`.

Các hành động mutation chỉ render khi `canManagePartners`:

- Cấu hình Level Hoa hồng.
- Nhập Excel.
- Khai báo đối tác mới.
- Sửa và xóa đối tác.
- Chi trả hoa hồng.

Xuất Excel là hành động đọc và vẫn có cho người có `partner:read`.

### Backend

Mount `/partners` không dùng `requireStudentModule` hoặc `student:read`.

- Các GET dùng `partner:read`.
- Các POST/PATCH/DELETE, bulk import, payout và cấu hình hoa hồng dùng `partner:manage`.

Mọi route vẫn giữ authentication, tenant/owner scoping và validation hiện có. Quyền frontend chỉ cải thiện UX; backend là lớp kiểm soát bắt buộc.

## Dữ liệu và ngữ cảnh

- Không đổi model Partner, collection, commission level, payout hay quan hệ referral.
- Không migrate dữ liệu.
- Không đổi endpoint hoặc response shape.
- Normal user tiếp tục được scope theo company/owner từ token.
- Super Admin tiếp tục dùng lựa chọn tenant/center phù hợp với pattern hiện tại; wrapper không gửi `all` thành owner ID.
- Việc đổi loại hình doanh nghiệp vẫn cập nhật thuật ngữ referral thông qua shared entity preset state.

## Xử lý lỗi

- Thiếu `partner:read`: sidebar khóa; điều hướng trực tiếp không render trang; API trả 403.
- Có `partner:read` nhưng thiếu `partner:manage`: trang chỉ đọc; API mutation trả 403 kể cả khi client bị can thiệp.
- API danh sách lỗi: giữ toast và empty/loading behavior hiện tại.
- Preset hoặc center chưa sẵn sàng: wrapper/page dùng trạng thái loading hiện hành, không fallback sang dữ liệu tenant khác.

## Kiểm thử

Thực hiện theo TDD:

- `TabType`, route config và sidebar có mục Đối tác đúng vị trí.
- Đối tác không bị ẩn theo `enabledModules`; người thiếu `partner:read` thấy trạng thái khóa.
- Admin/Super Admin truy cập đầy đủ; role khác tuân thủ `partner:read/manage`.
- `StudentManagementTab` không còn sub-tab/nhánh render Đối tác.
- Read-only user không thấy hành động mutation nhưng vẫn xuất Excel được.
- Backend GET yêu cầu `partner:read`; mutation yêu cầu `partner:manage`; route không còn yêu cầu student module.
- Focused tests, typecheck và production build phải qua.

## Ngoài phạm vi

- Không thiết kế lại giao diện trang Đối tác.
- Không đổi công thức hoặc nghiệp vụ hoa hồng.
- Không di chuyển vật lý toàn bộ thư mục Đối tác trong lần này.
- Không sửa các lỗi test suite tồn tại sẵn không liên quan.
