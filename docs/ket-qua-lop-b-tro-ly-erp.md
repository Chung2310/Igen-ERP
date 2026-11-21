# Kết quả lớp B cục bộ — Trợ lý ERP, slice tra cứu sản phẩm

Ngày chạy: **21/11/2026**. Trạng thái: **đã chạy bộ test mới, chờ chủ dự án rà; chưa bugfix, chưa duyệt T0.1-B/T1**.

## 1. Kết quả chính

- **14/14 test mới pass, exit code 0** ở lượt bàn giao, Vitest 4.1.10, pool `forks`.
- Tái hiện false-negative khi sản phẩm tồn tại **ngoài 100 bản ghi đầu** và phải phân giải lại ID. **Không tái hiện lỗi với bản ghi thứ 25**: executor đã đặt `limit=100`, khác default 20 của API. Các tài liệu trước đã bỏ sót bước này và được hiệu chỉnh.
- Xác nhận chênh số request transport so với journal/budget: chi tiết đơn có 3 leaf reads nhưng tính 1; chuỗi 9 chi tiết có 27 leaf reads nhưng tính 9.
- P2/P3 trùng tên nhưng khác productCode bị gộp thành **một lựa chọn không phân biệt được**. Bấm lựa chọn đó vẫn collecting; nêu mã P3 bằng lời thì hoàn tất đúng P3.
- Xác nhận projection detail có SKU row ID khác product ID, nhưng **không tái hiện việc gọi detail bằng nhầm variant ID** trong các đường đã chạy. Đây không là bằng chứng rằng mọi consumer khác đều đúng.
- Detail có variants rỗng tạo projection rỗng dù parent product tồn tại. Chưa chạy end-to-end toàn bộ trình bày cho trường hợp này, nên chưa kết luận UI chắc chắn báo “không tồn tại”.

**“Test pass” là kiểm tra/tái hiện hiện trạng có kiểm soát, không phải mọi expected nghiệp vụ đã pass hoặc các lỗi đã được sửa.** Lớp A/model thật, production API/DB và hiệu năng Mongo chưa đo.

## 2. Phạm vi và mức cô lập

| Thành phần | Cách chạy |
|---|---|
| Runtime được dùng thật | `processTurn`, `prepare`/`execute`, catalog, resolver/lookup/executor, formatter/completion và `ExecutionBudget` hiện tại |
| Interpretation | Scripted output theo schema/action; không gọi LLM, không đo hiểu tiếng Việt |
| Quyền/workflow | Mock profile chỉ cho hai action; không chứng minh middleware/backend ACL production đã được kiểm thử |
| Assistant persistence | Session/turn trong bộ nhớ, có requestId/digest, pending, journal và counters; không kết nối Mongo |
| API sản phẩm | Fetch mock theo company, query, page/limit, product/variant fixture; mô phỏng contract đã đọc, **không chạy ProductCatalogService hoặc DB thật** |
| Guard | Fetch ngoài whitelist, socket/HTTP/TLS/UDP, Mongoose ngoài mock và provider bị chặn; afterEach fail nếu runtime có vi phạm dù nó catch lỗi |
| Negative control | Cố ý gọi URL ngoài whitelist, HTTP, Mongoose connect và provider mock để xác minh guard throw trước I/O. Bốn vi phạm dự kiến này không phải request đã gửi thật |

Không chạy test cũ, server bootstrap, MongoMemoryReplSet, model/provider thật hoặc mutation. Không sửa source runtime/test hiện hữu. Chỉ thêm test/config/guard/README/artifact trong thư mục riêng và cập nhật tài liệu.

Mock API giữ default page/limit của service, nhưng **request thực tế lấy từ executor thật**. Chính vì vậy lần chạy đầu phát hiện request đã có `limit=100`; không chỉnh mock thành 20 để buộc giả thuyết lỗi thứ 25 đúng.

## 3. Cách tái chạy và bằng chứng

Từ root repository:

```sh
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/layer-b-product-audit/vitest.config.mjs --reporter=verbose --reporter=json --outputFile=server/assistant/testing/layer-b-product-audit/vitest-results.json
```

