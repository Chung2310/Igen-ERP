# Rà soát trợ lý AI theo tab và thao tác

## Phạm vi

- Danh mục hiện có **932 thao tác**. Bộ kiểm kê phân loại được **722 thao tác xem, tạo, sửa, xóa** trên **23 tab**. **210 thao tác chuyên biệt** như gửi, duyệt, nhập dữ liệu, tính toán và quy trình khác được liệt kê trong JSON nhưng không gộp vào bốn nhóm CRUD.
- Bộ tạo câu kiểm tra sinh **5.776 câu** có dấu/không dấu, tương ứng **5.750 câu duy nhất** sau khi gộp câu trùng trong từng tab.
- Báo cáo này phân biệt kiểm tra catalog, kiểm tra route bằng test cục bộ và đánh giá mô hình. Chúng không được tính thay cho nhau.

## Kiểm kê theo tab

| Phân hệ | Tab | CRUD | Xem | Tạo | Sửa | Xóa |
|---|---|---:|---:|---:|---:|---:|
| Chat | `/tro-chuyen` | 21 | 10 | 1 | 6 | 4 |
| Kho tri thức | `/kho-tri-thuc` | 10 | 5 | 0 | 1 | 4 |
| Khách hàng | `/quan-ly-khach-hang` | 14 | 9 | 3 | 2 | 0 |
| Tài chính | `/tai-chinh` | 52 | 30 | 16 | 5 | 1 |
| Y tế | `/quan-ly-y-te` | 25 | 14 | 5 | 5 | 1 |
| Nhân sự | `/` | 3 | 3 | 0 | 0 | 0 |
| Nhân sự | `/nhan-su` | 100 | 53 | 15 | 24 | 8 |
| Chi nhánh | `/nhan-su?sub=chi-nhanh` | 4 | 1 | 1 | 1 | 1 |
| Kanban | `/nhan-su?sub=kanban` | 8 | 2 | 2 | 2 | 2 |
| Phòng ban | `/nhan-su?sub=phong-ban` | 4 | 1 | 1 | 1 | 1 |
| Kho sản phẩm | `/kho-san-pham` | 55 | 20 | 14 | 12 | 9 |
| Đối tác lao động | `/doi-tac-lao-dong` | 19 | 12 | 2 | 3 | 2 |
| Marketing | `/marketing` | 8 | 4 | 1 | 2 | 1 |
| Hộp thư đa kênh | `/omni-inbox` | 19 | 11 | 1 | 7 | 0 |
| Báo giá | `/bao-gia` | 39 | 17 | 8 | 11 | 3 |
| Sửa chữa, bảo hành | `/sua-chua-bao-hanh` | 29 | 19 | 6 | 3 | 1 |
| Tài nguyên | `/quan-ly-tai-nguyen` | 15 | 7 | 3 | 3 | 2 |
| Bán lẻ | `/ban-le` | 56 | 42 | 7 | 5 | 2 |
| Đối tác bán lẻ | `/doi-tac-ban-le` | 17 | 10 | 4 | 3 | 0 |
| Chiến dịch nội dung | `/chien-dich-noi-dung` | 92 | 48 | 20 | 13 | 11 |
| Học viên | `/quan-ly-hoc-vien` | 91 | 38 | 16 | 22 | 15 |
| Đối tác giới thiệu | `/doi-tac` | 13 | 3 | 4 | 4 | 2 |
| Lao động | `/quan-ly-lao-dong` | 28 | 11 | 7 | 5 | 5 |
| **Tổng** | | **722** | **370** | **137** | **140** | **75** |

## Các lỗi đã sửa và kiểm tra

