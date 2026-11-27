# Codex CLI cho phân tích và chọn action ERP

Codex CLI đọc mã nguồn đã làm sạch để hiểu nghiệp vụ, phân tích yêu cầu và trả JSON theo schema của trợ lý. Khi action đọc dữ liệu hoàn tất, server lọc kết quả xuống các trường công khai được chọn rồi gửi cho agent tổng hợp theo yêu cầu ban đầu. Codex không gọi API ERP, không được cấp thông tin đăng nhập nghiệp vụ và không thực thi thao tác. `service.ts` vẫn kiểm tra workflow/quyền, hỏi xác nhận cần thiết rồi gọi action qua `dispatch()` và `completeAssistantOperation()`.

## Bật trên máy chạy ứng dụng

- Cài Codex CLI và đăng nhập dưới một tài khoản hệ điều hành riêng cho planner; tài khoản đó chỉ nên đọc được checkout mã nguồn đã làm sạch, không đọc được file `.env`, khóa, dữ liệu production hoặc hồ sơ xác thực của ứng dụng.
- Đặt `ASSISTANT_PLANNER_PROVIDER=codex-cli`.
- Đặt `ASSISTANT_CODEX_CLI_CWD` trỏ tới một checkout mã nguồn chỉ đọc, được chuẩn bị riêng cho trợ lý. Checkout này cần có mã nguồn dùng để tra quy trình nhưng không có `.env`, token, khóa API, dữ liệu sản xuất, cấu hình MCP hay tệp chứa bí mật.
- Có thể đặt `ASSISTANT_CODEX_CLI_BIN` (mặc định `codex`), `ASSISTANT_CODEX_CLI_MODEL`, `ASSISTANT_CODEX_CLI_TIMEOUT_MS` (mặc định 90 giây, giới hạn 5–180 giây) và `ASSISTANT_CODEX_CLI_MAX_CONCURRENCY` (mặc định 2, tối đa 8 tiến trình đồng thời).

Không trỏ `ASSISTANT_CODEX_CLI_CWD` vào bản checkout phát triển có `.env`. Codex dùng mã nguồn trong workspace khi sandbox cho phép; process chỉ nhận các biến hệ thống tối thiểu, không chuyển tiếp biến môi trường ứng dụng ERP cho CLI.

Nếu chính sách của Codex CLI trên máy chủ chặn lệnh đọc/tìm tệp, bước planner vẫn nhận hợp đồng workflow đã được server cấp; bước tổng hợp cũng nhận định nghĩa KPI/trường từ catalog runtime. Khi đó agent không khẳng định đã đọc mã nguồn trực tiếp. Muốn agent tự tra thêm mã nguồn tùy ý, môi trường CLI cần cho phép thao tác đọc tệp trong sandbox chỉ đọc.

## Luồng xử lý

1. `semantic-interpreter.ts` gửi danh mục workflow đã được cấp, schema, câu hỏi và ngữ cảnh trợ lý tới provider đã chọn.
2. Codex đọc phần mã nguồn liên quan và trả kế hoạch có cấu trúc. Semantic interpreter kiểm tra action, trường, điều kiện bao phủ yêu cầu và các ràng buộc hiện có.
3. Nếu thiếu kỳ, phạm vi, đối tượng hoặc điều kiện quan trọng, agent trả câu hỏi làm rõ; server hỏi người dùng và chưa gọi API. Khi đủ thông tin, agent chọn một hoặc nhiều workflow đọc từ danh mục được cấp.
4. Server tự kiểm tra quyền và gọi từng API chỉ đọc. Trước khi gửi cho agent, server chiếu dữ liệu theo các trường công khai đã chọn và giới hạn số dòng/kích thước. Quy trình này áp dụng cho cả tra cứu một nguồn và báo cáo một hoặc nhiều nguồn.
5. Agent đối chiếu dữ liệu đã chiếu với yêu cầu ban đầu và câu trả lời làm rõ trong hội thoại, dùng định nghĩa nghiệp vụ trong mã nguồn khi có thể, rồi trả bảng có cấu trúc. Server xác thực bảng và hiển thị bằng bộ dựng bảng chung.
6. Thao tác nghiệp vụ vẫn đi qua dispatcher chung; Codex không tự gọi hoặc thực thi action.

Các lần chạy dùng `codex exec --ephemeral --sandbox read-only`, tắt approval prompt và giới hạn biến môi trường cho lệnh con. Bước planner đưa schema vào prompt vì `values` là object có khóa động; server phân tích JSON rồi tự kiểm tra action và trường trước khi dispatch. Bước tổng hợp kết quả vẫn dùng `--output-schema` với schema tĩnh đặt trong thư mục tạm và xóa sau khi chạy. Lỗi CLI chỉ ghi metadata đã lọc, không ghi stderr thô có thể chứa prompt người dùng. Nếu Codex lỗi hoặc timeout, server báo lỗi và không chuyển sang nhà cung cấp khác để tránh đổi hành vi âm thầm. Mặc định provider vẫn là `openrouter` cho tới khi cấu hình Codex CLI. Cấu hình provider này áp dụng cho cả bước chọn action lẫn bước agent tổng hợp kết quả đọc dữ liệu.
