# Tiến độ thực hiện quản lý vật tư

Cập nhật: 05/09/2026. Kế hoạch tổng: [supply-management-implementation-plan.md](../supply-management-implementation-plan.md).

## Đã triển khai trong mã nguồn

- CV-01/CV-02: bảo vệ đường ghi cũ bằng transaction, idempotency, kiểm tra công ty/chi nhánh, chặn sửa tồn trực tiếp, ngừng/khôi phục danh mục và xử lý hạn dùng không rõ.
- CV-03: models cấu hình, đơn vị và quy đổi, lô, tồn theo kho/lô/trạng thái, chứng từ/dòng, lớp giá, sổ, audit, khóa kho/kỳ, quyền kho và outbox. Khóa unique được kiểm tra trước khi tạo/ghi sổ.
- Số lượng dùng số nguyên theo độ chính xác cấu hình; đầu vào thập phân dạng chuỗi, quy đổi bằng BigInt và từ chối làm tròn ngầm. Giá trị VND nguyên; phân bổ giữ đủ phần dư tại lần xuất cuối.
- Quyền riêng cho tạo, duyệt, ghi sổ, điều chỉnh, xem giá và các nhóm nghiệp vụ tiếp theo. Không tự chuyển quyền manage cũ thành quyền duyệt. Người dùng thường cần được phân công kho.
- CV-04, một phần CV-05: API mở sổ/nhập/xuất với nháp → gửi duyệt → duyệt → ghi sổ; từ chối/hủy có lý do, revision và idempotency. Phiếu đã ghi sổ không sửa trực tiếp.
- Ghi sổ cập nhật tồn, lớp giá, sổ, audit và outbox trong cùng transaction. Xuất FEFO, chặn âm tồn, lô hết hạn/thiếu hạn/cách ly/thu hồi, khóa kiểm kê và kỳ đóng.
- Outbox có lease, retry, giới hạn thử lại và thông báo chống trùng; không phát socket trước commit.
- API đọc chứng từ/tồn theo phạm vi, ẩn giá khi thiếu quyền; công cụ đối soát tồn–sổ–lớp giá chỉ đọc.
- Chế độ legacy/preparing/v2 ngăn hai nguồn tồn cùng ghi. Writer cũ bị chặn khi công ty chuyển khỏi legacy.
- CLI provision:supply-inventory có dry-run mặc định, chỉ tạo index khi --apply, không tự bật V2 hoặc sửa tồn.

## Kiểm chứng

- 77/77 kiểm thử vật tư đạt trên replica set riêng localhost:27189, gồm 28 integration test với MongoDB thật và các test số học, validation, scope, UI.
- Các ca mới kiểm tra FEFO và giá vốn, xuất đồng thời, gửi trùng, rollback lỗi dòng thứ hai, lô sai hạn/thu hồi, snapshot đơn vị, revision, phạm vi kho/giá, khóa kỳ/kiểm kê, writer legacy và outbox.
- Typecheck, build và git diff --check đã đạt sau các chỉnh sửa cuối.
- CLI provisioning dry-run đã đạt trên database thử nghiệm. Replica set thử nghiệm đã được dừng sau kiểm tra.

## Chưa hoàn thành

- Đã nối giao diện chứng từ (lập/sửa nháp, gửi duyệt, duyệt/từ chối, hủy, ghi sổ, lịch sử và phân bổ), tồn theo lô và cấu hình đơn vị. Chưa có màn hình tạo danh mục vật tư mới qua V2, chọn nhà cung cấp trên phiếu, quản trị phân công kho hoặc báo cáo đối soát.
- Chưa có chuyển kho, trả hàng/đảo phiếu, kiểm kê/điều chỉnh đầy đủ, hủy, quản lý chất lượng/release, truy xuất sử dụng, định mức, mua hàng, báo cáo kỳ và migration.
- Mới có model/guard cho khóa kỳ, kiểm kê và quyền kho; chưa có toàn bộ giao diện/API quản trị các phần này.
- API đối soát hiện cần ngừng ghi đồng thời để có chẩn đoán nhất quán; chưa thay thế báo cáo snapshot theo kỳ.
- Chưa có công cụ chuyển dữ liệu/kích hoạt V2. Không chỉnh mode trực tiếp để bỏ qua migration.
- Database cấu hình được kiểm tra chỉ đọc: standalone, 1 vật tư, 1 giao dịch, 1 cảnh báo UNRECORDED_OPENING_OR_ADJUSTMENT. Báo cáo trong tmp/supply-inspection/configured-*.json. Chưa thay đổi topology hoặc dữ liệu thật.

## Thứ tự tiếp tục

1. Hoàn thiện quản trị danh mục V2, nhà cung cấp trên phiếu và phân công kho.
2. Hoàn thiện đảo phiếu và chuyển kho trên cùng bộ ghi sổ.
3. Kiểm kê, điều chỉnh, chất lượng, hủy và truy xuất sử dụng theo kế hoạch.
4. Định mức, mua hàng, báo cáo và bộ nghiệm thu toàn luồng.
5. Migration dry-run, đối chiếu chênh lệch dữ liệu cũ, chuẩn bị replica set, diễn tập rollback rồi mới kích hoạt.

Đã có nền tảng backend CV-03/CV-04 và giao diện chứng từ/đơn vị/tồn của CV-05; chưa hoàn thành toàn bộ CV-01 đến CV-14.
