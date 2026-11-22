# P5 — Chuẩn bị và dry-run đánh giá ngôn ngữ

Ngày **21/11/2026**. **Đã xong phần chuẩn bị/dry-run được giao; chưa chạy model thật.** Ngân sách0 USD; không bật production, không deploy hoặc làm P6.

## 1. Quyết định và phạm vi

Người dùng chọn **“Chỉ chuẩn bị và dry-run, chưa chi tiền”**, đồng thời **duyệt24 nhãn S01–S24 theo đề xuất D1–D5**. Đã cập nhật [phiếu P4](phieu-duyet-48-ca-tro-ly-erp.md) bản0.2:24/48 ca được duyệt;16 ca O,8 ca F và D6 vẫn mở.

Harness dùng **semantic interpreter và lớp đóng gói provider thật của production**, thay transport provider bằng Response nhân tạo. Không thay prompt hoặc logic diễn giải runtime. Chỉ dùng câu, lịch sử/pending công khai và metadata catalog trong repo; không đọc tài khoản, log khách hàng hoặc `.env`. API key là chuỗi fixture vô hiệu, không dùng credential thật.

Phản hồi provider đã được viết sẵn để kiểm đường xử lý. **52 test pass không phải52 ca AI hiểu đúng hoặc accuracy100%.** Nhãn đã duyệt nằm riêng trong lock; scripted reply chỉ là một ví dụ hợp lệ để kiểm plumbing, không thay các cách trả lời tương đương được phiếu chấp nhận.

## 2. Kết quả dry-run

**52/52 test pass, exit0**, gồm48 lượt chạy24 ca qua hai profile và4 control. **0 provider request thật,0 API nghiệp vụ thật,0 kết nối DB thật; không phát sinh phí model.**

| Profile fixture | Workflow enabled | Ca S | Response provider mô phỏng | Discovery | Interpretation |
|---|---:|---:|---:|---:|---:|
| CAT-NARROW | 2 | 24 | 24 | 0 | 24 |
| CAT-PRODUCTION-SHAPED | 1.003 | 24 | 54 | 24 | 30 |

Profile rộng là **fixture metadata tổng hợp** từ các workflow enabled mặc định của catalog, chưa là profile quyền của một user production. Không gọi `allowedOperations`, settings hoặc DB thật để dựng nó. Sau discovery mô phỏng chọn inventory, main interpreter nhận68 workflow; khi fallback full catalog thì nhận1.003 workflow. Không suy kết quả narrow thành production accuracy.

18 ca ở profile rộng có2 request mô phỏng;6 ca **S16/S17/S18/S19/S20/S22** có3 request: discovery → interpretation trong inventory → interpretation lại trên full catalog khi kết quả trước là ambiguous/unsupported. Đây là nhánh production quan sát bằng **đáp án scripted**, chưa là tỉ lệ fallback của model thật.

Tổng corpus là78 response mô phỏng. Hai control có thêm3 response (discovery lỗi +fallback2, action ngoài catalog1), nên artifact ghi81 response fixture. Control từ chối transport chặn thêm1 attempt trước khi tạo response; không phải một lượt provider thật.

## 3. Prompt đã đo và điều kiện còn thiếu trước live

Đo **UTF-8 bytes của JSON request body sau lớp provider**, không phải tokens hoặc dữ liệu đã gửi ra mạng:

| Nhánh | Số body | Min–max bytes/body |
|---|---:|---:|
| Narrow interpretation | 24 | 18.951–19.178 |
| Profile rộng: discovery | 24 | 368.671–368.898 |
| Profile rộng: interpretation, gồm full fallback | 30 | 119.984–1.456.319 |

Body full fallback lớn nhất khoảng1,46 MB; chưa biết token count/context limit thực tế của model. Không đổi bytes thành tokens hoặc tiền bằng một hệ số giả. Giá provider, usage, cost và latency model **chưa đo**; chưa tra giá vì không có đợt chi tiền được mở.

