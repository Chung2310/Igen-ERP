# Phạm vi hoàn thiện trợ lý trên toàn ERP

Ngày 21/11/2026. Theo yêu cầu mới của chủ dự án: **trợ lý phải phục vụ các chức năng trên toàn web, gồm tra cứu, thêm, sửa, xóa và các thao tác nghiệp vụ được phép**. Hai action đọc sản phẩm là prototype đã kiểm thử, không phải phạm vi sản phẩm cuối cùng.

Tài liệu này cập nhật đích đến và thứ tự triển khai. Chưa thay đổi runtime, bật flag, cấp ngân sách model hoặc mở production.

## 1. Hiện trạng đã đối chiếu

Đếm trực tiếp `ASSISTANT_OPERATIONS` trong `server/assistant/catalog.ts`: **1.004 action, 21 mã phân hệ, 411 GET và 593 phương thức khác GET**. Phương thức khác GET không đồng nghĩa tất cả là tạo/sửa/xóa; phải phân loại ý nghĩa từng action. Một action hiện có `unavailableReason`.

| Phân hệ trong catalog | Tổng | GET | Khác GET |
|---|---:|---:|---:|
| hr | 198 | 94 | 104 |
| customer | 16 | 9 | 7 |
| inventory | 68 | 20 | 48 |
| repair | 36 | 18 | 18 |
| finance | 69 | 30 | 39 |
| omni-inbox | 42 | 17 | 25 |
| social-marketing | 122 | 40 | 82 |
| company-knowledge | 15 | 5 | 10 |
| architect-assistant | 8 | 2 | 6 |
| legal-reference | 8 | 3 | 5 |
| resource | 17 | 7 | 10 |
| chat | 32 | 10 | 22 |
| student | 109 | 40 | 69 |
| student-partner | 14 | 4 | 10 |
| retail | 72 | 42 | 30 |
| retail-partner | 19 | 10 | 9 |
| marketing | 8 | 4 | 4 |
| labor-partner | 32 | 12 | 20 |
| worker | 31 | 12 | 19 |
| healthcare | 28 | 8 | 20 |
| quotation | 60 | 24 | 36 |
| **Tổng** | **1.004** | **411** | **593** |

Đường chat hiện tại vẫn dùng semantic interpreter và catalog theo quyền. V2 prototype đang khóa ở `product.list` và `inventory.product.detail`; contract ngữ cảnh cũng chỉ nhận trang sản phẩm. Gate mới có allowlist hai action tương ứng. Widget chưa chuyển sang V2. Vì vậy không thể công bố toàn web đã được nâng cấp dựa trên kết quả prototype này.

Số action khai báo không đo được độ bao phủ giao diện hoặc khả năng hiểu ngôn ngữ. Trường hợp tạo dự án lao động trong ảnh local cho thấy có action/API nhưng hội thoại vẫn có thể trả hướng dẫn. Chưa xác định nguyên nhân cụ thể của phiên đó từ log runtime.

## 2. Định nghĩa bao phủ toàn web

Lấy **chức năng người dùng thực hiện trên web** làm đơn vị kiểm kê; đối chiếu thêm API và catalog. Một trang có thể có nhiều chức năng và một action có thể phục vụ nhiều trang. Không dùng tỷ lệ action đăng ký làm tỷ lệ hoàn thành.

Ma trận bàn giao cần có: phân hệ, trang/chức năng, hành vi người dùng, API/method, actionId, quyền, loại tác động, yêu cầu xác nhận, reference/field, khả năng hỏi bổ sung, trạng thái hỗ trợ, test và bằng chứng. Kiểm kê cả trang ngoài sidebar, modal, tác vụ hàng loạt, import/export và tác vụ nền. Tận dụng script kiểm kê sẵn có nhưng rà các route động và phần script chưa phân tích được.

Mỗi chức năng phải được phân loại rõ: đã kiểm chứng qua hội thoại; có action nhưng chưa kiểm chứng; thiếu action/adapter; chỉ hỗ trợ một phần; bị giới hạn theo quyền/cấu hình; hoặc cần tương tác chuyên biệt. Ghi rõ phần chưa có API hoặc chưa tự động hóa được. Thiếu quyền không phải thiếu chức năng, nhưng cũng không được coi là đã thực thi thành công.

## 3. Luồng chung cần hoàn thiện

1. Nhận câu hỏi, lịch sử đang chờ và ngữ cảnh trang qua hợp đồng chung. Server xác minh ngữ cảnh, không coi dữ liệu client là quyền hoặc bằng chứng đối tượng.
2. Từ catalog đã lọc quyền/cấu hình, tìm các action liên quan và để AI chọn action, trích các giá trị có căn cứ. Không gửi toàn bộ danh mục chi tiết một cách vô hạn; đo retrieval/discovery trên catalog đầy đủ.
3. Server kiểm schema, điều kiện chưa hỗ trợ, quyền, phạm vi và đối tượng. Thiếu trường thì hỏi; nhiều đối tượng thì đưa lựa chọn; giữ thông tin người dùng đã cung cấp qua các lượt.
4. Tạo pending/preview và yêu cầu xác nhận theo chính sách của action. Lựa chọn phải do server tra lại; không tin payload nghiệp vụ client gửi kèm option.
5. Dispatch chung gọi API sau kiểm tra lại quyền/đối tượng và bản xác nhận. Quản lý deadline, hủy, journal và retry phù hợp từng loại tác động; ghi không rõ kết quả thì không gửi lặp mù quáng.
6. Thành công đi qua completion chung, trả bảng được phép hiển thị. Sau tạo, bổ sung optional vào đúng bản ghi vừa tạo, cho phép bỏ qua và kiểm quyền cập nhật.
7. Với yêu cầu nhiều bước, dùng kết quả đã xác thực của bước trước, giữ trạng thái tiếp tục và không lặp thao tác ghi khi retry/resume.

