# Kế hoạch hoàn thiện Trợ lý ERP sau lớp B

**Phân biệt namespace dự án:** đã [sửa ràng buộc Nhân sự/Quản lý lao động](ket-qua-phan-biet-du-an-nhan-su-lao-dong.md), thêm lựa chọn có nhãn phân hệ và chặn action/preview sai namespace. Kiểm fixture và AI thật bằng dữ liệu nhân tạo; chưa deploy hoặc nghiệm thu toàn web. Lượt AI chẩn đoán được người dùng cho phép riêng, không mở toàn bộ ngân sách P5.

**Runtime ngày 21/11/2026:** đã [sửa bước phục hồi khi nhận diện sai unsupported trên catalog theo quyền](ket-qua-sua-nhan-dien-thao-tac-toan-catalog.md), kiểm bằng fixture tạo dự án trong ảnh và hồi quy. Đây là sửa đường legacy chung, chưa là nghiệm thu toàn web hoặc mở V2 ghi; chưa gọi model thật/deploy.

**Phạm vi mới theo yêu cầu chủ dự án ngày 21/11/2026:** hoàn thiện trợ lý cho **toàn web ERP, gồm đọc/thêm/sửa/xóa và các thao tác được phép**, theo [kế hoạch bao phủ toàn web](pham-vi-bao-phu-toan-web-tro-ly-erp.md). Hai action đọc là prototype đã bàn giao. Thứ tự công việc tiếp theo dùng W1–W6 trong tài liệu mới; các gói P bên dưới lưu tiến độ và bằng chứng lịch sử, không giới hạn đích đến ở trang sản phẩm. Việc cập nhật phạm vi chưa triển khai runtime, gọi model thật hoặc bật production.

Ngày: **21/11/2026**. Trạng thái: **P1–P3 đã bàn giao; P4 đã duyệt24 ca S/D1–D5, O/F và D6 còn mở; P5 đã [chuẩn bị/dry-run offline](ket-qua-p5-dry-run-tro-ly-erp.md) theo lựa chọn người dùng, chưa chạy model thật hoặc bật production**.

**P6 theo lệnh mới:** đã bàn giao [cổng gọi đọc, deadline/cancel và hồi quy](ket-qua-p6-cong-goi-deadline-cancel.md) cục bộ:359 test P6 và366 test hồi quy/offline pass, typecheck pass. Người dùng chốt **giữ budget tính primary/cap24 nhưng journal đủ call; chưa V2/ghi**. Flag `ASSISTANT_SAFE_EXECUTION=false`, production không được bật; ngân sách P5 live vẫn0.

**V2 theo lệnh tiếp theo:** đã có [API/contract V2 cho hai action đọc](ket-qua-v2-hai-action-doc-tro-ly-erp.md),122 test mới +725 hồi quy/offline pass, typecheck pass. Context/handle, quote NFC, token hash/encrypted replay, pending/version/proof và direct routing đã kiểm bằng fixture. Flag `ASSISTANT_PRODUCT_READ_V2=false`; UI/widget hiện vẫn legacy. Chưa production, model thật, thao tác ghi hoặc job/DAG V2; không coi đây là nghiệm thu toàn bộ T1.

**Đề xuất tiếp theo để duyệt:** [phương án P5 model thật và dự toán](phuong-an-p5-model-that-va-du-toan.md), gói đề nghị5 USD gồm pilot tối đa1 USD, một vòng; hiện vẫn chưa được cấp tiền hoặc quyền gọi thật. [JSON phép tính](p5-du-toan-model-that.json) lưu giả định, giá và cap đề xuất; chưa phải cấu hình đã bật.

**Model đã đổi theo yêu cầu:** LLM dùng chung hiện là GPT-6 Luna, xem [báo cáo migration](chuyen-llm-gpt-6-luna.md):84 test hồi quy +52 dry-run và typecheck pass. Dự toán hiện tại đã tính lại giá Luna/prompt dài; bản Gemini lưu riêng. Ngân sách vẫn0, chưa có inference thật.

Mục tiêu: người dùng nói yêu cầu → AI chọn đúng action và trích thông tin → server kiểm tra quyền, đối tượng, dữ liệu thiếu → hỏi/chọn/xác nhận khi cần → gọi API → trả bảng và tiếp tục đúng bản ghi. Cải thiện từng chỗ đã có bằng chứng trước, rồi mở rộng khả năng hiểu ngữ cảnh và tự làm nhiều bước.

