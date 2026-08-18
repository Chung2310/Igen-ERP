# Thiết kế triển khai kiểm kê kho bằng mã vạch

## 1. Mục tiêu và phạm vi

Xây dựng chức năng tạo và hoàn tất phiếu kiểm kê cho một kho, cho phép nhân viên đếm hàng bằng mã vạch và đối chiếu với tồn hệ thống.

Phạm vi phiên bản 1:

- Kiểm kê theo số lượng của từng SKU/biến thể.
- Quét mã vạch 1D bằng camera điện thoại trên trình duyệt.
- Hỗ trợ đầu đọc USB/Bluetooth ở chế độ keyboard wedge; thiết bị gửi chuỗi mã như thao tác gõ bàn phím.
- Lưu bản nháp, cho phép sửa số lượng thủ công và ghi chú.
- So sánh tồn hệ thống với tồn thực tế.
- Người có quyền xác nhận chênh lệch; khi xác nhận, hệ thống ghi giao dịch điều chỉnh tồn và khóa phiếu.
- Không triển khai serial/IMEI, số lô, nhiều người đếm đồng thời hoặc offline-first trong phiên bản này.

## 2. Hiện trạng liên quan

- Danh mục sản phẩm đã lưu `barcode` theo SKU/variant và có kiểm tra trùng mã vạch.
- POS đã có thành phần quét barcode bằng camera, có thể tái sử dụng cơ chế mở camera và nhận kết quả.
- Tồn kho được định danh theo kho, sản phẩm, variant và SKU; số lượng hiện có nằm trong `InventoryBalance`.
- Các giao dịch nhập/xuất đã có cơ chế ghi ledger và đồng bộ tồn. Điều chỉnh kiểm kê phải đi qua cùng cơ chế biến động tồn, không cập nhật trực tiếp số lượng.

## 3. Luồng nghiệp vụ

### 3.1 Tạo phiếu

Người dùng chọn kho và nhấn “Tạo phiếu kiểm kê”. Hệ thống chụp danh sách SKU đang có tồn tại thời điểm tạo phiếu, gồm mã sản phẩm, tên, SKU, barcode và tồn hệ thống. Các SKU chưa từng quét vẫn có thể được hiển thị với số đếm bằng 0.

Trạng thái: `draft` → `counting` → `pending_approval` → `completed`; có thể `cancelled` trước khi hoàn tất.

### 3.2 Đếm bằng đầu đọc hoặc camera

Màn hình có một ô nhập barcode luôn có thể focus. Với đầu đọc, mã được nhận như chuỗi bàn phím và kết thúc bằng Enter; debounce ngắn giúp xử lý thiết bị không gửi Enter. Với camera, kết quả quét được đưa qua cùng một hàm xử lý mã.

Khi mã hợp lệ, hệ thống tìm variant theo barcode trong phạm vi công ty. Mỗi lần quét tăng `countedQuantity` lên 1. Nhân viên có thể nhập số lượng tăng nhanh hoặc sửa trực tiếp. Mã không tồn tại phải được báo rõ và không tự tạo sản phẩm.

### 3.3 Đối chiếu và xác nhận

Phiếu hiển thị ba nhóm: khớp, thừa và thiếu. Chênh lệch được tính bằng `countedQuantity - systemQuantity`. Người dùng có thể lọc các dòng có chênh lệch và ghi chú.

Khi gửi duyệt, hệ thống không điều chỉnh tồn ngay. Người có quyền quản lý kho xem lại và xác nhận. Lúc xác nhận, server kiểm tra phiên bản/tồn hiện tại; nếu tồn đã thay đổi sau khi bắt đầu kiểm kê, phiếu chuyển sang trạng thái xung đột và yêu cầu người dùng tải lại/đối chiếu lại.

Sau khi xác nhận, mỗi dòng chênh lệch được ghi thành biến động điều chỉnh tồn với `purpose: "count_adjustment"`, liên kết tới phiếu kiểm kê và có idempotency key. Phiếu `completed` không thể sửa hoặc xác nhận lần hai.

## 4. Thiết kế dữ liệu

Tạo model `InventoryCountModel`:

```text
companyCode, branchId, warehouseId
countCode, status
createdBy, submittedBy, approvedBy
createdAt, submittedAt, approvedAt, cancelledAt
notes, version
items[]: {
  productId, variantId, sku, barcode, productName
  systemQuantity, countedQuantity, quantityDelta
  sourceBalanceVersion, note
}
```

Index đề xuất:

- `{ companyCode: 1, warehouseId: 1, createdAt: -1 }`
- `{ companyCode: 1, countCode: 1 }` unique
- `{ companyCode: 1, status: 1, warehouseId: 1 }`

Barcode được chụp vào dòng kiểm kê để giữ lại thông tin tại thời điểm đếm. SKU/variant và số lượng hệ thống vẫn là dữ liệu dùng để xác thực khi hoàn tất; không tin dữ liệu chỉ do client gửi lên.

## 5. API đề xuất

Base path: `/inventory/counts`.

