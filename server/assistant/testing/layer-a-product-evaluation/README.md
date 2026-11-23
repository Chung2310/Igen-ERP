# P5 — Offline dry-run, ngân sách0

Người dùng duyệt24 ca S và D1–D5 ngày21/11/2026, chỉ cho chuẩn bị/dry-run. Thư mục này **không có chế độ gửi model thật**.

```sh
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/layer-a-product-evaluation/vitest.config.mjs --reporter=verbose --reporter=json --outputFile=server/assistant/testing/layer-a-product-evaluation/luna-dry-run-vitest-results.json
```

- Import semantic interpreter và provider service thật, mock fetch provider bằng Response scripted. Không import `processTurn` hoặc dispatch API nghiệp vụ. Không nạp `.env`; key vô hiệu được stub trong test rồi phục hồi.
- Config chỉ include test tại đây, tái dùng safety setup chặn fetch chưa mock, HTTP/socket và Mongoose. Không native fetch, provider usage hoặc cost thật; guard vi phạm làm test fail.
- CAT-NARROW dùng2 workflow; CAT-PRODUCTION-SHAPED là metadata fixture tổng hợp1.003 workflow enabled mặc định, không là profile quyền user production. Discovery scripted chọn inventory68 workflow; ambiguous/unsupported có thể fallback full catalog.
- `corpus-s-v1.mjs` chứa một phản hồi scripted cho mỗi ca. Đây không phải scorer độ chính xác hoặc toàn bộ tập câu trả lời được phép; nhãn được duyệt và các ngoại lệ vẫn theo phiếu P4.
- `p5-label-lock.json` lưu24 hàng nhãn đã duyệt và hash nguồn; không đánh dấu O/F hoặc D6 đã duyệt. Thay nhãn cần review/version mới, không sửa expected sau khi xem model trả.
- Artifact `dry-run-observations.json` lưu metadata/counter/bytes, không lưu key; snapshot prompt công khai cho một số ca nằm riêng trong `dry-run-prompt-snapshots.json`. Bytes không phải tokens, scripted pass không phải accuracy.
- S07 giữ SKU corpus `SKU-MAY-A1-128` đã duyệt. Dry-run chỉ xác minh trích xuất/prompt, chưa gọi API sản phẩm để chứng minh SKU tồn tại; không dùng SKU khác trong trace P1–P3 thay bằng chứng.
- Không thay runtime, budget24, journal, flag P2/P3 hoặc cấu hình production. Chỉ chuẩn bị live khi có lệnh mới về ngân sách/provider/dữ liệu và cơ chế hard cap cho mọi attempt/expansion/retry/fallback.

**Sau yêu cầu đổi LLM:** harness hiện dùng chính sách `openai/gpt-6-luna`, bỏ temperature không được hỗ trợ; model môi trường Gemini cũ trong test được giữ như negative control để chứng minh không override được policy. Export `luna-dry-run-*` và `p5-luna-label-lock.json`; artifact Gemini trước đó giữ lịch sử.52 test offline pass vẫn không là accuracy model thật. [Báo cáo đổi model](../../../../docs/chuyen-llm-gpt-6-luna.md).

[Báo cáo đầy đủ](../../../../docs/ket-qua-p5-dry-run-tro-ly-erp.md).
