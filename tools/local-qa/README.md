# Kiểm thử ERP trên máy local

`npm run qa:local` khởi chạy MongoDB replica set tại `127.0.0.1:27119`, tạo dữ liệu mẫu, chạy API smoke test và phục vụ bản build `dist` tại `http://127.0.0.1:3120`.

Chạy `npm run build` trước nếu frontend thay đổi. Lệnh QA sử dụng database riêng `igen_qa_local`, không nhận URI bên ngoài và không nạp `.env` của dự án. MongoDB binary được mongodb-memory-server tải hoặc lấy từ cache. Dữ liệu được giữ trong `tmp/local-qa/mongo` giữa các lần chạy. Dừng bằng Ctrl+C và chờ database đóng xong trước khi khởi động lại.

Tài khoản và mật khẩu nằm trong `tmp/local-qa/access.json` (đã được gitignore). Hai doanh nghiệp chính `QA_EDU` và `QA_LABOR` có các phân hệ phù hợp với loại hình, mỗi doanh nghiệp có hai chi nhánh. `QA_EMPTY` dùng kiểm tra doanh nghiệp mới; `QA_PAUSED` dùng kiểm tra chặn doanh nghiệp tạm ngừng. Tài khoản Super Admin dùng luồng xác thực riêng của sản phẩm. Token trong `browser-auth.json` chỉ phục vụ script trình duyệt local, hết hiệu lực khi khởi động lại harness.

Tài khoản quản trị `QA_EDU` để thử Đối tác bán lẻ: `abc@gmail.com` / `123456`. Các tài khoản QA khác tiếp tục dùng mật khẩu chung trong `access.json`.

Trong doanh nghiệp `QA_EDU`, trang **Đối tác bán lẻ** có bộ mẫu để thử hai tab **Chính sách** và **Hoa hồng sản phẩm**:

- CTV Nguyễn An có chính sách riêng: 250.000 đ/máy, phụ kiện 12%, công sửa chữa 11%. CTV Trần Bình dùng chính sách chung: 200.000 đ/máy, phụ kiện 10%, công sửa chữa 10%. Có thêm CTV đã ngừng và một đại lý để thử bộ lọc vai trò/trạng thái.
- Có phiên bản chính sách chung tương lai (31/12/2027) để thử ngày hiệu lực.
- Nhóm điện thoại có `QA-PHONE-128` đặt riêng 300.000 đ/máy và `QA-PHONE-256` dùng chính sách; nhóm phụ kiện có `QA-CABLE-C` đặt riêng 15% và `QA-CASE-01` có cấu hình SKU cũ để thử hiển thị dữ liệu chuyển tiếp.

Seed giữ nguyên các bản ghi có ID ổn định, nên có thể sửa các mức trong giao diện rồi chạy lại `npm run qa:local` mà không mất thay đổi vừa thử.

Seed dùng ID ổn định và giữ các bản ghi đã có. Muốn tái tạo bộ mẫu: dừng tiến trình cũ, chạy `npm run qa:local -- --reset`. Tùy chọn này xóa **chỉ database QA riêng** sau khi kiểm tra host, port và tên database.

Các lệnh kiểm tra:

- `npm run qa:regression`: chạy các file Vitest và Node test tìm được trong src/server/tools, lưu báo cáo và trả exit code khác 0 khi có lỗi.
- `npm run qa:hr`: khi `qa:local` đang chạy, đăng nhập tài khoản QA và thao tác Phòng ban trên Chrome headless (tạo, sửa, xóa qua popup), đối chiếu dữ liệu MongoDB qua API, kiểm tra nội dung các tab Sơ đồ tổ chức, Chi nhánh, Đào tạo, Quy trình, Giao việc, Lịch/Ca, Hợp đồng, Bảng lương và Tuyển dụng. Lưu báo cáo ở `tmp/local-qa/hr-browser-report.json` và ảnh Phòng ban tại 390/768/1440 px trong `tmp/local-qa/screenshots`.
- `npx vitest run server/controller/payroll-hr.integration.test.ts`: tạo nhân viên ở hai chi nhánh trong MongoDB tạm riêng; thử tạo/duyệt phiếu tạm ứng, ngày không hợp lệ, chặn duyệt sau khi đóng kỳ, rồi dùng bản ghi phiếu lương đã phát hành để kiểm tra yêu cầu xem xét lại của nhân viên.
- `npm run qa:regression -- --node-only`: chỉ chạy lại nhóm Node.
- `node tools/local-qa/browser.mjs`: khi API local đang chạy, kiểm tra giám sát ở ba kích thước sáng/tối, tạm dừng/tiếp tục và mở các trang phân hệ. Cần Chrome; đặt `QA_CHROME_PATH` nếu đường dẫn cache mặc định không có.
- `node tools/local-qa/report.mjs`: tổng hợp các báo cáo đã chạy vào `tmp/local-qa/summary.json`.
- `npm run typecheck`: kiểm tra TypeScript.

Ảnh nằm tại `tmp/local-qa/screenshots`. Bộ mẫu và smoke test chỉ xác nhận các tình huống được mô tả trong báo cáo, không thay thế kiểm thử nghiệp vụ đầu-cuối. Các đơn bán lẻ mẫu còn ở trạng thái nháp. Harness không chạy Socket.IO và các worker của server chính. Không dùng môi trường này làm server triển khai.
