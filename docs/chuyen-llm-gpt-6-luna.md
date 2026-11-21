# Đổi LLM dùng chung sang GPT-6 Luna

Ngày21/11/2026. Theo yêu cầu người dùng, **LLM chữ và phân tích ảnh/tài liệu ra chữ hiện được pin vào `openai/gpt-6-luna`**. Mã này được đối chiếu [trang model](https://openrouter.ai/openai/gpt-6-luna) và [metadata endpoint](https://openrouter.ai/api/v1/models/openai/gpt-6-luna/endpoints). Chỉ sửa code/cấu hình mẫu và kiểm tra offline; không gọi model thật, không deploy hoặc mở ngân sách P5.

## Thay đổi

- [Chính sách chung](../shared/llm-model.ts) là nguồn model LLM. Model cũ từ môi trường/caller không đổi request chữ trở lại Gemini/Qwen/DeepSeek.
- [Provider ERP](../server/service/openrouter.service.ts) và [provider Marketing](../server/modules/marketing-suite/shared/service/openrouter.service.ts) pin model tại boundary. Provider ERP không chuyển FreeLLM/model khác sau lỗi; các nhánh retry/recovery Marketing cũng dùng Luna.
- Đã đổi các bước assistant: discovery, semantic/legacy interpreter, QA/research, tài liệu/attachment, memory/summary, rewrite, mô tả workflow và tác vụ chữ Studio như chart/mindmap/slide/chuẩn hóa prompt ảnh.
- Chatbot/agent, tư vấn học viên, phân tích Campaign/knowledge/caption/Telegram, OCR và vision-to-text theo cùng chính sách. Báo giá/Pháp lý/Kiến trúc dùng model chung; key scope và billing label vẫn theo request thực.
- Bỏ `temperature` khỏi wire GPT-6 vì endpoint không hỗ trợ. Giữ JSON mode/schema, target, ngày giờ, quyền và completion hiện hành.
- Model tạo/chỉnh ảnh, video, speech-to-text và TTS giữ tuyến chuyên biệt; test routing ảnh vẫn chạy hồi quy. Các tên lớp như `geminiService` giữ tương thích import, không quyết định model thực tế.
- Cập nhật `.env.example` cho text/fallback. Không sửa `.env` thật, credential hoặc cấu hình deployment.

## Kiểm chứng

**84/84 test hồi quy pass** trên12 file; **52/52 dry-run P5 Luna pass**; `npm run typecheck` **pass, exit0**. Tổng136 test offline, không phải accuracy model thật.

Kiểm wire Luna dù môi trường/caller đưa model cũ; không temperature; giữ target/JSON; ERP không fallback FreeLLM. Test Chat Message vẫn tách key riêng cho reply/OCR/upload khỏi key ERP. Bộ migration dùng guard chặn network/DB và mock Redis rate-limit khi import controller. Lượt đầu Redis startup bị guard chặn; lượt bàn giao đã mock startup và assert không có guard violation, không có kết nối thật.

```sh
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/llm-model-migration/vitest.config.mjs --reporter=dot --reporter=json --outputFile=server/assistant/testing/llm-model-migration/vitest-results.json
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/layer-a-product-evaluation/vitest.config.mjs --reporter=dot --reporter=json --outputFile=server/assistant/testing/layer-a-product-evaluation/luna-dry-run-vitest-results.json
npm run typecheck
```

[Kết quả84 test](../server/assistant/testing/llm-model-migration/vitest-results.json), [52 dry-run](../server/assistant/testing/layer-a-product-evaluation/luna-dry-run-vitest-results.json), [trace Luna](../server/assistant/testing/layer-a-product-evaluation/luna-dry-run-observations.json), [label lock](../server/assistant/testing/layer-a-product-evaluation/p5-luna-label-lock.json).

Không sửa frontend/layout, không build hoặc tuyên bố render UI. Chưa đo accuracy/chất lượng/latency khi gọi model thật.

## P5 sau đổi model

Giữ artifact Gemini làm lịch sử; Luna có tên riêng, không ghi đè.24 nhãn S không thay đổi; source hashes mới trong lock; O/F/D6 còn mở.

[Phương án hiện tại](phuong-an-p5-model-that-va-du-toan.md) đã tính lại Luna, gồm ngưỡng giá prompt dài và đề xuất tắt cache tự động riêng cho benchmark tương lai. Dự toán có điều kiện khoảng0,76–1,37 USD theo nhịp scripted; toàn bộ ca rộng expand khoảng3,58 USD, chưa là usage thật hoặc chi phí bảo đảm.

Trần5 USD gồm pilot1 USD vẫn chỉ là đề xuất chờ duyệt. Yêu cầu đổi model không tự cấp quyền chi tiền/P6. Cap24, accounting API nghiệp vụ, journal và flag production không thay đổi.
