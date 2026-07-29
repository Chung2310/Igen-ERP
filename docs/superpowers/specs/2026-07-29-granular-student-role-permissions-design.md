# Thiết kế quyền chi tiết cho quản lý học viên và role

## Mục tiêu

Chuẩn hóa hệ thống phân quyền của module quản lý học viên để quản trị viên có thể cấp quyền riêng cho từng chức năng, đồng thời giữ nguyên hành vi của các role đang sử dụng quyền tổng `student:read` và `student:manage`. Màn hình quản lý role phải hiển thị tên role, nhóm quyền, tên quyền và mô tả bằng tiếng Việt rõ ràng.

## Phạm vi

Thiết kế áp dụng cho:

- Hồ sơ học viên/lao động.
- Khóa học.
- Lớp học/dự án.
- Lịch thi.
- Học phí và thanh toán.
- Thông báo học viên.
- Tài nguyên học tập.
- Bài tập và điểm danh.
- Trường dữ liệu tùy chỉnh.
- Cấu hình module học viên.
- Cấu hình SMTP doanh nghiệp.
- Tên hiển thị của các role hệ thống và role tùy chỉnh.

Không thay đổi mã kỹ thuật của role hiện tại, cấu trúc cô lập chi nhánh, hoặc quyền quản lý đối tác.

## Mô hình quyền

### Quyền tổng tương thích ngược

| Mã quyền | Tên hiển thị | Ý nghĩa |
| --- | --- | --- |
| `student:read` | Xem toàn bộ quản lý học viên | Cho phép đọc mọi chức năng nghiệp vụ trong module học viên. |
| `student:manage` | Quản lý toàn bộ module học viên | Cho phép đọc và thay đổi mọi chức năng nghiệp vụ trong module học viên. |

Các role đang có quyền tổng tiếp tục hoạt động mà không cần migration. `student:manage` bao hàm cả quyền đọc của các chức năng nghiệp vụ.

### Quyền chi tiết

| Nhóm hiển thị | Mã quyền | Tên hiển thị |
| --- | --- | --- |
| Học viên & Lao động | `student-profile:read` | Xem hồ sơ học viên/lao động |
| Học viên & Lao động | `student-profile:manage` | Quản lý hồ sơ học viên/lao động |
| Đào tạo | `course:read` | Xem khóa học |
| Đào tạo | `course:manage` | Quản lý khóa học |
| Đào tạo | `batch:read` | Xem lớp học/dự án |
| Đào tạo | `batch:manage` | Quản lý lớp học/dự án |
| Đào tạo | `exam:read` | Xem lịch thi |
| Đào tạo | `exam:manage` | Quản lý lịch thi |
| Tài chính học viên | `payment:read` | Xem học phí và thanh toán |
| Tài chính học viên | `payment:manage` | Quản lý học phí và thanh toán |
| Nội dung & Liên lạc | `student-notification:read` | Xem thông báo học viên |
| Nội dung & Liên lạc | `student-notification:manage` | Quản lý thông báo học viên |
| Nội dung & Liên lạc | `student-resource:read` | Xem tài nguyên học tập |
| Nội dung & Liên lạc | `student-resource:manage` | Quản lý tài nguyên học tập |
| Đào tạo | `assignment:read` | Xem bài tập và điểm danh |
| Đào tạo | `assignment:manage` | Quản lý bài tập và điểm danh |
| Cấu hình dữ liệu | `custom-field:manage` | Quản lý trường dữ liệu tùy chỉnh |
| Cấu hình hệ thống | `student-settings:manage` | Cấu hình module học viên |
| Cấu hình hệ thống | `company-smtp:manage` | Cấu hình SMTP doanh nghiệp |

Quyền `student-resource:*` được tách khỏi `resource:*` để tránh nhầm với quyền quản lý tài nguyên Drive toàn hệ thống.

## Quy tắc kiểm tra quyền

Mỗi endpoint đọc nghiệp vụ được phép khi người dùng có một trong các quyền sau:

1. `*`;
2. quyền tổng `student:read` hoặc `student:manage`;
3. quyền `*:read` hoặc `*:manage` tương ứng với chức năng.

Mỗi endpoint thay đổi nghiệp vụ được phép khi người dùng có một trong các quyền sau:

1. `*`;
2. quyền tổng `student:manage`;
3. quyền `*:manage` tương ứng với chức năng.

Các quyền cấu hình `custom-field:manage`, `student-settings:manage` và `company-smtp:manage` không được kế thừa từ `student:manage`, vì chúng có ảnh hưởng quản trị và cấu hình hệ thống. Role `admin` tiếp tục có toàn quyền thông qua quyền `*`, nhưng backend và frontend không được kiểm tra cứng chuỗi role `admin` cho ba chức năng này.

Kiểm tra quyền phải được thực hiện ở backend. Frontend chỉ dùng cùng quy tắc để ẩn hoặc vô hiệu hóa tab, nút và biểu mẫu không được phép; frontend không phải lớp bảo mật.

## Phạm vi dữ liệu theo chi nhánh

Thay đổi quyền không làm thay đổi phạm vi dữ liệu:

- Admin chọn chi nhánh nào thì xem và thao tác trên dữ liệu của chi nhánh đó.
- Người dùng thuộc chi nhánh chỉ xem và thao tác trên dữ liệu được phép của chi nhánh mình.
- Có quyền chức năng không đồng nghĩa với quyền truy cập dữ liệu của chi nhánh khác.

