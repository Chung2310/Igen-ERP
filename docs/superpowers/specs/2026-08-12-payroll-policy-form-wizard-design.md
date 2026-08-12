# Thiết kế popup cấu hình công thức lương

## Mục tiêu

Thay màn hình nhập công thức lương dạng JSON bằng một popup có hướng dẫn, để người dùng không chuyên kỹ thuật có thể tạo, sửa và nhân bản công thức. Dữ liệu lưu phía máy chủ tiếp tục dùng cấu trúc JSON hiện tại nhằm giữ tương thích với nghiệp vụ đã triển khai.

## Phạm vi

- Áp dụng cho các thao tác tạo mới, sửa và nhân bản phiên bản công thức lương.
- Dùng chung quyền `manager` hiện tại cho toàn bộ thao tác cấu hình.
- Cho phép sửa phiên bản đang được dùng trong kỳ lương nháp.
- Không cho sửa hoặc xóa phiên bản đang được dùng trong kỳ lương đã chốt.
- Khi không thể sửa trực tiếp, giao diện hướng người dùng nhân bản thành phiên bản mới.
- Không thay đổi mô hình dữ liệu hoặc quy trình trạng thái kỳ lương trong phạm vi này.

## Trải nghiệm giao diện

Popup sử dụng wizard bốn bước:

1. Thông tin chung
2. Bảo hiểm
3. Thuế
4. Tăng ca và làm tròn

Thanh bước luôn cho biết vị trí hiện tại. Người dùng có thể quay lại bước trước mà không mất dữ liệu. Các nút hành động gồm `Quay lại`, `Tiếp tục`, `Lưu nháp` và `Lưu công thức` ở bước cuối. Khi đóng popup có dữ liệu chưa lưu, hệ thống phải hỏi xác nhận.

Các trường tiền tệ hiển thị và nhập theo VNĐ. Các tỷ lệ hiển thị theo phần trăm quen thuộc, không bắt người dùng nhập số thập phân kỹ thuật. Giao diện không hiển thị JSON.

### Bước 1: Thông tin chung

- Mã công thức
- Tên công thức
- Ngày bắt đầu hiệu lực
- Ngày kết thúc hiệu lực, không bắt buộc
- Lương cơ sở
- Lương tối thiểu vùng
- Nguồn tham chiếu hoặc ghi chú

Khi nhân bản, toàn bộ cấu hình được sao chép nhưng mã công thức phải được nhập mới để tránh nhầm phiên bản.

### Bước 2: Bảo hiểm

- Tỷ lệ BHXH, BHYT và BHTN của nhân viên
- Tỷ lệ BHXH, BHYT và BHTN của doanh nghiệp
- Hệ số hoặc mức trần đóng bảo hiểm theo cấu trúc hiện có
- Kinh phí công đoàn

Mỗi tỷ lệ có nhãn rõ ràng, đơn vị `%` và chú thích ngắn. Các giá trị hiện có được điền sẵn khi sửa hoặc nhân bản.

### Bước 3: Thuế

- Giảm trừ bản thân
- Giảm trừ người phụ thuộc
- Thuế suất không cư trú
- Tỷ lệ khấu trừ liên quan theo cấu trúc hiện có
- Bảng bậc thuế

Bảng bậc thuế cho phép thêm, sửa, sắp xếp và xóa dòng. Mỗi dòng biểu diễn khoảng thu nhập và thuế suất tương ứng. Giao diện kiểm tra thứ tự và ngăn các khoảng bị chồng lấn.

### Bước 4: Tăng ca và làm tròn

- Hệ số tăng ca ngày thường
- Hệ số ngày nghỉ
- Hệ số ngày lễ
- Hệ số ca đêm và các hệ số tăng ca hiện có
- Quy tắc làm tròn tiền lương

Cuối bước hiển thị phần tóm tắt các nhóm cấu hình quan trọng để người dùng kiểm tra trước khi lưu.

## Thành phần và ranh giới trách nhiệm

- `PayrollPolicyManager` tiếp tục quản lý danh sách, quyền và thao tác mở popup.
- Popup công thức lương quản lý chế độ tạo, sửa hoặc nhân bản; trạng thái bước; dữ liệu biểu mẫu; cảnh báo thay đổi chưa lưu; và gọi API.
- Mỗi bước là một thành phần biểu mẫu riêng, chỉ nhận dữ liệu và lỗi thuộc nhóm của nó.
- Một lớp chuyển đổi thuần túy ánh xạ dữ liệu biểu mẫu sang JSON chính sách hiện tại và ngược lại. Lớp này là nơi duy nhất biết chi tiết định dạng lưu trữ.
- Các hàm validation dùng chung kiểm tra dữ liệu từng bước và toàn bộ công thức trước khi gửi.

Cách tách này giữ giao diện dễ bảo trì, đồng thời tránh để cấu trúc JSON lan sang các thành phần hiển thị.

