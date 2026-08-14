# Sửa trực tiếp dữ liệu đầu vào trong bảng kỳ lương

## Mục tiêu

Cho phép người quản lý sửa trực tiếp dữ liệu đầu vào của từng nhân viên ngay tại các ô trong bảng kỳ lương, thay vì phải chuyển sang một bảng hoặc biểu mẫu riêng. Người dùng có thể sửa nhiều ô, nhiều nhân viên rồi lưu tất cả thay đổi trong một lần.

## Phạm vi trường dữ liệu

Sáu cột đầu vào cố định được sửa trực tiếp:

- Lương thỏa thuận.
- Ngày đối soát.
- Giờ đối soát.
- Phụ cấp.
- Thưởng.
- Khấu trừ.

Các biến đầu vào tùy chỉnh đang hoạt động tiếp tục dùng cùng cơ chế sửa trực tiếp nếu chúng được hiển thị trong bảng.

## Điều kiện chỉnh sửa

- Chỉ người có quyền quản lý bảng lương mới được sửa.
- Chỉ cho phép sửa khi kỳ lương chưa tồn tại hoặc đang ở trạng thái `draft` (`Nháp`).
- Từ trạng thái `review` (`Kiểm tra`) trở đi, dữ liệu đầu vào là chỉ đọc.
- Không thay đổi quyền, vòng đời hay quy tắc mở lại kỳ lương hiện có.

## Trải nghiệm trong bảng

Mỗi trường đầu vào là một ô số nằm ngay trên dòng của nhân viên tương ứng. Giá trị ghi đè đã lưu được hiển thị trong ô; nếu chưa có giá trị ghi đè, ô để trống và hiển thị dữ liệu nguồn làm gợi ý. Nhập `0` có nghĩa là ghi đè bằng 0, còn để trống hoặc hoàn tác có nghĩa là dùng lại dữ liệu nguồn.

Người dùng có thể dùng chuột hoặc phím `Tab` để di chuyển giữa các ô và sửa liên tục. Không tự lưu khi rời ô hoặc nhấn Enter.

Trạng thái được phân biệt trực quan:

- Ô chưa thay đổi dùng nền bình thường và hiển thị dữ liệu nguồn.
- Ô có giá trị ghi đè đã lưu dùng nền xanh nhạt.
- Ô đã sửa nhưng chưa lưu dùng nền vàng và nhãn `Chưa lưu`.
- Ô có giá trị ghi đè đã lưu cung cấp thao tác `Hoàn tác` để đưa trường về dữ liệu nguồn trong lần lưu tiếp theo.

## Lưu hàng loạt

Khi có thay đổi chưa lưu, thanh thông báo phía trên bảng hiển thị số nhân viên có thay đổi và nút `Lưu thay đổi`. Nút này mở hộp thoại yêu cầu một lý do đối soát chung, bắt buộc trước khi gửi.

Payload chỉ chứa các nhân viên và trường thực sự thay đổi. Mỗi dòng dùng phiên bản dữ liệu đã tải để phát hiện xung đột cập nhật. Các trường được hoàn tác được gửi trong `clearFields`; giá trị tùy chỉnh được nhóm trong `customValues` theo hợp đồng API hiện tại.

## Kết quả lưu và xử lý lỗi

- Dòng lưu thành công được xóa khỏi danh sách bản nháp trên giao diện.
- Dòng lưu thất bại giữ nguyên các giá trị người dùng vừa nhập và hiển thị thông báo lỗi tại dòng nhân viên.
- Nếu có cả dòng thành công và thất bại, giao diện tải lại dữ liệu đã lưu nhưng vẫn giữ các dòng lỗi để người dùng sửa và lưu lại.
- Lỗi toàn bộ request giữ nguyên toàn bộ dữ liệu chưa lưu.
- Trong lúc lưu, hộp thoại và nút lưu bị khóa để tránh gửi trùng.

## Tính lại bảng lương

Lưu dữ liệu đầu vào không tự động tính lại bảng lương. Sau khi lưu thành công, hệ thống tải lại dữ liệu kỳ và kết quả hiện có, hiển thị trạng thái bảng lương cần cập nhật, rồi để người dùng chủ động bấm tính hoặc tính lại lương.

Các revision và snapshot đã có không bị sửa trực tiếp. Kết quả mới chỉ được tạo khi người dùng thực hiện thao tác tính lại theo luồng hiện tại.

## Cấu trúc triển khai

- `PayrollTab` chịu trách nhiệm render các ô trực tiếp, quản lý modal lưu và kết nối thao tác với dịch vụ payroll.
- Module helper `payrollInlineInputs` chịu trách nhiệm bất biến cho trạng thái draft, tạo payload chỉ gồm thay đổi và giữ lại các dòng lỗi.
- API period input hiện tại tiếp tục xử lý lưu hàng loạt, version conflict, lý do đối soát và đánh dấu kỳ cần cập nhật.
- Component `PayrollPeriodInputsTable` riêng không được đưa trở lại luồng giao diện; việc sửa diễn ra trong bảng lương chính.

## Kiểm thử chấp nhận

- Quản lý có thể sửa trực tiếp cả sáu cột trên từng dòng khi kỳ ở trạng thái `Nháp`.
- Người không có quyền hoặc kỳ từ `Kiểm tra` trở đi không nhìn thấy ô có thể sửa.
- Sửa nhiều ô trên nhiều nhân viên chỉ tạo một thao tác lưu hàng loạt.
- Giá trị `0` được lưu như một giá trị ghi đè hợp lệ.
- Hoàn tác một trường tạo `clearFields` và đưa trường về dữ liệu nguồn sau khi lưu.
- Lưu yêu cầu lý do đối soát không rỗng.
- Thành công một phần chỉ xóa các draft thành công; draft lỗi và thông báo lỗi vẫn còn.
- Sau khi lưu, giao diện báo cần cập nhật nhưng không tự động tính lại bảng lương.
- Điều hướng bàn phím bằng `Tab` hoạt động theo thứ tự các ô trong bảng.

## Ngoài phạm vi

- Tự lưu khi blur hoặc nhấn Enter.
- Nút lưu riêng cho từng nhân viên.
- Cho sửa dữ liệu ở trạng thái `Kiểm tra`, `Chốt` hoặc `Đã thanh toán`.
- Thay đổi công thức lương, chính sách lương hoặc vòng đời kỳ lương.
- Tạo một màn hình nhập liệu thứ hai.