- [Test mới](../server/assistant/testing/layer-b-product-audit/product-read.test.mjs)
- [Config chỉ chọn test mới](../server/assistant/testing/layer-b-product-audit/vitest.config.mjs)
- [Guard cô lập](../server/assistant/testing/layer-b-product-audit/safety.setup.mjs), [README](../server/assistant/testing/layer-b-product-audit/README.md)
- [Kết quả Vitest JSON](../server/assistant/testing/layer-b-product-audit/vitest-results.json): trạng thái pass/fail chính thức.
- [Observations JSON](../server/assistant/testing/layer-b-product-audit/observations.json): từng request/target/response fixture, reply, budget, turn/steps và write counters. `outcome` trong hook có thể là trạng thái trung gian; không dùng nó thay kết quả Vitest.

Lượt bàn giao bắt đầu khoảng **10:15:49 giờ Việt Nam**, duration Vitest **2,88 giây**, 14 pass. Thời gian này là runner/mock trên máy, không là SLA của API/model/DB.

Trong quá trình xây harness, lượt đầu có assertion sai do giả định page 20, cách picker phân biệt productCode và fallback theo mã. Đã xem trace, sửa giả định của test, thêm control F25/F101 và kiểm tra lựa chọn thực. Một lần dùng pool `threads` gặp lỗi native khi shutdown trên Windows dù assertion pass; config cuối dùng `forks`, lượt cuối exit 0. Không tính lượt thread crash là kiểm tra thành công hoàn chỉnh.

## 4. Kết quả từng ca

“Leaf reads” dưới đây là request mà executor thật tạo và fetch mock nhận, **không phải HTTP đã gửi ra mạng**. “Journal entries” là số phần tử `steps` đã lưu; entry ở trạng thái executing khi lỗi không có nghĩa đã thành công. Các probe gọi trực tiếp helper không có turn/dispatch, được tách rõ khỏi thống kê processTurn.

| Case / cohort | Kết quả hiện trạng | Leaf reads | Budget reads | Entries | Kết luận |
|---|---|---:|---:|---:|---|
| Existing-shaped list api-rejection | failed, API mock 422 | 1 | 1 | 1 | Đường từ chối API chính được quan sát, không success giả |
| Existing-shaped detail api-rejection | failed, API mock 422 | 3 | 1 | 1 | Hai lần reference không tính riêng |
| Existing-shaped list success/control | completed đúng P1 | 1 | 1 | 1 | Một request list, đúng query/company |
| CG02/detail success | completed đúng product P1 | 3 | 1 | 1 | List theo mã → list không q tái kiểm tra ID → exact detail |
| O02/CG06, ba lượt | collecting → collecting → completed P3 | 11 | 1 | 1 | Picker gộp P2/P3; bấm không chọn sai, mã P3 bằng lời phục hồi đúng |
| O14/CG05, F25 | completed đúng P1 ở vị trí 25 | 3 | 1 | 1 | Không xác nhận giả thuyết page 20; request có limit100 |
| O14/CG05, F101 | failed trước primary detail | 3 | 0 | 0 | Target có trong q result, mất ở list recheck trang 100; false-negative được tái hiện |
| O15/CG03, fallback theo tên | completed đúng P1 | 4 | 1 | 1 | Query rỗng giả lập → fallback không q → recheck ID → detail; thiếu bookkeeping call phụ |
| CG06/helper variants rỗng | parent response có P1, rows `[]` | 1 | Không qua turn | Không qua turn | Projection không bảo toàn một row parent khi không có SKU |
| CG06/helper variants có dữ liệu | 2 rows SKU, productId đúng P3 | 1 | Không qua turn | Không qua turn | ID row khác ID sản phẩm; không có request sai target trong probe |
| Hai bước list → detail | completed | 4 | 2 | 2 | Có read amplification ngay chuỗi đơn giản |
| Control helper ID ngoài 100 | resolver có lỗi dù target fixture tồn tại | 2 | Không qua turn | Không qua turn | Hai list không q đều thiếu target, không exact get |
| Stress mới: 9 chi tiết khác nhau | completed cả 9 đúng target | 27 | 9 | 9 | Accounting tính đủ sẽ chạm trần24 nếu giữ nguyên hình dạng call |
| Safety negative control | Các guard throw đúng | 0 | Không áp dụng | Không áp dụng | Không có I/O thật; vi phạm cố ý được kiểm tra riêng |

### 4.1. Trace O02 và phân biệt ID

P2/P3 cùng tên “Tai nghe Sóng”, mã `SP-SONG-DEN` và `SP-SONG-TRANG`, ID sản phẩm và ID variant riêng biệt.

