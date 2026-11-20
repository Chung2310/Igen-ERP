# Kế hoạch hoàn thiện quản lý vật tư phòng khám nhỏ và vừa

Ngày lập: 05/09/2026. Trạng thái: đang thực hiện CV-01/CV-02; xem [tiến độ và kết quả kiểm tra](supply/implementation-status.md). Chưa chuyển dữ liệu V2.

## 1. Mục tiêu và phạm vi

Hoàn thiện module vật tư của LuxCare để có thể dùng làm nguồn số liệu kho chính: kiểm soát số lượng, lô, hạn dùng, vị trí, chứng từ, tiêu hao, giá trị và truy xuất. Mọi tính năng phải có backend, giao diện, phân quyền, kiểm thử và hướng dẫn sử dụng tương ứng.

Phạm vi toàn bộ kế hoạch gồm:

- Danh mục, nhà cung cấp, kho chính, kho khoa/phòng và vị trí lưu trữ.
- Tồn đầu kỳ, nhập mua, xuất dùng, điều chuyển, hoàn trả, trả nhà cung cấp, hủy, cách ly, thu hồi và kiểm kê.
- Quy đổi đơn vị, lô/hạn dùng, hạn sau mở nắp và nhật ký điều kiện bảo quản khi cần.
- Đề nghị cấp vật tư, đề nghị mua, đơn đặt hàng, nhận hàng nhiều đợt và đối soát hóa đơn nhà cung cấp ở mức quản trị.
- Định mức theo dịch vụ, tiêu hao thực tế, truy xuất theo lượt thực hiện hoặc mã tham chiếu.
- Báo cáo, cảnh báo, phê duyệt, nhật ký thao tác, chuyển dữ liệu và vận hành.

Không mở rộng thành HIS/LIS, nhà thuốc, hệ thống kế toán tổng hợp hoặc quản lý vòng đời thiết bị. Thuốc kê đơn, thuốc kiểm soát đặc biệt, bảo hiểm, bảo trì/hiệu chuẩn thiết bị và chu trình tiệt khuẩn dụng cụ tái sử dụng cần dự án chuyên biệt. Module thiết bị hiện có vẫn giữ trách nhiệm quản lý thiết bị. Việc không đưa các phần này vào module vật tư không đồng nghĩa phòng khám không cần các quy trình đó.

## 2. Hiện trạng đã xác minh và giới hạn khảo sát

| Thành phần | File hiện có | Kết luận làm cơ sở triển khai |
|---|---|---|
| Giao diện vật tư | `src/pages/SupplyTab.tsx`, `src/components/supply/*` | Có danh mục, kho, nhà cung cấp, nhập/xuất, lịch sử, Excel |
| API vật tư | `server/router/supply.router.ts`, `server/controller/supply.controller.ts` | Có CRUD, nhập/xuất đơn và nhiều dòng, thống kê và xuất Excel |
| Xử lý kho | `server/service/supply.service.ts` | Cộng/trừ trực tiếp trên Supply; ghi lịch sử riêng; chưa có bộ ghi sổ nguyên tử |
| Dữ liệu | `server/model/supply.model.ts`, `server/model/supply-transaction.model.ts` | Một số tồn/lô/hạn/kho trên mỗi Supply; giao dịch chỉ có in/out |
| Danh mục hỗ trợ | `warehouse`, `supplier`, `category`, `department`, `room` | Tái sử dụng; bổ sung kiểm tra quan hệ và phạm vi truy cập |
| Phân quyền | `shared/permissions.ts`, `server/middleware/auth.ts` | Có quyền supply:read/manage; cần quyền theo tác vụ và phạm vi kho |
| Thông báo | `server/service/notification.service.ts` | Có lưu thông báo và phát Socket; cần cơ chế giao việc tin cậy sau commit |
| Chi phí | `server/model/operating-expense.model.ts` | Bản ghi chi phí đơn giản; chưa đủ để suy ra đã có công nợ mua vật tư |
| Lâm sàng | Khảo sát model/router và từ khóa liên quan | Chưa xác minh được module lượt khám/dịch vụ phù hợp; không giả định đã có |

Các rủi ro đã thấy: nhập mới ghi đè lô/hạn cũ; xuất dùng chưa chặn hết hạn ở backend; cho sửa trực tiếp quantity; xóa vật tư xóa lịch sử; ghi tồn và lịch sử chưa cùng transaction; mặc định hạn dùng một năm khi bỏ trống.

Lần kiểm tra trước chạy 4 file test liên quan: 17 test, 16 đạt, 1 lỗi tại `server/validation/supply.validation.test.ts:45` do yêu cầu hạn dùng giữa test và schema không thống nhất. Đây là mốc tham chiếu, phải chạy lại khi bắt đầu triển khai. Chưa kiểm thử vận hành trên database/trình duyệt; chưa đọc dữ liệu thật để xác định khả năng khôi phục lô; chưa xác minh topology MongoDB.

## 3. Quyết định nghiệp vụ mặc định

Các quyết định dưới đây là phương án triển khai mặc định. Người triển khai ghi thay đổi có lý do nếu khảo sát thực tế cho thấy cần điều chỉnh; không bỏ trống các quy tắc cốt lõi để lập trình viên tự suy diễn.

1. **Danh mục chung theo công ty; tồn theo chi nhánh/kho.** Một mã vật tư không nhân bản chỉ vì có nhiều kho/lô. Một kho vật lý thuộc một chi nhánh xác định. Kho dùng chung cũ cần ánh xạ rõ lúc chuyển đổi.
2. **Đơn vị cơ sở cố định sau phát sinh sổ.** Quy đổi theo từng vật tư; snapshot hệ số trên chứng từ. Không đổi hồi tố. Số lượng dùng số nguyên theo độ chính xác cấu hình, API nhận chuỗi thập phân và chuyển sang đơn vị nguyên nhỏ nhất; cấm làm tròn âm thầm hoặc vượt giới hạn an toàn.
3. **Không tự tạo hạn dùng.** Vật tư có `trackingMode` không theo lô/theo lô/theo lô và đơn vị chứa; `requiresExpiry` riêng. Hàng phải có hạn nhưng chưa xác minh được chỉ nhận vào cách ly, không xuất dùng.
4. **Hạn dùng là ngày nghiệp vụ.** Cấu hình múi giờ theo công ty, mặc định Asia/Ho_Chi_Minh. Hạn YYYY-MM-DD có hiệu lực đến hết ngày đó theo múi giờ công ty; dữ liệu chỉ có tháng/năm cần quy tắc được xác nhận và lưu độ chính xác nguồn. Thời điểm sau mở nắp được tính theo chỉ dẫn đã khai báo, không mặc định quy tắc y khoa.
5. **Ưu tiên hết hạn trước (FEFO).** Chọn hạn hiệu lực sớm nhất, tiếp theo ngày nhận và ID để kết quả xác định; vật tư không có hạn dùng chọn nhập trước. Cho đổi lô thủ công với quyền và lý do nhưng không cho vượt điều kiện chất lượng/hạn dùng.
6. **Giá quản trị theo lớp nhận hàng thực tế.** Mỗi dòng nhận hình thành lớp giá vốn; xuất theo lớp thực sự được phân bổ. FEFO là cách chọn hàng, không được gọi là phương pháp kế toán FIFO. Nếu bộ phận kế toán yêu cầu bình quân/FIFO thì chốt thay đổi trước giai đoạn 3 và thiết kế sổ giá tương ứng, không pha hai cách tính trong cùng kỳ.
7. **Tiền mặc định VND.** Tiền dùng đơn vị nguyên nhỏ nhất và giá trị gốc trên dòng; phân bổ chi phí/chiết khấu theo quy tắc xác định, phần dư vào dòng cuối hợp lệ. Lưu riêng giá trước thuế, chiết khấu, thuế, chi phí phân bổ; không tự giả định thuế được khấu trừ.
8. **Chuyển khoa/phòng chưa phải tiêu hao.** Kho tủ khoa/phòng vẫn giữ tồn. Xuất dùng mới làm giảm tồn của phòng khám và ghi chi phí quản trị. Giữ chỗ chưa triển khai; phiếu nháp/đã duyệt không cam kết còn hàng, luôn kiểm tra lại lúc ghi sổ.
9. **Chứng từ ghi sổ bất biến.** Không sửa/xóa dòng, số lượng, giá và ngày. Sai sót xử lý bằng chứng từ đảo/điều chỉnh liên kết. Không đảo phiếu nhập nếu hàng đã phát sinh sử dụng mà không giải quyết các nghiệp vụ phụ thuộc.
10. **Không ghi lùi tùy ý.** Lưu riêng ngày chứng từ thực tế và thời điểm ghi sổ. Số tồn/giá quản trị theo thứ tự ghi sổ. Kỳ đóng chặn ghi phát sinh vào kỳ đó; sửa sai bằng kỳ hiện tại và tham chiếu chứng từ cũ. Không có API đổi ngày để viết lại lịch sử.
11. **Phê duyệt một cấp, có cấu hình đơn giản.** Có thể cho lập và ghi sổ trực tiếp với nhập/xuất thông thường khi công ty bật chế độ đơn giản và người dùng đủ quyền. Hủy, chênh lệch kiểm kê, đảo phiếu, xử lý thu hồi vẫn cần quyền chuyên biệt và dấu vết; ghi rõ nếu một người kiêm vai trò duyệt.
12. **Kiểm kê khóa phạm vi kho.** Bản đầu khóa mọi biến động tồn trong kho đang kiểm kê, kể cả chuyển nhận/hoàn/tiêu hao/mở đơn vị chứa. Không khóa toàn công ty. Kho hàng đang chuyển loại trừ khỏi kiểm kê vật lý, được đối soát bằng phiếu giao nhận.
13. **Triển khai bật/tắt theo công ty.** Không cho cùng một công ty có hai bộ ghi tồn hoạt động. Thử nghiệm một kho qua đào tạo/UAT trước khi chuyển cả công ty; không dùng pilot để ghi thật song song hai sổ.

