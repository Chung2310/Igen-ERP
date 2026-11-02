# Vận hành R15–R17

## Thu tiền sửa chữa

- API thu tiền yêu cầu `idempotencyKey` riêng cho mỗi lần thu. Chứng từ và số tiền đã thu trên phiếu được cập nhật trong cùng một giao dịch MongoDB. Gửi lại cùng khóa trả về chứng từ cũ; cùng khóa với số tiền hoặc phiếu khác bị từ chối.
- Giao diện giữ khóa trong phiên trình duyệt. Sau lỗi mạng, nó tra chứng từ theo khóa trước khi gửi lại. Quản lý có thể đối soát `paidAmount`, `dueAmount` và sổ khoản thu qua `GET /repair/tickets/:id/payments/reconcile`.
- Tiền đã thu trước khi mở sổ chi tiết được giữ làm `paymentLedgerBaseline` ở lần thu mới đầu tiên. Không tạo chứng từ giả cho khoản thu cũ.

## Chăm sóc khách hàng

- Từng phiếu sửa có nhật ký tương tác bất biến và trạng thái `open`, `waiting` hoặc `resolved`; màn hình cũng tra lịch sử phiếu theo khách trong chi nhánh. Gửi lại cùng khóa không tạo tương tác thứ hai.
- Chọn kênh Zalo trong nhật ký chỉ ghi nhận trao đổi đã diễn ra. Adapter Zalo của dự án hiện chưa có chức năng gửi; cần tài khoản OA, luồng xác thực và thử nghiệm gửi/nhận thực tế trước khi bật gửi tự động.

## Dự báo tồn kho

- Chỉ phiếu xuất có `purpose=bán` và đã hoàn thành được dùng làm nhu cầu. Phiếu xuất nội bộ/chuyển kho và phiếu cũ chưa phân loại không đi vào dự báo; dữ liệu cũ cần phân loại đúng nguồn trước khi dùng.
- Mỗi SKU được so dự báo với 14 ngày nhu cầu đã xảy ra, dựa trên 30 ngày trước đó. Khuyến nghị dựa trên dự báo chỉ hiện khi có đủ mẫu, sai số không quá 50% và không kém rõ rệt so với trung bình đơn giản. Cảnh báo tồn dưới ngưỡng cấu hình vẫn hiện dù chưa đủ dữ liệu dự báo.
- Cần xem số SKU đã kiểm định và sai số trên màn hình trước khi dùng khuyến nghị để nhập hàng. Kiểm định trong ứng dụng chạy trên dữ liệu phiếu xuất thực tế khi có; bộ kiểm thử chỉ xác minh quy tắc bằng dữ liệu mẫu.

## Điều kiện nghiệm thu trước khi dùng tại cửa hàng

- Chạy thử trọn luồng POS, ca thu ngân, chuyển khoản, đổi trả, điểm thưởng, điều chuyển IMEI, sổ quỹ và hoa hồng trên dữ liệu của ít nhất hai chi nhánh. Đối chiếu chứng từ nguồn với tiền, tồn, điểm và hoa hồng sau thao tác gửi lại hoặc mất mạng.
- Đối soát dữ liệu cũ trước khi mở tính năng mới: tiền sửa chữa đã thu làm số đầu kỳ của sổ thanh toán; phiếu xuất cũ cần phân loại mục đích trước khi dùng trong dự báo. Ghi nhận người xác nhận và số chênh lệch; không tự tạo giao dịch bù khi chưa được phê duyệt.
- Kiểm thử máy quét mã/IMEI, máy in và thiết bị thanh toán tại cửa hàng. Gửi Zalo OA tự động chỉ được bật sau khi có tài khoản, xác thực và thử nghiệm gửi/nhận thực tế.
- Build và kiểm thử tự động xác nhận mã nguồn; chưa thay thế được kiểm thử giao diện bằng trình duyệt và kiểm định dự báo trên dữ liệu bán hàng thật.
