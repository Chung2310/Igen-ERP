# Retail — Các phần chưa hoàn thành

## 1. Mục đích và phạm vi

Tài liệu này ghi nhận phần còn thiếu sau commit `8a359c89` trên nhánh `feat/retail-phase-4`, đối chiếu với `ke-hoach-trien-khai-chuc-nang-ban-le-ranking-chi-tiet timeline.md`.

Ưu tiên hiện tại là hoàn thiện chức năng phần mềm nội bộ. Các API bên thứ ba, thiết bị chuyên dụng và tính năng cần điều kiện pháp lý được để ở giai đoạn sau.

Quy ước trạng thái:

- **Một phần**: đã có luồng chính nhưng chưa đạt đủ điều kiện nghiệm thu trong roadmap.
- **Chưa làm**: chưa có model/service/API/UI chuyên biệt trong module Retail.
- **Để sau**: phụ thuộc API, đối tác, thiết bị hoặc quyết định nghiệp vụ bên ngoài.

## 2. Phần đã có nhưng chưa hoàn tất

### A2 — Hóa đơn bán lẻ nội bộ

Trạng thái: **Một phần**.

Đã có:

- Snapshot hóa đơn bất biến từ đơn xác nhận.
- Xem chi tiết, in lại bằng trình duyệt và lưu PDF qua hộp thoại in.
- In lại không tạo giao dịch hoặc doanh thu mới.

Còn thiếu:

- Thông tin đầy đủ của cửa hàng/chi nhánh trên mẫu in.
- Tùy chọn khổ giấy và mẫu in trong cài đặt.
- Nút tải PDF trực tiếp nếu không muốn phụ thuộc chức năng “Save as PDF” của trình duyệt.
- Test riêng cho thao tác in lại từ màn hình danh sách hóa đơn.

### A4 — Công nợ khách hàng cơ bản

Trạng thái: **Một phần**.

Đã có bán nợ, hạn thanh toán, thu từng phần, dư nợ theo khách và báo cáo quá hạn.

Còn thiếu:

- Sổ công nợ append-only tách biệt với snapshot tổng trên đơn.
- Bút toán điều chỉnh công nợ có lý do, người thực hiện và audit.
- Trang lịch sử phát sinh/thu/điều chỉnh theo từng khách hàng.
- Đối soát tự động giữa sổ công nợ và `dueAmount` của đơn.

### A5 — Báo cáo doanh thu/lợi nhuận

Trạng thái: **Một phần**.

Đã có dashboard theo ngày và chi nhánh, doanh thu, hoàn tiền, thanh toán, ca, thu ngân, công nợ, lợi nhuận theo quyền và xuất Excel.

Còn thiếu:

- Báo cáo doanh thu/lợi nhuận theo sản phẩm, SKU, nhóm hàng và thương hiệu.
- Bảng top sản phẩm và hàng bán chậm.
- Bộ lọc nhân viên/sản phẩm trực tiếp trên dashboard.
- Đối soát báo cáo Retail với khu vực Analytics tổng của ERP.

### A8 — Phân hạng khách hàng/VIP

Trạng thái: **Một phần**.

Đã có cấu hình tên hạng/ngưỡng doanh số, tự tính theo doanh số thuần, trừ hoàn tiền, loại đơn hủy, lưu lịch sử thay đổi và hiển thị hạng trong hồ sơ/POS.

Còn thiếu:

- Giao diện xem đầy đủ timeline tăng/giảm hạng.
- Bộ lọc danh sách khách hàng theo hạng.
- Thống kê số khách, doanh thu và tần suất mua theo hạng.
- Cấu hình kỳ xét hạng: toàn thời gian, 12 tháng hoặc khoảng tùy chọn.
- Điều chỉnh hạng thủ công có ngày hết hạn, lý do và audit.
- Tự đồng bộ lịch sử ngay sau giao dịch; hiện việc tính lại chủ yếu xảy ra khi tải danh sách hoặc hồ sơ khách.

### A12 — Nhắc công nợ quá hạn

Trạng thái: **Một phần**.

Đã có scheduler chạy lúc khởi động và mỗi giờ, thông báo in-app, nút chạy thủ công cho manager và khóa DB chống gửi trùng theo đơn/người nhận/ngày.

Còn thiếu:

- Cấu hình tần suất nhắc theo doanh nghiệp/chi nhánh.
- Cấu hình người nhận và ngưỡng số ngày quá hạn.
- Nhật ký từng lần chạy job và trạng thái gửi.
- Retry có kiểm soát cho lỗi gửi.
- Email nội bộ qua SMTP của doanh nghiệp; không dùng dịch vụ API bên thứ ba.
- Màn hình xem lịch sử nhắc nợ theo khách hàng/đơn hàng.

### B1/B2 — POS và quét barcode

Trạng thái: **Một phần**.

Đã có POS web responsive, tìm/quét mã, camera scan, giỏ hàng, đơn treo và thanh toán.

Còn thiếu:

- Bộ phím tắt hoàn chỉnh để thao tác không cần chuột.
- Kiểm thử và tài liệu tương thích máy quét HID USB/Bluetooth thực tế.
- Âm thanh/trạng thái rõ khi mã không tồn tại hoặc quét trùng.
- Hàng đợi/offline UX khi mất mạng; backend idempotency đã có nhưng chưa có chế độ offline hoàn chỉnh.

