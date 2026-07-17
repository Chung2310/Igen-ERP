# Super Admin Device Session Binding Design

## Mục tiêu

Ràng buộc phiên đặc quyền Super Admin với một mã thiết bị ổn định theo hồ sơ trình duyệt. Hệ thống phải từ chối hoàn tất đăng nhập hoặc tiếp tục sử dụng phiên nếu mã thiết bị thay đổi, đồng thời ghi nhận IP để Super Admin theo dõi mà không khóa nhầm người dùng khi mạng thay đổi.

## Phạm vi

- Tạo UUID thiết bị một lần trên trình duyệt và lưu trong `localStorage`.
- Gửi UUID qua header `x-device-id` trên toàn bộ request thuộc luồng Super Admin.
- Ghi metadata thiết bị vào challenge và session đặc quyền.
- Đối chiếu mã thiết bị khi xác thực OTP/recovery và trên mọi API đã bảo vệ của Super Admin.
- Thu hồi session khi request có mã thiết bị thiếu, sai định dạng hoặc khác session.
- Hiển thị mã thiết bị, IP đăng nhập, IP gần nhất và user-agent trong tab phiên hoạt động.
- Bổ sung test cho frontend helper, service đăng nhập, middleware và dữ liệu session.

Không lấy số serial hoặc định danh phần cứng thật. UUID chỉ đại diện cho một hồ sơ trình duyệt; xóa dữ liệu trình duyệt sẽ tạo mã mới và yêu cầu đăng nhập lại.

## Kiến trúc

### Frontend

Một helper tập trung chịu trách nhiệm đọc hoặc tạo UUID chuẩn, lưu bằng một khóa cố định trong `localStorage`, và trả về header `x-device-id`. Các request trong `superAdminAuthService`, `SessionsTab`, `SuperAdminShell` và những service Super Admin khác sử dụng helper chung để tránh bỏ sót endpoint.

Nếu giá trị trong storage bị hỏng, helper tạo UUID mới. Việc này cố ý làm session hiện tại mất hiệu lực ở request kế tiếp.

### Backend request context

`getSuperAdminRequestMetadata` tiếp tục là cổng chuẩn hóa duy nhất:

- Chỉ nhận `x-device-id` là UUID chữ thường đúng định dạng.
- Lấy IP từ `req.ip`; Express đã tin đúng một hop nginx và nginx ghi đè `X-Forwarded-For`.
- Cắt giới hạn độ dài user-agent và IP trước khi lưu.

Controller đăng nhập lấy metadata từ request và truyền vào service. Không để service tự đọc Express request nhằm giữ service độc lập và dễ test.

### Challenge và hoàn tất đăng nhập

Sau khi mật khẩu Super Admin đúng, challenge lưu `deviceId`, `sourceIp` và `userAgent`. Request bắt đầu enrollment, xác nhận enrollment, OTP hoặc recovery đều phải gửi mã thiết bị.

Trước khi xử lý challenge, service kiểm tra mã thiết bị hiện tại tồn tại và khớp `challenge.deviceId`. Sai hoặc thiếu mã trả lỗi xác thực và không tạo session. IP không được dùng để từ chối vì IP hợp lệ có thể đổi do NAT, VPN hoặc mạng di động.

### Session và middleware

Session lưu:

- `deviceId`: UUID được ràng buộc, bắt buộc.
- `loginIp`: IP khi mật khẩu được xác nhận.
- `lastIp`: IP gần nhất quan sát từ request hợp lệ.
- `userAgent`: user-agent tại lúc đăng nhập.

`requirePrivilegedSession` nhận metadata hiện tại, kiểm tra UUID trước khi cho request đi tiếp. Nếu UUID thiếu, sai hoặc khác session, middleware đánh dấu session bị thu hồi với lý do `device_mismatch` và trả HTTP 401. Với request hợp lệ, middleware cập nhật `lastSeenAt` theo nhịp hiện có và cập nhật `lastIp` khi IP thay đổi.

Session cũ không có `deviceId` sẽ bị coi là không hợp lệ. Đây là hành vi mong muốn khi phát hành tính năng bảo mật: Super Admin phải đăng nhập lại để nhận session đã ràng buộc.

### API và giao diện theo dõi

`GET /api/v1/super-admin/auth/sessions` trả thêm `deviceId`, `loginIp`, `lastIp` và `userAgent`. Tab “Phiên hoạt động” hiển thị:

- Mã thiết bị rút gọn nhưng cho phép xem toàn bộ qua tooltip.
- IP đăng nhập và IP gần nhất.
- Chuỗi trình duyệt/user-agent ở dạng có thể xuống dòng.

Các phiên đã thu hồi và hết hạn vẫn hiển thị metadata để phục vụ điều tra.

## Xử lý lỗi và bảo mật

- Không tin mã thiết bị như bằng chứng phần cứng; đây là lớp ràng buộc bổ sung bên cạnh mật khẩu, TOTP và token.
- UUID do client cung cấp không cấp quyền tự thân. Nó chỉ có giá trị khi khớp challenge/session đã được xác thực.
- Không ghi refresh token hoặc access token vào log/metadata.
- Thông báo lỗi phía client dùng nội dung chung về thiết bị không hợp lệ, không tiết lộ chi tiết session.
- IP chỉ phục vụ hiển thị và audit, không làm khóa cứng.

## Kiểm thử

- Helper frontend tạo UUID một lần, tái sử dụng UUID hợp lệ và thay giá trị hỏng.
- Mọi request xác thực Super Admin gửi `x-device-id`.
- Challenge lưu metadata ban đầu.
- OTP/recovery đúng thiết bị tạo session có metadata; khác thiết bị bị từ chối.
- Middleware cho phép đúng thiết bị, cập nhật IP, và thu hồi session khi mã thiếu/khác.
- API session trả các trường mới và UI render chúng.
- Các test IP/nginx hiện có tiếp tục chạy để bảo vệ trust-proxy boundary.

## Tiêu chí hoàn thành

Một phiên Super Admin không thể được hoàn tất hoặc sử dụng từ hồ sơ trình duyệt có UUID khác. IP đăng nhập và IP gần nhất xuất hiện trong trang theo dõi nhưng việc đổi IP không làm gián đoạn phiên. Toàn bộ test liên quan và kiểm tra build/type đều đạt.
