# Giao diện kho theo lô và chứng từ

Vào **Vật tư**, chọn chi nhánh. Dùng một thanh điều hướng chung để mở trực tiếp **Chứng từ**, **Tồn theo lô** hoặc **Đơn vị quy đổi**. Khi công ty còn dùng kho cũ, thanh này hiển thị thêm Vật tư, Nhập / xuất, Nhà cung cấp, Kho lưu trữ và Phân loại. Không còn hai tầng tab chuyển màn hình. Thanh cuộn ngang trên màn hình hẹp; chuyển mục bị khóa trong lúc soạn phiếu hoặc cấu hình chưa đóng.

## Danh mục và đơn vị

Tìm theo tên/mã, chọn vật tư để xem đơn vị cơ sở, độ chính xác, cách theo dõi lô/hạn và các đơn vị quy đổi. Ví dụ 1 hộp bằng 100 cái. Người có quyền quản lý danh mục có thể lưu cấu hình khi kho hoạt động. Cấu hình đã được dùng trong chứng từ không được sửa hồi tố.

## Chứng từ

1. Chọn **Lập phiếu**, loại nhập/xuất/mở sổ và kho được phân công.
2. Nhập lý do; phiếu xuất cần khoa/phòng nhận.
3. Chọn vật tư từng dòng, số lượng và đơn vị. Nhập kho khai báo số lô, hạn dùng và tổng giá trị dòng VND. Dùng dấu chấm cho số lượng thập phân.
4. Lưu nháp, mở chi tiết, gửi duyệt. Người có quyền duyệt chọn duyệt/từ chối; từ chối cần lý do.
5. Người có quyền ghi sổ xác nhận ghi sổ phiếu đã duyệt. Hệ thống kiểm tra tồn và phân bổ theo lô tại thời điểm này.
6. Xem lịch sử xử lý và các lô thực tế đã được ghi sổ trong chi tiết. Phiếu đã ghi sổ không có nút sửa/hủy trực tiếp.

Khi mất kết nối, thử lại cùng thao tác giữ nguyên mã chống trùng. Khi báo phiếu đã thay đổi, tải lại chi tiết và kiểm tra trạng thái trước khi thao tác tiếp.

## Tồn theo lô

Hiển thị tên vật tư/kho, lô, hạn, chất lượng, số lượng theo đơn vị cơ sở và giá trị nếu được cấp quyền. Có phân trang. Tồn mới không cộng chung với tồn của màn hình cũ. Ngày hết hạn được so với ngày nghiệp vụ do server trả theo múi giờ công ty.

## Điều kiện thao tác

Kho chưa kích hoạt hoặc đang chuyển dữ liệu chỉ cho xem; không tự bật ghi khi mở giao diện. Người dùng thường cần quyền nghiệp vụ và phân công kho. Quyền quản lý vật tư cũ không tự có quyền duyệt. Công ty phải hoàn thành chuẩn bị database hỗ trợ transaction và đối soát dữ liệu trước khi bật kho mới.

Đã kiểm thử giao diện bằng React Testing Library và dữ liệu hiển thị bằng MongoDB thử nghiệm riêng; chưa nghiệm thu trình duyệt trên dữ liệu vận hành thật. Các màn hình chuyển kho, kiểm kê, hủy hàng, phân công kho, báo cáo đối soát và chọn nhà cung cấp trên phiếu thuộc các bước tiếp theo.