## 3. Chức năng phần mềm nội bộ chưa làm

### Ưu tiên gần nhất

1. **A13 — Trả hàng từ khách**
   - Phiếu trả liên kết đơn gốc.
   - Chọn dòng hàng, số lượng, lý do và phương án hoàn tiền/đổi hàng.
   - Chặn trả vượt số lượng đã bán hoặc đã trả.
   - Hoàn tồn bằng stock log riêng, không sửa lịch sử tài chính của đơn gốc.
   - Audit người thực hiện và thời gian.

2. **A10 — Trả hàng nhà cung cấp**
   - Cần model nhà cung cấp và phiếu trả NCC.
   - Kiểm tra tồn khả dụng, chứng từ, lý do và stock log xuất trả.
   - Hỗ trợ dòng giá trị 0 đồng cho hàng lỗi/đổi bảo hành.

3. **B8 — Quản lý IMEI/serial**
   - Registry serial/IMEI duy nhất.
   - Trạng thái nhập kho, tồn, đã bán, trả hàng, sửa chữa.
   - Liên kết serial với SKU, chi nhánh/kho và chứng từ.
   - Timeline dịch chuyển và chặn thao tác sai trạng thái.

4. **A9 — CTV/Đại lý và hoa hồng**
   - Gắn nguồn CTV/đại lý vào đơn.
   - Chính sách hoa hồng theo phần trăm hoặc số tiền cố định.
   - Ledger hoa hồng truy ngược về đơn/chính sách.
   - Đơn hủy hoặc trả hàng phải đảo hoa hồng.
   - Báo cáo và đối soát theo kỳ.

### Nhóm quản trị nội bộ

- **A7 — Chi phí/chi tiêu chi nhánh**: ERP đã có operating expense cơ bản nhưng chưa nối đầy đủ với Retail, audit chứng từ và báo cáo lợi nhuận chi nhánh.
- **A11 — Tài sản cố định**: chưa có module danh mục tài sản, điều chuyển, trạng thái và bảng khấu hao đường thẳng.
- **D1–D4 — Sửa chữa/bảo hành**: chưa có phiếu tiếp nhận, workflow trạng thái, kho linh kiện và báo cáo doanh thu dịch vụ.
- **Marketing automation nội bộ**: chưa có rule engine dựa trên hạng khách, lần mua gần nhất, sinh nhật hoặc công nợ; chưa xét các kênh gửi bên ngoài.

## 4. Phần để sau do phụ thuộc bên ngoài

Các hạng mục sau không nằm trong đợt phần mềm nội bộ hiện tại:

- C1 — Hóa đơn điện tử pháp lý qua MISA, Viettel hoặc nhà cung cấp khác.
- C2/C3 — SMS và Zalo ZNS/OA.
- C5/C6 — Đồng bộ đơn, giá và tồn với Shopee, Lazada, TikTok Shop, Tiki.
- B3/B4 — Driver ESC/POS và điều khiển ngăn kéo tiền chuyên dụng.
- B5/B7/B9 — Camera traffic, Wi-Fi marketing và nhận diện khuôn mặt VIP.
- C9 — VNeID.

Các phần này chỉ triển khai sau khi có tài khoản sandbox, tài liệu API/SDK, thiết bị pilot, owner nghiệp vụ và tiêu chí nghiệm thu.

## 5. Thứ tự triển khai đề xuất

### Milestone 1 — Hoàn thiện vòng đời bán hàng

1. A13 trả hàng từ khách.
2. Hoàn thiện sổ công nợ append-only và audit A4.
3. Hoàn thiện cấu hình/lịch sử A12.
4. Bổ sung báo cáo theo sản phẩm cho A5.

### Milestone 2 — Hàng hóa và truy xuất

1. Model nhà cung cấp.
2. A10 trả hàng nhà cung cấp.
3. B8 IMEI/serial.
4. Đối soát tồn kho và stock movement.

### Milestone 3 — Khách hàng và kênh bán nội bộ

1. Hoàn thiện timeline/bộ lọc/thống kê A8.
2. A9 CTV/đại lý và ledger hoa hồng.
3. Marketing automation nội bộ, chỉ tạo nhiệm vụ/thông báo ERP.

### Milestone 4 — Quản trị mở rộng

1. Nối chi phí chi nhánh A7 vào báo cáo Retail.
2. A11 tài sản cố định.
3. D1–D4 sửa chữa/bảo hành.

## 6. Tiêu chuẩn hoàn thành chung

Mỗi hạng mục chỉ được coi là hoàn thành khi:

- Backend bắt buộc scope `companyCode` và `branchId` từ actor/guard hiện tại.
- Không thêm permission Retail ngoài mô hình đã được phê duyệt nếu chưa có quyết định mới.
- Giao dịch tài chính/tồn kho có idempotency và audit phù hợp.
- Đơn hủy, trả hàng và hoàn tiền không làm sai doanh thu, công nợ, tồn kho, hạng khách hoặc hoa hồng.
- Có unit test backend, test API/UI quan trọng, typecheck, build và `git diff --check` đạt.
- Có tài liệu migration/backfill nếu thay đổi schema dữ liệu đang vận hành.