## 4. Bất biến hệ thống và mô hình dữ liệu đích

### 4.1. Bất biến phải được bảo vệ ở backend

- Mỗi số tồn bằng tổng biến động đã ghi sổ từ tồn đầu kỳ, theo đúng công ty/chi nhánh/kho/vật tư/lô/đơn vị chứa/trạng thái chất lượng.
- Không số tồn hoặc lớp giá nào âm; lượng đã hoàn/trả/đảo không vượt lượng còn được xử lý trên chứng từ gốc.
- Tổng chuyển ra bằng đã nhận + đang chuyển + tổn thất đã được ghi nhận hợp lệ; điều chuyển nội bộ không làm tăng tổng tài sản hay chi phí.
- Một sự kiện nguồn hoặc idempotency key chỉ tạo một kết quả ghi sổ; dùng lại key với payload khác trả lỗi xung đột.
- Phê duyệt ràng buộc phiên bản chứng từ. Sửa nội dung làm mất hiệu lực duyệt; hai người không thể ghi sổ hai lần.
- Trạng thái cách ly/thu hồi và ngày hết hạn được kiểm tra lúc phân bổ lẫn lúc commit; thao tác thu hồi và xuất cùng lô phải có khóa phiên bản chung để tránh race condition.
- Client không quyết định tenant, actor, người duyệt hay phạm vi quyền. ID từ URL/body/query/header đều phải kiểm tra quan hệ, kể cả tệp đính kèm và xuất báo cáo.

### 4.2. Collections và dữ liệu chính

| Model đề xuất | Trường/trách nhiệm chính |
|---|---|
| `Supply` nâng cấp | companyCode, code, name, category, baseUnit, precision, conversions, trackingMode, requiresExpiry, storageProfile, isActive; bỏ quantity khỏi nguồn dữ liệu ghi chính |
| `Warehouse` nâng cấp | branchId bắt buộc cho kho vật lý, loại main/department/transit, departmentId/roomId, vị trí con, trạng thái; hàng đang chuyển dùng kho hệ thống |
| `SupplyStockPolicy` | Ngưỡng min/max, thời gian mua dự kiến, safety stock, cảnh báo theo vật tư/kho; không dùng một ngưỡng chung cho mọi kho |
| `SupplyLot` | supplyId, số lô chuẩn hóa, nhà sản xuất nếu có, ngày SX/HSD, độ chính xác hạn nguồn, trạng thái recall, version; lô cùng số nhưng khác nguồn sản xuất cần phân biệt |
| `SupplyContainer` | Mã chai/hộp, lotId, thời điểm mở, hạn sau mở, hạn hiệu lực, version; số lượng và vị trí lấy từ balance, không giữ một số tồn cạnh tranh |
| `SupplyStockBalance` | Khóa tồn đầy đủ, quantityScaled, version; lượng khả dụng suy ra từ chính sách chất lượng/hạn hiện tại |
| `SupplyDocument` | type, number, branch/source/destination, status, revision, businessDate, postedAt, actor, approval, reason, sourceRef, reversalOf, attachment metadata |
| `SupplyDocumentLine` | documentId, lineNo, supplyId, đơn vị/hệ số snapshot, quantityScaled, giá trị, lô dự kiến, liên kết dòng nguồn; lưu riêng để giới hạn kích thước document |
| `SupplyStockLedger` | postingId, documentId/lineId/allocationNo, khóa tồn, deltaQty/deltaValue, balanceBefore/After, recordedAt; append-only qua application |
| `SupplyCostLayer` | Dòng nhập gốc, vật tư/lô/đơn vị chứa/vị trí/chất lượng, lượng và giá trị còn lại; chuyển kho/chất lượng giữ provenance lớp gốc |
| `SupplyStocktake` và lines | Phạm vi khóa, thời điểm chốt, snapshot, số đếm lần 1/lần 2, chênh lệch, lý do, người kiểm/duyệt, adjustmentDocumentId |
| `SupplyRequisition` và lines | Khoa/phòng xin cấp, cần ngày nào, lượng yêu cầu/duyệt/đã cấp/còn lại, phiếu cấp liên kết |
| `SupplyPurchaseRequest`, `SupplyPurchaseOrder` và lines | Đề nghị mua, NCC, thời hạn giao, quantity ordered/received/returned/cancelled, giá và liên kết |
| `SupplySupplierInvoice` và lines | Số hóa đơn, NCC, dòng nhận liên quan, giá/thuế/chênh lệch, trạng thái đối soát, tham chiếu tài chính; chưa đồng nghĩa bút toán kế toán |
| `SupplyServiceNorm`, `SupplyConsumption` và lines | Mã dịch vụ nội bộ/ngoài, phiên bản định mức, mã lượt thực hiện, lượng dự kiến/thực tế, kho, người thực hiện, chứng từ đã ghi |
| `SupplyQualityCase`, `SupplyStorageLog` | Cách ly/thu hồi/vi phạm bảo quản, quyết định xử lý, bằng chứng, nhiệt độ/độ ẩm và thời gian ghi nhận |
| `SupplyPeriod`, `SupplyAuditEvent`, `SupplyOperation`, `SupplyOutbox` | Khóa kỳ, audit, idempotency/result, sự kiện chờ gửi sau commit |
| `SupplyMigrationRun`, `SupplyMigrationMapping` | Run ID, checksum nguồn, mapping legacy, checkpoint, báo cáo đối chiếu |

Chưa cần tách microservice. Giữ Express/Mongoose hiện có; các nghiệp vụ cùng dùng một bộ ghi sổ. Khảo sát model audit/outbox đã có để tái sử dụng nếu đáp ứng phạm vi và tính nguyên tử, không nhân đôi chỉ vì tên khác.

### 4.3. Index và lưu trữ

