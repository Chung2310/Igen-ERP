# Thiết kế giao diện đọc quy trình

## Mục tiêu

Tab Quy trình dành cho người dùng thường chỉ hiển thị nội dung hướng dẫn theo từng bước để đọc và làm theo. Màn hình chi tiết vận hành hiện tại (người tham gia, giao việc, tiến độ) không còn là luồng chính cho người dùng.

Quản lý vẫn được tạo, sửa và xóa quy trình cũng như các bước qua các nút quản trị hiện có.

## Phạm vi và hành vi

- Giữ danh sách các quy trình hiện có.
- Khi người dùng chọn một quy trình, hiển thị reader view trong cùng component thay cho detail view.
- Reader view hiển thị tên, mô tả, các bước theo thứ tự, nội dung hướng dẫn, thời lượng/hạn và file/link đính kèm của từng bước nếu có.
- Người dùng không có quyền quản lý không thấy nút sửa/xóa/tạo và không thấy các thao tác giao việc, theo dõi participant hoặc chuyển bước.
- Quản lý vẫn thấy các nút tạo/sửa/xóa; wizard và editor bước hiện tại được giữ nguyên và mở từ danh sách/reader view.
- API, model, cấu trúc dữ liệu và các liên kết Kanban hiện có không thay đổi.

## Triển khai

Giữ `WorkflowTab` làm nơi điều phối dữ liệu và trạng thái. Thay phần render `view === "detail"` bằng reader view; loại bỏ state/action chỉ phục vụ vận hành khỏi giao diện người dùng nhưng giữ các callback cần cho editor quản trị. Không thêm endpoint mới.

## Kiểm thử

- Kiểm tra tĩnh/render để xác nhận reader view có tiêu đề và toàn bộ bước theo đúng thứ tự.
- Xác nhận người dùng thường không thấy các nút chỉnh sửa/xóa/tạo và phần participant.
- Xác nhận quản lý vẫn mở được wizard/editor và các thao tác lưu/xóa hiện có.
- Chạy typecheck và các test frontend liên quan.
