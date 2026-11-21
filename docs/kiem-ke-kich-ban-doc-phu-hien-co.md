# Kiểm kê kịch bản hiện có để đánh giá số lần đọc phụ trước B2

Ngày đọc: 21/11/2026. Phạm vi: hai action `product.list`, `inventory.product.detail` và các test hội thoại dùng reference sản phẩm liên quan trực tiếp.

**Đây là kiểm kê tĩnh, không phải phân bố đã đo.** Không chạy test hiện có, không sửa test/runtime và không gọi model/API/DB. Các số liệu thực nghiệm của harness mới do task lớp B bàn giao tại [kết quả lớp B](ket-qua-lop-b-tro-ly-erp.md). Nếu file kết quả chưa có hoặc chưa ghi một cohort, không xem bảng dưới đây là số đo thay thế.

**Cập nhật sau đợt kiểm kê:** các mục1–5 giữ bối cảnh đọc mã ban đầu. Đợt P3 đã đo bằng harness mới, xem Mục6 và [báo cáo observer](ket-qua-p3-bo-dem-call-tro-ly-erp.md); không chạy suite cũ hoặc suy các khai báo trong ma trận tĩnh thành số liệu production.

## 1. Test hiện có thực sự bao phủ gì?

### 1.1. Ma trận hội thoại tổng quát

[function-conversation-matrix.test.ts](../server/assistant/function-conversation-matrix.test.ts) tạo `describe(op.id)` ở dòng 175; danh mục lấy theo [function-matrix-scope.ts](../server/assistant/testing/function-matrix-scope.ts). Danh sách module mặc định có `inventory`, nên trong cấu hình mặc định hai action sản phẩm có các tên case động sau:

| Action | Các scenario được sinh trong code | Phạm vi bằng chứng |
|---|---|---|
| `product.list` | `missing-data`, `unknown-condition`, `cancel`, `invalid-data`, `api-rejection-probe`, `success-probe` | Sáu khai báo case; chưa chạy trong đợt này |
| `inventory.product.detail` | Cùng sáu scenario trên | Sáu khai báo case; chưa chạy trong đợt này |

Số **12** là số khai báo dự kiến với module mặc định và hai operation khả dụng, không phải 12 test pass, 12 requests hoặc 12 kịch bản production độc lập. Biến cấu hình module có thể thay danh mục khi người khác chạy suite; task này không đọc `.env` hoặc chạy suite.

Các tên có thể tái hiện bằng harness mới:

- `product.list > success-probe` và `inventory.product.detail > success-probe`: happy path riêng từng action.
- `product.list > api-rejection-probe` và `inventory.product.detail > api-rejection-probe`: target API từ chối, reference có fixture riêng.
- `inventory.product.detail > missing-data`: thiếu target; đo cả các call phát sinh từ gợi ý reference thay vì giả định luôn bằng 0.
- Hai action `unknown-condition`/`cancel`: test hiện có kỳ vọng không gọi API; khi tái hiện phải giữ đúng input và provider mock.

Code tại dòng 178–184 bật `referenceFixtures` cho các probe và dựng required/path fields. Với field reference/path, helper `fieldValue()` dùng một ID nhân tạo ở dòng 172, nên happy path generic chủ yếu kiểm tra đối tượng fixture hợp lệ. Nó không phải case có hai tên trùng, target thứ 25 hoặc nhiều variant khác ID sản phẩm.

Các điểm quan trọng khi đọc kết quả ma trận cũ:

| Thiết lập hiện có | Hệ quả |
|---|---|
| Provider, session, workflow và transport được mock | Không chứng minh model live hoặc ACL/backend thật |
| `listWorkflows` trả operation đang chọn | Không đại diện cạnh tranh hơn 120 workflow/discovery |
| Transport dựng một record QA chung, nhiều field để khớp các loại operation | Không có bảo đảm fixture API sản phẩm giống hoàn toàn pagination/variants thật |
| Có vòng chọn option đầu và xác nhận ở dòng 234–259 | Có thể đi nhiều lượt, nhưng lựa chọn đầu không kiểm chứng disambiguation đúng theo người dùng |
| `calls` lưu actual requests, `record.calls` được cập nhật khi bàn giao | Có nền để đối chiếu leaf calls, nhưng suite không có assertion rằng leaf count bằng budget/journal |
| Probe thành công phải completed và có target call | Chứng minh mục tiêu của suite; không chứng minh lookup con đã được tính đủ hoặc output dùng đúng parent ID |

`missing-data` là nhãn generic. `product.list` không có field bắt buộc, nên không được tự suy nhãn này đồng nghĩa phải hỏi; phản hồi mock/API status và policy có thể quyết định kết quả khác. Harness mới cần oracle theo schema thật từng action.

### 1.2. Test dịch vụ nghiệp vụ có reference sản phẩm

[retail-inventory-business-database.test.ts](../server/assistant/retail-inventory-business-database.test.ts) có HTTP bridge tại dòng 114–129 tới các service thật, trong đó có `ProductCatalogService.list/get`. Suite khởi động `MongoMemoryReplSet` ở dòng 91–97; đây không phải harness hoàn toàn in-memory/no-socket được cho phép trong đợt lớp B hiện tại.