- Unique: Supply(companyCode, code); balance toàn bộ khóa tồn; document(companyCode, number); line(documentId, lineNo); ledger(documentId, lineId, allocationNo, leg); operation(companyCode, operationType, key).
- Chuẩn hóa giá trị vắng mặt bằng sentinel thống nhất cho các thành phần khóa như lotId/containerId/locationId, tránh unique index cho phép nhiều biến thể null/missing/chuỗi rỗng.
- Lô: unique theo định danh nhà sản xuất/số lô đã chốt. Nếu cùng định danh nhưng khác hạn dùng, chặn nhập và yêu cầu xác minh, không sửa lô đang tồn.
- Index danh sách theo company/branch/status/postedAt/ID; lớp tồn theo kho/vật tư/hạn; truy xuất theo sourceRef và lotId; hóa đơn NCC theo company/supplier/number/series nếu có.
- Giới hạn phiếu ban đầu 200 dòng, 1.000 phân bổ; benchmark và điều chỉnh có lý do trước rollout. Phiếu vượt giới hạn không được tự tách thành các lần commit rồi trả thành công toàn bộ.
- File đính kèm giới hạn loại/kích thước, kiểm tra quyền tải xuống; không dựa vào URL upload công khai để bảo vệ chứng từ.
- Danh mục đã dùng chỉ ngừng hoạt động. Nhật ký và chứng từ không có API xóa; chính sách lưu trữ/backup được cấu hình khi vận hành, không tự đặt thời hạn hủy dữ liệu.

## 5. Bộ xử lý ghi sổ và hợp đồng API

### 5.1. Trình tự ghi sổ dùng chung

1. Xác thực actor/phạm vi; validate payload, revision, khóa kỳ và trạng thái chứng từ.
2. Chuẩn hóa đơn vị/số lượng, kiểm tra dòng trùng, nguồn liên kết và điều kiện chất lượng.
3. Nhận idempotency key và hash payload; nếu đã hoàn thành trả kết quả cũ, nếu payload khác trả 409.
4. Mở MongoDB session/transaction; đọc lại chứng từ/approval/version, khóa kho kiểm kê, phiên bản lô/container. Các thao tác thay đổi trạng thái liên quan phải cạnh tranh trên cùng bản ghi guard, tránh chỉ đọc rồi ghi các bản ghi độc lập.
5. Phân bổ lô/lớp giá và trừ tồn bằng điều kiện quantity >= requested cùng version; cập nhật theo thứ tự khóa cố định để giảm xung đột.
6. Ghi các chân sổ, lớp giá, liên kết số đã nhận/hoàn, trạng thái chứng từ, audit, operation result và outbox trong cùng transaction.
7. Commit; worker gửi thông báo/invalidation từ outbox có retry và dedup. Lỗi thông báo không hoàn tác một phiếu đã ghi sổ.
8. Xử lý retry giới hạn cho transient transaction/unknown commit result theo driver; dùng operation ID để trả đúng kết quả sau mất kết nối. Không retry vô hạn hoặc sinh phiếu mới.

Phải xác minh MongoDB replica set/sharded cluster phù hợp transaction. Môi trường không đáp ứng phải chặn bật bộ ghi mới và có hướng dẫn cấu hình; không hạ cấp âm thầm thành nhiều lệnh ghi rời.

### 5.2. Trạng thái

- Chứng từ thông thường: draft -> submitted -> approved -> posted. submitted có thể rejected; rejected quay lại draft bằng revision mới. draft/submitted/approved có thể cancelled theo quyền; posted chỉ xử lý bằng chứng từ liên kết.
- Phiếu đảo là chứng từ mới; phiếu gốc có số lượng/giá trị đã đảo và trạng thái dẫn xuất partial/full reversal. Không đặt toàn bộ phiếu là reversed nếu mới đảo một phần.
- Đề nghị cấp/mua: draft -> submitted -> approved -> partially_fulfilled -> fulfilled/closed; từ chối/hủy phần chưa thực hiện có lý do.
- Đơn mua: draft -> approved -> sent -> partially_received -> received/closed; sent là trạng thái ghi nhận gửi. Không tự gửi email NCC khi chưa có tác vụ gửi được người dùng chủ động thực hiện.
- Điều chuyển: lệnh điều chuyển liên kết phiếu dispatch và từng receipt, hiển thị pending/in_transit/partial/received/closed. Mỗi chân đã ghi sổ là chứng từ bất biến.

### 5.3. API đề xuất

Các đường dẫn tương đối so với API router hiện có. Mã mới nằm dưới `/supply-*` để tránh va chạm route động `/:id` cũ; đăng ký ở `server/router/index.ts`.

| Nhóm | Endpoint chính |
|---|---|
| Danh mục | `/supplies`, `/warehouses`, `/suppliers`; bổ sung archive, conversion và stock-policy |
| Tồn/lô | `GET /supply-balances`, `GET /supply-lots`, `GET /supply-lots/:id/trace`, `GET /supply-ledger` |
| Chứng từ | `POST/GET /supply-documents`, `GET/PATCH /supply-documents/:id`; POST các action submit/approve/reject/post/cancel/reverse |
| Phân bổ | `POST /supply-documents/:id/preview-allocation`; chỉ tư vấn, luôn phân bổ/kiểm tra lại lúc ghi |
| Điều chuyển | `/supply-transfers`; action dispatch/receive/close-discrepancy, receipt có key riêng |
| Kiểm kê | `/supply-stocktakes`; action start/count/recount/submit/approve/post/cancel |
| Xin cấp/mua | `/supply-requisitions`, `/supply-purchase-requests`, `/supply-purchase-orders`, `/supply-supplier-invoices` |
| Tiêu hao | `/supply-service-norms`, `/supply-consumptions`; action confirm/reverse; lookup theo sourceRef |
| Chất lượng | `/supply-quality-cases`, `/supply-containers`; action open/quarantine/release/recall; `/supply-storage-logs` |
| Báo cáo | `/supply-reports/stock-movement`, `/valuation`, `/consumption`, `/expiry`, `/reconciliation`, `/export-jobs` |
| Quản trị | `/supply-periods`, `/supply-audit`, `/supply-settings`; không expose migration chạy tùy ý qua API công khai |

Mỗi API phải định nghĩa schema request/response, quyền, side effect, trạng thái hợp lệ, pagination, lọc và lỗi. Không trả raw error MongoDB. Dùng mã lỗi: INSUFFICIENT_STOCK, EXPIRED_STOCK, QUALITY_BLOCKED, REVISION_CONFLICT, IDEMPOTENCY_CONFLICT, STOCKTAKE_LOCKED, PERIOD_CLOSED, SOURCE_QUANTITY_EXCEEDED. Dữ liệu ngoài phạm vi dùng 403/404 nhất quán để tránh lộ thông tin.

Danh sách mặc định 20 dòng, tối đa 100; dropdown tìm từ server có phân trang, không chỉ chọn được vật tư ở trang đang xem. Lọc và count dùng cùng scope; xếp hạng thêm ID để ổn định. Xuất lớn dùng job/file theo cùng bộ lọc và thời điểm chốt; không cắt ngầm 5.000 dòng như logic cũ.

### 5.4. Tương thích API cũ

- Trước chuyển đổi: vá các rủi ro, vẫn dùng schema legacy; sửa quantity bị từ chối và giao diện chuyển sang chứng từ điều chỉnh phù hợp.
- Sau bật V2: route nhập/xuất cũ chỉ là adapter gọi bộ ghi mới nếu payload đủ thông tin; thiếu lô/kho/đơn vị trả lỗi hướng dẫn, không ghi vào Supply.quantity nữa.
- Trường quantity ở response cũ là tổng suy ra đúng phạm vi; lô/hạn hiển thị tóm tắt, không tạo ảo giác chỉ có một lô. Loại bỏ các caller còn phụ thuộc chỉnh sửa trực tiếp.
- Lịch sử cũ hiển thị khu vực legacy chỉ đọc, có nhãn trước mốc chuyển đổi; không cộng lại vào sổ V2 đã có tồn đầu kỳ.

## 6. Phân quyền và giao diện

### 6.1. Quyền đề xuất

