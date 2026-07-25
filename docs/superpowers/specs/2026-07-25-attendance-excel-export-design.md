# Thiết kế xuất Excel bảng chấm công

## Mục tiêu

Bổ sung menu `Tiện ích` trong màn hình bảng chấm công tháng để người dùng có
thể xuất riêng bảng số công hoặc bảng số giờ theo tháng/năm và danh sách nhân
viên đang hiển thị.

## Phạm vi

### Trong phạm vi

- Nút `Tiện ích` mở menu thả xuống.
- Menu có hai hành động:
  - `Xuất bảng số công`
  - `Xuất bảng số giờ`
- Mỗi hành động tải xuống một workbook Excel riêng, gồm một worksheet.
- Dữ liệu xuất theo tháng, năm và bộ lọc tìm kiếm nhân viên đang áp dụng trên
  bảng chấm công tháng.
- Menu đóng khi người dùng chọn một hành động hoặc bấm ra ngoài.
- Hiển thị thông báo thành công hoặc lỗi bằng hệ thống toast hiện có.

### Ngoài phạm vi

- Nhập ngược dữ liệu chấm công từ Excel.
- Thay đổi công thức tính số công hoặc số giờ đang dùng trên giao diện.
- Xuất PDF, CSV hoặc gửi file qua email.
- Xuất toàn bộ nhân viên bất chấp bộ lọc tìm kiếm hiện tại.
- Thay đổi API hoặc model dữ liệu phía server.

## Trải nghiệm người dùng

Nút `Tiện ích` nằm trên thanh công cụ của bảng chấm công tháng. Khi bấm, một
menu neo bên dưới nút hiển thị hai lựa chọn xuất. Nút có trạng thái mở rõ ràng
và menu có thứ tự bàn phím hợp lệ.

Khi chọn một lựa chọn:

1. Hệ thống lấy danh sách nhân viên sau khi áp dụng ô tìm kiếm hiện tại.
2. Hệ thống chuyển dữ liệu chấm công của tháng/năm đang chọn thành ma trận.
3. Trình duyệt tải file Excel xuống.
4. Menu đóng và toast báo xuất thành công.

Nếu danh sách nhân viên rỗng, hệ thống không tạo file, đóng menu và hiển thị
cảnh báo rằng không có dữ liệu phù hợp để xuất.

## Cấu trúc file

### File bảng số công

- Tên file: `bang-so-cong-thang-MM-YYYY.xlsx`
- Tên worksheet: `Số công`
- Các cột cố định:
  - `STT`
  - `Họ và tên`
  - `Mã đăng nhập`
  - `Tổng công`
- Các cột ngày: `01`, `02`, ... đến ngày cuối cùng của tháng.
- Giá trị số công là số thực, ví dụ `1`, `0.5`, `0`.

### File bảng số giờ

- Tên file: `bang-so-gio-thang-MM-YYYY.xlsx`
- Tên worksheet: `Số giờ`
- Các cột cố định:
  - `STT`
  - `Họ và tên`
  - `Mã đăng nhập`
  - `Tổng giờ`
- Các cột ngày: `01`, `02`, ... đến ngày cuối cùng của tháng.
- Giá trị số giờ là số thực, không thêm ký tự `h`, để Excel có thể tính toán.

## Quy tắc dữ liệu

- Dùng cùng nguồn dữ liệu và cùng quy tắc tính `getDayCellData` /
  `calcMonthTotals` mà bảng chấm công tháng đang hiển thị.
- Thứ Bảy, Chủ nhật không có dữ liệu được để trống.
- Ngày tương lai được để trống.
- Ngày không có bản ghi và không có trạng thái vắng mặt được để trống.
- Ngày đã phát sinh trạng thái vắng mặt được ghi số `0`.
- Các giá trị tổng là số, không phải chuỗi đã định dạng.
- Nhân viên xuất ra giữ đúng thứ tự đang hiển thị sau khi lọc tìm kiếm, không
  phụ thuộc trang phân trang hiện tại. Vì vậy file chứa toàn bộ kết quả lọc,
  không chỉ 10 nhân viên của trang đang xem.

## Kiến trúc

Tạo utility HR Excel độc lập để:

- Biến đổi nhân viên và dữ liệu theo ngày thành các hàng xuất.
- Tạo worksheet/workbook bằng thư viện `xlsx` đã có trong dự án.
- Gán độ rộng cột phù hợp.
- Tải workbook với tên file xác định.

`CalendarTab` chịu trách nhiệm:

- Quản lý trạng thái mở/đóng menu.
- Cung cấp tháng, năm, danh sách nhân viên đã lọc và hàm đọc dữ liệu từng ngày.
- Gọi utility tương ứng với lựa chọn số công hoặc số giờ.
- Hiển thị toast và xử lý trường hợp không có dữ liệu.

Việc tách utility giúp tránh làm `CalendarTab.tsx` lớn hơn và cho phép kiểm thử
logic tạo hàng Excel mà không cần render toàn bộ màn hình.

## Xử lý lỗi

- Không có nhân viên: cảnh báo, không tạo file.
- Lỗi tạo workbook hoặc tải file: bắt lỗi, ghi log và hiển thị toast lỗi.
- Dữ liệu thiếu tên/email: dùng chuỗi rỗng thay vì làm hỏng quá trình xuất.
- Số không hợp lệ: chuẩn hóa về `0` đối với tổng; ô ngày không xác định để trống.

## Kiểm thử

### Unit test utility

- Tạo đúng số cột theo tháng 28, 29, 30 và 31 ngày.
- Xuất đúng giá trị số công và tổng công.
- Xuất đúng giá trị số giờ và tổng giờ.
- Cuối tuần/ngày tương lai không có dữ liệu được để trống.
- Ngày vắng mặt được ghi `0`.
- Tên file và tên worksheet đúng.
- Toàn bộ kết quả tìm kiếm được xuất, không bị giới hạn bởi phân trang.

### Kiểm thử tích hợp giao diện

- Bấm `Tiện ích` mở hai lựa chọn.
- Bấm ra ngoài đóng menu.
- Chọn một lựa chọn gọi đúng exporter và đóng menu.
- Không có nhân viên thì không gọi exporter và hiển thị cảnh báo.

### Xác minh cuối

- Chạy test mới.
- Chạy typecheck toàn dự án.
- Chạy build.
- Mở file mẫu của cả hai kiểu và xác nhận tiêu đề, số dòng, số cột và kiểu dữ
  liệu số có thể cộng được trong Excel.

