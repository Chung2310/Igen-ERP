# Thiết kế tạo nhanh khách hàng tại POS Retail

## Mục tiêu

Cho phép nhân viên bán hàng tạo khách hàng ngay tại màn hình POS khi tìm theo số điện thoại nhưng không có kết quả. Khách hàng vừa tạo được tự động chọn vào giỏ hàng để nhân viên tiếp tục thanh toán hoặc bán nợ mà không mất trạng thái đơn.

## Phạm vi

- Mở chức năng cho mọi nhân viên đã có quyền truy cập màn hình POS; không tạo thêm quyền mới.
- Tái sử dụng API tạo khách hàng Retail hiện có.
- Popup dùng đầy đủ các trường giống trang Quản lý khách hàng: tên, số điện thoại, email, địa chỉ và ghi chú.
- Không thay đổi quy tắc tính tiền, thanh toán hoặc công nợ trong phạm vi này.

## Luồng giao diện

1. Nhân viên nhập số điện thoại vào bộ chọn khách hàng trên giỏ hàng.
2. Sau khi tìm kiếm hoàn tất và không có kết quả, giao diện hiển thị nút **Tạo khách hàng mới**.
3. Nhân viên bấm nút để mở popup. Giá trị tìm kiếm được điền sẵn vào trường số điện thoại.
4. Nhân viên nhập tên và các thông tin còn lại rồi lưu.
5. Khi API tạo thành công, popup đóng, khách hàng mới được chọn vào giỏ hàng và toàn bộ sản phẩm, số lượng, giảm giá, thuế, phí đang có được giữ nguyên.
6. Nhân viên tiếp tục thanh toán. Nếu còn số tiền chưa thu, đơn có đủ `customerId` để đi theo luồng bán nợ hiện tại.

Nút tạo mới chỉ xuất hiện khi truy vấn không rỗng, việc tìm kiếm đã hoàn tất, không có lỗi và danh sách kết quả rỗng. Khi đang tải hoặc API tìm kiếm bị lỗi, giao diện không hiển thị nút để tránh hiểu nhầm rằng khách hàng chưa tồn tại.

## Thành phần và ranh giới

### `CustomerPicker`

- Quản lý truy vấn tìm kiếm và trạng thái kết quả.
- Hiển thị hành động tạo mới khi thỏa điều kiện không có kết quả.
- Mở popup và chuyển truy vấn hiện tại thành dữ liệu điền sẵn.
- Nhận khách hàng vừa tạo và gọi `onChange(customer)` để cập nhật giỏ hàng.

### Popup tạo khách hàng

- Là component độc lập để biểu mẫu và xử lý submit không làm phình `CustomerPicker`.
- Nhận `scope`, số điện thoại điền sẵn, hàm đóng và hàm báo tạo thành công.
- Gọi `retailCustomersApi.create` với đúng phạm vi công ty/chi nhánh hiện tại.
- Tên khách hàng là bắt buộc. Các trường số điện thoại, email, địa chỉ và ghi chú được chuẩn hóa bằng cách loại bỏ khoảng trắng thừa trước khi gửi.
- Trong lúc lưu, khóa nút submit để ngăn tạo trùng do bấm nhiều lần.

Không sao chép logic quản lý danh sách khách hàng hoặc điều hướng sang trang khác. Popup chỉ chịu trách nhiệm tạo một bản ghi và trả kết quả về bộ chọn.

## Xử lý lỗi

- Lỗi validation phía client được hiển thị trong popup và không gọi API.
- Lỗi API, bao gồm số điện thoại trùng, được hiển thị trong popup; toàn bộ dữ liệu đã nhập được giữ lại.
- Đóng popup hoặc hủy không thay đổi khách hàng đang chọn và không làm mất giỏ hàng.
- Sau khi tạo thành công, trạng thái tìm kiếm và danh sách kết quả cũ được xóa trước khi chọn khách hàng mới.

## Kiểm thử

- `CustomerPicker` hiển thị nút tạo mới chỉ sau khi tìm không có kết quả.
- Không hiển thị nút khi truy vấn rỗng, đang tải, có kết quả hoặc tìm kiếm lỗi.
- Popup mở với số điện thoại đã nhập được điền sẵn.
- Form chặn tên rỗng và không gọi API.
- Submit gửi đủ năm trường cùng đúng `scope`.
- Tạo thành công đóng popup và gọi `onChange` với khách hàng trả về.
- Lỗi API giữ popup, giữ dữ liệu và hiển thị thông báo.
- Hủy popup không gọi API hoặc thay đổi khách hàng trong giỏ.
- Test trang POS xác nhận chọn khách hàng mới không làm mất các dòng hàng và `customerId` được truyền vào luồng thanh toán.

## Tiêu chí hoàn thành

- Nhân viên POS có thể tạo khách hàng đầy đủ ngay từ trạng thái tìm không thấy.
- Khách hàng mới tự động gắn vào đơn hiện tại.
- Luồng bán nợ nhận được `customerId` của khách vừa tạo.
- Các test liên quan và bộ kiểm tra build/typecheck của dự án chạy thành công.
