# Thiết kế làm rõ và chống tràn popup thanh toán Retail

## Mục tiêu

Làm cho popup Thanh toán dễ hiểu với nhân viên tại quầy: giải thích rõ hạn thanh toán công nợ, phân biệt hai ô tiền trong mỗi nguồn tiền, hiển thị tiền theo định dạng Việt Nam trong lúc nhập và không tràn khỏi popup trên màn hình hẹp.

## Phạm vi

- Chỉ thay đổi giao diện và cách nhập liệu trong popup Thanh toán Retail.
- Giữ nguyên ba chế độ thanh toán, validation miền nghiệp vụ và payload API hiện tại.
- Giá trị tiền trong state và payload luôn là số nguyên; chuỗi có dấu phân cách chỉ phục vụ hiển thị.

## Hạn thanh toán công nợ

Trong chế độ **Thanh toán một phần** và **Ghi nợ toàn bộ**, ô ngày được bọc trong một trường có:

- Nhãn nhìn thấy: **Hạn thanh toán công nợ**.
- Mô tả: **Ngày khách hàng cần thanh toán phần công nợ còn lại.**
- Nhãn truy cập của input vẫn là `Hạn thanh toán công nợ`.

Trường này không hiển thị trong chế độ Thanh toán đủ.

## Khối nguồn tiền

Mỗi khoản thanh toán được trình bày như một khối riêng với tiêu đề **Nguồn tiền 1**, **Nguồn tiền 2** và tăng theo thứ tự.

Các trường luôn có nhãn nhìn thấy:

- **Phương thức thanh toán** cho danh sách tiền mặt, thẻ, chuyển khoản và ví điện tử.
- **Số tiền thu** với mô tả **Khoản được ghi nhận vào đơn.**
- Khi phương thức là tiền mặt: **Tiền khách đưa** với mô tả **Dùng để tính tiền trả lại.**
- Khi phương thức không phải tiền mặt: **Mã giao dịch**; đây là thông tin tham chiếu tùy chọn và không hiển thị mô tả tiền trả lại.

Nút xóa nằm trong chính khối nguồn tiền và có nhãn truy cập theo số thứ tự.

## Nhập và định dạng tiền

Tạo một component nhập tiền dùng chung trong popup:

- Dùng `type="text"` và `inputMode="numeric"` để vẫn mở bàn phím số trên thiết bị di động.
- Chỉ nhận chữ số; khi người dùng nhập hoặc dán nội dung, loại bỏ ký tự không phải số.
- Hiển thị dấu phân cách hàng nghìn theo `vi-VN`, ví dụ giá trị số `500000` hiển thị thành `500.000`.
- Hiển thị hậu tố `₫` cố định bên phải, không nằm trong giá trị input.
- Chuỗi rỗng ánh xạ thành số `0`; state và callback luôn nhận số nguyên.
- Áp dụng cho cả **Số tiền thu** và **Tiền khách đưa**.

Việc định dạng không thay đổi các quy tắc số tiền dương, tiền khách đưa, tiền thừa hoặc tổng thực thu.

## Bố cục responsive

- Container popup có `overflow-x-hidden` và các vùng nội dung có `min-w-0`.
- Bộ chọn ba chế độ dùng lưới một cột trên màn hình hẹp và ba cột từ breakpoint phù hợp; chữ được phép xuống dòng.
- Mỗi nguồn tiền dùng một cột trên mobile. Trên desktop, các trường có thể nằm trên cùng hàng nhưng dùng cột co giãn `minmax(0, ...)`, không dùng tổng chiều rộng cố định vượt container.
- Mọi input và select có `w-full min-w-0`.
- Ba thẻ tổng kết **Đã thu**, **Công nợ phát sinh**, **Tiền thừa** dùng một cột trên mobile và ba cột từ breakpoint phù hợp.
- Giá trị tiền trong thẻ cho phép xuống dòng hoặc co chữ hợp lý, không tạo cuộn ngang.

## Thành phần

### `CurrencyInput`

Component nội bộ, độc lập với nghiệp vụ thanh toán:

- Nhận `label`, `description`, `value` và `onChange(number)`.
- Chịu trách nhiệm chuẩn hóa chữ số, định dạng `vi-VN` và hiển thị hậu tố `₫`.
- Không tự kiểm tra giới hạn nghiệp vụ; `PaymentDialog` và `buildPaymentSummary` tiếp tục chịu trách nhiệm đó.

### `ExplicitPaymentDialog`

- Sử dụng `CurrencyInput` cho hai loại số tiền.
- Cung cấp tiêu đề và nhãn nhìn thấy cho mỗi nguồn tiền.
- Đổi nhãn trường phụ theo phương thức đang chọn.
- Cập nhật class responsive để loại bỏ tràn ngang.

## Xử lý lỗi

- Dán chuỗi có dấu chấm, dấu phẩy, khoảng trắng hoặc ký hiệu tiền vẫn lấy phần chữ số và định dạng lại.
- Giá trị không có chữ số trở thành `0`; validation hiện có sẽ báo lỗi khi xác nhận nếu không phù hợp với chế độ.
- Thay đổi phương thức từ tiền mặt sang phương thức khác tiếp tục xóa `tenderedAmount`; đổi về tiền mặt đặt tiền khách đưa bằng số tiền thu hiện tại.
- Lỗi validation vẫn hiển thị trong popup và giữ dữ liệu người dùng đã nhập.

## Kiểm thử

- Hạn thanh toán có nhãn và mô tả nhìn thấy trong hai chế độ công nợ, không có ở thanh toán đủ.
- `CurrencyInput` hiển thị `500.000` và hậu tố `₫` từ giá trị `500000`.
- Nhập, xóa và dán chuỗi tiền Việt Nam trả đúng số nguyên qua callback.
- Mỗi nguồn tiền hiển thị tiêu đề, nhãn **Số tiền thu** và mô tả tương ứng.
- Tiền mặt hiển thị **Tiền khách đưa**; phương thức khác hiển thị **Mã giao dịch**.
- Payload submit vẫn chứa số nguyên và tính đúng tiền thừa.
- Kiểm tra các class thiết yếu: `overflow-x-hidden`, `min-w-0`, lưới mobile một cột và desktop nhiều cột.
- Chạy lại toàn bộ test ba chế độ thanh toán và tích hợp POS.

## Tiêu chí hoàn thành

- Nhân viên hiểu mục đích của từng trường mà không cần suy đoán.
- Mọi số tiền nhập trong popup hiển thị theo định dạng hàng nghìn Việt Nam.
- Popup không tạo tràn ngang ở mobile, tablet hoặc chiều rộng desktop thông dụng.
- Payload và quy tắc thanh toán/công nợ không thay đổi.
- Test liên quan, typecheck và production build chạy thành công.