| Tên test hiện có | Reference/chuỗi liên quan | Giới hạn kiểm kê |
|---|---|---|
| `retail cancels preview without business writes` | Chuẩn bị đơn nháp, chọn reference, hủy | Ngoài slice đọc; không chạy |
| `inventory cancels preview without business writes` | Chuẩn bị điều chuyển, chọn reference, hủy | Ngoài slice đọc; không chạy |
| `{retail,inventory} confirms once and replay does not duplicate the record or stock movement` | Reference → preview → ghi → replay | Có tác động nghiệp vụ fixture; cần cohort riêng khi được giao slice ghi |
| `{retail,inventory} exposes insufficient-stock rejection without partial writes` | Chuẩn bị và API từ chối do stock | Không suy count/availability từ suite này sang hai GET |
| `receives the transfer in the destination branch once and conserves total stock` | Chuỗi điều chuyển, đổi branch và lookup ở branch nhận | Chỉ ghi nhận tên/flow hiện hữu; không đo, không audit dịch vụ điều chuyển |

Tổng các tên do vòng lặp sinh là bảy test khai báo trong những nhóm trên; đây không là số lượt đọc. Không tái chạy suite cũ hoặc import nó chỉ để lấy distribution: việc đó sẽ khởi tạo DB fixture và vượt lệnh “chỉ test mới”. Nếu cần cohort ghi sau này, tái hiện có kiểm soát ở task được giao riêng hoặc phê duyệt phạm vi đo suite đó.

### 1.3. Kiểm tra lựa chọn reference và budget riêng

- [remaining-module-interpreter.test.ts](../server/assistant/remaining-module-interpreter.test.ts), test `offers inventory receipt references as selectable chat choices` tại dòng 218: truyền callback `suggest` trả các nhãn nhân tạo cho branch, supplier, `product.list`, `inventory.product.detail`. Nó kiểm hình dạng lựa chọn trong `missingReferencePrompts`; không gọi resolver/API thật và không chứng minh số HTTP calls.
- [reference-projection.test.ts](../server/assistant/reference-projection.test.ts): kiểm projection của transfer/job references. Chỉ đọc contract chung; chưa có assertion riêng rằng một variant row ID không bị dùng làm product target.
- [execution-budget.test.ts](../server/assistant/execution-budget.test.ts) có bốn test: cho phép hơn bốn lượt đọc hữu ích, ghi trùng bất kể thứ tự key, no-progress trên dữ liệu giống nhau và thời gian direct/background. Test đầu tạo **12 lần `beforeCall` đọc bằng vòng lặp**, không phải trace 12 HTTP requests của một hội thoại. Các test này chứng minh mục tiêu unit budget, không bao phủ lookup đang đi ngoài dispatch.

## 2. Đường đọc tĩnh và điều chưa thể kết luận

| Đường đọc từ code | Bằng chứng tĩnh | Số call thực tế |
|---|---|---|
| GET primary của `product.list` | [service.ts](../server/assistant/service.ts):2130–2133 gọi dispatch với callback lookupRecords | Chưa đo trong suite hiện có |
| Detail resolve target khi prepare | service:2335 → resolver/reference lookup | Chưa đo; phụ thuộc target và gợi ý |
| Detail resolve lại khi execute | service:1963–1971 | Chưa đo; có thể phát sinh list khác query |
| `lookupRecords` gọi operation | [executor.ts](../server/assistant/executor.ts):4131 | Mỗi nhánh gọi có thể gửi API; phải đếm ở biên transport |
| Internal ID khi lookup `.list` | executor:4114–4118 đổi search thành rỗng | Không được suy sẽ tìm đủ catalog |
| Fallback product reference | executor:4438–4442 đọc list không query nếu chưa có exact match | Có thể thêm một API read; chỉ khi điều kiện chạy |
| Projection detail thành variant rows | executor:3968–3977 | Thao tác thuần bộ nhớ, không tự thêm HTTP call |

Một đường detail có thể gồm list ở prepare, list ở execute và detail primary; không mặc định coi mọi case có đúng ba call. Selection, retry, fallback, lỗi, missing reference và workflow confirmation có thể tạo đường khác. Code tĩnh không cho p50/p95 hoặc phân bố có trọng số theo traffic thật.

## 3. Cohort đề xuất cho harness mới và cách ghép kết quả

| Cohort | Nguồn/kỳ vọng | Được phép kết luận khi có trace mới |
|---|---|---|
| E-LIST-SUCCESS | Tái hiện `product.list > success-probe` bằng fixture sản phẩm đúng schema | Chi phí đọc của một happy path list dưới fixture đó |
| E-DETAIL-SUCCESS | Tái hiện `inventory.product.detail > success-probe` | Chênh primary-wrapper budget so với primary + reference leaves |
| E-REJECTION | Probe target API từ chối như suite cũ | Đường lỗi có đọc phụ bao nhiêu; không trộn với success cohort |
| NEW-DUPLICATE | O02/CG02/CG06, P2/P3 và product ID khác variant ID | Disambiguation/parent identity theo actual target trace |
| NEW-PAGE25 | O14/CG05, target thứ 25 trong F-25 | False-negative nếu fixture oracle tồn tại nhưng resolver không tìm được; không tự bắt test phải fail |
| NEW-FALLBACK | O15/CG03, query không khớp rồi list không q có record | Số reads phụ và journal/budget thực |
| NEW-MULTISTEP-READ | Chuỗi list → detail, interpreter scripted, chỉ hai GET | Chi phí chuỗi read-only trong fixture, không đại diện chuỗi ghi/miền khác |