## Luồng dữ liệu

Khi mở popup ở chế độ sửa hoặc nhân bản, dữ liệu JSON hiện tại được chuyển thành mô hình biểu mẫu và điền vào các ô. Người dùng chỉnh sửa theo đơn vị hiển thị. Tỷ lệ phần trăm được đổi sang định dạng lưu trữ hiện có tại lớp chuyển đổi.

Khi lưu, hệ thống thực hiện validation toàn bộ biểu mẫu, chuyển dữ liệu sang payload JSON hiện tại và gọi API vòng đời phiên bản đã có. Nếu API thành công, popup đóng và danh sách được tải lại. Nếu API thất bại, popup giữ nguyên dữ liệu và hiển thị thông báo lỗi có thể hành động.

`Lưu nháp` lưu phiên bản ở trạng thái có thể tiếp tục chỉnh sửa theo trạng thái API hiện hành. `Lưu công thức` hoàn tất thao tác tạo hoặc cập nhật nhưng không tự động thay đổi trạng thái kỳ lương.

## Quy tắc chỉnh sửa phiên bản

- Phiên bản chưa được dùng trong kỳ đã chốt có thể sửa khi người dùng có quyền `manager`.
- Phiên bản đang được dùng trong kỳ nháp vẫn có thể sửa. Việc tính lại kỳ lương chỉ xảy ra khi người dùng bấm nút đồng bộ/tính lương hiện có; lưu công thức không tự động tính lại kỳ.
- Phiên bản đang được dùng trong kỳ đã chốt không được lưu đè hoặc xóa.
- Với phiên bản bị khóa, nút sửa được thay bằng hoặc dẫn sang hành động `Nhân bản thành phiên bản mới`, kèm giải thích ngắn.
- Quy tắc khóa phải được kiểm tra ở cả giao diện và máy chủ; giao diện chỉ giúp trải nghiệm rõ ràng, máy chủ là lớp bảo vệ cuối cùng.

## Validation và xử lý lỗi

- Mã, tên và ngày bắt đầu hiệu lực là bắt buộc.
- Ngày kết thúc không được trước ngày bắt đầu.
- Tỷ lệ phải nằm trong khoảng từ 0 đến 100%.
- Số tiền và hệ số không được âm.
- Bậc thuế phải đúng thứ tự, không chồng lấn và có thuế suất hợp lệ.
- Không cho chuyển sang bước kế tiếp khi bước hiện tại còn lỗi.
- Trước khi gửi API, toàn bộ bốn bước được kiểm tra lại.
- Lỗi gắn với trường được hiển thị cạnh trường; lỗi nghiệp vụ hoặc lỗi máy chủ hiển thị ở khu vực thông báo chung trong popup.
- Khi lưu thất bại, dữ liệu và bước hiện tại được giữ nguyên.

## Khả năng tương thích

API và cấu trúc JSON chính sách hiện tại được giữ nguyên. Bộ chuyển đổi phải bảo toàn các trường hiện có khi mở rồi lưu lại mà người dùng không thay đổi. Nếu gặp dữ liệu cũ không thể biểu diễn an toàn trong biểu mẫu, popup không được âm thầm làm mất dữ liệu; thay vào đó phải báo cấu hình không tương thích và chặn lưu cho đến khi được xử lý.

## Kiểm thử

- Unit test cho chuyển đổi JSON sang biểu mẫu và biểu mẫu sang JSON, bao gồm phép đổi tỷ lệ `%`.
- Unit test validation ngày, số tiền, tỷ lệ, hệ số và bậc thuế.
- Component test cho điều hướng bốn bước, giữ dữ liệu khi quay lại và chặn bước khi có lỗi.
- Component test cho tạo mới, sửa, nhân bản, lưu nháp, cảnh báo đóng và lỗi API.
- Kiểm thử mã mới là bắt buộc khi nhân bản.
- Kiểm thử quyền `manager` và trạng thái khóa của phiên bản đang dùng trong kỳ đã chốt.
- Kiểm thử cho phép sửa phiên bản dùng trong kỳ nháp mà không tự động tính lại bảng lương.
- Kiểm thử hồi quy danh sách công thức và payload API hiện tại.

## Tiêu chí hoàn thành

- Người dùng có thể hoàn thành mọi thao tác cấu hình thông thường mà không nhìn thấy hoặc chỉnh JSON.
- Tạo, sửa và nhân bản đều dùng cùng một popup bốn bước.
- Dữ liệu lưu ra tương thích với công thức JSON hiện tại.
- Không thể sửa hoặc xóa phiên bản đang được dùng trong kỳ đã chốt.
- Có thể sửa phiên bản đang dùng trong kỳ nháp; kỳ chỉ cập nhật khi người dùng chủ động chạy lại thao tác đồng bộ/tính lương.
- Các lỗi nhập liệu và lỗi API không làm mất dữ liệu đang nhập.