Mở rộng `shared/permissions.ts` và role editor với: supply:read, supply:catalog-manage, supply:document-create, supply:approve, supply:post, supply:transfer, supply:stocktake, supply:adjust, supply:dispose, supply:reverse, supply:quality-manage, supply:purchase, supply:cost-read, supply:report-export, supply:settings-manage. Backend kiểm tra đồng thời quyền và kho/chi nhánh được giao.

| Vai trò mẫu | Phạm vi |
|---|---|
| Nhân viên khoa/phòng | Xem kho được giao, xin cấp, xác nhận nhận, nhập tiêu hao/hoàn trong phạm vi |
| Thủ kho | Danh mục được phép, lập nhập/xuất/chuyển, kiểm đếm; không mặc định được duyệt hủy hoặc mở kỳ |
| Quản lý phòng khám | Duyệt, xử lý chênh lệch/hủy, báo cáo các kho trong phạm vi |
| Mua hàng/tài chính | Đề nghị/đơn mua, đối soát hóa đơn, giá trị; không tự có quyền thay đổi tồn |

Chuyển quyền supply:manage cũ bằng script mapping có báo cáo; không tự cấp quyền hủy/đảo/duyệt nhạy cảm cho tất cả người đang có manage. Giữ quyền đọc tương thích. Test quyền trực tiếp từ HTTP, không chỉ ẩn nút.

### 6.2. Các màn hình phải bàn giao

1. Tổng quan kho: tồn thấp, hạn, phiếu chờ, kiểm kê, cảnh báo; không cộng các đơn vị không tương đương thành KPI gây hiểu nhầm.
2. Danh mục và chi tiết: cấu hình tracking/quy đổi; tồn theo kho/lô, thẻ kho, lớp nhận, tệp, audit.
3. Chứng từ: danh sách lọc, soạn nhiều dòng, chọn đơn vị/lô, xem phân bổ, duyệt, ghi sổ, in, đảo một phần/toàn phần.
4. Xin cấp và điều chuyển: lượng còn cần cấp, nguồn/đích, giao/nhận nhiều đợt, hàng đang chuyển, chênh lệch.
5. Kiểm kê: chọn kho, cảnh báo khóa, bảng đếm không hiển thị tồn hệ thống cho người đếm mặc định, đếm lại, duyệt điều chỉnh.
6. Mua hàng: đề nghị, đơn mua, tiến độ nhận, đối soát giá/hóa đơn; không đánh dấu đã trả tiền chỉ vì đã nhận hàng.
7. Tiêu hao: dịch vụ/mã lượt tham chiếu, định mức, số thực tế, lô, lý do chênh lệch, hoàn/đảo.
8. Chất lượng: cách ly/thu hồi/hủy, truy xuất lô, chai đã mở, nhật ký bảo quản.
9. Báo cáo: kỳ, chi nhánh, kho, vật tư/lô, khoa/phòng; drill-down đến chứng từ; xuất/in.
10. Cấu hình: quyền/phạm vi, ngưỡng cảnh báo, chính sách duyệt, kỳ kho, đơn vị, vị trí, mẫu chứng từ.

Tái sử dụng components hiện tại khi phù hợp nhưng tách SupplyTab thành workspace nhỏ; không dồn mọi luồng vào một modal. Có loading/empty/error, chống submit lặp, giữ draft khi lỗi mạng, thông báo xung đột phiên bản dễ hiểu. Trạng thái còn hàng/hạn/chất lượng hiển thị riêng thay vì một enum che mất thông tin.

## 7. Backlog thực hiện theo thứ tự phụ thuộc

Các mã CV dùng để theo dõi tiến độ. Mỗi CV chỉ hoàn tất khi code, UI liên quan, test, migration/permission và tài liệu đều đạt tiêu chí. Không coi mock UI hoặc endpoint chưa nối là hoàn tất.

### CV-01 — Khảo sát và chốt hợp đồng dữ liệu

Phụ thuộc: không. File chính: tài liệu này; tạo `docs/supply/domain-design.md`, `docs/supply/api-contract.md`, `docs/supply/decision-log.md`.

- [ ] Chạy lại test nền; ghi các lỗi có sẵn và phạm vi.
- [ ] Kiểm tra AGENTS/quy ước hiện hành, caller API, role editor, audit/jobs và export dùng chung.
- [ ] Kiểm tra MongoDB transaction bằng metadata cấu hình không in URI/secret; khảo sát dữ liệu qua script chỉ đọc và báo cáo tổng hợp.
- [ ] Thống kê quy mô vật tư/giao dịch, đơn vị, kho không có chi nhánh, dòng trùng, lô/hạn thiếu, chênh lệch lịch sử.
- [ ] Xác nhận điểm tích hợp dịch vụ/tài chính: nếu chưa có, dùng phương án tối thiểu CV-10/CV-11 bên dưới.
- [ ] Chốt schema, quy tắc tại mục 3, index, từ điển thuật ngữ phiếu/lô và mẫu chứng từ.

Nghiệm thu: không còn quyết định bỏ trống về đơn vị, hạn, giá, khóa kỳ, scope và phương án tích hợp. Có số liệu để ước lượng lại khối lượng/migration.

### CV-02 — Vá rủi ro trên đường ghi hiện tại

Phụ thuộc: CV-01. Sửa `server/service/supply.service.ts`, `server/validation/supply.validation.ts`, controller/router và form hiện tại.

- [ ] Chặn xuất dùng hết hạn tại backend; cập nhật frontend tương ứng.
- [ ] Cấm sửa quantity bằng CRUD; với tồn đầu kỳ tạo đường ghi có lịch sử. Archive thay xóa cứng/lịch sử.
- [ ] Bỏ mặc định hạn một năm; bổ sung trạng thái không áp dụng/chưa xác minh tương thích schema trước migration.
- [ ] Kiểm tra company/branch/warehouse và tham chiếu NCC/phòng; không chỉ regex ObjectId.
- [ ] Gộp/kiểm tra tổng các dòng trùng; xử lý đủ phiếu nguyên tử và khóa cập nhật nếu tiếp tục cho legacy ghi thật trước CV-05.
- [ ] Sửa test hạn dùng theo quy tắc mới; ghi rõ đây không sửa được dữ liệu lô từng bị ghi đè.

Nghiệm thu: không xuất hết hạn, không sửa tồn/xóa lịch sử trực tiếp, không ghi một phần phiếu; migration vẫn đọc được dữ liệu cũ. Nếu chưa có transaction phải hoàn tất hạ tầng trước mở lại đường ghi liên quan, không phát hành bản vá nửa vời.

### CV-03 — Schema mới, số học và phân quyền

Phụ thuộc: CV-01; triển khai nối tiếp CV-02 để tránh xung đột đường ghi.

- [ ] Tạo models/interfaces/validation cho danh mục nâng cấp, lô/container, balance, document/line, ledger, cost layer, operation/outbox, stock policy và kỳ.
- [ ] Tạo `server/service/supply/quantity.ts`, `expiry.ts`, `scope.ts`, `valuation.ts` và kiểm thử biên.
- [ ] Mở rộng Warehouse với loại kho/vị trí/phạm vi và script mapping; giữ dữ liệu tên cũ để tra cứu.
- [ ] Tạo index migration có dry-run và báo trùng; không tạo unique index trên dữ liệu chưa chuẩn hóa.
- [ ] Bổ sung permission catalog, role mapping, scope helper; tách cost-read khỏi quyền xem số lượng.

Nghiệm thu: schema/index tạo được trên database test; đơn vị lẻ và tiền phân bổ không trôi số; truy cập chéo bị chặn.

### CV-04 — Bộ ghi sổ nguyên tử

Phụ thuộc: CV-03. Tạo `server/service/supply/posting.service.ts`, `allocation.service.ts`, `document.service.ts`, `reconciliation.service.ts` và worker outbox theo pattern dự án.

