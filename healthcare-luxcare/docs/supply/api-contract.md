# Hợp đồng API của bản bảo vệ kho legacy

Base path hiện tại: /api/v1. Các route vật tư cần authentication, quyền supply:read hoặc supply:manage và middleware requireSupplyScope.

## Scope

Company lấy từ user đã xác thực. Chi nhánh lấy từ scope user hoặc lựa chọn hợp lệ của admin; header X-Branch-Id, query branchId và body branchId nếu cùng xuất hiện phải thống nhất. Nhân viên không được ghi đè branch của mình. Admin chọn chi nhánh phải có branch thuộc company và đang hoạt động. Nhân viên chưa được gán branch không được đọc toàn công ty.

## Đọc

- GET /supplies: pagination/bộ lọc cũ và archived boolean, mặc định false. Status hỗ trợ in-stock/low-stock/out-of-stock/expired/quarantined; được tính theo ngày hiện tại.
- GET /supplies/:id: chi tiết trong scope, kể cả đã archive để phục vụ truy xuất.
- GET /supplies/:id/transactions: 50 giao dịch gần nhất trong scope; không xóa khi archive.
- GET /supplies/transactions/all và /export: giữ giao dịch lịch sử, không lọc bỏ các vật tư đã archive.
- GET /supplies/export: bộ lọc danh mục, có archived; thống kê hiện tại vẫn là vật tư đang hoạt động.

## Ghi

- POST /supplies: whitelist trường danh mục; requiresExpiry mặc định true, expiryDate được null. Có quantity > 0 thì cùng transaction tạo dòng tồn đầu kỳ. Trả 201 {status, data}.
- PATCH /supplies/:id: quantity bị từ chối kể cả gửi đúng bằng số hiện có. Field managed như companyCode/isActive/status không nhận qua schema. Metadata ảnh hưởng kho chỉ đổi trước khi có tồn/lịch sử. Trả {status, data}.
- DELETE /supplies/:id: archive, yêu cầu quantity=0. Trả thành công và giữ toàn bộ lịch sử; không có xóa cứng.
- POST /supplies/:id/restore: restore archive, quyền manage và đúng scope; không thay số tồn.
- POST /supplies/:id/stock-in, /stock-out: giữ body tương thích; single writer gọi cùng bộ batch bên trong. Xuất cần lý do và khoa/phòng nhận.
- POST /supplies/transactions/batch: 1–200 dòng; kiểm tra tổng số lượng trùng vật tư; toàn phiếu commit hoặc rollback; phản hồi theo định dạng cũ {status, data: {batchCode, type, totalItems, totalQuantity, transactions, supplies}}.

Nhập lô/hạn/giá khác khi còn tồn trả LOT_CONFLICT; không đổi warehouse bằng body warehouseLocation trong phiếu nhập. Vật tư expired/quarantined không xuất dùng. Giao diện mới giữ Idempotency-Key từ lúc mở form create/batch đến khi có kết quả; client không có key vẫn nguyên tử nhưng chưa chống được gửi lại sau timeout.

## Idempotency và lỗi

Key 8–128 ký tự chữ/số/:/_/-, unique theo company. Fingerprint bao gồm loại nghiệp vụ, actor ID, scope và payload canonical. Cùng key/cùng payload trả kết quả cũ; key khác payload trả 409. Không xóa key bằng TTL. Index unique phải tồn tại trước request; thiếu index trả 503, không tiếp tục ghi.

Lỗi có {status: error, code, message}, HTTP 400 với lỗi nghiệp vụ, 403 scope, 404 không tìm thấy trong scope, 409 conflict và 503 hạ tầng chưa sẵn sàng. Schema validation vẫn theo middleware chung {status, message, errors}. MongoDB error chưa được phân loại trả thông báo 500 chung, không đưa raw database message/URI cho client.

## API V2

Chưa phát hành các đường /supply-documents, /supply-balances, /supply-lots, /supply-stocktakes và nghiệp vụ kế tiếp. Hợp đồng dự kiến ở mục 5 của kế hoạch tổng; không gọi các endpoint đó từ UI cho đến khi hoàn tất CV-03/CV-04/CV-05.

## API V2 đã triển khai ngày 05/09/2026

Prefix: /api/v1/supply-inventory. Mọi request cần đăng nhập và phạm vi công ty/chi nhánh hợp lệ. Phạm vi chi nhánh được chọn bằng x-branch-id; không đưa companyCode/branchId vào body chứng từ.

| Method/path | Nội dung |
| --- | --- |
| GET /state | legacy/preparing/v2, mặc định legacy |
| GET /documents | Danh sách phân trang page/limit |
| POST /documents | Tạo nháp opening/receipt/issue |
| GET /documents/:id | Chi tiết và dòng |
| PATCH /documents/:id | Sửa nháp/bị từ chối, revision bắt buộc |
| POST /documents/:id/submit | Gửi duyệt |
| POST /documents/:id/approve | Duyệt đúng revision |
| POST /documents/:id/reject | Từ chối có reason |
| POST /documents/:id/cancel | Hủy phiếu chưa ghi sổ, có reason |
| POST /documents/:id/post | Ghi sổ phiên bản đã duyệt |
| PUT /profiles/:id | Cấu hình vật tư, expectedVersion bắt buộc |
| GET /balances | Tồn theo kho/lô/trạng thái, phân trang |
| GET /reconciliation | Đối soát chỉ đọc; chạy khi ngừng ghi |

Mutation chứng từ cần Idempotency-Key dài 8–128 ký tự (chữ/số/:/_/-). Giữ nguyên key khi thử lại cùng nội dung; thay key khi thay nội dung. Action body là { revision, reason? }. Phiếu mở sổ cần thêm supply:adjust. Nhập/mở sổ cần quyền xem giá để khai báo tổng giá trị. Profile id là supplyId.

Draft: type, warehouseId, reason, recipientDepartment (bắt buộc khi issue), supplierId tùy chọn, lines (1–200). Dòng gồm supplyId, quantity dạng chuỗi, unit; nhập có lotNumber, manufacturerKey, expiryDay YYYY-MM-DD và totalValueMinor VND nguyên. Issue có lotId tùy chọn để giới hạn lô, mặc định FEFO.

Tồn trả quantityScaled; số lượng cơ sở = quantityScaled / 10^precision cấu hình profile. Không cộng trường quantity legacy vào tồn V2. Các trường tiền bị lược bỏ khi thiếu supply:cost-read. API đã được nối với giao diện Kho theo lô và chứng từ; chưa sẵn sàng kích hoạt trên dữ liệu thật trước migration/đối soát.


## API phục vụ giao diện

- GET /catalog?search=&page= trả tối đa 50 danh mục đang hoạt động theo công ty, chỉ tên/mã/đơn vị/hồ sơ quy đổi; không trả tồn hoặc giá legacy.
- GET /warehouses trả kho trong chi nhánh và quyền được phân công, kèm canWrite.
- GET /balances bổ sung tên vật tư, tên kho, profile, lot và businessDay theo múi giờ công ty.
- GET /documents/:id bổ sung history và movements có số lô; vẫn kiểm tra phạm vi trước khi đọc và lược bỏ trường giá theo quyền.

Giao diện truyền X-Branch-Id và Idempotency-Key, giữ nguyên key khi thử lại cùng nội dung. Khi đổi công ty/chi nhánh, workspace được tạo lại để không mang phiếu đang soạn sang phạm vi khác.
