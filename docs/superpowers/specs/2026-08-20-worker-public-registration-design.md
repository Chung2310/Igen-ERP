# Đăng ký Lao động công khai — Thiết kế

## Mục tiêu

Link và QR đăng ký Lao động phải tạo hồ sơ trong module Lao động của đúng công ty/cơ sở, không tạo Học viên.

## Phạm vi

- Giữ nguyên URL `/public/dang-ky?teacherId=...` và trang `PublicRegisterPage` đang được chia sẻ.
- Giữ nguyên luồng Học viên cho tenant có `entityPreset: "student"`.
- Với tenant có `entityPreset: "worker"`, API public tạo `Worker` với `companyCode` và `branchId` của người tạo link.
- Các tệp CCCD/chân dung vẫn được hoàn tất và gắn vào bản ghi đúng loại thực thể.

## Thiết kế

`StudentController.publicRegister` đã xác định tenant từ `teacherId` và có thể đọc `ModuleSettingsService`. Bổ sung một nhánh theo `entityPreset`:

- `worker`: kiểm tra payload public theo dữ liệu chung của form, chuẩn hóa `registrationDate` theo ngày hiện tại, gọi `WorkerService.create`, rồi hoàn tất upload với `entityType: "worker"`.
- các preset còn lại: giữ nguyên nhánh `StudentService.createStudent` và logic upload hiện tại.

Để form public dùng chung cho cả hai loại hồ sơ, schema public không được ép các trường chỉ có ở Học viên, đặc biệt `email`. Các trường bắt buộc vẫn được kiểm bằng cấu hình field công khai của tenant ở controller.

## Lỗi và an toàn dữ liệu

- `teacherId` không hợp lệ hoặc đã khóa: trả 400, không ghi dữ liệu.
- Field bắt buộc theo tenant bị thiếu: trả 400, không ghi dữ liệu.
- Chỉ dùng `companyCode`/`branchId` từ profile người tạo QR, không nhận tenant scope từ payload công khai.
- Không thay đổi các QR/link đã phát hành.

## Kiểm thử

- Test tenant `worker` gửi form public: `WorkerService.create` được gọi với đúng scope; `StudentService.createStudent` không được gọi.
- Test tenant `student`: giữ nguyên gọi `StudentService.createStudent`.
- Test validation cho payload Lao động không buộc trường chỉ dành cho Học viên.