1. Lượt đầu đọc list 3 lần, trả một option `Tai nghe Sóng [trùng tên, cần thêm thông tin]` thay vì hai lựa chọn khác nhau.
2. Bấm option hợp lệ đó đọc thêm 5 lần và vẫn collecting; không có request detail chọn tùy ý P2/P3.
3. Cung cấp `SP-SONG-TRANG` bằng text/script interpretation đọc 3 lần và gọi detail chính xác ID sản phẩm P3.
4. Probe projection độc lập cho thấy hai SKU row có `row.id != P3`, `row.productId == P3`.

Do đó, lỗi khả dụng picker được tái hiện; giả thuyết “runtime dùng SKU ID làm product ID” **chưa được xác nhận** trên đường này. `referenceOptionDisambiguators` hiện chưa dùng productCode để phân biệt nhãn hai sản phẩm; xem [executor.ts](../server/assistant/executor.ts), `referenceOptionLabel` quanh 3905 và `rawRecords` quanh 3968.

### 4.2. Trace F25 đối chứng F101

API default20 ở service không phải giới hạn request này. [executor.ts](../server/assistant/executor.ts), đoạn 644–646 thêm `limit=100&page=1` cho GET không dùng adapter contract như `product.list`.

- **F25:** list q=`SP-MAY-A1` trả target → list q rỗng trả đủ25 → GET đúng product ID → completed.
- **F101:** list q=`SP-MAY-A1` trả target → execute phân giải ID qua list q rỗng chỉ trả100 item đầu → fallback list không q vẫn100 → failed, không gọi detail chính.

Fixture oracle có target thứ101 và request đầu đã tìm được nó. Đây là false-negative trong tái phân giải, không phải thiếu record hoặc model chọn sai. Chưa có bằng chứng khớp nhầm sang record khác trong các ca đã chạy. Exact getter là phương án spike để tránh list recheck, không phải bugfix đã thực hiện.

### 4.3. O15 là fault injection có chủ đích

Fetch mock cố ý trả rỗng khi có q theo tên dù record tồn tại, để chạy nhánh fallback được khai báo trong executor. Không kết luận API production thường xuyên bỏ sót tên từ ca này. Fallback theo tên khớp thành công; ca chạy ban đầu dùng mã không khớp cùng cách vì matcher không đối xử productCode như mọi label. Phần đó chưa được mở thành một bugfix/test riêng trong bản bàn giao.

## 5. Phân bố reads và tác động trước B2

Đã kiểm kê test hiện có trong [tài liệu census](kiem-ke-kich-ban-doc-phu-hien-co.md). Test mới tái hiện hình dạng hai success-probe và hai api-rejection-probe của ma trận generic, cộng các case mới trùng tên/page/fallback/multi-step. **Không chạy các test cũ hoặc suite cần MongoMemoryReplSet.** Không gọi kết quả này là phân bố đầy đủ mọi conversation test hiện hữu.

Chỉ lấy **12 lượt processTurn** của 10 scenario hội thoại, không gồm helper probes và safety control:

| Leaf reads mỗi lượt | Số lượt |
|---:|---:|
| 1 | 2 |
| 3 | 6 |
| 4 | 2 |
| 5 | 1 |
| 27 | 1 |

- Tổng: **60 leaf reads**, budget hiện tính **18**; 42 reads không được tính riêng trong cohort này.
- p50 = **3**, p95 = **27**, max = **27**, dùng nearest-rank trên n=12. Đây là số lượng call, không phải độ trễ và không phải thống kê production; p95 chịu ảnh hưởng mạnh của một stress case nhân tạo.
- Cohort 9 bước mới là stress có chủ đích, không phải kịch bản cũ đã đo hoặc tần suất người dùng. Nếu tính tất cả leaf và chưa giảm reread, cùng đường này sẽ đụng hard cap tại lần đọc25. **Chưa đổi budget thật để chạy accounting mới.**
- Chưa có phân bố đại diện các chuỗi ghi/bulk/nhiều reference và miền khác; chưa đủ cơ sở tăng trần chung hoặc mở B2 toàn hệ thống.

**Giữ nguyên trần24.** Trước B2 cần chủ dự án rà bảng case, mức giảm call có thể đạt bằng spike, lượng đường hợp lệ bị chặn và quyết định giữ/đổi trần hoặc rollout giới hạn. Không bỏ tính call phụ, tăng trần hoặc đổi no-progress âm thầm để giữ test pass.

