# Kết quả P2 — Prototype phương án C sau flag

Ngày: **21/11/2026**. **Đã triển khai và đo cục bộ; chưa bật production, chưa deploy và chưa làm P3.**

## 1. Kết quả

**73/73 test pass, exit0; `npm run typecheck` pass, exit0.** Bộ đo gồm24 fixture chạy cùng harness với flag tắt/bật (48 lượt test),24 ca kiểm tra bổ sung ở nhánh bật và1 test đối chiếu các cặp. Tất cả dùng transport/persistence/model được mock và guard chặn I/O thật.

| Ca | Physical requests: flag tắt → bật | Budget reads: tắt → bật | Kết quả |
|---|---|---|---|
| CG02, detail duy nhất | 3 → 2 | 1 → 1 | Cùng product, cùng phản hồi |
| O02, bấm chọn một trong hai mã trùng tên | 7 → 6, tính cả hai lượt hội thoại | 1 → 1 | Hai ca chọn P2/P3 đều đúng; không thêm interpretation khi bấm |
| O14/CG05, F25 | 3 → 2 | 1 → 1 | Cả hai thành công |
| O14/CG05, F101 | 3 → 2 | 0 → 1 | Tắt: failed ở list recheck; bật: completed đúng product |
| O15/CG03, fallback tên | 4 → 3 | 1 → 1 | Cùng product, cùng phản hồi |
| List rồi detail | 4 → 3 | 2 → 2 | Cùng hai bước và kết quả |
| Chuỗi9 detail | 27 → 18 | 9 → 9 | Đủ9 product, đúng thứ tự |
| Chọn mã rồi xác nhận theo workflow | 7 → 6, tính cả ba lượt | 1 → 1 | Vẫn chờ confirmation, sau đó đúng product |

Các số là leaf requests mock mà runtime thực sự tạo, không phải traffic production hoặc số query Mongo. Với F101, budget tăng từ0 lên1 vì trước đây chưa dispatch được action chính, nay action chính hoàn tất; không có thay đổi chính sách accounting/trần24.

Test đối chiếu xác nhận **23/24 cặp giữ nguyên nội dung/status phản hồi và các target primary**. Cặp còn lại là F101 được sửa theo kỳ vọng. Với các ca qua `processTurn`, path target của request detail khớp command mà budget đã nhận; helper projection riêng không có turn budget và được tách khỏi kiểm tra này.

## 2. Cách prototype hoạt động

1. `prepare` vẫn dùng resolver hiện tại tìm sản phẩm theo tên/mã. Mơ hồ vẫn hỏi/chọn, chưa pin target từ một ID tự khai.
2. Sau khi toàn bộ bước thu thập/phân giải thành công, server tạo `ProductReadProofV1` riêng trong pending, ngoài `provided`/`resolved` và ngoài input model/client.
3. Proof gắn action/field/entity Product, product ID, chủ thể/công ty/chi nhánh/cuộc hội thoại, pending ID, digest workflow+operation, thời điểm tạo và hết hạn. Thời hạn **5 phút chỉ cho prototype**, chưa phải TTL rollout được duyệt.
4. `execute` giữ kiểm tra quyền/module, workflow hiện hành, schema và confirmation. Proof hợp lệ cho detail trong allowlist mới bỏ list recheck dư. Thiếu proof thì dùng legacy; proof có nhưng sai/hết hạn thì dừng, không chọn target khác.
5. Primary exact GET vẫn qua common `dispatch`: journal/budget → kiểm lại proof ngay trước transport → gọi detail một lần → kiểm raw parent và công ty → kiểm liên kết product của variants → completion/journal chung.
6. Dùng chính response đó cho formatter contract hiện hữu; không gọi detail lần hai và không đổi output schema. Giữ raw parent khi variants rỗng. ID SKU chỉ là ID con, không dùng làm target Product.

Điểm cắm nằm **trước nhánh GET contract** trong service vì `inventory.product.detail` chạy nhánh này. Không chỉ đặt tại nhánh GET generic. Các test response sai parent/company/variant xác nhận validation thực sự chạy trước khi đánh dấu step completed.

## 3. Flag và phạm vi

Flag server: `ASSISTANT_PRODUCT_DETAIL_EXACT_VERIFY=true`. Mặc định không có flag hoặc giá trị khác `true` đều tắt. Chỉ cho phép khi `NODE_ENV` là `test` hoặc `development`, và `control.background` không bật. Production, staging, môi trường không khai báo và job nền đều dùng legacy dù flag được đặt `true`.

Không sửa file `.env`, deployment, settings người dùng hoặc router/queue; chỉ harness dùng `vi.stubEnv` bật/tắt flag cục bộ. Slice vẫn là direct work flow tra cứu sản phẩm; không thêm context/handle/token V2 hoặc mở rộng create/update.

Proof là sidecar private version1 trong `pending` vốn là Mongo Mixed; không đổi shared request/response, job envelope hoặc schema Mongo. Legacy pending không có sidecar vẫn được đọc; flag tắt bỏ qua sidecar. Proof không được đưa vào preview, bảng kết quả hoặc pending DTO gửi cho interpreter. Nó là bằng chứng server lưu nội bộ, **không phải token client hoặc bằng chứng do model tự khai**.

## 4. Kiểm tra ranh giới và restore

