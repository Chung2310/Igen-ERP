# Retail Phase 4 Reporting Design

## Mục tiêu

Thêm subtab Báo cáo vào module Retail để theo dõi doanh thu, thanh toán, ca bán hàng, hiệu suất thu ngân và công nợ theo chi nhánh đang chọn. Phase này không tổng hợp toàn công ty, không so sánh chi nhánh và không tạo hệ thống quyền mới.

## Phạm vi và quyền

- Tất cả người dùng có quyền vận hành retail được mở subtab Báo cáo.
- Mọi truy vấn bắt buộc dùng `companyCode` và `branchId` đã được backend suy ra hoặc kiểm tra theo actor hiện tại.
- Nhân viên thường được xem doanh thu, số đơn, thanh toán, hoàn tiền, ca và công nợ.
- Chỉ người có capability `retail:manager` được nhận giá vốn, lợi nhuận gộp và tỷ suất lợi nhuận.
- Backend phải loại bỏ trường nhạy cảm khỏi response và file Excel của nhân viên thường; ẩn bằng giao diện là không đủ.
- Không thêm permission ngoài mô hình `retail:operate` và `retail:manager` hiện tại.

## Bộ lọc thời gian

- Mặc định là ngày nghiệp vụ hiện tại theo múi giờ Việt Nam.
- Preset gồm hôm nay, 7 ngày gần nhất và 30 ngày gần nhất.
- Khoảng tùy chọn gồm cả ngày bắt đầu và kết thúc, tối đa 366 ngày.
- Ngày được so sánh bằng `businessDate` dạng `YYYY-MM-DD`, không phụ thuộc múi giờ trình duyệt.
- Khoảng sai định dạng, đảo ngày hoặc vượt giới hạn bị backend từ chối bằng lỗi validation rõ ràng.
- Thay đổi bộ lọc làm mới toàn bộ dashboard; thao tác tải lại giữ nguyên bộ lọc hiện tại.

## Chỉ số tổng quan

- Doanh thu gộp: tổng `grandTotal` của mọi đơn đã từng xác nhận trong khoảng ngày, nhận diện bằng `orderCode`; gồm cả đơn sau đó bị hủy để đối ứng đúng với hoàn tiền. Draft bị hủy do hết hạn không có `orderCode` và bị loại.
- Hoàn tiền: tổng `refundedAmount` của các đơn đã từng xác nhận trong phạm vi báo cáo, gồm đơn đã hủy.
- Doanh thu thuần: doanh thu gộp trừ hoàn tiền.
- Số đơn: số đơn confirmed/completed đang có hiệu lực; đơn draft và cancelled không được tính.
- Giá trị đơn trung bình: doanh thu gộp chia số đơn, bằng 0 khi không có đơn.
- Đã thu: tổng tiền thanh toán thực nhận, không tính tiền khách đưa hoặc tiền thừa.
- Còn phải thu: tổng `dueAmount` của đơn còn nợ.
- Giá vốn, lợi nhuận gộp và tỷ suất lợi nhuận chỉ xuất hiện cho manager. Giá vốn chỉ tính đơn confirmed/completed còn hiệu lực vì hàng của đơn cancelled đã được hoàn kho. Lợi nhuận gộp bằng doanh thu thuần trừ giá vốn; tỷ suất bằng lợi nhuận chia doanh thu thuần và bằng 0 khi doanh thu thuần không dương.

## Xu hướng và cơ cấu thanh toán

- Biểu đồ xu hướng có một điểm cho mỗi `businessDate` trong khoảng, kể cả ngày không phát sinh dữ liệu.
- Mỗi điểm gồm doanh thu gộp, hoàn tiền, doanh thu thuần, đã thu và số đơn.
- Cơ cấu thanh toán nhóm theo `cash`, `card`, `transfer`, `ewallet` dựa trên `payments.amount`.
- Tiền thừa không làm tăng doanh số thanh toán.
- Hoàn tiền được trình bày riêng, không trừ vào từng phương thức thanh toán vì snapshot refund có thể khác phương thức thu ban đầu.

## Hiệu suất ca và thu ngân

- Bảng ca gồm mã ca, ngày nghiệp vụ, thu ngân, trạng thái, doanh thu gộp, đã thu, hoàn tiền và chênh lệch tiền mặt nếu dữ liệu đã được phép hiển thị theo trạng thái ca.
- Bảng thu ngân nhóm các đơn theo `createdBy`/`createdByName`, gồm số đơn, doanh thu gộp, doanh thu thuần và giá trị đơn trung bình.
- Chỉ số ca dùng dữ liệu snapshot trên ca và đơn; không thay đổi quy tắc blind count hiện có.
- Danh sách sắp xếp giảm dần theo doanh thu thuần, sau đó theo tên để kết quả ổn định.

## Công nợ khách hàng