- [ ] Thực hiện đầy đủ trình tự mục 5.1; counter số phiếu nguyên tử, unique number và revision check.
- [ ] FEFO/FIFO không hạn, chia lượng qua nhiều lô/lớp nhận, xử lý snapshot đơn vị/giá.
- [ ] Nhập tồn đầu kỳ/nhập mua/xuất dùng/đảo phiếu qua cùng engine.
- [ ] Tạo outbox và dedup; query operation phục hồi trạng thái request sau timeout.
- [ ] Tạo lệnh đối soát chỉ đọc ledger/balance/layer và cảnh báo lệch; không tự sửa lệch bằng cập nhật trực tiếp balance.
- [ ] Test transaction với MongoDB replica set test thật: đồng thời, rollback, key trùng, race recall/kiểm kê/khóa kỳ.

Nghiệm thu: đủ mọi bất biến mục 4.1, không phụ thuộc UI để bảo vệ dữ liệu.

### CV-05 — Nhập/xuất, lô và chứng từ trên giao diện

Phụ thuộc: CV-04. Sửa `src/pages/SupplyTab.tsx`, `src/components/supply/*`, `src/services/supplyService.ts`, `src/types/supply.ts`; tạo service/type/workspace theo nhóm.

- [ ] Nối danh mục, số tồn và chi tiết lô/kho từ API mới.
- [ ] Form nhập nhiều lô của cùng vật tư, đơn vị quy đổi, hạn và bằng chứng kiểm nhận.
- [ ] Form xuất có preview phân bổ, quyền chọn lô và kiểm tra lại lúc post.
- [ ] Luồng nháp/gửi/duyệt/từ chối/ghi sổ/hủy nháp/đảo; số phiếu và mẫu in có người giao/nhận.
- [ ] Adapter API cũ và feature flag theo công ty; chặn mọi legacy writer sau bật V2.
- [ ] Lịch sử legacy có nhãn; xuất Excel dùng cùng nguồn dữ liệu mới và scope.

Nghiệm thu: người dùng thực hiện nhập hai lô, xuất qua hai lô, tra cứu và in phiếu hoàn chỉnh; refresh không mất kết quả ghi đã thành công.

### CV-06 — Xin cấp và điều chuyển

Phụ thuộc: CV-05. Tạo models/service/controller/router/UI cho requisition và transfer.

- [ ] Phiếu khoa/phòng xin cấp, duyệt số lượng, cấp nhiều đợt; tổng đã cấp không vượt đã duyệt trừ khi có revision mới.
- [ ] Dispatch: giảm kho nguồn, tăng kho transit; receipt: giảm transit, tăng kho đích, giữ lô và giá gốc.
- [ ] Nhận thiếu một phần, hàng còn chờ nhận, chuyển trả nguồn; tổn thất phải có case và chứng từ riêng được duyệt.
- [ ] Quyền thao tác hai đầu; người nhận không có quyền sửa kho nguồn. Chuyển liên chi nhánh chỉ trong cùng company và với quyền phù hợp.
- [ ] Từ chối/hủy chỉ phần chưa dispatch; không xóa hàng đang chuyển bằng đổi status.

Nghiệm thu: gửi 100, nhận 60 rồi 40 cho kết quả đúng; nhận trùng/sai kho/vượt lượng bị chặn; tổng giá trị công ty không đổi.

### CV-07 — Hoàn trả, trả NCC, hủy, cách ly và thu hồi

Phụ thuộc: CV-05/CV-06.

- [ ] Hoàn hàng đã xuất dùng phải liên kết lần xuất và kiểm tra lượng còn được hoàn; nhập cách ly mặc định đến khi kiểm chất lượng.
- [ ] Hàng khoa/phòng chưa tiêu hao trả kho chính là điều chuyển, tránh tạo tồn hai lần.
- [ ] Trả NCC liên kết lớp nhập, giữ giá gốc, giới hạn số tồn và lượng chưa trả; theo dõi ảnh hưởng đơn mua/hóa đơn sau CV-11.
- [ ] Chuyển available/quarantine/damaged bằng các chân sổ đối ứng, không làm đổi tổng tồn.
- [ ] Thu hồi theo lô chặn xuất ngay, tìm tồn tất cả kho/transit và lịch sử tiêu hao; phát danh sách công việc xử lý từng vị trí.
- [ ] Hủy hàng cần lý do, bằng chứng và duyệt; phân biệt hủy tồn với đảo chứng từ sai.

Nghiệm thu: không xuất được lô thu hồi qua bất cứ API nào; tổng hoàn/trả không vượt nguồn; báo cáo truy xuất có cả tồn và sử dụng đã xảy ra.

### CV-08 — Kiểm kê và kỳ kho

Phụ thuộc: CV-07.

- [ ] Tạo phiên, khóa kho bằng guard dùng chung engine, snapshot số lượng/giá; kiểm tra xung đột trước bắt đầu.
- [ ] Nhập đếm theo lô/vị trí/container, nhập Excel có preview lỗi; yêu cầu người đếm lại cho chênh lệch.
- [ ] Mất hàng sinh điều chỉnh giảm theo lớp giá hiện hữu; phát hiện dư cần lô/giá có căn cứ hoặc cách ly và đánh dấu chưa xác minh, không mặc định giá 0 rồi báo cáo như đã định giá.
- [ ] Duyệt và post một lần, giải phóng khóa sau commit. Hủy phiên giữ biên bản; khóa không tự hết hạn giữa lúc đếm, có quy trình quản trị phục hồi phiên bị bỏ dở.
- [ ] Đóng kỳ khi đối soát đạt và không có phiên kiểm kê dở; ghi snapshot báo cáo. Sai kỳ cũ điều chỉnh kỳ hiện tại.

Nghiệm thu: mọi đường thay đổi tồn trong kho đang kiểm đều bị chặn; submit/post lặp không tạo hai phiếu điều chỉnh; biên bản giải thích được toàn bộ chênh lệch.

### CV-09 — Chai/hộp đã mở và bảo quản

Phụ thuộc: CV-07/CV-08.

- [ ] Tạo container khi cần; việc mở tạo định danh và chuyển đúng lượng từ tồn chưa mở sang container trong transaction, không nhân đôi tồn.
- [ ] Hạn hiệu lực là hạn sớm hơn giữa hạn hãng và hạn sau mở; policy thời gian do người có quyền khai báo dựa trên sản phẩm.
- [ ] Ghi và sửa nhật ký nhiệt độ/độ ẩm theo revision/audit; báo giá trị bất thường và thiếu nhật ký theo lịch cấu hình.
- [ ] Vi phạm bảo quản tạo quality case; cấu hình có thể cách ly số tồn liên quan, người có quyền quyết định release/hủy với bằng chứng.
- [ ] Truy xuất container khi chuyển kho/hoàn; chỉ có một phiên mở hợp lệ, không mở lại để gia hạn.

Nghiệm thu: hai chai cùng lô mở khác ngày có hạn và phân bổ riêng; không xuất container hết hạn dù hạn lô còn dài.

### CV-10 — Định mức và tiêu hao thực tế

Phụ thuộc: CV-05/CV-07/CV-09 đối với vật tư dạng container.

- [ ] Tạo danh mục tham chiếu dịch vụ và phiên bản định mức; áp dụng từ ngày hiệu lực, không sửa định mức đã dùng.
- [ ] Phiếu thực hiện có sourceSystem/sourceId/sourceRevision, serviceCode, khoa/phòng, người thực hiện, thời gian, kho xuất và lượng thực tế.
- [ ] Chênh lệch định mức cần lý do theo ngưỡng; hỗ trợ tiêu hao dùng chung, thử nghiệm/QC và hao hụt có phân loại.
- [ ] Nếu chưa có module lâm sàng: bàn giao màn hình nhập trực tiếp với mã lượt tham chiếu; không tự tạo HIS. Trạng thái thực hiện được người có quyền xác nhận.
- [ ] Nếu có module phù hợp sau khảo sát: adapter nhận sự kiện hoàn thành có idempotency; chỉ lúc thực hiện mới ghi tiêu hao, không dựa vào đặt lịch/thu tiền.
- [ ] Khi thiếu tồn, hiển thị trạng thái chưa ghi kho và công việc xử lý; không âm thầm báo thành công hoặc chặn lưu hồ sơ lâm sàng chỉ vì kho lỗi. Retry/reconcile có cùng source key.
- [ ] Hủy lượt thực hiện không tự hoàn vật tư đã thực sự dùng; phân biệt sửa ghi nhầm với hoàn hiện vật, yêu cầu xác nhận phù hợp rồi dùng chứng từ liên kết.
- [ ] Chỉ lưu định danh bệnh nhân tối thiểu khi cần và được phép; quyền xem chi tiết bệnh nhân tách khỏi thủ kho, không đưa thông tin bệnh nhân vào log/export kho mặc định.

