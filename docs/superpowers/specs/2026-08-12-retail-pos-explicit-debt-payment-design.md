# Thiết kế lựa chọn công nợ trong thanh toán POS Retail

## Mục tiêu

Làm rõ luồng bán nợ tại popup Thanh toán bằng ba chế độ riêng: thanh toán đủ, thanh toán một phần và ghi nợ toàn bộ. Nhân viên không còn phải tự suy luận rằng giảm số tiền thực thu sẽ tạo công nợ.

## Phạm vi

- Thay đổi giao diện và logic lập payload của popup Thanh toán Retail.
- Giữ nguyên các phương thức nhận tiền hiện có: tiền mặt, thẻ, chuyển khoản và ví điện tử.
- Giữ nguyên API xác nhận đơn và mô hình công nợ hiện tại.
- Không coi công nợ là một phương thức nhận tiền.

## Chế độ thanh toán

Popup hiển thị bộ chọn chế độ ở đầu nội dung:

### Thanh toán đủ

- Là chế độ mặc định.
- Khởi tạo một khoản tiền mặt bằng toàn bộ tổng đơn.
- Nhân viên có thể chia thành nhiều phương thức nhưng tổng số tiền thực thu phải bằng tổng đơn.
- Không yêu cầu hạn thanh toán.

### Thanh toán một phần

- Nhân viên nhập đúng các khoản tiền thực tế đã nhận theo từng phương thức.
- Công nợ phát sinh được tính tự động bằng `tổng đơn - tổng thực thu`.
- Tổng thực thu phải lớn hơn `0` và nhỏ hơn tổng đơn.
- Bắt buộc có khách hàng và hạn thanh toán.

### Ghi nợ toàn bộ

- Không hiển thị danh sách phương thức nhận tiền.
- Số thực thu bằng `0`; toàn bộ tổng đơn là công nợ phát sinh.
- Bắt buộc có khách hàng và hạn thanh toán.
- Khi xác nhận, popup gọi `onSubmit([], dueDate)`.

## Chuyển đổi trạng thái

- Từ chế độ bất kỳ sang **Thanh toán đủ**: đặt lại một khoản tiền mặt bằng tổng đơn để luôn có trạng thái hợp lệ, dễ hiểu.
- Từ **Thanh toán đủ** sang **Thanh toán một phần**: giữ các khoản hiện tại để nhân viên giảm hoặc chỉnh số thực thu; giao diện chưa cho xác nhận cho đến khi tổng thực thu nhỏ hơn tổng đơn.
- Sang **Ghi nợ toàn bộ**: ẩn danh sách phương thức; các khoản đang nhập không được gửi lên API.
- Từ **Ghi nợ toàn bộ** sang chế độ có nhận tiền: khởi tạo một khoản tiền mặt bằng tổng đơn nếu danh sách khoản thu đang rỗng.
- Việc chuyển chế độ không thay đổi khách hàng đã chọn trên giỏ hàng.

## Hiển thị và thao tác

- Bộ chọn ba chế độ dùng nút hoặc radio có nhãn rõ ràng và trạng thái chọn truy cập được bằng bàn phím.
- Khu vực tổng kết hiển thị **Đã thu**, **Công nợ phát sinh** và **Tiền thừa**.
- Hạn thanh toán chỉ xuất hiện trong chế độ thanh toán một phần hoặc ghi nợ toàn bộ.
- Nếu chưa có khách hàng, hiển thị cảnh báo “Hãy chọn khách hàng trên giỏ hàng để bán nợ.”
- Nút xác nhận vẫn hoạt động như điểm kiểm tra cuối; lỗi được hiển thị trong popup và không đóng popup.

## Validation

Logic tổng hợp thanh toán nhận thêm chế độ giao dịch để kiểm tra đúng ý định người dùng:

- `full`: tổng thực thu phải bằng tổng đơn.
- `partial`: tổng thực thu phải lớn hơn `0`, nhỏ hơn tổng đơn, đồng thời có `customerId` và `dueDate`.
- `debt`: danh sách thanh toán phải rỗng, đồng thời có `customerId` và `dueDate`.
- Mọi chế độ tiếp tục chặn số tiền không phải số nguyên dương, tổng thu vượt tổng đơn, tiền khách đưa thấp hơn số thu và `tenderedAmount` trên phương thức không phải tiền mặt.

Không suy luận chế độ chỉ từ tổng tiền khi submit. Chế độ được chọn rõ ràng ở giao diện và truyền vào hàm validation để tránh một giao dịch “thanh toán đủ” vô tình trở thành bán nợ.

## Dữ liệu gửi đi

- Thanh toán đủ: `onSubmit(payments)`.
- Thanh toán một phần: `onSubmit(payments, dueDate)`.
- Ghi nợ toàn bộ: `onSubmit([], dueDate)`.

`RetailPosPage` tiếp tục đưa `customerId` từ giỏ hàng vào popup và đưa `dueDate` vào draft trước khi xác nhận. Không thay đổi contract API.

## Xử lý lỗi

- Thiếu khách hàng hoặc hạn thanh toán: báo lỗi trong popup, không gọi `onSubmit`.
- Tổng thu không phù hợp với chế độ: báo lỗi cụ thể và giữ toàn bộ dữ liệu đang nhập.
- Lỗi API từ `onSubmit`: được luồng POS hiện tại xử lý; popup không tự tạo công nợ cục bộ.
- Đổi chế độ không phát sinh API call.

## Kiểm thử

- Chế độ mặc định là thanh toán đủ với khoản tiền mặt bằng tổng đơn.
- Thanh toán đủ chặn tổng thực thu khác tổng đơn.
- Thanh toán một phần tính đúng công nợ và gửi các khoản thực thu cùng hạn thanh toán.
- Thanh toán một phần chặn thực thu bằng `0`, bằng tổng đơn hoặc vượt tổng đơn.
- Hai chế độ có nợ đều chặn khi thiếu khách hàng hoặc hạn thanh toán.
- Ghi nợ toàn bộ ẩn phương thức và gọi `onSubmit([], dueDate)`.
- Chuyển về thanh toán đủ tái tạo khoản tiền mặt hợp lệ.
- Hồi quy nhiều phương thức, tiền khách đưa và tiền thừa.
- Test trang POS xác nhận `dueDate` được đưa vào draft và danh sách thanh toán rỗng được chuyển tới API khi ghi nợ toàn bộ.

## Tiêu chí hoàn thành

- Nhân viên nhìn thấy và chủ động chọn được ba chế độ thanh toán.
- Thanh toán một phần và ghi nợ toàn bộ luôn gắn với khách hàng và hạn thanh toán.
- Payload xác nhận đơn phản ánh đúng số tiền thực thu; công nợ không bị biểu diễn như một phương thức tiền.
- Các test liên quan, typecheck và production build chạy thành công.