- Tổng công nợ là tổng `dueAmount` dương của đơn confirmed chưa thanh toán đủ tại chi nhánh hiện tại.
- Nợ quá hạn có `dueDate` trước ngày nghiệp vụ hiện tại; nợ đến hạn có `dueDate` đúng ngày hiện tại; còn lại là chưa đến hạn.
- Các đơn không có khách hàng không được phép tạo nợ theo quy tắc checkout hiện tại và không xuất hiện trong báo cáo.
- Bảng công nợ nhóm theo khách hàng, gồm mã/tên/số điện thoại snapshot có sẵn, tổng nợ, nợ quá hạn, hạn gần nhất và số đơn còn nợ.
- Khách hàng dùng chung toàn công ty nhưng giao dịch và số nợ trong dashboard chỉ lấy từ chi nhánh hiện tại.
- Sắp xếp mặc định: nợ quá hạn giảm dần, rồi tổng nợ giảm dần.

## API và kiến trúc backend

- Thêm namespace `/retail/reports` nằm sau module guard và retail operate permission hiện có.
- Endpoint summary trả metrics, time series, payment mix, shifts, cashiers và debt summary cho một bộ lọc thống nhất.
- Endpoint export nhận cùng bộ lọc và trả file Excel; không nhận dữ liệu tổng hợp từ frontend.
- Service báo cáo xây Mongo aggregation pipeline thuần từ orders và shifts, không tạo collection tổng hợp mới trong Phase 4.
- Các builder thuần cho date range, branch filter, metric normalization và permission projection được tách riêng để kiểm thử không cần database.
- Query phải giới hạn chi nhánh từ đầu pipeline và chỉ project các trường cần thiết trước khi group.

## Giao diện

- Thêm subtab `Báo cáo` cạnh Hóa đơn và trước Khách hàng.
- Header chứa preset ngày, khoảng tùy chọn, nút tải lại và nút Xuất Excel.
- Hàng KPI hiển thị doanh thu thuần, số đơn, giá trị đơn trung bình, đã thu, còn phải thu và hoàn tiền. Manager có thêm giá vốn, lợi nhuận gộp và tỷ suất.
- Phần biểu đồ gồm xu hướng doanh thu theo ngày và cơ cấu phương thức thanh toán.
- Phần bảng gồm hiệu suất thu ngân, ca bán hàng và công nợ khách hàng.
- Trạng thái loading dùng skeleton theo từng khối; empty state vẫn hiển thị KPI bằng 0 và trục ngày đúng khoảng lọc.
- Nếu tải dashboard lỗi, giữ nguyên bộ lọc và dữ liệu thành công gần nhất, đồng thời hiển thị thông báo có thể thử lại.
- Nếu xuất Excel lỗi, dashboard không bị thay đổi.

## Xuất Excel

- Workbook gồm các sheet `Tổng quan`, `Theo ngày`, `Thanh toán`, `Thu ngân`, `Ca bán hàng` và `Công nợ`.
- File dùng tên `retail-report-<branchCode>-<from>-<to>.xlsx`; branch code được backend xác định.
- Tiền được lưu dưới dạng số với format VND, ngày ở dạng `YYYY-MM-DD`, không xuất công thức thực thi từ dữ liệu người dùng.
- Các chuỗi bắt đầu bằng `=`, `+`, `-` hoặc `@` được escape để ngăn formula injection.
- Sheet Tổng quan của manager có giá vốn/lợi nhuận/tỷ suất; workbook nhân viên thường không chứa các nhãn hoặc cột này.

## Xử lý lỗi và hiệu năng

- Không có dữ liệu trả về cấu trúc đầy đủ với số 0 và mảng rỗng, không trả 404.
- Mọi lỗi validation dùng response 400; actor sai scope dùng guard hiện có.
- Dashboard không tự polling; chỉ tải khi mở tab, đổi bộ lọc hoặc bấm tải lại.
- Giới hạn 366 ngày bảo vệ truy vấn; pipeline phải tận dụng index `companyCode`, `branchId`, `businessDate`, `status` hiện có hoặc bổ sung index ghép nếu kiểm tra cho thấy thiếu.
- Export dùng cùng service tổng hợp để số liệu khớp dashboard.

## Kiểm thử và tiêu chí hoàn thành

- Unit test date range bao phủ preset, ngày nhuận, đảo ngày, sai định dạng và giới hạn 366 ngày.
- Backend test bao phủ loại draft/cancelled, doanh thu/hoàn tiền, payment amount không tính tender/change, ngày không dữ liệu, phân loại công nợ và scope chi nhánh.
- Permission test chứng minh operator không nhận cost/profit/margin ở JSON và Excel, manager nhận đúng.
- Excel test kiểm tra tên sheet, kiểu số/ngày, filename và formula injection.
- Frontend test bao phủ filter, trạng thái rỗng/lỗi, KPI manager/operator, dữ liệu chart/table và export giữ nguyên dashboard.
- Toàn bộ retail tests, TypeScript typecheck, production build và permission scan phải đạt trước khi hoàn tất.

## Ngoài phạm vi

- Tổng hợp toàn công ty hoặc so sánh nhiều chi nhánh.
- Báo cáo tùy biến, lưu mẫu báo cáo hoặc gửi báo cáo định kỳ.
- Dự báo bằng AI.
- Kiểm kê, điều chỉnh và luân chuyển tồn kho.
- Máy in nhiệt, ESC/POS hoặc thiết bị POS chuyên dụng.
