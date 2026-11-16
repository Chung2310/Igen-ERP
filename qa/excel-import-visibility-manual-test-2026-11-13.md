# Kiểm thử nhập Excel và khả năng nhìn thấy dữ liệu — staging, 13/11/2026

## Phạm vi và cách thử

Playwright điều khiển Chrome để chọn file, xem trước, xác nhận nhập và kiểm tra kết quả trên giao diện. Không tạo hoặc sửa dữ liệu bằng lệnh gọi API. Dùng hai tài khoản admin cùng công ty, chi nhánh `QA-KHO-20261113` và `MAIN`. Sau mỗi lần nhập, kiểm tra tải lại trang, màn nghiệp vụ liên quan, admin còn lại cùng chi nhánh và chi nhánh khác. Các bản ghi mới đều có tiền tố `QA Excel` hoặc mã `QA-...-EXCEL-20261113`.

## Test case và kết quả

| Mã | Thao tác và kỳ vọng | Kết quả quan sát | Trạng thái |
| --- | --- | --- | --- |
| HV-01 | Nhập học viên mới với học phí 1.000.000đ, đã đóng 200.000đ, còn nợ 800.000đ. Kiểm tra danh sách, hồ sơ, bảng Học phí, tải lại và admin thứ hai. | `QA Excel Hoc Phi 20261113` xuất hiện ở cả hai admin tại chi nhánh QA. Hồ sơ và bảng Học phí hiện đúng ba số tiền; có nhật ký đóng phí 200.000đ từ file Excel. Sau tải lại vẫn còn. Tại MAIN không thấy bản ghi QA. | Đạt |
| HV-02 | Nhập lại cùng học viên để cập nhật học phí thành 1.200.000đ, đã đóng 300.000đ, còn nợ 900.000đ. Kỳ vọng số liệu sau nhập khớp file và bản xem trước, không tạo học viên thứ hai. | Bản xem trước ghi 1.200.000đ / 300.000đ và “Sẽ cập nhật học phí”. Kết quả báo cập nhật 1, tạo mới 0. Bảng Học phí thực tế là **1.200.000đ / 200.000đ / 1.000.000đ**; khoản đã đóng mới 300.000đ bị bỏ qua. | **Lỗi** |
| HV-03 | Đối chiếu tất cả học viên đang có tại MAIN với bảng Học phí bằng phân trang giao diện. | 41/41 học viên đang có đều xuất hiện trong bảng Học phí. Bảng có 43 dòng vì giữ thêm 2 dòng của học viên đã xóa, cùng ghi “Nguyễn Văn A (đã xóa)”; đây là dữ liệu lịch sử chứ chưa chứng minh học viên hiện tại bị mất. | Đạt trong phạm vi đối chiếu |
| DT-01 | Nhập một đối tác học viên tại QA, kiểm tra sau tải lại và bằng admin khác cùng chi nhánh. | Admin tạo thấy `QA Excel Partner 20261113` sau nhập và tải lại. Admin còn lại cũng chọn `QA-KHO-20261113` nhưng danh sách 0 đối tác, không thấy bản ghi. Tại MAIN, admin tạo không thấy bản ghi QA. | **Lỗi chia sẻ cùng chi nhánh** |
| LD-01 | Nhập một lao động thời vụ tại QA, kiểm tra sau tải lại, admin khác và MAIN. | `QA Excel Lao Dong 20261113` hiện trong danh sách Lao động sau nhập và tải lại; admin còn lại cùng QA thấy; tại MAIN không thấy. | Đạt |
| YT-01 | Tải mẫu bệnh nhân, điền một dòng, tải lên, mở lịch sử, xác nhận nhập, kiểm tra danh sách và admin khác. | File ở trạng thái chờ xác nhận sau tải lên; sau xác nhận báo đã nhập 1. `QA Excel Benh Nhan 20261113` hiện trong danh sách sau tải lại và ở admin khác cùng QA; không hiện tại MAIN. | Đạt |
| YT-02 | Tải mẫu lượt khám, liên kết mã bệnh nhân vừa nhập, xác nhận và kiểm tra danh sách. | `QA-VISIT-EXCEL-20261113` hiện đúng bệnh nhân và ngày khám 13/11/2026, còn sau tải lại, admin khác cùng QA thấy. | Đạt |
| BG-01 | Nhập một sản phẩm Bảng giá bằng Excel, kiểm tra mã hàng, giá, tải lại, admin khác và MAIN. | `QA Excel Bang Gia 20261113` / `QA-EXCEL-PRICE-20261113` hiện giá 150.000đ sau tải lại. Admin khác cùng QA thấy; tại MAIN không thấy. Đây là **Bảng giá của phân hệ Báo giá**, không phải danh mục hàng hóa của Kho. | Đạt |
| KHO-01 | Tìm chức năng nhập Excel trên màn Hàng hóa và Giao dịch kho đang chạy. | Hàng hóa không có nút nhập Excel. Giao dịch kho có Xuất Excel nhưng không có Nhập Excel; giao diện hiện đang để chỉ đọc. Không thể kiểm tra nhập bằng thao tác người dùng. | Chưa có luồng UI để thử |

