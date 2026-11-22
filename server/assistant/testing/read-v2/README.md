# V2 direct/read — fixture và báo cáo

Hai action: `product.list`, `inventory.product.detail`. Chưa production, model/API/DB thật hoặc thao tác ghi. Flag `ASSISTANT_PRODUCT_READ_V2` mặc địnhfalse, cần `ASSISTANT_SAFE_EXECUTION=true` và môi trường test/development.

Từ root repository:

```sh
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/read-v2/vitest.config.mjs --reporter=default --reporter=json --outputFile=server/assistant/testing/read-v2/vitest-results.json
node server/assistant/testing/read-v2/summarize-v2.mjs
npm run typecheck
```

`summarize-v2.mjs` cần các reporter hồi quy đã tạo tại đây; nếu tái chạy đầy đủ:

```sh
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/p6-call-gate/vitest.config.mjs --reporter=default --reporter=json --outputFile=server/assistant/testing/read-v2/p6-regression-results.json
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/layer-b-product-audit/vitest.config.mjs --reporter=default --reporter=json --outputFile=server/assistant/testing/read-v2/p3-regression-results.json
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/llm-model-migration/vitest.config.mjs --reporter=default --reporter=json --outputFile=server/assistant/testing/read-v2/llm-regression-results.json
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/p6-call-gate/regression.config.mjs --reporter=default --reporter=json --outputFile=server/assistant/testing/read-v2/shared-regression-results.json
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/layer-a-product-evaluation/vitest.config.mjs --reporter=default --reporter=json --outputFile=server/assistant/testing/read-v2/p5-offline-regression-results.json
node server/assistant/testing/read-v2/summarize-v2.mjs
```

- Config có envDir riêng, không nạp `.env` root. Safety setup chặn fetch chưa mock, socket/HTTP/TLS/UDP và Mongoose ngoài mock, đồng thời thay Redis startup bằng mock.
- `product-read.test.mjs` dùng lại nền fixture P3/P6 thành file riêng, không sửa test gốc. V2 schema, evidence checker, model DTO, adapter, crypto cache và `processTurn`/executor/dispatch/completion chạy thật; provider output, auth/workflow, persistence và business HTTP được mô phỏng. Provider chỉ được gọi qua DTO V2; nhánh interpreter/summarizer legacy bị chặn.
- `semantic-read-v2.test.mjs` dùng OpenRouter wrapper thật với native fetch mock để kiểm model Luna, JSON mode, output cap và abort, không gọi provider thật.
- `router-boundary.test.mjs` chạy Express router trong bộ nhớ bằng request/response giả, không mở port; kiểm direct trước auto-queue, từ chối `/jobs`, legacy routing và unknown fields.
- `vitest-results.json` quyết định pass/fail. `v2-observations.json` được tạo cục bộ tại afterEach và bỏ khỏi Git vì kích thước lớn; chạy suite để tạo lại. `outcome` có thể là trạng thái trung gian. Trace không ghi raw option token; cache public reply đã bỏ token, vector replay được mã hóa riêng. Chỉ fixture IDs, không dữ liệu/credential thật.
- `v2-summary.json` có số call/charged theo kịch bản và source hashes. Không tính test fixture thành accuracy model hoặc Mongo/provider latency.
- TTL5/15/30 phút và lazy retention24 giờ là cấu hình prototype, chưa phê duyệt rollout. Tắt flag V2 chỉ đóng intake text mới; pending selection/decision còn hạn có thể tiếp tục bằng compatibility path khi P6 safe execution vẫn bật. Tắt P6 hoặc sai môi trường thì dừng, không tự chuyển sang legacy.

[Báo cáo bàn giao](../../../../docs/ket-qua-v2-hai-action-doc-tro-ly-erp.md).