## Catalog và dữ liệu quyền

Backend permission catalog là nguồn chuẩn duy nhất cho mã quyền, nhãn và nhóm. API quyền trả về catalog đã chuẩn hóa để màn hình role sử dụng. Frontend có thể giữ bản dịch dự phòng nhưng phải đồng bộ với backend và không được tạo thêm mã quyền chỉ tồn tại ở giao diện.

Việc bổ sung catalog phải idempotent: quyền mới được seed/upsert mà không xóa quyền đã gán, không đổi ID quyền hiện có và không làm mất role-permission hiện tại.

## Hiển thị role và quyền

### Tên role

Giữ nguyên mã role trong database và API. Giao diện ánh xạ tên hiển thị:

| Mã role | Tên hiển thị |
| --- | --- |
| `superadmin` | Quản trị viên cấp cao |
| `admin` | Quản trị viên |
| `manager` | Quản lý chi nhánh |
| `staff` | Nhân viên |
| `teacher` | Giáo viên |
| `accountant` | Kế toán |

Role tùy chỉnh ưu tiên `name` do người dùng nhập. Nếu có `description`, giao diện hiển thị dưới tên role để giải thích phạm vi sử dụng.

### Màn hình gán quyền

- Nhóm quyền theo lĩnh vực nghiệp vụ thay vì sắp xếp theo mã kỹ thuật.
- Mỗi quyền hiển thị title tiếng Việt, mô tả ngắn và mã quyền ở dạng phụ để hỗ trợ kỹ thuật.
- Quyền “Xem” và “Quản lý” của cùng chức năng đặt cạnh nhau.
- Quyền tổng có nhãn “Toàn bộ module” và cảnh báo rằng nó bao phủ các quyền nghiệp vụ chi tiết.
- Khi chọn quyền quản lý chi tiết, giao diện tự chọn quyền đọc tương ứng hoặc backend coi quyền quản lý là bao hàm quyền đọc. Dữ liệu lưu vẫn chỉ cần giữ các quyền người dùng đã chọn.
- Không tự cấp các quyền cấu hình khi chọn `student:manage`.

## Tích hợp backend

Tạo helper kiểm tra tập quyền thay vì lặp logic `OR` ở từng route. Helper nhận các quyền hợp lệ và sử dụng cơ chế xác thực hiện tại. Các router con áp dụng quyền đọc ở cấp router và quyền quản lý ở endpoint thay đổi.

Các route trường tùy chỉnh, cấu hình module và SMTP chuyển từ kiểm tra role cứng sang permission middleware. Route quản lý user nằm ngoài phạm vi thay đổi này vì cần thiết kế quyền quản trị người dùng riêng.

Lỗi thiếu quyền tiếp tục trả mã HTTP 403 theo middleware lỗi chuẩn; lỗi chưa đăng nhập trả 401.

## Tích hợp frontend

Tạo hàm dùng chung để xét quyền tổng hoặc quyền chi tiết. Navigation và từng tab dựa trên quyền đọc; nút tạo, sửa, xóa, gửi hoặc tải lên dựa trên quyền quản lý. Tab cấu hình SMTP và cấu hình module dựa trên quyền cấu hình tương ứng thay cho `role === "admin"`.

Nếu người dùng có quyền vào module nhưng không có quyền đọc bất kỳ tab con nào, giao diện hiển thị trạng thái “Bạn chưa được cấp quyền sử dụng chức năng này” thay vì trang trống hoặc gọi API chắc chắn trả 403.

## Kiểm thử

Backend cần kiểm thử:

- Quyền tổng cũ vẫn đọc và quản lý được các chức năng nghiệp vụ.
- Mỗi quyền chi tiết chỉ mở đúng route tương ứng.
- Quyền quản lý chi tiết bao hàm đọc cùng chức năng.
- Quyền chi tiết không mở chức năng khác.
- `student:manage` không mở cấu hình module, trường tùy chỉnh hoặc SMTP.
- Quyền cấu hình mới thay thế kiểm tra role cứng.
- Thiếu quyền trả 403 và không làm thay đổi dữ liệu.
- Phạm vi chi nhánh không thay đổi sau khi áp dụng quyền mới.

Frontend cần kiểm thử:

- Tên role mặc định được dịch đúng nhưng mã role không đổi.
- Permission catalog được nhóm và đặt title đúng.
- Quyền tổng và quyền chi tiết điều khiển tab/nút đúng quy tắc.
- Role tùy chỉnh có quyền cấu hình có thể mở đúng giao diện dù không mang mã role `admin`.

## Tiêu chí hoàn thành

- Các quyền mới xuất hiện đầy đủ trong màn hình tạo/sửa role.
- Quản trị viên có thể tạo role chỉ xem hoặc quản lý riêng từng chức năng.
- Role cũ dùng `student:read/manage` không bị mất quyền nghiệp vụ.
- Không còn kiểm tra cứng role cho trường tùy chỉnh, cấu hình module và SMTP.
- Tên role, nhóm quyền, title và mô tả hiển thị rõ ràng bằng tiếng Việt.
- Các kiểm thử quyền và kiểm thử hồi quy phạm vi chi nhánh đều đạt.
