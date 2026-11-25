# Model LLM chính và dự phòng

Chính sách tại `shared/llm-model.ts`:

- Chính: `openai/gpt-6-luna`.
- Dự phòng: `anthropic/claude-haiku-5.5`.
- Tạo ảnh, video và giọng nói giữ model riêng.

Client text ERP và Marketing/Chat Message đều dùng chính sách này. Các tên model cũ do caller hoặc env truyền vào không thay đổi cặp model đã duyệt. Chat Message giữ API key riêng, kể cả khi dùng dự phòng. Marketing ghi nhận usage theo model thực sự được gọi.

Khi Luna gặp lỗi khả dụng (404, 408, 429, 500, 502, 503, 504, lỗi mạng hoặc timeout còn thời gian), thử Haiku tối đa một lượt; không lặp lại chuỗi hai model. Lượt chính ưu tiên failover thay vì chờ nhiều retry cùng model. Giữ nguyên messages, schema, output cap, phạm vi và xác nhận. Không chuyển sang FreeLLM hay catalog rộng hơn.

Không fallback với sai request, sai key, hết credit hoặc lỗi quyền (400, 401, 402, 403). Trường hợp OpenRouter báo in-flight budget 402 vẫn giữ cơ chế retry có Retry-After của client ERP, không đổi model để vượt ngân sách. Hủy thao tác hoặc hết deadline tổng thì dừng, không bắt đầu Haiku. Caller có `allowFallback:false` vẫn được tôn trọng.

Luồng generateText của Marketing chỉ tự phục hồi riêng khi provider đã trả thành công nhưng JSON không hợp lệ; dùng Haiku một lượt và không khởi động lại chuỗi đã thất bại. Request có ảnh tôn trọng `allowImageFallback:false`.

Kiểm chứng offline: bộ `server/assistant/testing/llm-model-migration/vitest.config.mjs` gồm test model, fallback, giữ key riêng, JSON/schema, dừng chuỗi và hủy. Không gọi AI thật trong đợt đổi chính sách này; trần chi phí kiểm thử cũ không được reset.