Đây là thứ tự giao việc hiện tại của [kế hoạch tổng thể](../ke-hoach-nang-cap-tro-ly-erp.md). Các đặc tả T0.1-A/T0.8 vẫn là tài liệu tham chiếu; không lặp lại thiết kế và không triển khai toàn bộ V2 cùng một lần.

## 1. Điểm xuất phát và giới hạn

| Đã biết | Ý nghĩa cho kế hoạch |
|---|---|
| [Lớp B](ket-qua-lop-b-tro-ly-erp.md):14/14 test quan sát pass | Harness tái hiện hiện trạng; không có nghĩa lỗi đã sửa hoặc AI hiểu đúng |
| Hai sản phẩm cùng tên, khác mã bị gộp một lựa chọn | Sửa nhãn và kiểm tra đường chọn trước |
| F25 thành công; F101 thất bại khi tìm lại target qua list100 dòng | Sửa exact verification cho target đã xác thực, không sửa theo giả định page25 |
| Detail thường3 physical reads nhưng budget tính1; chuỗi9 detail là27/9 | Cần tối ưu và đo đủ; chưa đổi accounting hoặc tăng trần24 |
| SKU row ID khác product ID | Kiểm tra parent target; chưa có bằng chứng đường đã chạy gọi nhầm variant ID |
| 48 nhãn còn dự thảo; lớp A chưa chạy | Chưa công bố accuracy, chi phí hay độ trễ model |

Slice hiện tại: `/kho-san-pham`, mode `work`, chỉ `product.list` và `inventory.product.detail`. Product theo công ty; scope session/context có chi nhánh không biến product thành dữ liệu sở hữu theo chi nhánh. Dữ liệu kiểm thử nhân tạo, provider/API/DB thật chưa được mở cho đợt tiếp theo; ngân sách model/shadow hiện là **0**.

Giữ quy tắc chung trong [AGENTS.md](../AGENTS.md): quyền và xác nhận hiện hành, common dispatch/completion, bảng kết quả, ngày giờ Việt Nam, ẩn ID và trường tự điền, giữ thông tin người dùng đã nhập. Chưa đổi form-only, journal fail policy hoặc quote literal/NFC.

## 2. Thứ tự và cổng chuyển bước

| Ưu tiên | Gói việc | Phụ thuộc / phần mở được | Bàn giao và điểm dừng |
|---|---|---|---|
| 1 | **P1: sửa nhãn lựa chọn** | Đủ bằng chứng O02; không cần V2/model | Patch nhỏ, hội thoại chọn đúng target; dừng để rà |
| 2 | **P2: prototype C sau flag** | Dùng spike đã có; P1 làm sạch đường chọn | So trước/sau lớp B, flag bật/tắt và hồi quy quyền; chưa rollout |
| 3 | **P3: đếm call chỉ quan sát** | Chốt metric tối thiểu trước P2; triển khai riêng sau prototype để tránh trộn diff | Phân bố theo kịch bản, coverage và overhead; không đổi budget |
| 4 | **P4: duyệt48 nhãn** | Chủ dự án rà; có thể làm trong lúc P1–P3 chạy | Corpus có version, nhãn và người duyệt; các điểm chưa chốt ghi riêng |
| 5 | **P5: lớp A có ngân sách cứng** | P4 cho tập đo tương ứng + provider/dữ liệu/môi trường/budget được chốt | Báo cáo ngôn ngữ/discovery/cost; dừng ở trần hoặc stop rule |
| Sau đó | **P6: tích hợp và mở rộng từng slice** | Bằng chứng P1–P5 và thiết kế liên quan được duyệt | Slice đọc trước, một action ghi sau, rồi nhiều bước và mở phân hệ |

P1 không chờ việc duyệt toàn bộ T0.8. P2 chỉ là prototype được giao riêng, không kéo theo T1, job V2 hoặc thay toàn bộ resolver. P4 không phải điều kiện duy nhất của lớp A: thiếu ngân sách/provider/dữ liệu vẫn chưa chạy model.

## 3. P1 — Sửa nhãn sản phẩm trùng tên

**Thay đổi dự kiến:** khi tên trùng, dùng tên và mã sản phẩm công khai, ví dụ `Tai nghe Sóng — SP-SONG-01` và `Tai nghe Sóng — SP-SONG-02`. Kiểm tra cả nhãn hiển thị lẫn giá trị đối chiếu lựa chọn để không bị Set/dedup gộp lại.

