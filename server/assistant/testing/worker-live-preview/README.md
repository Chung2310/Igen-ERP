# Kiểm thử trợ lý quản lý lao động với AI thật

Corpus gồm 15 yêu cầu đã thay toàn bộ tên người, dự án, chi nhánh, địa chỉ và công ty bằng dữ liệu nhân tạo; thêm hai ca đối chứng phân hệ. Không dùng tên trong ảnh của người dùng.

Chạy production `processTurn`, semantic interpreter, catalog, module guard, resolver, form, preview, completion, định dạng kết quả và xuất Excel. Persistence, tài khoản/quyền và API nghiệp vụ dùng fixture; không kiểm thử quyền của tài khoản đang đăng nhập. `buildWorkerReport` là hàm thật với input nhân tạo. Không kiểm thử controller/DB nghiệp vụ thật hay HTTP end-to-end của local.

Mọi thao tác ghi dừng trước xác nhận. Chỉ cho phép xác nhận khi catalog chứng minh action là GET. Business fetch khác GET/HEAD bị chặn trước transport; route fixture thiếu làm test thất bại. Mongoose connect/query và raw HTTP/HTTPS bị chặn. Chế độ offline chặn cả native fetch.

## Chạy lại offline

Tại root dự án, PowerShell:

```powershell
$env:ASSISTANT_WORKER_LIVE_APPROVED='1'
$env:ASSISTANT_WORKER_LIVE_REPLAY='1'
$env:ASSISTANT_WORKER_LIVE_DRY_RUN='0'
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/worker-live-preview/live.config.mjs
```

Replay lấy output thực đã lưu trong `live-observations.json`, không gọi model/network. Ba ca L10, L11, L14 cố ý vẫn đỏ theo kết quả baseline; không sửa runtime để đổi kết quả.

Để kiểm tra plumbing bằng output AI giả lập, đặt `REPLAY='0'`, `DRY_RUN='1'`. Dry-run chỉ kiểm tra an toàn và đường chạy; không chấm chất lượng AI.

## Chạy lại trả phí

Chỉ chạy khi có quyền gửi corpus nhân tạo tới provider và chi phí. Không chạy trong CI mặc định. `*.live.ts` không thuộc mẫu test thông thường và setup yêu cầu biến opt-in.

```powershell
$env:ASSISTANT_WORKER_LIVE_APPROVED='1'
$env:ASSISTANT_WORKER_LIVE_REPLAY='0'
$env:ASSISTANT_WORKER_LIVE_DRY_RUN='0'
node --import dotenv/config node_modules/vitest/vitest.mjs run --config server/assistant/testing/worker-live-preview/live.config.mjs
```

Runner chỉ gọi `openai/gpt-6-luna` qua OpenRouter/OpenAI, tắt provider fallback. Trần một lần chạy là 1 USD/60 request, output tối đa 4096 token/request. Trước mỗi request dự phòng theo byte prompt và giá cao nhất từ metadata endpoint. Dừng khi không xác định được giá, chi phí usage, lỗi transport/provider hoặc chạm trần. Không tự chạy lại, không tự nạp tiền. Chạy lại trả phí sẽ ghi đè evidence live; lưu bản cũ trước khi chạy nếu cần giữ lịch sử.

## Evidence ngày 21/11/2026

- `live-observations.json`: 37 request thật, 0.20886525 USD theo provider usage; response đã parse, hash prompt và trace nghiệp vụ fixture. Không lưu API key/headers.
- `replay-observations.json`: kiểm tra lại cùng output AI thật, không tốn phí, với cách chấm C01 đã sửa để chấp nhận cả câu hỏi phân hệ bằng chữ.
- `live-export.xlsx`: workbook ba hợp đồng nhân tạo, chỉ trang API được trả về; đã đọc lại bằng parser XLSX.
- Báo cáo và giới hạn: `docs/ket-qua-15-kich-ban-lao-dong-ai-that.md` tại root dự án.

L10 chưa tới confirmation nên trường `resolved` chưa tồn tại. Nhãn `WRONG_VALUE:fullName` trong raw live lần đầu là phép chấm quá sớm, không phải bằng chứng AI đọc sai tên; đã sửa trong replay. C01 lần đầu bị chấm sai vì chỉ nhận `workflowSelection`, trong khi câu trả lời thực đã hỏi đúng Nhân sự hay quản lý lao động. Giữ nguyên evidence live ban đầu để đối chiếu.
