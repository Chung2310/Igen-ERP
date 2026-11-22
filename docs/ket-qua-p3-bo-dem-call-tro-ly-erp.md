# Kết quả P3 — Bộ đếm call chỉ quan sát

Ngày: **21/11/2026**. Trạng thái: **đã triển khai và kiểm tra cục bộ; chưa bật production, chưa deploy, chưa làm P4**.

## 1. Kết quả chính

**161/161 test pass, exit0; `npm run typecheck` pass, exit0.** Bộ đếm khớp trace transport ở các lượt hội thoại được bật. Có72 cặp kiểm tra observer tắt/bật, giữ nguyên phản hồi, thứ tự/payload API trong trace, target, budget/no-progress và số ghi persistence mock.

`execution-budget.ts` không sửa. Test riêng xác nhận cả hai chế độ observer đều chỉ cho24 lượt đọc đã tính; lần25 vẫn bị chặn. Việc bộ đếm ghi nhận27 request phụ ở một lượt không đổi cách budget hiện tại tính9 action chính.

## 2. Phân bố đã đo

Cohort đối chiếu gồm **19 kịch bản hội thoại nhân tạo,31 lượt xử lý mỗi chế độ C**. Lấy các case chung ở cả hai chế độ; loại helper projection không có `processTurn`, safety guard, test cố ép C tắt và các ca âm chỉ dành cho C. Có list/detail, chọn trùng tên, nhập mã, pending cũ, mã thiếu/trùng, API từ chối, mất quyền, confirmation, F25/F101, fallback và chuỗi nhiều bước. Giữ cả lượt không gọi API.

| Chỉ số | C tắt: đường legacy | C bật: prototype P2 |
|---|---:|---:|
| Kịch bản / lượt | 19 /31 | 19 /31 |
| Tổng GET giao cho transport | 116 | 95 |
| Reads mà budget hiện tại tính | 23 | 24 |
| Reads/lượt: p50 | 3 | 3 |
| Reads/lượt: p95 | 5 | 5 |
| Reads/lượt: max | 27 | 18 |
| Reads/kịch bản: p50 /p95 /max | 4 /27 /27 | 3 /18 /18 |
| Call thiếu owner /purpose | 0 /0 | 0 /0 |
| Call ngoài danh sách classification đã rà | 0 | 0 |
| Event bị cắt do giới hạn bộ nhớ | 0 | 0 |

Histogram **theo lượt**:

| Số GET/lượt | Số lượt, C tắt | Số lượt, C bật |
|---:|---:|---:|
| 0 | 2 | 2 |
| 1 | 2 | 3 |
| 2 | 2 | 7 |
| 3 | 16 | 15 |
| 4 | 5 | 0 |
| 5 | 3 | 3 |
| 18 | 0 | 1 |
| 27 | 1 | 0 |

Quantile dùng nearest-rank. Mỗi chế độ chỉ31 lượt; một stress case9 bước tạo max27/18. p95=5 không chứng minh các chuỗi ERP đều nằm dưới24. Không dùng mẫu này để tăng trần hoặc chuyển accounting production.

Theo purpose: C tắt có **23 primary +71 reference +22 verification**; C bật có **24 primary +71 reference +0 verification**. F101 từ failed trước primary sang completed làm số primary/charged tăng1 ở C bật. Bộ đếm quan sát riêng các phần này, không cộng reference/verification vào budget.

Một số trace cụ thể:

- Detail duy nhất: **3 GET/1 charged** khi C tắt; **2/1** khi C bật.
- O02 chọn một mã: C tắt **3 rồi4 GET** qua hai lượt; C bật **3 rồi3**. Chỉ lượt hoàn tất có1 charged read.
- Fallback O15: **4/1 →3/1**.
- Chuỗi9 detail: **27/9 →18/9**, đúng target và thứ tự.
- F101: C tắt3 GET và0 charged, failed; C bật2 GET và1 charged, completed.

## 3. Cách cắm bộ đếm và nghĩa của số đo