- Đọc `referenceOptionLabel`, `referenceOptionDisambiguators`, nơi tạo options và nơi nhận `referenceSelections`. Giới hạn theo reference sản phẩm/metadata công khai, không thêm quy tắc productCode tùy tiện cho mọi phân hệ.
- Giữ tương thích lựa chọn/pending cũ khi có thể đối chiếu an toàn. Nếu nhãn cũ vẫn mơ hồ thì hỏi lại bằng lựa chọn mới; không lấy dòng đầu.
- Thiếu mã hoặc tên+mã vẫn trùng: dùng thông tin công khai đã được phép nếu đủ phân biệt, hoặc tiếp tục hỏi. Không dùng ID/revision làm nhãn và không tự chọn.
- Không đổi layout nếu thành phần chung đã hiển thị được. Nếu cần sửa frontend, áp dụng workflow UI và kiểm chứng theo `AGENTS.md`.

**Nghiệm thu:** O02 hiện đủ hai lựa chọn khác mã; chọn từng lựa chọn dẫn tới đúng product; cách nhập mã bằng lời vẫn dùng được. Không lộ ID, không đổi quyền/confirmation, không gọi AI mới để phân biệt một lựa chọn đã rõ. Thêm ca không trùng, thiếu mã và option cũ mơ hồ. Giữ báo cáo baseline lịch sử; ghi kỳ vọng bugfix trong hồi quy mới, không xóa bằng chứng đã tái hiện lỗi.

**Kiểm tra và bàn giao:** typecheck nếu sửa TS, Vitest resolver/hội thoại liên quan và lớp B mới; báo cáo diff, target trace, trạng thái kiểm tra. Revert patch nếu hồi quy; không đợi V2 để sửa lỗi này.

## 4. P2 — Prototype phương án C, chưa rollout

Căn cứ [spike trustedReferences, mục4](spike-trusted-references-tro-ly-erp.md). Đường dự kiến: `prepare` tìm/chọn đúng product → server pin proof → kiểm tra quyền/workflow/confirmation hiện hành → primary exact GET xác thực target hiện tại → dùng chính response đó cho kết quả và completion. Bỏ list recheck dư **chỉ ở nhánh đủ điều kiện**.

- Flag đề xuất `assistant_product_detail_exact_verify`, mặc định tắt, giới hạn hai action của slice và tối ưu chỉ `inventory.product.detail` trên đường direct. Tên/cách cấu hình chốt theo cơ chế hiện hữu; ghi cách xác định phiên bản baseline.
- Proof là dữ liệu server kiểm soát, tách khỏi `values` model/client. Prototype phải chứng minh điểm tạo/kiểm proof theo owner, scope, target, workflow/version và vòng đời request/pending. Không coi scalar ID tự khai là bằng chứng.
- Không có proof hợp lệ: dùng đường phân giải/clarify hiện hữu. Proof hết hạn, đổi scope/quyền/workflow hoặc record404: dừng/hỏi theo nguyên nhân; không âm thầm đổi target. Không đánh dấu selected chỉ vì nhận một ID.
- Primary GET đi qua dispatch và completion chung. Kiểm raw parent trùng product target trước khi chiếu variants; dùng lại response trong cùng logical step, không gọi detail hai lần. Biến thể và parent phải tách rõ, kể cả variants rỗng.
- Tên mơ hồ vẫn cần tìm/chọn. Exact getter không chứng minh tìm kiếm tên đã đầy đủ hoặc duy nhất. Không thay create/update, background job, plan DAG hay contract toàn hệ thống.
- Chuẩn hóa command một lần: dữ liệu journal/budget và payload transport phải khớp; không kiểm object mới rồi callback gửi object cũ.

**So trước/sau:** chạy cùng fixture và version harness cho flag off/on, ghi status, target parent, physical calls, charged reads, journal steps, completion và dữ liệu kết quả. Tối thiểu O02, O14/F25/F101, O15, CG02/03/05/06 và chuỗi9 detail; bổ sung mất quyền, sai company, đổi scope/workflow, record bị xóa, custom confirmation và variants rỗng/nhiều variants.

