# Retail Phase 3 POS Completion Design

## Mục tiêu

Hoàn thiện luồng bán hàng tại quầy còn thiếu sau Retail Phase 2: gắn khách hàng vào đơn, nhập giảm giá theo dòng và toàn đơn, thuế, phí vận chuyển, xác nhận kết quả thanh toán và in hóa đơn bằng trình duyệt.

Phase này không triển khai dashboard, báo cáo nâng cao, tồn kho chuyên sâu hoặc tích hợp máy in chuyên dụng.

## Quyền và phạm vi dữ liệu

- Không sinh thêm quyền retail.
- Người có quyền vận hành retail mặc định được bán hàng và sử dụng toàn bộ trường nghiệp vụ của POS.
- `retail:manager` tiếp tục dành cho quản lý và chỉnh sửa cài đặt retail.
- Khách hàng là dữ liệu dùng chung trong công ty, không tách theo chi nhánh và không có trạng thái kích hoạt.
- Sản phẩm, đơn hàng, ca bán hàng và hóa đơn tiếp tục bị giới hạn theo công ty và chi nhánh hiện hành.

## Kiến trúc

Frontend giữ trạng thái giỏ hàng và hiển thị số tiền dự kiến để phản hồi tức thời. Backend vẫn là nguồn tính toán chính thức: mọi giá trị giảm giá, thuế, phí vận chuyển và tổng thanh toán đều được xác thực và tính lại khi giữ đơn hoặc xác nhận đơn.

Các phần giao diện POS được tách theo trách nhiệm: chọn khách hàng, chỉnh giá trị dòng hàng, tổng kết đơn, thanh toán và kết quả giao dịch. API hiện có được mở rộng tối thiểu để truyền các trường đã được model và service hỗ trợ, tránh tạo một luồng tính tiền thứ hai.

## Chọn khách hàng

- POS có ô tìm kiếm khách hàng theo tên, số điện thoại hoặc mã khách hàng.
- Kết quả tìm kiếm lấy từ danh sách khách hàng dùng chung toàn công ty.
- Nhân viên có thể chọn một khách hàng hoặc tiếp tục bán khách lẻ.
- Khách hàng đã chọn được gắn vào draft và order để khi mở lại đơn giữ vẫn khôi phục đúng thông tin.
- Việc chọn khách hàng không yêu cầu kích hoạt hay thay đổi trạng thái khách hàng.

## Điều chỉnh dòng hàng

- Mỗi dòng cho phép thay đổi số lượng nguyên dương.
- Mỗi dòng hỗ trợ giảm giá theo số tiền cố định hoặc phần trăm.
- Giảm giá không được âm hoặc vượt giá trị dòng. Tổng tỷ lệ hiệu lực của giảm giá dòng và giảm giá toàn đơn phải tuân thủ trần giảm giá của cấu hình chi nhánh.
- Khi đổi sản phẩm, số lượng hoặc giảm giá, frontend cập nhật tổng dự kiến ngay; backend kiểm tra lại toàn bộ khi lưu.

## Điều chỉnh toàn đơn

- Đơn hỗ trợ giảm giá theo số tiền cố định hoặc phần trăm.
- Thuế được nhập theo phần trăm với tối đa hai chữ số thập phân, trong khoảng 0 đến 100.
- Phí vận chuyển là số tiền VND nguyên, không âm.
- Trình tự tính tiền giữ nguyên quy tắc backend: tổng dòng sau giảm giá dòng, giảm giá toàn đơn, thuế, rồi phí vận chuyển.
- Tiền VND được làm tròn thành số nguyên theo quy tắc hiện có của service tính tổng.

## Thanh toán và kết quả giao dịch

- Luồng chia nhiều phương thức, tiền khách đưa và tiền thừa của Phase 2 được giữ nguyên.
- Payload xác nhận phải chứa khách hàng và đầy đủ các điều chỉnh đã nhập trên POS.
- Idempotency hiện có tiếp tục bảo vệ thao tác xác nhận khỏi tạo trùng đơn khi retry.
- Sau khi thành công, POS hiển thị mã đơn, mã hóa đơn, tổng tiền, số đã thu, tiền thừa và khách hàng nếu có.
- Nhân viên có thể bắt đầu đơn mới hoặc mở bản in hóa đơn.

## In hóa đơn

- Phase 3 dùng bản in HTML/CSS và hộp thoại in của trình duyệt.
- Bản in lấy dữ liệu snapshot hóa đơn từ backend, không lấy giá trị giỏ hàng tạm trên frontend.
- Nội dung gồm thông tin công ty/chi nhánh có sẵn, mã hóa đơn, thời gian, thu ngân, khách hàng nếu có, các dòng hàng, giảm giá, thuế, phí vận chuyển, thanh toán và tiền thừa.
- CSS in ẩn toàn bộ điều hướng và nút thao tác, phù hợp giấy hẹp nhưng vẫn đọc được trên A4.
- Máy in nhiệt, ESC/POS và cấu hình thiết bị được để lại phase sau.

## Xử lý lỗi

- Lỗi validation từ backend được hiển thị gần khu vực tổng kết hoặc trường liên quan và không làm mất giỏ hàng.
- Nếu draft hết hạn, POS thông báo rõ và giữ dữ liệu giỏ hiện tại để nhân viên có thể tạo draft mới.
- Nếu phiên ca không còn hợp lệ, thao tác thanh toán bị chặn và yêu cầu mở hoặc chọn ca hợp lệ.
- Nếu yêu cầu xác nhận không rõ kết quả do mất kết nối, frontend dùng idempotency key hiện tại để tra lại trước khi cho phép gửi lại.
- In thất bại không làm thay đổi trạng thái đơn hoặc hóa đơn.

## Kiểm thử và tiêu chí hoàn thành

- Unit test frontend bao phủ tính tổng dự kiến với giảm giá dòng, giảm giá toàn đơn, thuế và phí vận chuyển.
- Test payload bao phủ khách lẻ, khách hàng được chọn, draft giữ và thanh toán chia nhiều phương thức.
- Backend test xác nhận dữ liệu điều chỉnh được chuẩn hóa, kiểm tra trần giảm giá và tính lại chính xác.
- Component test bao phủ tìm/chọn/xóa khách hàng, nhập điều chỉnh, hiển thị lỗi mà không mất giỏ và màn hình thành công.
- Test bản in xác nhận dữ liệu đến từ invoice snapshot và không hiển thị thông tin giá vốn.
- Toàn bộ retail tests, TypeScript typecheck và production build phải qua trước khi hoàn tất.

## Ngoài phạm vi

- Dashboard và báo cáo doanh thu nâng cao.
- Quản lý tồn kho chuyên sâu hoặc luân chuyển kho.
- Tích hợp máy in nhiệt, ngăn kéo tiền hoặc thiết bị POS chuyên dụng.
- Tạo thêm permission ngoài mô hình quyền retail hiện tại.
- Thay đổi vòng đời hoặc trạng thái kích hoạt khách hàng.
