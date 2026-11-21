# P6: gate đọc và execution control cục bộ

Phạm vi người dùng đã chốt: giữ `legacy_primary`/cap24; journal đủ call; deadline/cancel và hồi quy; chưa V2/ghi hoặc production. Báo cáo: [kết quả P6](../../../../docs/ket-qua-p6-cong-goi-deadline-cancel.md).

Từ root repository:

```sh
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/p6-call-gate/vitest.config.mjs --reporter=default --reporter=json --outputFile=server/assistant/testing/p6-call-gate/vitest-results.json
node server/assistant/testing/p6-call-gate/summarize-p6.mjs
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/p6-call-gate/regression.config.mjs --reporter=default --reporter=json --outputFile=server/assistant/testing/p6-call-gate/regression-results.json
npm run typecheck
```

- Config dùng envDir riêng, không đọc `.env` root. Không cần key/DB/API thật. Safety guard dùng lại của lớp B; regression dùng thêm mock Redis startup từ bộ LLM.
- `product-read.test.mjs` kế thừa fixture P3 thành bản riêng:8 tổ hợp gate/C/observer, so cặp và fault injection. Không đổi test lớp B gốc. Interpretation scripted, persistence/auth/workflow và API đều mock; `processTurn`/executor/budget/completion là code thật.
- `execution-control.test.mjs` chạy helper, provider Luna và semantic interpreter thật với native fetch mock: cancellation, deadline tổng, discovery, retry/backoff, response body và cleanup/isolation.
- `p6-observations.json` là trace ở afterEach; trạng thái `outcome` có thể là trung gian. Pass/fail chính thức lấy từ reporter JSON, không từ trace.
- `p6-gate-comparison.json` so144 cặp; `p6-exact-comparison.json` giữ đối chứng C trong gate-off.
- `summarize-p6.mjs` chọn cùng19 kịch bản/31 turn của P3, kiểm counts, persistence overhead và source hashes trước khi xuất `p6-summary.json`. Không gộp helper/safety/negative-only controls vào phân bố đó.
- Một số test cố ý gọi guard để xác nhận chặn I/O; expected violations được kiểm riêng. Không có request được gửi ra mạng. Test instances không là số ca corpus hoặc accuracy model.
- Bảng timing chỉ là thời gian chạy mock một lần. Chưa đo Mongo/Redis/API/model latency hoặc overhead production.
- Chỉ `.env.example` có flag mới mặc địnhfalse. Không đặt flag trong `.env` thật; không bật production hoặc gộp P6 với V2/ghi.