**Nghiệm thu prototype:** F101 hoàn tất đúng target khi đã có proof hợp lệ; ca detail đủ điều kiện giảm list recheck và không lặp primary GET. Không đặt cứng mọi ca chỉ1 request vì prepare có thể vẫn cần lookup. Flag off giữ hành vi baseline đã sửa P1; không phát sinh mutation hoặc vượt xác nhận/quyền. Kết quả không đủ thì sửa hoặc bỏ phương án, không tuyên bố C đã thành công từ spike.

**Bàn giao:** tài liệu mới `docs/ket-qua-prototype-c-tro-ly-erp.md`, trace trước/sau, giới hạn proof và rollback. Flag off phải quay lại legacy an toàn; nếu lưu shape pending mới thì cần version/restore test trước khi viết persistence, không xóa pending để rollback. Dừng sau prototype; chưa bật production.

## 5. P3 — Bộ đếm physical reads chỉ quan sát

Mục đích là biết server thực sự gửi bao nhiêu request ở từng kịch bản, kể cả lookup/reference/fallback/verification. Không gọi thêm `beforeCall`, không cộng vào counter giới hạn hiện hành và không thay no-progress. Cap24 giữ nguyên.

- Gắn quan sát ở boundary chung đủ bao phủ call phụ. Ghi action chủ, action thực, logical step/parent call, purpose nếu xác định được, method/classification, attempt, status và duration. Trường chưa xác định để `unknown`, không đoán nhãn nhằm làm đẹp số liệu.
- Tách physical read attempts, requests đã gửi, logical steps, charged reads hiện hữu và writes. Phân loại pure read dựa trên catalog đã rà, không mặc định mọi GET đều không có tác động phụ. Không log payload, tên sản phẩm, credential hoặc ID nghiệp vụ thô; chỉ giữ metadata tối thiểu.
- Counter lỗi không làm lỗi lượt xử lý; nguyên tắc này chỉ cho telemetry mới. Không thay fail policy của journal hiện hữu, session lock, ACL, pending, idempotency hoặc thao tác ghi.
- Bắt đầu bằng fixture/test cục bộ. Nếu muốn lấy lưu lượng thật phải chốt môi trường, quyền thu thập, sampling, retention và người đọc trước; không tự bật production. Observer có flag/kill switch và đo overhead, không ghi Mongo riêng cho từng call theo mặc định.

**Mẫu cần đo:** list/detail, chọn trùng tên nhiều lượt, fallback, ngoài page100, lỗi API, bị từ chối, xác nhận/resume, chuỗi nhiều bước; sau đó cohort có ghi/nhiều reference bằng fixture tương ứng. Phân biệt số liệu trước C và sau C. Báo cáo n, histogram, p50/p95/max theo turn và kịch bản; tỷ lệ thiếu attribution, số ghi persistence và độ trễ quan sát. Fixture không đại diện production; mock Mongo không chứng minh latency Mongo thật.

**Nghiệm thu:** số đếm khớp leaf transport trace trong lớp B; bật/tắt observer không đổi response, target, API sequence hoặc budget/no-progress. Có số liệu cả nhánh lỗi và chuỗi dài. Bàn giao cập nhật [phân bố kịch bản](kiem-ke-kich-ban-doc-phu-hien-co.md) và baseline. Sau đó mới đề xuất T0.1-B/B2 và quyết định trần, không tự chuyển accounting.

## 6. P4 và P5 — Đo khả năng hiểu câu hỏi

**P4 do chủ dự án duyệt:** rà48 nhãn của [baseline](baseline-do-luong.md), gồm24 ca ngôn ngữ,16 điều phối,8 hợp đồng V2. Chốt list/detail, khi nào hỏi/chọn và S16/S17 khi điều kiện lọc chưa hỗ trợ; không tự bỏ điều kiện người dùng. Rà lại các kỳ vọng đã bị thực nghiệm F25/F101 và O02 sửa giả định. Ca V2 chưa triển khai không đưa vào accuracy hiện tại.

**P5 chỉ mở sau các quyết định sau:**

| Cần chốt | Trạng thái hiện tại |
|---|---|
| Tập case/nhãn/version và số lần lặp; tách ví dụ hướng dẫn khỏi tập đánh giá |24 ca S và D1–D5 đã duyệt; O/F/D6 còn mở;52 test dry-run không là model accuracy |
| Provider, model, môi trường và dữ liệu được phép gửi | Chỉ cho offline fixture, provider transport bị mock; chưa mở gửi thật |
| Trần tiền, tokens, tổng attempts, thời hạn và người ra quyết định | Người dùng chọn ngân sách0, chỉ chuẩn bị/dry-run; footprint prompt đã đo theo bytes, chưa dự toán tiền/token |
| Cách dừng và ghi nhận usage không xác định | Phải thiết kế trước lượt gọi đầu |