[call-observer.ts](../server/assistant/call-observer.ts) giữ context bằng `AsyncLocalStorage` theo lượt, owner/phase và invocation của `callOperation`. [service.ts](../server/assistant/service.ts) đặt context cho prepare/execute/dispatch; [executor.ts](../server/assistant/executor.ts) quan sát đúng điểm `fetch` chung nên thấy cả list lookup, fallback và recheck chạy ngoài dispatch.

Mỗi lượt xuất một summary có counter tổng và tối đa256 event. Event có số invocation và parent cục bộ, logical step quan sát, action chủ/action thực, phase, purpose, method/classification, attempt, HTTP status hoặc transport error và thời gian đợi response header. Không ghi URL/path chứa ID, payload, tên sản phẩm, user/request/session ID, credential hoặc error message thô.

- `operationInvocations`: số lần vào wrapper `callOperation`, có thể gồm operation tổng hợp không tự gửi HTTP. Không đồng nhất với physical calls.
- `fetchInvocations`: số lần callback giao request cho `fetch`; không chứng minh request đã tới server trên mạng. `responsesReceived` và `transportErrors` tách riêng; lỗi trước response không có HTTP status.
- `readFetches`: số GET. Chỉ `product.list` và `inventory.product.detail` hiện được rà là `pure_read`; GET khác là `unreviewed`, không tự suy rằng không có tác động phụ. Non-GET không `readOnly` là mutation; non-GET `readOnly` chưa rà vẫn là unreviewed.
- `logicalSteps`: nhóm orchestration đã quan sát, gồm cả prepare chưa thực thi; số journal step/completed được đối chiếu riêng bằng trace. Không dùng nó thay journal.
- `chargedReads/chargedWrites`: sao chép tín hiệu sau khi `beforeCall` hiện hữu thành công, không gọi thêm hoặc sửa budget. Metadata chưa biết giữ `unknown`; purpose fallback chưa có tag riêng vẫn là reference.
- Context lồng nhau có parent invocation; lượt đồng thời được cách ly. Helper gọi ngoài context không tự tạo lượt giả; có thể bọc bằng `observeAssistantTurn` để quan sát riêng, với owner/purpose unknown nếu chưa gắn.

Flag: **`ASSISTANT_CALL_OBSERVATION=true`**, mặc định tắt. Chỉ chạy khi `NODE_ENV=test` hoặc `development`; production/staging/môi trường chưa khai báo đều bị vô hiệu hóa. Không đổi `.env`, router, deployment hoặc cấu hình production. Tắt flag là kill switch cho lượt mới; lượt đã khởi tạo context hoàn tất summary hiện tại.

Sink mặc định ghi JSON metadata ra console một lần sau lượt. Sink mới lỗi đồng bộ hoặc reject bất đồng bộ đều bị cô lập, không đổi kết quả/exception nghiệp vụ và không gửi lại request. Điều này chỉ áp dụng telemetry mới; fail policy journal, ACL, idempotency, pending, session lock và completion hiện hữu giữ nguyên. Không thêm ghi Mongo hay gọi model/API để đo.

## 4. Persistence và overhead

Trong cùng cohort19 kịch bản:

| Chế độ C | Tạo turn mock | Update turn mock | Ghi session mock |
|---|---:|---:|---:|
| Tắt | 31 | 107 | 102 |
| Bật | 31 | 110 | 102 |

Observer tắt/bật giữ nguyên từng số trên trong cùng chế độ C. Chênh107→110 giữa hai chế độ C do F101 hoàn tất thêm bước, không do telemetry ghi DB. Đây là số thao tác persistence **mock**, không phải số query hoặc latency Mongo thật.

Microbenchmark cục bộ:100 lượt warmup,40 cặp batch đảo thứ tự tắt/bật,25 lượt/batch, response giả tái sử dụng và sink noop. Median mỗi lượt: **tắt0,0106 ms; bật0,0185 ms**. Median chênh theo cặp **+0,0050 ms**, p95 chênh **+0,0709 ms**. Đây chỉ đo wrapper/context/event với response giả; không gồm HTTP, Mongo, model hoặc chi phí console thực.

