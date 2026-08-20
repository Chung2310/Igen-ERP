# Thiết kế quản lý vòng đời IMEI / Serial

## Mục tiêu

Tạo một điểm tra cứu thống nhất trong Kho cho từng IMEI/serial phát sinh mới, với lịch sử bất biến của mọi nghiệp vụ: nhập, bán, sửa chữa/bảo hành và chuyển kho liên chi nhánh.

## Phạm vi

- Chỉ áp dụng với giao dịch phát sinh sau khi triển khai; không backfill dữ liệu lịch sử.
- Áp dụng cho sản phẩm/biến thể được cấu hình theo dõi serial.
- Tận dụng mô hình `InventorySerialUnit` và `InventorySerialEvent` hiện có.

## Trải nghiệm người dùng

### Tab Kho: IMEI / Serial

Thêm tab **IMEI / Serial** vào thanh tab của phân hệ Kho. Danh sách hỗ trợ tìm theo IMEI/serial, mã vạch nội bộ và SKU; lọc theo trạng thái, chi nhánh và kho. Người dùng mở một serial để xem hồ sơ chi tiết và timeline vòng đời.

Hồ sơ hiển thị sản phẩm/SKU, serial, mã nội bộ, trạng thái và vị trí hiện tại; thông tin bán hàng, khách hàng và bảo hành khi đã bán; chứng từ hiện tại nếu có.

Timeline hiển thị thời gian, loại sự kiện tiếng Việt, người thao tác, trạng thái trước/sau, chi nhánh/kho nguồn và đích (nếu có), lý do/ghi chú, và liên kết tới chứng từ liên quan.

## Quy tắc nghiệp vụ

### Nhập kho

Khi chốt phiếu nhập có dòng hàng theo dõi serial, người dùng bắt buộc nhập hoặc quét đủ số lượng IMEI/serial. Mỗi serial chưa tồn tại tạo một `InventorySerialUnit` và sự kiện `RECEIVED`; serial trùng trong công ty bị từ chối. Bản ghi nhận chi nhánh, kho, phiếu nhập và bảo hành nhà cung cấp nếu phiếu có cấu hình.

### Bán hàng

Khi chốt đơn/hóa đơn, mỗi đơn vị hàng theo dõi serial phải chọn một serial `IN_STOCK` tại đúng chi nhánh/kho bán. Giao dịch nguyên tử sẽ chuyển serial sang `SOLD`, gắn khách hàng, đơn bán/hóa đơn, thời điểm bán và bảo hành khách, rồi tạo sự kiện `SOLD` liên kết chứng từ.

### Sửa chữa và bảo hành

Tạo phiếu sửa/bảo hành bắt buộc quét hoặc chọn một serial đã bán. Hệ thống tra cứu hồ sơ serial và thông tin bảo hành; không cho tạo phiếu không gắn serial. Các mốc tạo phiếu, tiếp nhận, bắt đầu sửa, hoàn tất, bàn giao/đóng phiếu và thay đổi kết quả bảo hành đều tạo sự kiện serial liên kết phiếu sửa. Trạng thái serial chuyển `REPAIRING` khi tiếp nhận và trở về trạng thái phù hợp khi hoàn tất/hoàn trả theo quy tắc trạng thái hiện hành.

### Chuyển kho giữa chi nhánh (hai bước)

Chi nhánh gửi tạo phiếu chuyển kho, chọn serial đang `IN_STOCK` tại kho của mình. Serial chuyển sang `IN_TRANSIT`, giữ vị trí gửi và ghi sự kiện `TRANSFER_REQUESTED` chứa chi nhánh/kho gửi, chi nhánh/kho nhận và chứng từ.

Chi nhánh nhận xác nhận phiếu. Trong cùng giao dịch, serial cập nhật chi nhánh/kho hiện tại sang nơi nhận, về `IN_STOCK`, và tạo sự kiện `TRANSFER_RECEIVED`. Nếu từ chối hoặc hủy trước khi nhận, serial quay về `IN_STOCK` tại nơi gửi và có sự kiện `TRANSFER_REJECTED` hoặc `TRANSFER_CANCELLED` kèm lý do.

## Mô hình dữ liệu và tính toàn vẹn

`InventorySerialUnit` là ảnh chụp hiện tại của một thiết bị. Bổ sung trạng thái `IN_TRANSIT`, định danh/địa điểm nguồn chuyển và đích chuyển trong lúc chờ nhận, cùng dữ liệu bán hàng/khách hàng/bảo hành đã xác định.

`InventorySerialEvent` là nhật ký chỉ-ghi-thêm. Bổ sung trường cấu trúc cho chi nhánh/kho nguồn–đích, mã/loại chứng từ và dữ liệu tham chiếu tối thiểu. Lịch sử truy vấn theo `companyCode` và `serialUnitId`, không bị giới hạn bởi chi nhánh hiện tại, để vẫn xem được lịch sử trước chuyển kho.

Mọi thay đổi serial phải chạy trong transaction cùng chứng từ nguồn. Không được gọi endpoint chuyển trạng thái chung từ giao diện cho nghiệp vụ bán, sửa hay chuyển kho; các service nghiệp vụ sở hữu việc cập nhật trạng thái và ghi sự kiện để tránh lịch sử thiếu hoặc sai.

## Phân quyền và lỗi

- Người dùng chỉ xem/thao tác serial, chứng từ và chi nhánh/kho mà quyền hiện có cho phép.
- Bên gửi chỉ tạo/hủy khi còn quyền tại kho gửi; bên nhận chỉ xác nhận/từ chối khi còn quyền tại kho nhận.
- Từ chối serial không tồn tại, serial trùng, serial không thuộc kho/chi nhánh, serial sai trạng thái, số serial khác số lượng, và serial không ở trạng thái đã bán khi mở phiếu sửa/bảo hành.
- API trả thông báo nghiệp vụ rõ ràng; giao dịch lỗi không để lại cập nhật dở dang hoặc sự kiện mồ côi.

## Kiểm thử và tiêu chí hoàn thành

- Unit test các chuyển trạng thái hợp lệ/không hợp lệ và tính bất biến của timeline.
- Integration test cho nhập, bán, tạo/cập nhật phiếu sửa-bảo hành, và toàn bộ luồng chuyển liên chi nhánh tạo → nhận, tạo → từ chối, tạo → hủy.
- Test phân tách tenant/công ty, phạm vi chi nhánh/kho, transaction rollback và serial trùng.
- Component test cho tab danh sách, tìm/lọc, hồ sơ chi tiết/timeline và hành động chuyển kho theo quyền.

Hoàn thành khi một serial mới có thể được tạo từ phiếu nhập, bán cho khách hàng, bắt buộc dùng khi mở sửa/bảo hành, chuyển hai bước giữa chi nhánh, và hiển thị đầy đủ timeline có liên kết chứng từ từ một màn hình duy nhất.