Harness phải chạy đúng semantic interpreter production, mock business dispatch và DB. Tách `CAT-NARROW` khỏi `CAT-PRODUCTION-SHAPED`; tính đầy đủ discovery, interpretation, retries và fallback. Dự toán bằng prompt/catalog thực và giới hạn output, không coi24 câu là24 request. Giá/khả năng provider kiểm tra lại khi lập dự toán, chưa gán số tiền trong kế hoạch này.

Trước mỗi attempt phải dự trù đủ ngân sách theo giới hạn đầu vào/đầu ra; không đủ thì không gửi. Retry/fallback dùng cùng trần, không tự chọn provider khác hoặc tăng tiền. Dừng khi chạm trần tiền/token/attempt/thời gian, provider/dữ liệu sai allowlist, có request thoát mock, hoặc usage chưa đối soát khiến không bảo đảm phần ngân sách còn lại. Có hủy request và ghi trạng thái chưa hoàn tất; không lấp bằng số0.

**Chỉ số:** đúng action sau discovery, action bị discovery loại mất, field đúng/sai/thiếu, clarify cần thiết/hỏi thừa, lỗi provider, số calls/tokens/cost và latency. Đo riêng false `UNSOURCED_VALUE` do quote literal/NFC; chưa nới rule. Báo cáo case lỗi, cỡ mẫu và phần chưa đo; không gộp success lớp B với accuracy model hoặc dùng slice hai GET để suy độ an toàn thao tác ghi.

## 7. P6 — Hoàn thiện kiến trúc và mở rộng

**Chặng đầu đã thực hiện theo phạm vi được chọn:** gate direct cho hai action đọc, journal version1/accounting `legacy_primary`, truyền deadline/cancel xuống native provider và business GET. [Bàn giao](ket-qua-p6-cong-goi-deadline-cancel.md) giữ số call/budget trước/sau116/23 hoặc95/24; chi phí thêm3 journal writes mỗi leaf và revalidation được ghi riêng. Chưa đổi trần/accounting, chưa fail-open, chưa V2/ghi/retrieval/rollout. Các hàng tiếp theo là phần dài hạn, không phải quyền triển khai cùng đợt này.

**Sau đó đã giao V2 riêng:** [phần API/direct/read](ket-qua-v2-hai-action-doc-tro-ly-erp.md) đã xong sau flag và fixture. Đây là bước triển khai contract phía server; chưa nối frontend T1.1/T1.4 hoặc chuyển luồng mặc định/widget. TTL5/15/30 phút và lazy retention24 giờ là cấu hình prototype, chưa duyệt rollout. Ngân sách live và accounting/cap24 giữ nguyên.

| Chặng sau bằng chứng ban đầu | Công việc chính | Cổng nghiệm thu |
|---|---|---|
| Cổng gọi và độ bền | T0.1-B theo [T0.1-A](kiem-ke-thiet-ke-cong-goi-tro-ly-erp.md): quản lý call chính/phụ, journal/completion; T0.5 deadline/cancellation, T0.6 bugfix riêng theo bằng chứng | Phân bố trước/sau; quyết định rõ accounting/trần24, không chặn ngầm chuỗi đang chạy; đo chi phí journal ở B5 |
| V2 cho slice đọc | Duyệt [T0.8 v0.2](thiet-ke-hop-dong-tro-ly-erp-v2.md), chốt TTL; context/handle, evidence, option token server, adapter/version/digest/restore; direct-only | Test ranh giới client/model/server, proof và pending/flag off; job nền vẫn legacy; không triển khai DAG dự phòng |
| Khả năng chọn action | T2.1 retrieval/tách diễn giải nếu lớp A chỉ ra discovery/cost/latency là điểm nghẽn; ưu tiên khảo sát sớm với catalog1004 action | So recall/action accuracy/calls/latency với discovery hiện tại trên cùng holdout; chưa thay đường mặc định từ quy mô catalog đơn thuần |
| Một action ghi đơn giản | Chọn action có chủ nghiệp vụ, đủ API/permission và confirmation; hỏi thiếu, preview, thực thi, completion, bổ sung optional vào cùng bản ghi | Không ghi khi chưa xác nhận; retry không tạo trùng; đồng ý/bỏ qua/bổ sung sau xác nhận và bảng chung đều qua conversation test |
| Nhiều bước và thêm phân hệ | T2.3 output có kiểu, Product/SKU tách rõ, dependency/resume; sau đó từng nhóm action theo giá trị và dữ liệu lỗi | Không mất target, không lặp write khi retry/resume; nghiệm thu slice trước rồi mở slice sau |

