# Nạp ví bằng chuyển khoản

1. Liên kết tài khoản nhận tiền với SePay.
2. Đặt `WALLET_PAYMENT_PROVIDER=sepay` và điền `SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME` trong `.env` trên server. Khóa webhook là khóa dùng chung bạn cấu hình ở bước 3, không phải token gọi API quản lý SePay. Dùng tên ngân hàng `short_name` khớp trường `gateway` trong webhook (ví dụ `Vietcombank`), không dùng BIN ở biến này.
3. Tạo webhook trên SePay: sự kiện **Có tiền vào**, tài khoản nhận tiền tương ứng, URL HTTPS `https://<domain>/api/v1/wallet/webhook/sepay`, xác thực **API Key** với cùng `SEPAY_WEBHOOK_API_KEY`. Header được kiểm tra là `Authorization: Apikey <key>`.
4. Trong **Cấu hình Công ty → Cấu hình chung → Cấu trúc mã thanh toán**, bật nhận diện mã và thêm mẫu tiền tố **LC**, hậu tố **8 chữ số**. Mỗi lần nạp có mã `LC` + 8 chữ số riêng; QR điền sẵn mã này và số tiền. Sau đó sửa webhook LuxCare, tại bước **Tài khoản và bộ lọc**, chọn đúng tài khoản nhận tiền và tiền tố **LC** (viết hoa). Có thể nhận diện từ `code` hoặc `content` của webhook; không dùng `description` để khớp đơn.
5. Khởi động lại server sau khi cập nhật môi trường. Vào **Ví & Nạp tiền**, tạo yêu cầu, kiểm tra ngân hàng/tài khoản/nội dung trên QR trước khi thử một khoản nhỏ.

`SEPAY_QR_ACCOUNT_NUMBER` chỉ cần khi QR sử dụng VA khác tài khoản gốc; `SEPAY_SUB_ACCOUNT` dùng kiểm tra VA trong webhook. Đối với VietinBank cá nhân/hộ kinh doanh, đặt `SEPAY_TRANSFER_NOTE=SEVQR`. VA theo nội dung chuyển khoản có thể cần `TKP<ma-VA>`; xác nhận quy tắc tài khoản trong SePay trước khi dùng.

Webhook chỉ cộng đúng Credit của yêu cầu đang chờ khi **tiền vào, mã thanh toán, ngân hàng, tài khoản và số tiền VND đều khớp** (thêm VA nếu cấu hình). Thiếu/thừa tiền hoặc sai nội dung không tự cộng; xem cảnh báo `Transfer does not match a pending deposit` theo ID webhook và đối soát thủ công. Webhook tiền ra/không có mã được bỏ qua và trả `success: true`.

MongoDB phải hỗ trợ transaction (replica set hoặc sharded cluster). Index unique sparse `sepayTransactionId` chống xử lý một giao dịch ngân hàng nhiều lần; cập nhật trạng thái và cộng số dư nằm trong cùng transaction. Không có chế độ cộng tiền không nguyên tử khi database không hỗ trợ. Lỗi xử lý trả HTTP 500 để SePay retry; xác thực sai trả 401. Không dùng endpoint giả lập để xác nhận đơn chuyển khoản.

Trang QR tự kiểm tra trạng thái mỗi 5 giây, lấy thông tin đơn từ API đã xác thực; chỉ chủ yêu cầu nạp xem được. Tải lại trang hoặc bấm **Thanh toán** trong lịch sử sẽ mở lại đơn. Thông tin đơn được lưu lúc tạo nên không thay đổi khi sửa tài khoản cấu hình.

## Nhiều dự án dùng chung tài khoản SePay

Mỗi dự án cần bộ lọc mã thanh toán riêng: LuxCare dùng `LC`, các dự án khác dùng tiền tố riêng của chúng. Thêm mẫu `LC` vào danh sách cấu trúc mã, không thay thế mẫu đang dùng cho dự án khác. Webhook không chọn tiền tố sẽ nhận mọi mã; chỉ đặt bộ lọc riêng cho những webhook cần giới hạn theo dự án (webhook đối soát tổng có thể vẫn nhận tất cả).

Webhook LuxCare phải trỏ tới đúng domain triển khai, đường dẫn `/api/v1/wallet/webhook/sepay`, và dùng API key khớp `.env` của chính server đó. API key xác thực request, không quyết định dự án nào được SePay gửi tới. `SEPAY_TRANSFER_NOTE` chỉ thêm nội dung ngân hàng yêu cầu, không thay thế bộ lọc tiền tố. Không đổi `LC` sang tiền tố khác chỉ trên SePay vì mã nguồn hiện tạo và nhận diện cố định `LC`.

Kiểm tra **Nhật ký webhook** theo giao dịch: không có lần gửi tới LuxCare thì kiểm tra bật/tắt webhook, tài khoản, VA, sự kiện tiền vào và bộ lọc mã; HTTP 401 là sai khóa xác thực; 404 cần kiểm tra URL/route triển khai; 500 cần xem log server/database. HTTP 200 chỉ xác nhận đã xử lý webhook, không đảm bảo đã cộng ví: mã không khớp hoặc sai số tiền/tài khoản sẽ bị bỏ qua. Với giao dịch đã chuyển, dùng nhật ký để đối soát và gửi lại webhook tới đúng endpoint sau khi sửa cấu hình, không yêu cầu khách chuyển tiền lần nữa.

Chi tiết: [Bộ lọc webhook](https://developer.sepay.vn/vi/sepay-webhooks/tao-webhook), [Cấu trúc mã thanh toán](https://developer.sepay.vn/vi/sepay-webhooks/cau-hinh-ma-thanh-toan).

Tài liệu chính thức: [Webhook SePay](https://docs.sepay.vn/tich-hop-webhooks.html), [QR và quy tắc ngân hàng](https://developer.sepay.vn/vi/tien-ich-khac/tao-qr-code).