Lưu ý hiển thị: cột “Học phí” trong danh sách Học viên đang hiện số dư có dấu âm (ví dụ `-1.000.000đ` sau HV-02), trong khi màn Học phí tách tổng phí / đã đóng / còn nợ. Cần tránh hiểu con số ở danh sách là tổng học phí.

## Lỗi cần xử lý

### 1. Nhập lại học phí không cập nhật khoản “Đã đóng”

Tái hiện với file `qa-student-tuition-update-20261113.xlsx` trên chi nhánh QA:

1. Mở Học viên → Nhập Excel, chọn file có học viên `QA Excel Hoc Phi 20261113`, học phí 1.200.000đ, đã đóng 300.000đ, còn nợ 900.000đ.
2. Xem trước: dòng hợp lệ và ghi “Sẽ cập nhật học phí”, cột Đã đóng 300.000đ.
3. Bấm nhập. Kết quả cập nhật học phí 1, không tạo mới.
4. Mở Học phí: học phí 1.200.000đ, **đã thu vẫn 200.000đ**, còn nợ 1.000.000đ.

Mã nguồn hiện tại xác nhận nhánh cập nhật học viên cũ chỉ ghi `fee` và `tuitionWaived`; `paidAmount` của file bị bỏ qua (`server/modules/student-management/services/student.service.ts`, nhánh `isTuitionUpdate`). Cần thống nhất quy tắc đối soát: nếu file được phép cập nhật tiền đã đóng thì phải ghi chênh lệch vào nhật ký thanh toán và bản ghi thanh toán, tránh lệch sổ; nếu chỉ cho phép đổi tổng học phí thì bản xem trước phải nêu rõ khoản đã đóng trong file không được áp dụng và không nên hiển thị kết quả như đã nhập đủ số liệu.

### 2. Đối tác học viên nhập Excel không hiện với admin khác cùng chi nhánh

Tái hiện: admin 36 chọn `QA-KHO-20261113` → Đối tác học viên → Nhập Excel `qa-student-partner-20261113.xlsx` → thành công 1 và tải lại vẫn thấy. Đăng nhập admin còn lại, chọn **cùng chi nhánh** → Đối tác học viên → tổng 0, không thấy đối tác. Đây là kết quả staging tại thời điểm thử; nhánh `fix-ui` có thay đổi chưa triển khai liên quan phạm vi owner/chi nhánh, nên cần kiểm tra lại sau triển khai trước khi kết luận bản sửa đã giải quyết.

## Những đường nhập chưa có kết luận end-to-end

- **Kho & Sản phẩm:** mã cũ vẫn có xử lý Excel cho danh mục sản phẩm/giao dịch kho, nhưng màn đang chạy không cung cấp nút nhập. Không bắn API để thay thao tác người dùng.
- **Điểm thi học viên:** có nhập Excel trong thẻ kỳ thi, nhưng chưa tạo kỳ thi và lớp thử riêng để thay đổi điểm; không dùng kỳ thi thật làm dữ liệu thử.
- **Đối tác lao động → đối soát:** file Excel/CSV ở đây chỉ điền số giờ/số tháng vào biểu mẫu tính kỳ; bản thân thao tác chọn file không tạo bản ghi đối soát. Chưa thử với kỳ mới trong lượt kiểm thử nhập dữ liệu này.
- **Marketing:** có đường nhập file cho order tài sản chiến dịch và tạo nội dung hàng loạt, nhưng không có chiến dịch/template thử phù hợp trong phạm vi tài khoản đã dùng; chưa kiểm chứng sau lưu.
- **Y tế:** đã thử hai mẫu một sheet (bệnh nhân, lượt khám). Chưa thử lựa chọn “Toàn bộ workbook y tế” nhiều sheet/25 cột.

Các kết luận “Đạt” chỉ áp dụng cho dữ liệu và tình huống đã ghi trong bảng; chưa xác nhận mọi mẫu file Excel lịch sử. Nếu cần tìm đúng sự cố học phí cũ, cần tên học viên hoặc file đã nhập để đối chiếu dòng gốc.

Các chỗ nhận `.xlsx` làm **tệp đính kèm** (yêu cầu báo giá, kho tri thức, trợ lý, tài nguyên, hồ sơ nhân sự) không được tính là nhập bảng dữ liệu nghiệp vụ: tệp được lưu/đọc như tài liệu, không tạo danh sách bản ghi từ từng dòng Excel.
