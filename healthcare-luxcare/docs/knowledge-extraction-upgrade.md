# Nâng cấp đọc tài liệu và phân tích bảng tính

Phiên bản trích xuất: 2. Không thay đổi quyền truy cập doanh nghiệp, chi nhánh, phòng ban hoặc tài nguyên.

## Hành vi

- PDF: kiểm tra toán tử ảnh trên từng trang, OCR cả trang có chữ lẫn ảnh; trang chỉ có số được kiểm tra lại. OCR theo lô tối đa 4 trang, kiểm tra đủ số trang ở mọi độ dài tài liệu. Trang không đọc rõ hoặc OCR thiếu trang làm tác vụ lỗi, giữ nguyên phiên bản đã công bố trước đó. Trang trắng cần được OCR xác nhận `blank=true`.
- DOCX: đọc phần thân, header/footer, footnotes/endnotes; giữ ranh giới bảng. Ảnh PNG/JPEG/WebP được OCR; liên kết ngoài không được tải. Đối tượng nhúng/ảnh không hỗ trợ được ghi cảnh báo “Đọc được một phần”. OCR lỗi làm tác vụ lỗi thay vì công bố nội dung giả định đầy đủ.
- XLS/XLSX/CSV: lưu sheet, dòng gốc, kiểu ô, công thức và vùng gộp cùng phiên bản nội dung. Ngày được giữ riêng với số. Không thực thi công thức.
- Tính bảng: AI chỉ tạo kế hoạch có cấu trúc; mã ứng dụng kiểm tra kế hoạch rồi tính trên toàn bộ dòng. Hỗ trợ sum/count/average/min/max/list, điều kiện AND và groupBy. So sánh thể hiện bằng các kết quả riêng kèm phạm vi. Không hỗ trợ join, OR, distinct, chênh lệch, tỷ lệ hoặc lọc ngày bằng lớn/nhỏ. Những yêu cầu này cần làm rõ, không chuyển về tính từ vài đoạn RAG.
- Chặn tính khi cột không rõ, ô gộp, công thức, lỗi ô, số dạng chữ hoặc dòng tổng phụ có nguy cơ tính trùng. Kết quả ghi tên tệp, sheet, hàng tiêu đề, khoảng dòng, điều kiện lọc, số dòng phù hợp và nguồn có revision. Bao gồm cả dòng ẩn. `count` là đếm dòng, không phải đếm duy nhất.
- Giới hạn bảng: 200.000 ô, 256 cột, 6 MB dữ liệu có cấu trúc, đồng thời giữ giới hạn 500.000 ký tự trích xuất. Danh sách/nhóm kết quả tối đa 100; không âm thầm cắt kết quả.

## Kiểm thử

`npx vitest run server/assistant server/router/knowledge-workbook.local.test.ts server/router/assistant-knowledge.multipart.test.ts server/router/chatbot-rag.local.test.ts server/controller/assistant-knowledge.controller.test.ts src/components/knowledge src/components/settings/AssistantKnowledgeSettings.test.tsx`

Kiểm thử HTTP dùng router/controller, queue/worker, bộ trích xuất, công bố revision và tính toán thật; thay thế xác thực, lưu trữ và nhà cung cấp AI bằng dữ liệu local. Chưa thay thế kiểm thử MongoDB và OCR/AI thật trên staging.

## Cập nhật tài liệu cũ

Sau khi đưa mã mới lên staging, thử tệp thực tế có PDF scan, DOCX có ảnh và bảng tính đã biết đáp án. Khởi động lại web/worker để nạp mã mới. Kiểm tra cảnh báo và câu trả lời trước khi triển khai production.

Xem trước số tài liệu của một doanh nghiệp cần cập nhật:

```sh
npm run rag:reindex -- --company=CODE --extraction-upgrade
```

Sau khi xác nhận đúng môi trường và doanh nghiệp, tạo tác vụ:

```sh
npm run rag:reindex -- --company=CODE --extraction-upgrade --apply
```

Chỉ xử lý tài liệu active, chưa xóa, có tệp nguồn và phiên bản trích xuất cũ. `missingSource` báo số tài liệu cần tải lại tệp; không dùng đoạn văn bản cũ để giả lập khôi phục nội dung đã mất. Có thể bấm lập chỉ mục lại riêng từng tệp ở Kho tri thức. Bảng cũ chưa có dữ liệu ô sẽ yêu cầu lập chỉ mục lại trước khi tính.

Phiên bản mới chỉ được công bố khi đọc, chia đoạn và lưu hoàn tất; lỗi giữ phiên bản trước. Tiến trình nâng cấp không tự chạy khi khởi động ứng dụng.