- Giữ hồi quy P1: mã trùng tên, nhập mã bằng lời, mã thiếu/trùng, nhãn cũ mơ hồ và option giả. Giữ bảng chung và không lộ ID trong phản hồi.
- Mất quyền giữa preview/chọn bị chặn trước primary; workflow yêu cầu confirmation vẫn chờ. ACL/workflow trong harness là mock; không tuyên bố đã kiểm integration quyền hoặc module thật.
- Proof sai version/owner/pending/digest/target, hết hạn, command target bị thay hoặc chuyển branch session đều bị chặn trước primary. Không suy sản phẩm thuộc branch cũ từ việc proof sai scope.
- Workflow đổi version: dựng lại preview, chưa detail; sau xác nhận mới detail đúng target. Workflow bị đổi mà không tăng version: digest vẫn phát hiện.
- Response sai parent, sai company hoặc variant trỏ product khác: failed, không đánh dấu step completed. Record bị xóa sau preview: exact GET404, không tìm record thay thế cùng tên.
- Product có nhiều SKU vẫn pin product parent. Product không SKU vẫn có phản hồi parent hợp lệ. Helper `lookupRecords`/projection ngoài prototype giữ hành vi cũ, chưa sửa rộng các consumer.
- Legacy pending không proof: xác nhận qua list recheck cũ. Pending có proof rồi tắt flag: tiếp tục bằng legacy, không xóa pending và không gọi detail hai lần.
- Pending F101 khi tắt flag: lỗi legacy ngoài page100 tái hiện, pending giữ nguyên; bật lại flag cục bộ và xác nhận bằng request mới thì hoàn tất. Rollback an toàn không đồng nghĩa đã sửa F101 trên đường legacy.
- Replay cùng request sau tắt flag trả cached result, không GET lại. Cancellation chặn primary. Model/client gửi proof tự tạo không vượt được bước phân giải ID.
- Default off, production/staging/unset environment và background đều được kiểm tra. Safety guard chặn external fetch, HTTP, DB và provider trước I/O; các lần guard bị gọi có chủ đích nằm riêng trong test safety.

## 5. Bằng chứng và tái chạy

```sh
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/layer-b-product-audit/vitest.config.mjs --reporter=verbose --reporter=json --outputFile=server/assistant/testing/layer-b-product-audit/p2-vitest-results.json
npm run typecheck
```

- [Runtime proof/validation/flag](../server/assistant/product-read-prototype.ts), [điều phối](../server/assistant/service.ts), [harness](../server/assistant/testing/layer-b-product-audit/product-read.test.mjs).
- [Kết quả73 test](../server/assistant/testing/layer-b-product-audit/p2-vitest-results.json), [trace tắt/bật](../server/assistant/testing/layer-b-product-audit/p2-observations.json), [24 cặp số đo](../server/assistant/testing/layer-b-product-audit/p2-comparison.json).
- [Baseline14 test](../server/assistant/testing/layer-b-product-audit/vitest-results.json) và [P1:22 test](../server/assistant/testing/layer-b-product-audit/p1-vitest-results.json) cùng trace cũ được giữ nguyên, không ghi đè.

SHA256 khi bàn giao:

| Tệp | SHA256 |
|---|---|
| `server/assistant/service.ts` | `d13843cefc94fcd0714cf39b5b22c47533dedd13e80c0740540f5b5c6b1a716d` |
| `server/assistant/product-read-prototype.ts` | `97634d82038534e0a5ed314fde9afcf00ba24f8273e8078d9ad36cce5bc17bc9` |
| `server/assistant/executor.ts` | `5feb5c2b7d5f6fe691cfdcae971b716fec83acc7093e0491c5364d2868550978` — giữ nguyên sau P1 |
| `server/assistant/execution-budget.ts` | `440627bceee07157191f6c93d12adb846b96434398d6b59c3e0ea28edf06ecd7` — chưa sửa |

Trong quá trình hoàn thiện harness có các lượt fail trước lượt cuối: kỳ vọng stress27 chưa tách flag; validation ban đầu đặt sau nhánh contract nên không chạy; kiểm command/transport áp nhầm vào helper không có budget. Đã sửa điểm cắm và phạm vi assertion, không bỏ các ca response sai. Chỉ lượt cuối73/73, exit0 được dùng làm kết quả bàn giao.

## 6. Giới hạn và điểm dừng

Đây là bằng chứng deterministic trên fixture, không là model accuracy, latency API/Mongo, SLA hay bằng chứng an toàn cho thao tác ghi. Chưa thu lưu lượng thật, chưa có bộ đếm production P3, chưa thay journal fail policy hoặc cap24; chênh physical reads và budget vẫn tồn tại.

F101 được giải quyết ở bước **tìm lại ID đã được prepare phân giải đúng**. Prototype không giải quyết recall/ambiguity khi tìm tên ban đầu bị cắt trang; raw ID tự khai không trở thành proof. Chưa triển khai trustedReferences tổng quát, V2 context/handle, background pin-at-enqueue hoặc plan DAG.

Rollback cấu hình: giữ flag tắt; legacy tiếp tục đọc pending có sidecar và không thực hiện lại result đã cache. Nếu bỏ code prototype thì sidecar còn trong Mongo Mixed được code cũ bỏ qua; pending không bị xóa. Chưa chạy migration hoặc thao tác DB thật.

**Dừng sau báo cáo này để chủ dự án rà prototype. Chưa bật production, chưa deploy, chưa làm P3 hoặc mở lớp A.**