- `GET /inventory/counts?warehouseId=&status=`: danh sách phiếu.
- `GET /inventory/counts/:id`: chi tiết phiếu và các dòng.
- `POST /inventory/counts`: tạo phiếu từ tồn kho hiện tại.
- `PATCH /inventory/counts/:id/items/:itemId`: cập nhật số đếm/ghi chú khi phiếu còn `draft` hoặc `counting`.
- `POST /inventory/counts/:id/start`: chuyển sang `counting`.
- `POST /inventory/counts/:id/submit`: chuyển sang `pending_approval`.
- `POST /inventory/counts/:id/approve`: kiểm tra xung đột và ghi adjustment.
- `POST /inventory/counts/:id/cancel`: hủy phiếu trước khi hoàn tất.

Mọi endpoint phải kiểm tra company/branch/warehouse scope và permission `inventory:read` hoặc `inventory:manage`. Endpoint approve nên yêu cầu quyền quản lý kho ở mức hiện có, hoặc tách thêm `inventory:count:approve` nếu hệ thống cần phân quyền chi tiết.

## 6. Giao diện

Thêm khu vực “Kiểm kê kho” trong tab kho hàng:

- Danh sách phiếu: mã phiếu, kho, trạng thái, người tạo, thời gian, số dòng chênh lệch.
- Màn hình tạo/đếm: chọn kho, ô nhập barcode, nút “Quét bằng camera”, thống kê tổng dòng/đã quét/khớp/thừa/thiếu.
- Bảng dòng: tên, SKU, barcode, tồn hệ thống, đã đếm, chênh lệch, ghi chú.
- Bộ lọc “chưa đếm” và “có chênh lệch”.
- Màn hình duyệt: tổng hợp tác động tăng/giảm và yêu cầu xác nhận.

Camera chỉ được bật sau thao tác rõ ràng của người dùng, xử lý quyền truy cập bị từ chối, không hỗ trợ HTTPS giả lập hoặc môi trường không có camera. Sau mỗi lần quét nên phát âm báo/ngắn rung nếu thiết bị cho phép, đồng thời chống tăng đôi do camera trả cùng mã liên tiếp trong khoảng debounce.

## 7. Xử lý lỗi và tính nhất quán

- Barcode không tồn tại: hiển thị “Chưa có SKU tương ứng”, giữ nguyên ô nhập để quét lại.
- Barcode trùng dữ liệu: server từ chối từ danh mục; client hiển thị lỗi cấu hình dữ liệu.
- Quét lặp: mỗi lần quét hợp lệ tăng một đơn vị; có nút giảm và sửa số lượng.
- Mất mạng khi đang đếm: giữ dữ liệu nháp cục bộ trong phiên hiện tại và báo chưa đồng bộ; không tuyên bố hoàn tất offline.
- Tồn thay đổi trước approve: không tự ghi đè. Báo chênh lệch mới và yêu cầu tải lại hoặc tạo lại phiếu.
- Retry approve: dùng idempotency key theo `countId`, không tạo adjustment trùng.
- Người dùng rời trang: cảnh báo nếu có thay đổi chưa lưu.

## 8. Kiểm thử và tiêu chí nghiệm thu

Backend:

- Tạo phiếu chụp đúng danh sách tồn theo kho.
- Không cho cập nhật phiếu đã submit/completed/cancelled.
- Từ chối barcode không thuộc công ty hoặc variant không hợp lệ.
- Tính đúng delta âm, dương và bằng không.
- Approve ghi đúng ledger/balance, chạy lại request không ghi trùng.
- Phát hiện tồn thay đổi sau khi tạo phiếu.
- Kiểm tra quyền và scope kho.

Frontend:

- Nhận mã từ input keyboard wedge có và không có Enter.
- Camera tăng đúng một dòng cho mã hợp lệ và debounce quét lặp.
- Hiển thị lỗi barcode lạ, camera bị từ chối và mất mạng.
- Sửa số lượng, lọc chênh lệch, lưu nháp và khôi phục danh sách.
- Hiển thị đúng trạng thái sau submit/approve/cancel.

Tiêu chí nghiệm thu chính: nhân viên dùng đầu đọc hoặc camera có thể kiểm kê một kho, xem chính xác chênh lệch, và sau khi duyệt tồn kho/ledger thay đổi đúng một lần, có thể truy vết về phiếu kiểm kê.

## 9. Kế hoạch triển khai

1. Thêm model, service, controller, router và test backend cho phiếu kiểm kê.
2. Tích hợp adjustment vào cơ chế stock movement hiện có với idempotency.
3. Tách/tái sử dụng scanner camera từ POS thành thành phần dùng chung.
4. Thêm service client và màn hình “Kiểm kê kho”.
5. Bổ sung test UI, test tích hợp và chạy kiểm thử trên Chrome Android/iOS cùng đầu đọc USB/Bluetooth.
6. Triển khai sau feature flag; theo dõi lỗi approve, mã không tìm thấy và xung đột tồn trong giai đoạn đầu.

## 10. Giai đoạn 2

Sau khi phiên bản số lượng ổn định, có thể mở rộng:

- Kiểm kê serial/IMEI từng đơn vị.
- Kiểm kê theo lô và hạn sử dụng.
- Nhiều người đếm đồng thời với phân vùng khu vực.
- Hàng đợi offline và đồng bộ lại.
- In tem barcode hoặc sinh barcode còn thiếu.