Nghiệm thu: cùng sự kiện gửi lại không trừ hai lần; sửa số thực tế có lịch sử; báo cáo theo dịch vụ dẫn đến đúng phiếu/lô. Tích hợp ngoài chưa có phải ghi rõ trạng thái, không tuyên bố hoàn thành tích hợp bằng adapter giả.

### CV-11 — Mua hàng và đối soát tài chính

Phụ thuộc: CV-05/CV-07.

- [ ] Đề nghị mua từ thủ công hoặc gợi ý tồn, duyệt, tạo đơn NCC; lưu giá/đơn vị/thuế/chiết khấu/ngày giao dự kiến.
- [ ] Nhận từng đợt vào phiếu nhập; số còn đặt = số đặt - đã nhận hợp lệ - hủy phần còn lại, xử lý trả hàng bằng quy tắc rõ cho có/không đặt bù.
- [ ] Nhận vượt mặc định chặn; sửa đơn hoặc duyệt phần vượt bằng phiên bản mới. Giá nhận khác giá đặt có lý do và quyền duyệt.
- [ ] Đối soát đơn mua - phiếu nhận - hóa đơn; nhận hóa đơn sau vẫn giữ giá tạm có trạng thái rõ. Điều chỉnh giá bằng chứng từ giá trị: phân bổ phần còn tồn và phần đã tiêu hao, không sửa giá lịch sử.
- [ ] Tạo theo dõi phải trả quản trị từ hóa đơn đã xác nhận, credit note/trả NCC và chứng từ thanh toán được nhập hoặc đồng bộ với tài chính; chống trùng theo externalRef.
- [ ] Nếu chưa có công nợ/thanh toán phù hợp: bàn giao sổ theo dõi thanh toán tham chiếu và xuất đối soát, không tự thực hiện chuyển tiền. Nếu tái sử dụng module có sẵn phải test transaction/idempotency liên kết.
- [ ] Không tự tạo OperatingExpense mỗi lần nhập rồi thêm một lần khi tiêu hao. Định nghĩa một nguồn cho mua hàng, phải trả/thanh toán và chi phí tiêu hao; báo cáo quản trị phân biệt ba khái niệm.

Nghiệm thu: đặt 100, nhận 60+40, trả 10, hóa đơn/credit note/thanh toán một phần có số dư đúng; nhận hàng không bị coi là đã thanh toán.

### CV-12 — Báo cáo, cảnh báo và công cụ sử dụng

Phụ thuộc: CV-06 đến CV-11 cho báo cáo từng nghiệp vụ.

- [ ] Tồn đầu + nhập - xuất = tồn cuối theo kỳ/kho/lô/chất lượng; định nghĩa rõ chuyển kho trong báo cáo một kho và toàn công ty.
- [ ] Giá trị tồn theo lớp nhận, chi phí tiêu hao theo khoa/dịch vụ, hủy/hỏng, chênh lệch kiểm kê, tiến độ đơn mua và phải trả quản trị.
- [ ] Thẻ kho drill-down, số tồn ở thời điểm chốt, đối soát lớp giá/ledger/balance; giá chưa xác minh hiển thị thiếu dữ liệu, không cộng như giá 0 đã biết.
- [ ] Cảnh báo tồn min/max, sắp hết hạn 30/60/90 ngày cấu hình, quá hạn, tồn lâu không dùng, hàng đang chuyển quá lâu, phiếu chờ và thiếu nhật ký.
- [ ] Gợi ý mua từ tốc độ tiêu hao thực tế, lead time, safety stock và đơn đang chờ nhận; không dùng điều chuyển làm số tiêu hao. Dữ liệu chưa đủ phải ghi rõ thay vì dự báo chắc chắn.
- [ ] Worker alert/outbox có unique dedup theo điều kiện/đối tượng/kỳ; ACK/snooze và mở lại khi tái phát, retry có giới hạn và theo dõi job lỗi.
- [ ] Excel/PDF/mẫu in có bộ lọc và thời điểm chốt, phân quyền tải; chống spreadsheet formula injection, tên file an toàn; không cắt ngầm số dòng.
- [ ] Barcode/QR tùy chọn cho vật tư/lô/container/vị trí, tìm kiếm bằng máy quét kiểu bàn phím; nhãn không chứa dữ liệu bệnh nhân. Import danh mục có preview/validate và kết quả từng dòng; import số tồn chỉ qua phiếu tồn đầu/kiểm kê.

Nghiệm thu: tổng chi tiết bằng tổng báo cáo; UI và export cùng bộ lọc/thời điểm; không spam cảnh báo hay tiết lộ giá cho người thiếu cost-read.

### CV-13 — Migration, rehearsal và UAT

Phụ thuộc: CV-01 cho công cụ khảo sát; hoàn tất sau CV-12. Tạo `server/scripts/migrate-supply-v2.ts`, `verify-supply-v2.ts`, `docs/supply/migration-runbook.md`, `uat-checklist.md`.

- [ ] Triển khai quy trình chi tiết ở mục 8, dry-run/apply/verify/resume theo migrationRunId.
- [ ] Chuẩn bị database test replica set và seed chỉ chứa dữ liệu giả; rehearsal từ bản sao dữ liệu được phép, không dùng unit test kết nối production.
- [ ] Chạy UAT với thủ kho, khoa/phòng, quản lý và tài chính theo kịch bản mục 9; có người chịu trách nhiệm ký nghiệm thu từng nhóm.
- [ ] Đào tạo bằng phiếu mẫu và hướng dẫn xử lý sai sót, mạng lỗi, hàng thiếu, trả/hủy/kiểm kê.
- [ ] Chốt mapping quyền, dữ liệu chưa xác minh, kết quả đối chiếu và kế hoạch rollback/forward-fix.

Nghiệm thu: rehearsal chuyển dữ liệu chạy lại không nhân đôi; các báo cáo đạt; không còn lỗi làm sai tồn, mất lịch sử hoặc vượt quyền.

### CV-14 — Triển khai và theo dõi sau chuyển đổi

Phụ thuộc: CV-13.

- [ ] Deploy code ở chế độ chưa bật writer V2; tạo indexes đã kiểm tra, kiểm tra transaction/worker/export và backup phục hồi được.
- [ ] Chốt maintenance window theo kết quả rehearsal, dừng writer kho ở API và worker, drain request đang chạy, kiểm tra không còn job ghi dở.
- [ ] Snapshot nguồn, apply migration, verify toàn bộ công ty; dữ liệu chưa xác minh đưa vào cách ly đúng mapping.
- [ ] Bật V2 theo công ty; chặn writer legacy, mở thao tác, kiểm tra phiếu thật đầu tiên cùng người phụ trách kho.
- [ ] Theo dõi hằng ngày trong ít nhất 7 ngày vận hành: reconciliation, giao dịch lỗi, pending outbox, phiếu đang chuyển, alert và phản hồi người dùng.
- [ ] Đóng bàn giao khi các điều kiện mục 10 đạt; lưu runbook, owner và danh sách cải tiến không chặn vận hành.

Nghiệm thu: kho vận hành được với người dùng thực tế, không chỉ build/test thành công.

## 8. Chuyển dữ liệu và phục hồi

### 8.1. Nguyên tắc nguồn dữ liệu