Timing toàn lượt fixture cũng được lưu, nhưng thứ tự cohort cố định có JIT/cache/GC noise. Ví dụ legacy p50 tắt/bật observer là8,44/5,62 ms, còn C bật là5,37/6,64 ms. Không suy observer làm nhanh hơn hoặc có overhead production ổn định từ các số này. Chưa có SLA hoặc ngưỡng phát hành được duyệt.

## 5. Kiểm thử và bằng chứng

```sh
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/layer-b-product-audit/vitest.config.mjs --reporter=verbose --reporter=json --outputFile=server/assistant/testing/layer-b-product-audit/p3-vitest-results.json
node server/assistant/testing/layer-b-product-audit/summarize-p3.mjs
npm run typecheck
```

- [Kết quả161 test](../server/assistant/testing/layer-b-product-audit/p3-vitest-results.json), [trace4 tổ hợp flag](../server/assistant/testing/layer-b-product-audit/p3-observations.json), [phân bố và chi tiết từng kịch bản](../server/assistant/testing/layer-b-product-audit/p3-distribution.json), [overhead](../server/assistant/testing/layer-b-product-audit/p3-observer-overhead.json).
- [Hồi quy hội thoại](../server/assistant/testing/layer-b-product-audit/product-read.test.mjs), [kiểm tra observer riêng](../server/assistant/testing/layer-b-product-audit/call-observer.test.mjs). Có transport rejection, HTTP422, sink lỗi, concurrent contexts, metadata không chứa dữ liệu đầu vào, cắt event ở256 nhưng vẫn đếm đủ300, môi trường/flag tắt và boundary24 reads.
- Network/provider/DB thật bị safety guard chặn. Chỉ các test mới trong thư mục riêng được chạy; không sửa/chạy suite hội thoại cũ.
- Giữ nguyên artifact baseline14 test, P1:22 test và P2:73 test. Artifact P3 có tên riêng, không ghi đè bằng chứng cũ.
- Trong lượt dựng harness có một assertion số cặp sai vì state flag bị giữ từ describe trước. Đã reset state trước mỗi test; lượt cuối161/161 pass và exit0 mới là kết quả bàn giao.

SHA256 bàn giao:

| Tệp | SHA256 |
|---|---|
| `server/assistant/call-observer.ts` | `82bd477fb3a2fa8fc0ee31b5595c5bf73bdc8702409c5c534f27fa51f377cbf2` |
| `server/assistant/service.ts` | `16eba9e4f2d09b0166dc81bda3ca789ecd6eaa82824192ad220b45cf72f28012` |
| `server/assistant/executor.ts` | `343848e0ed1703c14a41b51d21ace1c8d35ecf2c92a1b16a6309c782c00e084a` |
| `server/assistant/execution-budget.ts` | `440627bceee07157191f6c93d12adb846b96434398d6b59c3e0ea28edf06ecd7` — giữ nguyên |

## 6. Giới hạn và điểm dừng

Đã đếm đủ HTTP chung qua `executor.callOperation` trong slice được test, gồm call phụ. Chưa kiểm kê/đo đầy đủ SDK, HTTP riêng hoặc DB trực tiếp bên ngoài transport này; `operationInvocations` không thay số I/O của các đường đó. Chưa đo cohort ghi, bulk, nhiều reference ở các miền khác hoặc lưu lượng thật. Coverage/unknown bằng0 ở mẫu hai action không đại diện catalog1004 action.

Chưa có đủ phân bố đại diện toàn hệ thống để đổi accounting/trần24 hoặc mở B2 rộng. Không thay journal fail-open/fail-closed, không nới quote và không duyệt nhãn48 case. Muốn đo live cần quyết định riêng về môi trường, sampling, metadata được phép, retention/người đọc và overhead của sink thực.

**Giữ cả flag P2 và P3 mặc định tắt. Chưa bật production, chưa deploy, dừng trước P4.**
