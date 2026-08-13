# Tạm tắt kiểm tra khuôn mặt khi chấm công

## Mục tiêu

Tạm bỏ bước chụp và xác minh khuôn mặt trong luồng Check-In và Check-Out của nhân viên. Các kiểm tra đăng nhập, chi nhánh, GPS và IP mạng vẫn giữ nguyên. Mã nhận diện khuôn mặt được giữ lại để có thể bật lại sau này.

## Phạm vi

- Áp dụng cho chấm công nhân viên tại Dashboard và Header trên cả giao diện desktop và mobile.
- Áp dụng cho API `POST /api/v1/timekeeping/check-in` và `POST /api/v1/timekeeping/check-out`.
- Không thay đổi luồng QR chấm công công nhân, học viên hoặc chức năng đăng ký/quản lý khuôn mặt.

## Thiết kế

Tạo một cờ cấu hình dùng chung `ATTENDANCE_FACE_CHECK_ENABLED`, mặc định là `false`. Frontend và backend cùng đọc cờ này để không thể lệch trạng thái.

Khi cờ tắt, frontend lấy GPS rồi gửi yêu cầu chấm công ngay, không mở modal camera và không đính kèm ảnh. Backend vẫn chạy xác thực người dùng, validation dữ liệu và `attendanceBranchGate`, sau đó bỏ qua `attendanceFaceGate` và chuyển tới controller chấm công.

Khi cờ bật lại, luồng hiện tại được giữ nguyên: frontend mở camera, gửi ảnh và backend bắt buộc xác minh khuôn mặt.

## Xử lý lỗi

- Lỗi GPS, sai vị trí hoặc sai mạng tiếp tục hiển thị như hiện tại.
- Khi gửi yêu cầu không có ảnh trong lúc cờ tắt, backend không trả lỗi thiếu ảnh.
- Khi cờ bật, hành vi và thông báo lỗi khuôn mặt hiện tại không thay đổi.

## Kiểm thử

- Test cờ mặc định đang tắt.
- Test middleware backend bỏ qua xác minh khuôn mặt khi cờ tắt nhưng vẫn tiếp tục chuỗi xử lý.
- Test giao diện gửi chấm công sau khi lấy GPS mà không mở camera hoặc gửi file ảnh.
- Chạy test liên quan tới chấm công, kiểm tra TypeScript và build.

## Triển khai và khôi phục

Thay đổi được đưa lên nhánh `feature/branch-attendance-network-errors`. Khi cần khôi phục kiểm tra khuôn mặt, đổi cờ dùng chung sang `true` và chạy lại bộ test; không cần phục hồi mã đã xóa.