### 5.1. Số lần ghi persistence mock, không phải latency Mongo

| Scenario | Turn create | Turn update | Session write |
|---|---:|---:|---:|
| List success | 1 | 4 | 3 |
| Detail success | 1 | 4 | 3 |
| O02 ba lượt | 3 | 6 | 9 |
| F101 failed | 1 | 1 | 3 |
| Fallback success | 1 | 4 | 3 |
| Chuỗi hai bước | 1 | 8 | 4 |
| Chuỗi chín bước | 1 | 36 | 11 |

Các counter ghi nhận lời gọi mock assistant models, không bao gồm DB queries thật, indexes, durability, contention hoặc mạng. Không thể dùng thời gian test để quyết định chi phí Mongo của gate mới. B5 cần đo latency/p50/p95 và writes amplification theo chính sách journal đã chọn.

## 6. Bốn điểm thiết kế sau review

1. **Budget:** số đo đã có witness27/9; không duyệt tăng cap. Phân bố này chỉ đủ chứng minh thay accounting có thể đổi hành vi, chưa đủ định ngưỡng toàn ERP.
2. **Journal fail-open cho pure read:** giữ là phương án cần duyệt, chưa code hoặc test chính sách mới. Chỉ có thể xét record call telemetry bị lỗi khi request identity, session lock và memory budget vẫn đáng tin; không fail-open claim/idempotency/scope/pending. Mutation/effectful/unreviewed giữ fail-closed. Mỗi trường hợp degraded phải có reason/quan sát rõ, không báo journal đã ghi thành công.
3. **Giảm call:** [spike trustedReferences](spike-trusted-references-tro-ly-erp.md) so sánh giữ list recheck, exact preflight + main (có thể vẫn double-call), và dùng primary exact detail làm verification rồi tái sử dụng raw parent response. Cần giữ ACL/module/workflow/selection/preview và không suy unique từ trang đầu.
4. **Quote:** chưa đo false `UNSOURCED_VALUE` hoặc hỏi thừa ở lớp A. Giữ thiết kế0.2 để đánh giá bằng model thật sau khi có ngân sách; không nới literal/NFC theo cảm giác từ test orchestration mock.

## 7. Backlog bugfix độc lập, chưa triển khai

| Vấn đề | Bằng chứng hiện có | Phạm vi tiếp theo cần duyệt |
|---|---|---|
| Reference target ngoài page100 | F101 + ID helper tái hiện false-negative | Bugfix resolver/exact verification riêng, regression vượt100; không đợi V2 |
| Nhãn sản phẩm trùng tên | O02 trả một option không phân biệt được P2/P3 | Bugfix disambiguation theo public code, vẫn giữ quyền và không tự chọn |
| Reference/fallback không tính đủ call | Trace detail3/1, fallback4/1 và stress27/9 | T0.1-B với quyết định accounting/cap trước rollout |
| Variant ID bị dùng sai thành product | Không xác nhận trong đường đã đo | Không ghi “đã có lỗi nhầm ID” hoặc sửa runtime khi chưa có call site tái hiện |
| Detail không SKU bị projection rỗng | Helper có parent nhưng trả rows rỗng | Thêm end-to-end case/duyệt expected trước khi quyết định sửa renderer/formatter |

## 8. Điều kiện dừng và phần chưa làm

Bàn giao kết quả thực tế và spike để chủ dự án rà. Chưa sửa runtime/test cũ, chưa bugfix, chưa T0.1-B/T1 hoặc deploy. Chỉ chạy file test mới bằng config riêng; không typecheck/build toàn dự án vì không đổi TypeScript source hoặc UI. Model live accuracy, discovery live, cost và latency thật vẫn **chưa đo**.

Đã so SHA-256 của10 file runtime có trong bảng snapshot của baseline sau khi test: **10 khớp,0 thay đổi**. Đây là kiểm tra cho các file đã liệt kê, không tuyên bố working tree toàn repository sạch; dự án đã có thay đổi khác từ trước.

T0.4 đã có một phần bằng chứng deterministic lớp B; chưa hoàn tất tập O/corpus, nhãn chưa được duyệt toàn bộ và chưa có lớp A/end-to-end backend thật. Không đánh dấu toàn bộ baseline hoặc thiết kế V2 được nghiệm thu.
