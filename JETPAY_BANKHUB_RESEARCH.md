# Nghiên cứu JetPay BankHub cho phân hệ giao dịch Igen ERP

**Cập nhật: 02/11/2026**  
Phạm vi nghiên cứu: lập lệnh chuyển tiền, theo dõi dòng tiền vào/ra và quản lý thu chi. Không tính các phân hệ lương, hóa đơn hay khai thuế.

## 1. Tóm tắt

JetPay BankHub công bố các tính năng phù hợp với nhu cầu giao dịch của Igen ERP: xem số dư và lịch sử tài khoản, nhận thông báo tiền vào, đối soát ngân hàng và lập lệnh chuyển tiền. Tất cả gói giá công khai đều liệt kê tra cứu số dư/lịch sử, nhận biến động số dư, chuyển tiền trực tuyến và đối chiếu ngân hàng. [Trang BankHub](https://jetpay.vn/jetpay-bankhub/) · [Bảng giá JetPay](https://store.jetpay.vn/Home/Pricing)

Điểm chưa rõ nhất là **cách ERP bên thứ ba như Igen kết nối bằng API**. JetPay quảng bá kết nối phần mềm quản trị qua API, nhưng hướng dẫn công khai mình tìm được mô tả kết nối với MISA AMIS bằng mã API của phần mềm kế toán. Chưa có API reference công khai cho đối tác ERP tùy chỉnh để xác nhận cách lấy giao dịch, gửi lệnh chuyển hay nhận trạng thái. [Trang BankHub](https://jetpay.vn/jetpay-bankhub/) · [Hướng dẫn thiết lập BankHub](https://help.jetpay.vn/kb/huong-dan-thiet-lap-tai-khoan-jetpay-bankhub/)

## 2. Từng tính năng trong phạm vi

| Tính năng | Năng lực BankHub được công bố/hướng dẫn | Vai trò dự kiến trong Igen ERP | Điều cần JetPay xác nhận |
|---|---|---|---|
| Kết nối tài khoản ngân hàng | Liên kết tài khoản doanh nghiệp sau khi đăng nhập/ủy quyền với ngân hàng; tài khoản liên kết đồng bộ biến động số dư và lịch sử giao dịch. | Người dùng chọn ngân hàng và tài khoản thuộc doanh nghiệp để liên kết với tenant Igen. | Igen khởi tạo kết nối qua API hay người dùng phải liên kết trong BankHub trước; luồng ủy quyền, thời hạn token và cách thu hồi quyền. |
| Số dư và lịch sử giao dịch | Tra cứu số dư và lịch sử giao dịch trên BankHub/phần mềm kết nối. | Hiển thị số dư theo tài khoản, thời gian cập nhật và giao dịch ngân hàng đã ghi nhận. | API truy vấn, giới hạn ngày/lượng dữ liệu, tần suất cập nhật và phân biệt giao dịch đang xử lý với giao dịch đã hạch toán. |
| Dòng tiền vào | Nhận thông báo biến động số dư; mô tả sản phẩm có tự động hạch toán chứng từ thu sau khi tài khoản có giao dịch. | Nhập giao dịch vào danh sách thu, phân loại và đối chiếu với số tiền thực nhận. | Webhook/API cho giao dịch vào, mã giao dịch ổn định để tránh ghi trùng, cách xử lý giao dịch đảo/điều chỉnh. |
| Dòng tiền ra và lệnh chuyển tiền | Hướng dẫn BankHub cho phép lập lệnh với tài khoản nguồn, người thụ hưởng, số tiền, hình thức chuyển, nội dung và bên chịu phí; lệnh được gửi duyệt và theo dõi trạng thái. | Lập lệnh từ Igen, lưu bản nháp/đang chờ duyệt/đã gửi/hoàn tất/thất bại và cập nhật sổ thu chi theo kết quả. | API tạo lệnh, sửa/thu hồi lệnh, phê duyệt ở đâu, trạng thái nào được trả về, xử lý lỗi và giới hạn giao dịch. |
| Thu chi và đối soát | BankHub quảng bá đối chiếu giao dịch/số dư ngân hàng với chứng từ sổ tiền gửi; có thể phát hiện sai lệch. | Gắn giao dịch ngân hàng với khoản thu hoặc khoản chi trong Igen; hiển thị giao dịch chưa khớp để xử lý. | Dữ liệu đối soát có truy cập được qua API không hay chỉ có trong giao diện BankHub; tiêu chí khớp giao dịch. |

Nguồn cho luồng liên kết tài khoản và đồng bộ là [hướng dẫn thiết lập ngân hàng](https://help.jetpay.vn/kb/huong-dan-thiet-lap-tai-khoan-jetpay-bankhub/). Các bước lập lệnh, gửi duyệt và xem trạng thái nằm trong [hướng dẫn lập lệnh chuyển tiền](https://help.jetpay.vn/kb/huong-dan-lap-lenh-chuyen-tien-tren-phan-mem-jetpay-bankhub/). Luồng BIDV Direct còn mô tả người có quyền duyệt ký, JetPay đẩy lệnh lên ngân hàng và trạng thái có thể là đã chuyển, thất bại hoặc chờ ngân hàng xử lý: [hướng dẫn BIDV Direct](https://help.jetpay.vn/kb/huong-dan-lap-va-duyet-lenh-chi-tien-tu-tai-khoan-bidv-direct-ngay-tren-jetpay-bankhub/).

### Luồng nghiệp vụ Igen đề xuất để thảo luận

1. Quản trị viên doanh nghiệp chọn ngân hàng/tài khoản và hoàn tất ủy quyền kết nối.
2. Igen nhận số dư, lịch sử giao dịch và thông báo giao dịch vào từ BankHub.
3. Igen ghi nhận giao dịch vào danh sách thu chi, liên kết với khoản thu/chi và đánh dấu trạng thái đối soát.
4. Người dùng lập lệnh chuyển tiền trong Igen; người có thẩm quyền duyệt theo quy trình ngân hàng; Igen cập nhật trạng thái từ BankHub.

Đây là luồng mục tiêu để xác nhận với JetPay, chưa phải hợp đồng API đã được tài liệu công khai chứng minh.

## 3. Ngân hàng và điều kiện kết nối

Trung tâm trợ giúp JetPay hiện liệt kê 18 trang hướng dẫn theo ngân hàng: Vietcombank, VietinBank, BIDV, Techcombank, MB, MSB, MSB Business Banking, SHB, ACB, OCB, VPBank, TPBank, Sacombank, LPBank, Agribank, VIB, HDBank và PVCBank. Danh sách hướng dẫn không đồng nghĩa tất cả ngân hàng hỗ trợ cùng tính năng hoặc cùng điều kiện. [Danh sách hướng dẫn theo ngân hàng](https://help.jetpay.vn/kb/jetpay-bankhub-huong-dan-su-dung-theo-tung-ngan-hang/)

Hướng dẫn thiết lập có bảng điều kiện chi tiết cho một số ngân hàng. Ví dụ: VietinBank có thể yêu cầu đăng ký dịch vụ ERP tại quầy; MSB cần đăng ký kết nối; BIDV yêu cầu hợp đồng giấy cho luồng biến động số dư; hướng dẫn hiện ghi Techcombank và SHB chưa kết nối luồng thu, còn Vietcombank ở trạng thái đang kết nối luồng thu. Vì vậy, cần chọn ngân hàng mục tiêu của khách hàng Igen rồi xác nhận riêng luồng thu, luồng chi, tra cứu số dư/lịch sử và đối soát. [Điều kiện kết nối BankHub](https://help.jetpay.vn/kb/huong-dan-thiet-lap-tai-khoan-jetpay-bankhub/)

## 4. Chi phí công khai

Trang giá JetPay liệt kê phí khởi tạo dịch vụ **1.000.000đ** ngoài phí gói. Các gói dưới đây có thời hạn một năm. Tổng năm đầu là phép cộng phí khởi tạo và giá gói; chưa bao gồm chi phí triển khai tích hợp Igen vì JetPay chưa công bố mức đó.

| Gói | Hạn mức thông báo giao dịch tiền vào | Phí gói/năm | Phí khởi tạo đang niêm yết | Ước tính năm đầu |
|---|---:|---:|---:|---:|
| BH-500 | 500 | 590.000đ | 1.000.000đ | **1.590.000đ** |
| BH-2.000 | 2.000 | 2.190.000đ | 1.000.000đ | **3.190.000đ** |
| BH-5.000 | 5.000 | 4.990.000đ | 1.000.000đ | **5.990.000đ** |
| BH-10.000 | 10.000 | 8.990.000đ | 1.000.000đ | **9.990.000đ** |

**Lưu ý cách tính:** JetPay định nghĩa số giao dịch trong gói là số thông báo biến động tiền **vào** tài khoản. Đây không phải số lệnh chuyển tiền. Trang giá có liệt kê chuyển tiền trực tuyến trong các gói, nhưng không nêu liệu có phí riêng theo lệnh chuyển, API call, số tài khoản hay số doanh nghiệp kết nối. [Bảng giá hiện tại](https://store.jetpay.vn/Home/Pricing)

Giỏ hàng JetPay cũng hiển thị lựa chọn mua thêm **50 giao dịch thu tiền với giá 59.000đ**; cần xác nhận thời hạn và điều kiện áp dụng cho phần mua thêm. [Giỏ hàng JetPay](https://store.jetpay.vn/Home/Cart?orderType=0&packageId=P2.015.01.08.2102)

### Khoản phí chưa có giá công khai cho trường hợp Igen

- Phí tích hợp/API dành cho đối tác phần mềm hoặc phí khởi tạo kết nối ERP.
- Mức tối thiểu hoặc phí định kỳ cho đối tác; chiết khấu, chia sẻ doanh thu hay mô hình white-label nếu có.
- Gói BankHub áp dụng theo từng doanh nghiệp, từng tài khoản ngân hàng hay theo tenant Igen.
- Phí cho lệnh chuyển tiền, truy vấn API, webhook hoặc vượt hạn mức giao dịch tiền vào.
- Phí ngân hàng đối với kết nối Internet Banking, tra cứu, chuyển khoản hoặc dịch vụ ERP.
- Phí khởi tạo 1.000.000đ có lặp lại khi gia hạn không; giá đã gồm thuế hay chưa.

JetPay có một [báo giá PDF ngày 05/07/2021](https://jetpay.vn/sites/jetpay/documents/bao-gia-jetpay-bankhub.pdf) với mức phí và cách chia gói khác trang giá hiện tại. Báo giá đó ghi phí thuê bao không gồm phí theo quy định của ngân hàng. Vì tài liệu đã cũ và giá khác, không dùng bảng cũ để lập ngân sách hiện tại; hỏi JetPay xem khoản phí ngân hàng vẫn tính riêng ra sao.

## 5. Tài liệu cần xin JetPay trước khi ước tính chi phí triển khai

1. Bộ tài liệu API dành cho đối tác ERP: môi trường sandbox, endpoint, xác thực, cấp quyền theo doanh nghiệp và giới hạn gọi.
2. API/luồng cụ thể cho: liên kết tài khoản, số dư, lịch sử giao dịch, thông báo tiền vào, tạo lệnh chuyển, duyệt/thu hồi và truy vấn trạng thái.
3. Cơ chế webhook: chữ ký xác thực, retry, thứ tự sự kiện, mã định danh giao dịch và cách đồng bộ bù khi mất sự kiện.
4. Danh sách ngân hàng và ma trận tính năng hiện hành cho từng ngân hàng: tiền vào, tiền ra, xem số dư/lịch sử, đối soát; kèm thủ tục và thời gian kích hoạt.
5. Bảng phí đối tác: phí tích hợp ban đầu, phí thường niên, cách tính theo doanh nghiệp/tài khoản/giao dịch, mức phí chuyển tiền và phí phát sinh từ ngân hàng.
6. SLA, kênh hỗ trợ kỹ thuật, quy trình kiểm thử/nghiệm thu và yêu cầu bảo mật khi Igen lưu hoặc xử lý dữ liệu giao dịch.

## 6. Kết luận ngân sách

Chi phí BankHub bán lẻ công khai hiện bắt đầu từ **1.590.000đ năm đầu** (BH-500 cộng phí khởi tạo đang niêm yết) và lên đến **9.990.000đ năm đầu** (BH-10.000 cộng phí khởi tạo). Đây chỉ là ước tính gói dịch vụ. Chưa thể kết luận tổng chi phí hợp tác và tích hợp Igen cho đến khi JetPay báo phí API/đối tác, cách cấp gói cho nhiều doanh nghiệp và các khoản phí của ngân hàng.