Quy tắc rollout theo Mục0.3 kế hoạch tổng thể: mỗi lần một slice hành vi, baseline → shadow diễn giải không dispatch thêm → rà ngưỡng → canary → nghiệm thu hoặc rollback. Chỉ chạy live khi phạm vi/ngân sách/dữ liệu được phép; mẫu nhỏ, có deadline và stop rule. Đề xuất rà hàng tuần và tối đa hai tuần mỗi đợt shadow, chốt mốc cụ thể trước khi bật. Bugfix P1 và prototype cục bộ không cần chờ shadow model.

**Hoãn:** journal fail-open, tăng trần24, nới quote; job V2/plan DAG, UI điều khiển rộng và thay chính sách form-only. Chỉ mở lại từng việc khi có bằng chứng và yêu cầu riêng.

## 8. Cách giao việc và trạng thái

P1–P3 đã bàn giao; P4 được duyệt24 ca S, phần còn lại đang chờ; **P5 chỉ được giao offline và đã dry-run; P6 đã giao và hoàn tất phần gate/deadline/cancel cục bộ**. Mẫu13.3 lưu phạm vi P1 để đối chiếu. Mỗi gói có diff nhỏ, bằng chứng trước/sau, kiểm tra liên quan, rollback và điểm dừng; không tự nối sang gói tiếp theo. Khi thực hiện TS chạy typecheck và Vitest liên quan; sửa UI tuân thủ workflow trong `AGENTS.md`.

- [x] Có protocol, thiết kế T0.1-A/T0.8, spike và số đo lớp B cục bộ để lập kế hoạch.
- [x] P1 sửa nhãn và kiểm tra hồi quy cục bộ; [bàn giao](ket-qua-p1-nhan-lua-chon-san-pham.md) để chủ dự án rà, chưa deploy.
- [x] P2 prototype C và số đo flag off/on cục bộ; [bàn giao73 test](ket-qua-prototype-c-tro-ly-erp.md) để chủ dự án rà, chưa rollout.
- [x] P3 bộ đếm và kiểm tra cục bộ:161 test, phân bố19 kịch bản/31 lượt mỗi chế độ C; [báo cáo](ket-qua-p3-bo-dem-call-tro-ly-erp.md). Coverage/đại diện toàn hệ thống và đo live chưa hoàn tất, chưa đủ để đổi trần/accounting.
- [ ] P4 duyệt toàn corpus: [phiếu](phieu-duyet-48-ca-tro-ly-erp.md) đã duyệt24/48 ca S và D1–D5; O/F/D6 còn mở.
- [x] P5 phần chuẩn bị/dry-run được giao:52 test offline pass, prompt/profile/discovery và label lock đã bàn giao.
- [ ] P5 live: chưa mở ngân sách/provider/dữ liệu thật; accuracy/usage/cost/latency chưa đo.
- [x] P6 phần được giao: cổng gọi hai action đọc, journal đủ call nhưng giữ primary budget, deadline/cancel và hồi quy cục bộ; [báo cáo](ket-qua-p6-cong-goi-deadline-cancel.md).
- [x] V2 API/direct/read sau flag: context/evidence/adapter/pending/token/replay và fixture; [báo cáo](ket-qua-v2-hai-action-doc-tro-ly-erp.md).
- [ ] P6/T1 phần còn lại: nối UI/client context và lựa chọn V2 khi giao riêng, đánh giá chi phí persistence/quyền/retention, đo model khi được cấp ngân sách, retrieval/tích hợp/rollout và slice ghi.

Đã bàn giao đến API V2 direct/read bằng fixture. Cap24/accounting, ngân sách model0 và cấu hình production giữ nguyên; các flag mặc định tắt. Dừng trước chuyển UI, thao tác ghi, rollout và P5 live.
