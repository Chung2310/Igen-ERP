# Tính phí trợ lý theo chi phí API thực tế

Áp dụng cho trợ lý AI (widget và chat nội bộ) và nút AI gợi ý đối chiếu văn bản.
Mỗi lần gọi OpenRouter trong yêu cầu được ghi thành giao dịch riêng, bao gồm
truy vấn phụ, embedding truy vấn, xếp hạng và tạo câu trả lời nếu được sử dụng.
Lập chỉ mục tài liệu/OCR chạy nền chưa được phân bổ phí vào ví người dùng.

`Credit = chi phí USD × AI_USD_TO_VND / 100`, làm tròn 6 chữ số thập phân.
`AI_USD_TO_VND` để trống dùng 25400; đây là tỷ giá kế toán cấu hình, không tự
cập nhật tỷ giá thị trường. Không áp dụng phí cố định 2,5 Credit/lượt.
Giao dịch lưu tỷ giá tại thời điểm phát sinh, model, token và mã generation.

Chi phí lấy từ `usage.cost` (kể cả số 0) trong phản hồi OpenRouter. Nếu thiếu,
tra `/api/v1/generation?id=...` lấy `data.total_cost`. Không suy đoán phí từ
số token. Tài liệu nhà cung cấp:
https://openrouter.ai/docs/api/api-reference/generations/get-generation

Ví hết tiền bị chặn trước khi gọi API. Vì chi phí chỉ biết sau phản hồi,
yêu cầu đang chạy vẫn có thể vượt số dư còn lại. Khoản đó được giữ ở trạng
thái chờ thanh toán, không làm ví âm; các lần gọi tiếp theo bị chặn. Sau nạp
tiền, khi tải số dư hoặc bắt đầu yêu cầu mới, hệ thống thanh toán khoản chờ.
Thiếu metadata chi phí thì giao dịch chờ đối soát, không được coi là miễn phí.
Nếu nhà cung cấp không trả cost và không có generation ID để tra cứu, cần
đối soát thủ công từ nhà cung cấp; hệ thống không tự xóa khoản chờ.

Phản hồi API đã có chi phí vẫn được tính tiền nếu bước xử lý/kiểm tra câu trả
lời sau đó thất bại. Mỗi lần gọi phụ/retry có phản hồi tính phí được ghi nhận
riêng. FreeLLM không được dùng làm fallback trong yêu cầu tính phí vì không
có nguồn chi phí xác minh. Lỗi HTTP không có phản hồi usage không tạo khoản
phí ước lượng; chi phí nhà cung cấp tính ngoài phản hồi cần đối soát riêng.

MongoDB phải hỗ trợ transaction (replica set hoặc sharded cluster). Cập nhật
ví và hoàn tất giao dịch nằm trong cùng transaction; điều kiện đủ số dư ngăn
trừ âm. Unique sparse index `aiRequestId` ngăn ghi/trừ lặp cùng generation.
Nếu triển khai tắt autoIndex, tạo index này trước khi bật server mới. Các
giao dịch AI chờ không bị bộ dọn giao dịch nạp tiền hết hạn xóa bỏ.

Kiểm thử sử dụng mock, không gọi API trả phí hoặc thay đổi ví thật.

## Người trả phí sau khi bật ví công ty

Khi `AI_COMPANY_WALLET_ENABLED=true`, chatbot và đề xuất đối chiếu pháp lý của thành viên công ty ghi `payerType=company`, `payerId=companyCode` và trừ ví Credit công ty. Admin công ty nạp ví trên web. Không chuyển số dư/giao dịch ví cá nhân cũ vào ví công ty và không xóa dữ liệu cũ. Khi cờ tắt, đường tính phí cá nhân cũ giữ nguyên.

Tài khoản cơ bản đã xác minh email và chưa thuộc công ty dùng endpoint `/api/v1/ai/personal` miễn phí, không tạo giao dịch Credit. Hạn mức và ngân sách chung được ghi trong `docs/AI-ACCESS-ROLLOUT.md`.