- Lưu bản sao bất biến của Supply và SupplyTransaction cũ trước chuyển đổi, có số bản ghi/checksum và mốc thời gian.
- Không dựng lại lịch sử lô một cách chắc chắn từ trường batchNumber hiện tại. Số tồn cũ có thể đúng tổng nhưng sai phân bổ lô; cần kiểm kê thực tế hoặc bằng chứng nguồn.
- Sổ V2 bắt đầu bằng chứng từ tồn đầu kỳ tại thời điểm chuyển. Lịch sử legacy giữ nguyên để tra cứu và không được phát lại vào cùng balance.
- Tồn không xác minh được lô/hạn/giá ghi rõ provenance, cách ly, người phụ trách xử lý. Không tạo một lô giả có hạn tùy ý rồi cho xuất.
- Cùng mã vật tư ở nhiều biểu diễn cũ chỉ gộp khi đơn vị/tracking tương thích và mapping được xác nhận. Không gộp chỉ theo tên gần giống.

### 8.2. Các bước script

1. `inspect`: đọc nguồn, phát hiện thiếu/trùng, xuất báo cáo mapping và số liệu tổng hợp không chứa secrets.
2. `dry-run`: tính danh mục/lô/kho/lớp giá dự kiến, tồn đầu và các lỗi chặn; không ghi nghiệp vụ.
3. `prepare`: tạo indexes và mapping đã duyệt trên môi trường mục tiêu, lấy lease migration theo công ty để chỉ một run apply.
4. `apply`: writer đã dừng; ghi theo các nhóm có checkpoint, unique legacySource/run key và checksum. Migration nhiều nhóm không giả vờ là một transaction toàn công ty; V2 vẫn đóng đến khi tất cả nhóm verify đạt.
5. `verify`: đối chiếu từng vật tư/kho/lô đã xác minh, tổng lượng theo đơn vị cơ sở, tổng giá trị đã biết, số dòng chưa định giá, referential integrity, ledger/balance/layer và quyền.
6. `resume`: chỉ tiếp tục run cùng snapshot/checksum; nguồn thay đổi thì dừng và lập run mới có kiểm soát.
7. `activate`: lưu cutover marker và cấu hình V2; đưa báo cáo vào thư mục vận hành hạn chế quyền.

### 8.3. Rollback và forward-fix

- Trước khi mở ghi V2: có thể hủy run chưa kích hoạt theo mapping, phục hồi snapshot nếu cần và mở writer cũ sau verify; không xóa theo truy vấn rộng thiếu run/company.
- Sau khi có giao dịch V2 thật: không tắt cờ quay về legacy rồi bỏ giao dịch mới. Dừng ghi, lưu toàn bộ chứng từ phát sinh, ưu tiên sửa và đối soát trên V2. Nếu buộc phục hồi snapshot phải có kế hoạch phát lại đã thử nghiệm; legacy không biểu diễn được nhiều lô nên không mặc định có thể nhận ngược dữ liệu V2.
- Ghi quyết định phục hồi, người phụ trách, mốc dữ liệu và kết quả kiểm chứng. RPO cho giao dịch đã xác nhận là không bỏ mất giao dịch; RTO mục tiêu được chốt sau diễn tập, không cam kết số giờ khi chưa đo.

## 9. Ma trận kiểm thử và UAT bắt buộc

| ID | Tình huống | Kết quả cần đạt |
|---|---|---|
| T01 | Nhập 100 lô A, 200 lô B khác hạn | Tồn tách 100/200; metadata A không đổi |
| T02 | Xuất 150, A hết hạn trước B | Phân bổ 100 A + 50 B khi cả hai hợp lệ, giá theo lớp thực tế |
| T03 | A hết hạn/cách ly/thu hồi | Không phân bổ A cho dùng; vẫn cho nghiệp vụ xử lý hợp lệ như hủy/trả theo quyền |
| T04 | Hai request cùng xuất 8 khi chỉ còn 10 | Chỉ một request thành công, tồn 2, không ghi lịch sử phiếu thất bại |
| T05 | Gửi lại key, retry sau mất phản hồi commit | Một chứng từ và một bộ chân sổ; key cùng payload trả kết quả cũ, payload khác lỗi |
| T06 | Lỗi dòng thứ hai hoặc tạo ledger lỗi | Rollback cả phiếu, số tồn/giá không đổi |
| T07 | Cùng vật tư xuất trùng nhiều dòng | Kiểm tra tổng và phân bổ đủ, không lách giới hạn tồn |
| T08 | Nhập 2 hộp x 100 cái; xuất 15 cái | Tồn 185 cái; snapshot quy đổi giữ nguyên sau sửa danh mục |
| T09 | Xuất ml/số thập phân, giá phân bổ dư | Không sai số tích lũy; tổng giá trị dòng/phiếu/lớp khớp |
| T10 | Hai chai cùng lô mở khác ngày | Hạn riêng, lượng chỉ xuất hiện một lần, không mở lại để kéo hạn |
| T11 | Dispatch 100, nhận 60 + retry + 40 | Tổng nhận 100, transit 0; retry không nhân đôi |
| T12 | Hoàn 5 của phiếu xuất 10 rồi hoàn thêm 6 | Phiếu sau bị chặn; kiểm tra cả trường hợp thao tác đồng thời |
| T13 | Kiểm kê thiếu/dư, post lặp, phiên bỏ dở | Một phiếu điều chỉnh; bảo toàn audit; khóa phục hồi có kiểm soát |
| T14 | Ghi sổ trong lúc bắt đầu kiểm kê/đóng kỳ/recall | Không lọt giao dịch do race giữa guard và balance |
| T15 | Đảo phiếu nhập đã có tiêu hao | Chặn đảo đơn giản và chỉ rõ phụ thuộc cần giải quyết |
| T16 | Truy cập ID/URL tệp/export khác tenant/branch | Bị từ chối, không lộ tồn/giá/tài liệu |
| T17 | Người có read gọi post/approve, thiếu cost-read | Backend từ chối action; UI/export không lộ giá |
| T18 | Hai người sửa hoặc duyệt bản nháp cũ | Conflict revision; không ghi bản sửa chưa duyệt |
| T19 | Sự kiện dịch vụ gửi lại/hủy sau đã dùng thật | Không trừ hai lần; không tự tăng tồn hiện vật khi hủy dịch vụ |
| T20 | Đặt 100 nhận 60+40, trả 10, thanh toán một phần | Tiến độ mua, tồn và phải trả quản trị khớp; không ghi chi phí hai lần |
| T21 | Hóa đơn sau làm đổi giá nhận | Có chứng từ giá trị và phân bổ phần tồn/đã dùng, không sửa lịch sử |
| T22 | UI và Excel cùng bộ lọc/kỳ, trên 5.000 dòng | Tổng nhất quán, không cắt ngầm, xuất theo quyền và mốc chốt |
| T23 | Qua nửa đêm múi giờ công ty | Hạn chuyển đúng quy tắc dù vật tư không vừa được cập nhật |
| T24 | Worker thông báo chết sau commit | Phiếu vẫn tồn tại đúng; worker chạy lại không spam |
| T25 | Migration chạy lại hoặc nguồn đổi giữa resume | Không nhân đôi; nguồn khác checksum bị chặn |
| T26 | Chênh lệch legacy, giá/lô không biết | Được báo và cách ly/chưa định giá, không dựng số liệu giả |
| T27 | Tổng công ty qua điều chuyển và đổi chất lượng | Không tăng/giảm tổng lượng hay giá trị do chuyển nội bộ |
| T28 | Kỳ đã đóng, ngày chứng từ cũ | Không ghi lùi thay đổi kỳ; điều chỉnh kỳ hiện tại có tham chiếu |

Các lớp kiểm thử:

