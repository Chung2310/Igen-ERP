# Thiết kế chuẩn hóa popup lỗi sang tiếng Việt

## Mục tiêu

Mọi popup được phát qua `toast.error` phải hiển thị nội dung tiếng Việt thân thiện với người dùng. Phạm vi không gồm `console.error`, log server, mã lỗi, nội dung thành công/cảnh báo/thông tin, hoặc phản hồi API không được hiển thị bằng popup lỗi.

## Giải pháp

Thêm một hàm thuần dùng chung để chuẩn hóa chuỗi lỗi trước khi `toast.error` phát sự kiện:

- Giữ nguyên chuỗi đã có nội dung tiếng Việt.
- Dịch các nhóm lỗi tiếng Anh phổ biến: mạng, timeout, xác thực, phân quyền, không tìm thấy, validation, tải lên/tải xuống và lỗi máy chủ.
- Với chuỗi chủ yếu là tiếng Anh nhưng chưa có ánh xạ an toàn, trả về thông báo chung: `Đã xảy ra lỗi. Vui lòng thử lại.`
- Không thay đổi tên riêng/kỹ thuật nằm trong một thông báo tiếng Việt có ngữ cảnh rõ ràng.
- Chuỗi rỗng hoặc không hợp lệ dùng thông báo chung tiếng Việt.

Điểm tích hợp duy nhất là phương thức `toast.error` trong `src/pages/Toast.tsx`, nhờ đó các component đang truyền trực tiếp `error.message` từ API cũng được bảo vệ mà không cần sửa hàng trăm call site.

## Kiểm thử

Thêm unit test cho hàm chuẩn hóa, bao gồm:

- Giữ nguyên thông báo tiếng Việt.
- Dịch các lỗi mạng, quyền, xác thực, upload và validation thông dụng.
- Che thông báo kỹ thuật hoặc tiếng Anh chưa biết bằng fallback tiếng Việt.
- Không làm thay đổi các phương thức toast khác.

Thêm test wiring xác nhận `toast.error` luôn gọi hàm chuẩn hóa trước khi phát sự kiện. Chạy các test liên quan và TypeScript typecheck toàn dự án.

## Ngoài phạm vi

- Không dịch log kỹ thuật hoặc nội dung lưu trong cơ sở dữ liệu.
- Không thay đổi hợp đồng API backend.
- Không dùng dịch máy hoặc gọi dịch vụ bên ngoài lúc runtime.
- Không Việt hóa `toast.success`, `toast.warning` hoặc `toast.info` trong thay đổi này.