Thiết kế chung cần registry metadata/adapter cho từng loại tài nguyên và action; tái sử dụng prepare, resolver, dispatch, completion. Những API đặc thù có adapter rõ hợp đồng. **Không mở rộng bằng cách thêm một bộ regex riêng cho từng câu hoặc chỉ thêm actionId vào allowlist prototype.** Tách chính sách action khỏi transport/version; giữ tương thích pending legacy và kiểm restore khi tắt flag.

`unsupported` phải được phân biệt nội bộ: thiếu capability, không được phép, workflow tắt, điều kiện chưa hỗ trợ hay không chọn được action. Lưu trace đã loại dữ liệu nhạy cảm về danh mục ứng viên và quyết định để truy lỗi. Không lấy một kết luận của model làm bằng chứng rằng hệ thống không có API. Khi chưa xác định chắc, hỏi lại cụ thể; không tuyên bố đã thao tác hoặc chỉ trả hướng dẫn chung rồi coi ca hoàn tất.

## 4. Thứ tự triển khai theo phạm vi mới

| Gói | Công việc | Bàn giao / nghiệm thu |
|---|---|---|
| W1 | Lập ma trận toàn web và trace quyết định; truy ca tạo dự án lao động local | Có danh sách khoảng trống; xác định riêng lỗi chọn action, cấu hình/quyền và thực thi; chưa gán nguyên nhân từ ảnh |
| W2 | Thiết kế hợp đồng và registry chung từ prototype, có đọc/ghi và ngữ cảnh nhiều trang | Type, JSON, chuyển đổi legacy, restore, chính sách theo action; không chỉ sửa tuple hai action |
| W3 | Kiểm chứng đường tạo dự án lao động và họ thao tác thêm/sửa/xóa qua lõi chung | Fixture: hỏi mã thiếu, chọn lao động, giữ ngày, preview, xác nhận, API mock, completion, bổ sung cùng bản ghi; không tạo thật |
| W4 | Mở registry/adapter và nối widget/context cho các trang theo ma trận W1 | Mỗi nhóm có conversation test, quyền và trạng thái UI; tính coverage theo chức năng đã kiểm chứng, liệt kê phần còn thiếu |
| W5 | Hoàn thiện nhiều bước, tác vụ nền và tương tác chuyên biệt theo khoảng trống | Kiểm dependency/resume, timeout/cancel, ghi không trùng, upload/export hoặc chuyển sang form khi cần |
| W6 | Đánh giá model trên các phân hệ/họ thao tác và rollout có kiểm soát | Báo riêng hiểu ngôn ngữ và thực thi; chỉ chạy model thật/production khi được cấp ngân sách và phạm vi |

W1 lập phạm vi toàn web ngay từ đầu; không chờ hoàn tất một phân hệ mới kiểm kê phân hệ khác. W3 là ca đầu kiểm chứng kiến trúc ghi, không thu hẹp phạm vi sản phẩm thành một action ghi. Triển khai và rollout từng nhóm để cô lập lỗi, nhưng mọi nhóm dùng chung lõi và cùng ma trận mục tiêu.

## 5. Bằng chứng cần có

- Mỗi chức năng được đánh dấu hoàn tất phải có hội thoại fixture qua đúng đường runtime, không chỉ kiểm catalog hoặc mock toàn bộ prepare/dispatch/completion.
- Kiểm tra thiếu trường, lựa chọn trùng tên, mất quyền, đổi phạm vi, xác nhận/hủy, retry và lỗi API theo mức tác động. Với tạo: xác nhận trước ghi, bỏ qua/bổ sung optional, cùng bản ghi và bảng chung. Với sửa/xóa: đúng target và không bỏ qua xác nhận hiện hành.
- Đánh giá ngôn ngữ cần câu diễn đạt khác nhau trên nhiều phân hệ và họ thao tác; catalog đầy đủ và discovery được tính vào phép đo. Test provider giả lập chỉ chứng minh điều phối, không chứng minh model hiểu đúng câu thật.
- Tỷ lệ bao phủ chức năng, kết quả fixture, độ đúng model và kết quả live là bốn số riêng. Phần chưa đo ghi “chưa đo”; không suy rộng từ hai action đọc hoặc từ số lượng test.
- Giữ trần 24/accounting hiện tại cho đến khi có quyết định khác; ngân sách model thật hiện 0. Không gọi model/API/DB thật hoặc bật production trong bước cập nhật phạm vi này.

Ca đầu tham chiếu: “tạo 1 dự án mới tên vinscon20 quản lí lao động” phải vào luồng tạo dự án phù hợp khi được phép, giữ tên người dùng nhập, hỏi mã còn thiếu và xác nhận trước POST. Không tự coi tên là mã. Bản dài có danh sách lao động/ngày làm phải giữ các thông tin đó hoặc hỏi rõ khi chưa ánh xạ được; không âm thầm bỏ điều kiện để tạo một dự án gần đúng.
