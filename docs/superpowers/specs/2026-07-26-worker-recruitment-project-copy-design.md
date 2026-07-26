# Thiết kế đổi trang Khóa học thành Dự án cho loại hình Lao động

## Mục tiêu

Khi doanh nghiệp sử dụng loại hình `worker`, trang dùng chung hiện có tên **Khóa học** sẽ hiển thị theo nghiệp vụ công ty tuyển dụng/cung ứng lao động với tên **Dự án**. Một dự án đại diện cho một nhu cầu tuyển số lượng lao động cụ thể, ví dụ “Tuyển 100 công nhân nhà máy Samsung”.

Loại hình `student` phải giữ nguyên toàn bộ giao diện và hành vi hiện tại. Hai loại hình `candidate` và `customer` không thuộc phạm vi thay đổi này.

## Phạm vi

- Đổi nhãn tab `Khóa học` thành `Dự án` khi `entityPreset === "worker"`.
- Đổi toàn bộ nội dung hiển thị thuộc trang khóa học khi ở preset `worker`, gồm tiêu đề, nút, bộ lọc, trạng thái rỗng, bảng, thẻ, phân trang, biểu mẫu, placeholder, tooltip, modal xác nhận và toast.
- Giữ nguyên API, route, kiểu dữ liệu, khóa module và tên kỹ thuật `course/courses`.
- Không mở thêm tab đang bị ẩn và không sửa các trang khác.
- Không thay đổi bất kỳ nội dung hoặc hành vi nào của preset `student`.

## Phương án kỹ thuật

Tạo một bộ từ điển nội dung giao diện cho trang Courses. Trang xác định preset hiện tại qua `useEntityLabel`:

- `worker`: dùng từ điển Dự án tuyển dụng.
- Mọi preset khác: dùng nguyên các chuỗi hiện tại.

Không nhân bản `CoursesPage` và không đổi tên model/API. Cách này giới hạn rủi ro, giữ dữ liệu tương thích và cho phép bổ sung từ điển riêng cho các loại hình khác sau này.

Các nhãn trường tùy chỉnh do người dùng đã cấu hình vẫn được ưu tiên. Từ điển chỉ cung cấp nhãn mặc định theo preset, không ghi đè cấu hình đã lưu.

## Bộ thuật ngữ Lao động

| Nội dung hiện tại | Nội dung ở preset Lao động |
|---|---|
| Khóa học | Dự án |
| Danh mục khóa học | Danh sách dự án tuyển dụng |
| Thêm khóa học mới | Thêm dự án mới |
| Mã khóa học | Mã dự án |
| Tên chương trình đào tạo | Tên dự án tuyển dụng |
| Phân loại | Nhóm dự án |
| Quản lý phân loại khóa học | Quản lý nhóm dự án |
| Thời lượng | Thời gian tuyển dụng |
| Học phí niêm yết | Ngân sách dự kiến |
| Tối đa học viên lớp | Chỉ tiêu tuyển |
| Max: N HV | Chỉ tiêu: N lao động |
| Lớp đang chạy | Đợt tuyển đang triển khai |
| Chương trình học | Dự án |
| Khởi tạo chương trình | Tạo dự án |
| Cập nhật khóa học | Cập nhật dự án |
| Kích hoạt lại khóa học | Tiếp tục dự án |
| Tạm dừng khóa học | Tạm dừng dự án |
| Xóa khóa học | Xóa dự án |
| Phân loại khóa học | Nhóm dự án |

Nội dung trạng thái rỗng:

- Tiêu đề: `Chưa có dự án tuyển dụng nào`
- Mô tả: `Bấm "Thêm dự án mới" để tạo dự án tuyển dụng đầu tiên.`

Placeholder:

- Mã dự án: `Ví dụ: DA-SAMSUNG-2026`
- Tên dự án: `Ví dụ: Tuyển 100 công nhân nhà máy Samsung`
- Thời gian tuyển dụng: `Ví dụ: 01/08/2026 - 30/09/2026`
- Ngân sách dự kiến: `Ví dụ: 150.000.000`

## Hành vi và dữ liệu

Các thao tác tạo, sửa, tạm dừng, tiếp tục, xóa, tìm kiếm, lọc nhóm và phân trang giữ nguyên. Payload vẫn dùng các trường:

- `code`: mã dự án trên giao diện.
- `title`: tên dự án tuyển dụng.
- `category`: nhóm dự án.
- `duration`: thời gian tuyển dụng.
- `fee`: ngân sách dự kiến.
- `maxLearners`: chỉ tiêu tuyển.
- `activeBatches`: số đợt tuyển đang triển khai.

Việc thay đổi chỉ là lớp trình bày; dữ liệu hiện có không cần migration.

## Xử lý lỗi

Các lỗi kiểm tra và lỗi API phải dùng thuật ngữ theo preset. Với preset `worker`, không được xuất hiện các từ “khóa học”, “học phí”, “học viên”, “lớp học”, “chương trình đào tạo” trong phạm vi trang Dự án.

## Kiểm thử

- Kiểm tra preset `student` vẫn hiển thị đúng toàn bộ chuỗi cũ.
- Kiểm tra preset `worker` hiển thị `Dự án` ở thanh tab.
- Kiểm tra trang danh sách, trạng thái rỗng, dạng lưới, dạng bảng và phân trang dùng thuật ngữ Lao động.
- Kiểm tra modal thêm/sửa, quản lý nhóm, xác nhận xóa, tooltip và toast không còn thuật ngữ giáo dục ở preset `worker`.
- Kiểm tra payload và endpoint không thay đổi.
- Chạy các test liên quan và build/type-check của dự án.