- Unit cho số học, hạn, phân bổ, quyền và trạng thái có nhiều nhánh; không viết test chỉ để kiểm tra tên trường.
- Integration với MongoDB replica set test cho atomicity/concurrency/index/migration. Mock Mongoose không đủ chứng minh rollback.
- HTTP test quyền/scope/validation/idempotency và các route adapter cũ.
- UI test các luồng quan trọng bằng Testing Library; UAT trình duyệt cho nhập/xuất/chuyển/kiểm kê/in/export.
- Kiểm tra build và typecheck sau mỗi nhóm thay đổi có liên quan; lint theo phạm vi được cấu hình. Script lint hiện tại chỉ phủ một số file, không xem nó là kiểm tra đầy đủ module mới.
- Benchmark trên seed dự kiến 5.000 vật tư, 50.000 bản ghi tồn và 500.000 chân sổ; điều chỉnh theo khảo sát CV-01. Mục tiêu ban đầu: p95 danh sách < 1,5 giây, ghi phiếu 20 dòng < 3 giây ở tải 10 người thao tác đồng thời trên cấu hình staging đã ghi lại. Báo cáo lớn chạy nền; ngưỡng này là mục tiêu nghiệm thu cần đo, không phải kết quả đã có.

Lệnh nền hiện dùng được trong repo:

```powershell
node node_modules/vitest/vitest.mjs run server/service/supply.service.test.ts server/validation/supply.validation.test.ts server/validation/supply-batch.validation.test.ts server/validation/warehouse.validation.test.ts
npm run typecheck
npm run build
```

Khi tạo test mới, bổ sung script chạy riêng unit/integration/UI ở package.json với URL database test bắt buộc và guard chống kết nối nhầm môi trường thật. Không chạy toàn bộ suite liên tục nếu không có thay đổi liên quan; hoàn tất kiểm tra regression cần thiết trước mỗi đợt bàn giao.

## 10. Triển khai, giám sát và điều kiện hoàn thành

### 10.1. Các đợt bàn giao

| Đợt | Công việc | Điều kiện ra khỏi đợt |
|---|---|---|
| A | CV-01 đến CV-05 | Danh mục/lô/kho, chứng từ và engine được chứng minh đúng; migration sơ bộ chạy trên test |
| B | CV-06 đến CV-09 | Xin cấp, điều chuyển, hoàn/hủy, kiểm kê, chất lượng và container trọn luồng |
| C | CV-10 đến CV-12 | Tiêu hao, mua hàng, đối soát, báo cáo/cảnh báo hoàn chỉnh |
| D | CV-13 đến CV-14 | Chuyển đổi đã diễn tập, UAT đạt, vận hành và bàn giao |

Ước lượng sơ bộ để lập nguồn lực, chưa phải cam kết lịch: A 20–30 ngày công kỹ thuật, B 20–30, C 20–35, D 10–20; tổng 70–115 ngày công, gồm kiểm thử và tài liệu thông thường, chưa tính chờ xác minh dữ liệu/đào tạo ngoài lịch. Cập nhật ước lượng sau CV-01 và mỗi đợt; lịch thực tế phụ thuộc nhân sự và hệ thống cần tích hợp. Không suy ra số tuần bằng cách chia máy móc ngày công cho số người vì engine/migration có phụ thuộc tuần tự.

### 10.2. Theo dõi vận hành

- Dashboard kỹ thuật: posting success/failure/latency, transaction conflict/retry, idempotency conflict, outbox age/error, export jobs, migration state.
- Đối soát hằng ngày: ledger với balance, lớp giá, lượng đang chuyển, phiên kiểm kê bỏ dở, số tồn/giá chưa xác minh. Lệch sổ có cảnh báo chủ động và owner xử lý.
- Log có company/branch/document/operation/correlation ID nhưng không có secret, URI database hoặc dữ liệu bệnh nhân không cần thiết.
- Backup định kỳ và phục hồi thử trên môi trường tách biệt; có hướng dẫn dừng ghi, verify và mở lại.
- Owner nghiệp vụ: người phụ trách kho; owner kỹ thuật: người bảo trì ứng dụng; owner đối soát giá/mua: bộ phận tài chính. Gán người cụ thể khi triển khai.

### 10.3. Checklist hoàn thành toàn bộ

- [ ] CV-01 đến CV-14 có trạng thái/kết quả và liên kết PR hoặc commit thực hiện.
- [ ] Không còn writer trực tiếp thay đổi số tồn ngoài posting engine, kể cả script/admin/adapter/worker.
- [ ] Mọi biến động tồn và giá đều có chứng từ, actor, thời điểm, source và đường truy xuất.
- [ ] T01–T28 đạt theo phạm vi cấu hình; các tính năng điều kiện như container đã có khả năng cấu hình và test dù một công ty chưa dùng.
- [ ] Các màn hình mục 6.2 dùng được với quyền thật; không còn nút giả hoặc dữ liệu mẫu thay nghiệp vụ.
- [ ] Không có lỗi nghiêm trọng về âm/sai tồn, nhân đôi phiếu, mất lịch sử, lộ dữ liệu hoặc chặn luồng chính.
- [ ] Số tồn/giá đã xác minh đối chiếu đạt; phần chưa xác minh được cách ly và có biên bản/owner, không bị che trong tổng báo cáo.
- [ ] Tích hợp có thật được kiểm thử end-to-end; phần nhập trực tiếp/tham chiếu ngoài được ghi rõ, không gắn nhãn đã tích hợp HIS/LIS/kế toán khi chưa có.
- [ ] Migration và phục hồi đã rehearsal; báo cáo chuyển đổi được lưu, legacy chỉ đọc.
- [ ] Tài liệu sử dụng, API, thiết kế, vận hành, mapping quyền và quyết định nghiệp vụ đã cập nhật theo code cuối cùng.
- [ ] Theo dõi sau chuyển đổi đạt, người phụ trách kho và các bên liên quan nghiệm thu.

## 11. Rủi ro chính và cách xử lý trong kế hoạch

| Rủi ro | Cách xử lý | Công việc chịu trách nhiệm |
|---|---|---|
| Lô cũ bị ghi đè, không thể dựng lại chính xác | Kiểm kê/mapping bằng chứng, cách ly phần không xác minh; giữ legacy | CV-01, CV-13 |
| MongoDB chưa hỗ trợ transaction | Xác minh và cấu hình trước mở writer; test replica set | CV-01 đến CV-04 |
| UI cũ hoặc script vẫn ghi quantity | Rà caller, adapter, chặn ở service/schema, kiểm tra sau bật cờ | CV-02, CV-05, CV-14 |
| Giá và đơn vị thay đổi làm sai lịch sử | Snapshot, số học chính xác, lớp giá/chứng từ điều chỉnh | CV-03, CV-04, CV-11 |
| Thiếu module khám/tài chính để tích hợp | Phiếu tham chiếu tối thiểu và hợp đồng adapter rõ; không dựng hệ thống ngoài scope | CV-10, CV-11 |
| Thu hồi/khóa kỳ/kiểm kê chạy đua với xuất | Guard/version cùng transaction, kiểm thử đồng thời | CV-04, CV-07, CV-08 |
| Chuyển hệ thống làm mất giao dịch mới | Maintenance/drain, run checkpoint, forward-fix sau cutover | CV-13, CV-14 |
| Phạm vi tăng thành hệ thống bệnh viện/kế toán | Giữ mục 1, ghi yêu cầu bổ sung thành dự án liên kết có hợp đồng riêng | CV-01 và review từng đợt |

## 12. Tài liệu tham chiếu nghiệp vụ

Các tài liệu dưới đây hỗ trợ thiết kế nghiệp vụ theo dõi tồn/hạn, đặt bổ sung và bảo quản; không được dùng để tuyên bố phần mềm đã được chứng nhận hay đáp ứng toàn bộ quy định pháp lý Việt Nam.

- WHO, Procurement, supply chain and inventory management: https://www.who.int/tools/quality-management-system-for-non-laboratory-settings/pillar-3--procurement-supply-chain-and-inventory-management
- WHO, Laboratory Quality Stepwise Implementation — inventory monitoring: https://extranet.who.int/lqsi/node/137

Các yêu cầu pháp lý/chứng từ bắt buộc cụ thể nếu được đưa vào phạm vi triển khai cần xác minh nguồn hiện hành tại thời điểm thực hiện, và ghi nguồn/quyết định vào decision-log.
