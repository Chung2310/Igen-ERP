# Thiết kế nghiệp vụ và ranh giới chuyển đổi vật tư

## Nguồn dữ liệu hiện tại

Supply.quantity là số tồn legacy; SupplyTransaction giữ biến động in/out. Việc hardening không đổi nguồn này thành đa lô một cách ngầm định. Mọi writer đã được gom vào legacy-write.service.ts; đọc lấy trạng thái hạn động từ shared/supply-stock.ts.

SupplyOperation là bản ghi kết quả thao tác có idempotency, không phải chứng từ V2. SupplyAudit ghi thay đổi danh mục/ngừng/khôi phục, không thay sổ kho. Không dùng tên batchCode của legacy làm định danh lô sản xuất: đó là mã nhóm giao dịch/phiếu.

## Quyết định cho giai đoạn hiện tại

- Tất cả ghi nghiệp vụ dùng MongoDB transaction, readConcern snapshot và writeConcern majority; standalone chặn ghi với 503.
- Mongoose document được nạp bên trong callback transaction để retry đọc lại số tồn. Ghi số tồn và lịch sử nằm cùng session; không chạy Promise.all trong transaction.
- Hạn lưu ở UTC midnight dưới dạng ngày lịch. So với ngày ở Asia/Ho_Chi_Minh; hết hạn từ đầu ngày kế tiếp. Đây là múi giờ mặc định cố định của bản hardening, chưa có cấu hình tenant timezone.
- requiresExpiry=false chỉ dùng cho vật tư không quản lý hạn. Null/thiếu hạn với requiresExpiry khác false là chưa xác minh, không xuất dùng.
- Có số tồn hoặc lịch sử thì danh mục không đổi đơn vị/kho/lô/hạn/giá trực tiếp. Nhập cùng lô/hạn/giá được cộng; lô mới chỉ nhận khi tồn legacy đã về 0, không kế thừa hạn/giá cũ nếu chưa khai báo.
- Stock quantity vẫn là số nguyên an toàn JS trong legacy; số lượng lẻ/quy đổi chính xác thuộc V2 và không ép vào kho cũ.
- Quyền hiện tại read/manage giữ tương thích nhưng phải cùng company/branch scope; không lấy actor hoặc companyCode từ payload.
- Archive chỉ khi số tồn 0, giữ lịch sử và audit, có restore. Archive không phải phiếu hủy hàng.

## Thiết kế V2 đã chọn trong kế hoạch

- Danh mục Supply chung theo công ty; tồn tách theo chi nhánh/kho/vị trí/vật tư/lô/container/chất lượng.
- Số lượng dùng số nguyên theo precision của đơn vị cơ sở. Giá quản trị theo lớp nhận thực tế; snapshot quy đổi và số tiền. FEFO chọn hàng có hạn, FIFO theo lần nhận cho hàng không hạn; không tuyên bố phương pháp kế toán chỉ từ cách chọn hàng.
- SupplyDocument + lines + immutable ledger + cost layers là nguồn chứng từ/sổ. SupplyStockBalance là projection được cập nhật cùng transaction và đối soát bằng sổ.
- Phiếu đã ghi không sửa/xóa. Sai sót dùng đảo/điều chỉnh liên kết, giới hạn theo số còn được đảo/hoàn, giữ audit.
- Kho transit thể hiện hàng đang chuyển. Chuyển kho và thay đổi chất lượng có hai chân đối ứng; không coi là tiêu hao.
- Kiểm kê khóa kho bằng guard chung với engine. Recall/container/khóa kỳ có version/guard để cạnh tranh với xuất và không bị race.
- Chưa có giữ chỗ; phải kiểm tra tồn lại lúc post kể cả đã duyệt. Outbox cùng transaction để phát thông báo sau commit.
- Bật V2 theo công ty sau tồn đầu/chuyển đổi đã verify; legacy chỉ đọc và không phát lại giao dịch cũ vào số tồn mở sổ.
- Chưa xác minh có HIS/LIS hoặc công nợ phù hợp để nối trực tiếp. Trước mắt V2 tiêu hao có mã lượt tham chiếu, tài chính có đối soát mua/nhận/hóa đơn riêng; không tự tạo chi phí kép hoặc thực hiện chuyển tiền.

Chi tiết models, indexes, API, trạng thái và checklist có trong kế hoạch tổng. Không tạo models V2 rồi coi đã bàn giao nghiệp vụ nếu chưa có engine/API/UI/migration tương ứng.

## Hiện thực backend V2 ngày 05/09/2026

Các model và engine mở sổ/nhập/xuất đã được triển khai; xem implementation-status.md để phân biệt phần đã có và phần còn thiết kế. Hạn V2 lưu chuỗi YYYY-MM-DD, múi giờ lấy từ config công ty. Khóa config.writeVersion tuần tự hóa transaction theo công ty để giữ nhất quán ở quy mô phòng khám nhỏ/vừa. Đây là giới hạn throughput có chủ đích; cần đo tải trước khi thay bằng khóa chi tiết hơn. Vị trí/container hiện dùng khóa rỗng, chưa có nghiệp vụ quản lý container. Recipient hiện là tên khoa/phòng tham chiếu dạng chuỗi; chưa liên kết lượt khám/HIS.