- **Học viên:** câu hỏi học phí của một người dùng bộ lọc hồ sơ `search`, không gửi trường không được API hỗ trợ như `studentName`. Tra cứu chất lượng, thông báo, ngưỡng đánh giá và lịch sử thu tiền được tách khỏi tra cứu hồ sơ. Câu “xem trước ảnh hưởng khi xóa” được chuyển đúng sang bước xem trước.
- **Khách hàng:** tên, mã và số điện thoại đi vào trường API `query_q`. “Bổ sung thông tin cho khách hàng” được hiểu là cập nhật hồ sơ có sẵn, không tự chuyển thành tạo khách hàng mới. Phiếu tài chính thông thường được phân biệt với phiếu quỹ.
- **Nhân sự và lương:** tra cứu nhân sự không bị lẫn với hồ sơ chi tiết; giờ làm, biến đầu vào lương, lịch phát hành đối soát và nhật ký của *kỳ lương* được tách khỏi nhật ký của một *lượt lương*.
- **Lao động:** thêm/sửa/xóa hồ sơ được phân biệt với hợp đồng lao động; hợp đồng có thao tác xem chi tiết, cập nhật, xóa và gia hạn riêng. Trường dữ liệu tiêu chuẩn có đường xem và sửa riêng.
- **Y tế:** xem danh sách nhân viên y tế không bị định tuyến sang công việc chăm sóc; dữ liệu từng dòng nhập Excel, xem trước xóa bệnh nhân và bổ sung thông tin cho hồ sơ hiện tại có route riêng.
- **Xem hồ sơ:** thêm kiểm tra cho cách hỏi tự nhiên về nội dung marketing đã lưu và tài sản cố định; tránh để câu yêu cầu cập nhật bị hiểu thành xem chi tiết.
- **Xem trước và tra cứu phép năm:** sáu API xem trước dùng POST được nhận diện là thao tác xem; câu mẫu được viết lại theo mục đích nhập, tạo ảnh, xem gợi ý AI hoặc xem ảnh hưởng trước khi xóa. Tra cứu số ngày phép còn lại không bị bỏ sót chỉ vì URL có `/leave`.
- **Cập nhật trạng thái:** thay đổi trạng thái chiến dịch và đổi loại mẫu tài liệu báo giá được tính là sửa/cập nhật; câu mẫu gọi đúng trường hợp đổi trạng thái hoặc danh mục, không dùng câu “sửa thông tin” chung chung.
- **Lời gọi AI trong audit:** giới hạn `max_tokens` theo cấu hình để tránh gửi mặc định 65.535 token khi tài khoản không đủ hạn mức; cho phép tiếp tục từ checkpoint, lưu từng lô và dừng ngay khi gặp HTTP 402 thay vì chờ rồi gửi lặp lại.

## Kết quả xác minh

- `npx vitest run server/assistant server/service/openrouter.chat.test.ts`: **35 file / 348 bài test đạt**.
- `npm run typecheck`: **đạt**.
- `git diff --check`: **đạt**; Git chỉ báo khác biệt quy ước LF/CRLF ở một số file có sẵn.
- Có test hội thoại kiểm tra lựa chọn khóa học trong khung chat, lựa chọn hồ sơ liên quan, xác nhận trước thao tác ghi và bổ sung thông tin vào đúng bản ghi đã tạo. Toàn bộ các câu trong bảng trên không tương đương với thao tác ghi dữ liệu trên tenant thật.

## Giới hạn của lượt chạy mô hình

Ma trận đánh giá **5.750 câu chưa hoàn tất**. JSON hiện có một lô mẫu **40/5.750 câu** khớp, nhưng lô này không đại diện cho độ chính xác tổng thể. Tài khoản OpenRouter trả HTTP 402 vì hạn mức còn lại chỉ đủ yêu cầu tối đa 1.667 token; các lô lớn hơn cũng từng trả JSON bị cắt khi giảm `max_tokens`. Audit đã dừng thay vì coi lỗi hạn mức hoặc JSON thiếu là lỗi hiểu yêu cầu hay tiếp tục sử dụng số dư. JSON lưu lô hợp lệ và trạng thái lỗi; không được diễn giải mẫu đã chạy như độ chính xác của toàn ma trận.

Ma trận cũng **không chạy 5.750 yêu cầu qua bộ thông dịch sản phẩm**, và không thực hiện ghi/xóa trên dữ liệu khách hàng thật. Độ bao phủ route của bộ thông dịch được xác minh qua test tự động cục bộ; đánh giá mô hình quy mô lớn cần hạn mức OpenRouter đủ dùng để chạy lại lệnh audit.

Chi tiết thao tác, câu mẫu, nhóm tab và kết quả đánh giá từng lô nằm trong [intent-audit-report.json](./intent-audit-report.json). Lệnh chạy lại: `npx tsx server/assistant/scripts/intent-audit.ts --resume --evaluate`.
