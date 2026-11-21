# Phân biệt dự án Nhân sự và dự án Quản lý lao động

Ngày 21/11/2026. Đã sửa runtime và kiểm thử cục bộ; chưa deploy production.

## Hai tài nguyên độc lập

| Loại | Phân hệ | Action tạo | API |
|---|---|---|---|
| Dự án công việc/Kanban | Nhân sự | `project.create` | `POST /kanban/projects` |
| Dự án sử dụng lao động | Quản lý lao động | `worker.project.create` | `POST /worker-management/projects` |

Hai loại có create/update/delete/list riêng, không dùng chung bản ghi hoặc ID. Dự án lao động còn có mã dự án, danh sách lao động và lịch làm; thiếu mã phải hỏi bổ sung.

## Bằng chứng thực tế

- Với model thật và dữ liệu nhân tạo, interpreter mặc định chọn đúng `worker.project.create` ở cả một action, phân hệ worker và toàn catalog enabled. Điều này chứng minh model có thể hiểu yêu cầu, không chứng minh mọi phiên đều chọn đúng.
- Trên phiên local đã đăng nhập, câu mẫu về dự án trong Quản lý lao động lại được gợi ý “Tạo dự án”. Sau khi người dùng tiếp tục trong tab bàn giao, kết quả dẫn đến `/nhan-su?sub=kanban`. Đây là bằng chứng luồng đã chọn sai loại dự án. Agent không bấm xác nhận tạo và không tự xóa bản ghi người dùng vừa xác nhận.
- Chưa kết luận nguyên nhân sâu hơn khiến danh mục/AI của phiên đó chọn ứng viên Nhân sự: chưa có đầy đủ trace và cấu hình workflow đúng phạm vi tài khoản. Kiểm tra metadata chỉ đọc đã dừng khi không xác định được phạm vi tài khoản duy nhất; không sửa quyền hoặc cấu hình.
- Lỗ hổng đã xác định trong code: chưa ràng buộc phân hệ được nêu trong câu với namespace action, và lựa chọn phục hồi trước đó có thể đưa công cụ gần giống của phân hệ khác. Việc người dùng xác nhận một preview không làm hai loại dự án trở thành tương đương.

## Thay đổi

1. `module-scope.ts` nhận diện tên phân hệ công khai từ metadata dùng chung, có xử lý cách viết “quản lí/quản lý” và không coi tên hồ sơ được trích dẫn là lựa chọn phân hệ.
2. Semantic interpreter thu hẹp catalog theo phạm vi đã nêu trước khi AI chọn công cụ. Discovery và phục hồi unsupported tiếp tục trong phạm vi đó, không quay ra toàn catalog để thay bằng dự án ở nơi khác.
3. Server kiểm tra phạm vi tại prepare, khi nhận lựa chọn thao tác, và ngay trước dispatch. Bản xác nhận sai namespace đã lưu từ trước cũng bị chặn trước API chính.
4. Nếu chỉ nói “dự án” mà chưa rõ loại, các action dự án đủ quyền được đưa ra để chọn. Nhãn có phân hệ: **Tạo dự án — Nhân sự** / **Tạo dự án lao động — Quản lý lao động**. Lựa chọn server lưu riêng, có thời hạn và version; client chỉ gửi token.
5. Thiếu thao tác khả dụng trong phạm vi đã nêu thì báo quyền/cấu hình, không thay sang namespace Nhân sự. Không mở rộng quyền hoặc bật workflow đã tắt.
6. Giữ các thao tác đối tác thuộc API `/worker-management/` hoạt động trong ngữ cảnh Quản lý lao động, dù catalog cấp phép riêng bằng module `labor-partner`. Không chặn nhầm các hội thoại hiện hữu chỉ vì mã phân hệ cấp phép khác mã màn hình.

## Kiểm tra

- **119 test pass**: scope, lựa chọn công cụ, biểu mẫu và hội thoại. Gồm tạo/sửa/xóa/list hai loại dự án; câu thiếu phân hệ; khác biệt lí/ly; từ chối công cụ sai module; thiếu quyền/catalog; chặn preview sai đã lưu từ trước; không nhầm tên sản phẩm/hồ sơ với phân hệ; không hồi quy đối tác lao động.
- **69 test pass**: hồi quy budget, presentation, formatter, reference, quotation.
- **359 test pass P6**, **122 test pass V2 đọc**, **52 test pass dry-run P5**.
- `npm run typecheck`: **pass**. `npm run build`: **pass**, có cảnh báo kích thước chunk lớn, không có lỗi build.

Sau bản sửa đã gọi Luna thật một lần với câu nhân tạo “tạo 1 dự án mới tên QA-MODULE-CHECK trong mục quản lí lao động”, từ catalog enabled đầy đủ. Kết quả: `worker.project.create`, `name=QA-MODULE-CHECK`, không tự điền code. Không discovery toàn ERP vì phạm vi đã được thu hẹp; khoảng 3,7 giây, 22.808 input / 152 output token, cost provider trả **0,0023568 USD**.

Runner chẩn đoán độc lập có tổng 5 request, cost ghi nhận **0,0135196 USD**, không gọi API nghiệp vụ hoặc DB. Đây không phải tổng chi phí của các thao tác người dùng chạy tiếp trong giao diện local; các lượt giao diện chưa được đối soát usage riêng. Giới hạn runner là 6 request/0,50 USD, không phải mở toàn bộ P5 live.

[Trace AI thật đã loại thông tin xác thực](tro-ly-erp-project-namespace-live.json) lưu kết quả, usage và SHA256 request; không chứa key hoặc prompt đầy đủ của hệ thống.

Đã dùng hoàn toàn tên/mã nhân tạo khi gửi provider. Lượt chứa tên người từ ảnh đã bị auto-review chặn trước thực thi; không gửi lại các tên đó bằng đường khác.

Lần kiểm tra giao diện cuối bị gián đoạn vì `localhost:3000` không phản hồi. Không coi kết quả runner AI là nghiệm thu lại toàn bộ đường UI local sau sửa. Các test không tạo bản ghi ERP thật; bản ghi Nhân sự được người dùng xác nhận trong tab bàn giao được giữ nguyên.

## Phần biểu mẫu từ yêu cầu trước

Đã bổ sung ô chọn thao tác, dropdown chọn một mục, checkbox chọn nhiều và ô nhập scalar còn thiếu qua `AssistantMissingInfoForm`. Submit gửi dữ liệu có cấu trúc, gắn với pending ID; không gửi một đoạn văn để model phân tích lại. Bổ sung giữ cùng bản nháp và vẫn phải xác nhận trước ghi.

15 test UI liên quan pass. Bộ UI đầy đủ có 30 pass/6 fail; đã tái hiện cùng 6 ca lỗi trên bản widget trước thay đổi biểu mẫu (điều hướng tab, Studio, lời chào, placeholder), không sửa các hành vi ngoài phạm vi để làm xanh số đo. Các form chuyên biệt cho dữ liệu lồng nhau hiện hữu được giữ nguyên; không thay bằng ô JSON thô.