Ba cohort cuối là **case mới** để kiểm giả thuyết phát hiện khi đọc code; không mô tả là ca đã chạy sẵn trong suite cũ. Root quyết định tập test mới thực sự viết/chạy; bảng này không công bố tất cả cohort đã được thực thi.

Mỗi run mới nên xuất: scenario ID, số lượt người dùng/turn, số logical step, leaf HTTP calls theo action và purpose suy được, `budget.beforeCall` đã tính, journal entries/success và tổng `reads_if_all_leaves_charged`. Trường purpose được suy từ trace phải đánh dấu inferred, không giả vờ runtime hiện đã có BusinessCallContext.

## 4. Cổng trước B2: chưa đủ dữ liệu để duyệt trần

Trước khi thay wrapper accounting bằng tính đủ mọi leaf read, cần bảng so sánh tối thiểu:

| Chỉ số theo cohort | Cần đo | Hiện tại của bản kiểm kê |
|---|---|---|
| Counts và histogram | Số run ở từng mức leaf read; tách success/collecting/error/replay | Chưa đo |
| Median/p50, p95, max | Leaf read và read đã tính hiện tại; ghi phương pháp quantile | Chưa đo |
| Amplification | Leaf read / charged read; charged=0 phải báo riêng, không chia vô hạn giả | Chưa đo |
| Chạm hard cap | Số case có leaf reads >24 hoặc không còn budget để hoàn tất bước; kể cả lặp qua nhiều turn | Chưa đo |
| Call có thể tránh | Re-read list so với exact getter; không tự bỏ revalidation | Chưa đo |
| Chi phí journal | Số update Mongo/call và latency theo pha; mock không đo latency Mongo thật | Chưa đo |

Không đưa p95 của vài fixture dễ vào kết luận các chuỗi đang chạy sẽ không bị ảnh hưởng. Sau tập lớp B đầu tiên vẫn còn thiếu các cohort ghi, bulk, nhiều reference và các miền khác. Cần kiểm kê/đo riêng chúng trước khi mở cổng chung rộng hơn; không chạy các suite cũ trong lệnh hiện tại.

**Trần 24 lần đọc giữ nguyên.** Nếu tính đủ làm một số đường hợp lệ vượt trần, bàn giao bảng case/call-graph, phương án giảm call và đề xuất trần có số liệu để chủ dự án quyết định. Không tự tăng trần, bỏ child reads, nới no-progress hoặc thay behavior âm thầm. Mọi thay đổi accounting cũng cần baseline trước/sau và kế hoạch phát hành riêng.

## 5. Trạng thái bàn giao

- Đã đọc các đoạn test/call-site nêu trên, không chạy test cũ hay mới trong task kiểm kê này.
- Không viết/sửa source, fixture runtime, test hoặc config. Chỉ tạo tài liệu này.
- Số liệu lớp B thực tế thuộc file kết quả của root; bản này chỉ xác định độ phủ và phần còn thiếu.
- Chưa duyệt B2, chưa thay policy journal fail-open/fail-closed hoặc trần đọc.

## 6. Phân bố cục bộ P3 đã đo ngày21/11/2026

Observer đếm fetch tại boundary executor, đối chiếu trace và kiểm thử bật/tắt không đổi hành vi. Cohort chung19 hội thoại nhân tạo,31 turn/chế độ, có cả turn0 GET; chưa đại diện các miền ghi/bulk/nhiều reference.

| Chế độ | Tổng GET /charged | Histogram GET/turn | p50 /p95 /max theo turn |
|---|---|---|---|
| C tắt | 116 /23 | 0:2;1:2;2:2;3:16;4:5;5:3;27:1 | 3 /5 /27 |
| C bật | 95 /24 | 0:2;1:3;2:7;3:15;5:3;18:1 | 3 /5 /18 |

Chi tiết từng case, histogram theo kịch bản và phương pháp nearest-rank nằm trong [artifact phân bố](../server/assistant/testing/layer-b-product-audit/p3-distribution.json). Turn F101 chuyển failed→completed giải thích charged23→24. Observer không cộng đọc phụ vào budget. Unit test vẫn chặn lần charged read25 ở cả hai chế độ observer.

Owner/purpose unknown và event bị cắt đều0 trong cohort này; chưa xác nhận coverage SDK/DB/HTTP riêng bên ngoài boundary chung. Số persistence chỉ là mock, chưa có latency Mongo. Bộ161 test pass, typecheck pass; không thay trần24, journal policy hoặc mở B2. Chưa bật production và chưa làm P4.