Main interpretation hiện yêu cầu JSON object mode, không truyền responseSchema; discovery có schema được provider service thêm vào prompt, vẫn không phải strict schema enforcement. Snapshot giữ đúng khác biệt này.

Dry-run không nạp `.env` và không đặt `OPENROUTER_MAX_TOKENS`, nên body không có `max_tokens`. Service production có hỗ trợ đọc biến này nếu được cấu hình; không dùng fixture này kết luận cấu hình production thực tế. Trước live cần giới hạn output, reserve ngân sách từng attempt và chặn cả retry/fallback/expanded interpretation, timeout/cancellation, provider allowlist và usage không xác định. **Harness hiện chỉ hỗ trợ offline, không có công tắc chuyển sang gửi thật.** Chưa tuyên bố cơ chế trần tiền đã được kiểm với provider thật.

Theo D3 đã duyệt, nhãn ngoài slice S18/S19/S20 không được áp nguyên vào accuracy full catalog. Mapping action đầy đủ cho ba ca này vẫn phải rà riêng; dry-run chỉ kiểm nhánh nhận/fallback, không chấm định tuyến full catalog.

## 4. Bàn giao và kiểm chứng

- [Harness](../server/assistant/testing/layer-a-product-evaluation/dry-run.test.mjs), [24 fixture ngôn ngữ](../server/assistant/testing/layer-a-product-evaluation/corpus-s-v1.mjs), [README](../server/assistant/testing/layer-a-product-evaluation/README.md).
- [Kết quả52 test](../server/assistant/testing/layer-a-product-evaluation/dry-run-vitest-results.json), [trace và footprint](../server/assistant/testing/layer-a-product-evaluation/dry-run-observations.json), [snapshot prompt](../server/assistant/testing/layer-a-product-evaluation/dry-run-prompt-snapshots.json).
- [Lock24 nhãn đã duyệt](../server/assistant/testing/layer-a-product-evaluation/p5-label-lock.json): ID, hàng nhãn gốc, quyết định được duyệt và source hashes. SHA256 phần24 hàng nhãn: `3b83f82846a5981128dce5e99968e3b1b708971be8b6842819f4cef98d1586f2`.

```sh
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/layer-a-product-evaluation/vitest.config.mjs --reporter=verbose --reporter=json --outputFile=server/assistant/testing/layer-a-product-evaluation/dry-run-vitest-results.json
```

Test kiểm cả lịch sử S21/S22 hiện trong prompt, pending hủy S24, literal SKU/ngày trong mã, danh mục candidate và schema injection thực tế; control kiểm catalog không hợp lệ, discovery fallback và transport bị từ chối. Dùng lại safety guard chặn network/Mongoose; fetch của provider chỉ trả Response fixture, không giữ đường thoát tới native fetch. Guard vi phạm vẫn làm test fail dù runtime catch lỗi.

Các lượt đầu phát hiện hai giả định harness sai: main interpreter không có responseSchema như discovery, và ambiguous/unsupported ở profile rộng có thể diễn giải thêm lần nữa. Đã chỉnh assertion theo source/trace thực, không sửa runtime hay đổi nhãn người dùng. Lượt cuối52/52 pass, exit0 mới là kết quả bàn giao.

Không sửa TypeScript/runtime, không chạy lại typecheck/build hoặc toàn bộ test chỉ cho harness `.mjs` mới. Source hashes runtime P3 giữ nguyên; source semantic interpreter: `2c9cbbf0ef2f1c421ce78d6be960980c45f3d70b915f2e758a0c7930a7751af1`.

## 5. Trạng thái cuối

Đã đóng phần **P5 offline** theo lựa chọn của người dùng. P5 live vẫn chưa đo: không có accuracy action/field/discovery, tỉ lệ hỏi thừa, recall, usage, cost hoặc latency model. Không đánh dấu nghiệm thu P5 live, không đổi flag P2/P3, trần24 hoặc journal. O/F và D6 chưa được duyệt; không tự chuyển sang P6 hoặc bắt đầu thu traffic thật.
