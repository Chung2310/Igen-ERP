# Sửa nhánh nhận diện thao tác bị trả “không hỗ trợ”

Ngày 21/11/2026. Đã sửa runtime đường chat legacy dùng chung; không chỉ cập nhật kế hoạch. Không gọi model thật, API nghiệp vụ thật, DB thật hoặc deploy.

## 1. Bằng chứng và giới hạn chẩn đoán

Ảnh local cho thấy yêu cầu tạo dự án lao động nhận câu trả lời hướng dẫn dự phòng. Catalog có `worker.project.create` và API POST tương ứng; mã và tên dự án là hai trường bắt buộc riêng. Chưa có trace của chính phiên local để khẳng định vì sao model hoặc danh mục theo quyền dẫn đến câu trả lời đó.

Đã tái hiện điểm yếu trong code bằng provider giả lập: nếu model trả `intentType=unsupported` trên danh mục đầy đủ, interpreter chấp nhận kết luận này mà không kiểm lại công cụ. Bốn ca đọc/tạo/sửa/xóa đều thất bại trước sửa. Đây là bằng chứng về nhánh xử lý, không phải phép đo độ đúng của model thật.

## 2. Thay đổi runtime chung

Sửa `server/assistant/semantic-interpreter.ts`:

1. Khi kết quả là unsupported, chưa hủy và còn workflow được phép, tìm lại công cụ trên **toàn danh mục enabled đã được truyền theo quyền**, kể cả action bị discovery phân hệ loại ra.
2. Lượt tìm công cụ chỉ nhận metadata gọn, trả tối đa 5 actionId; server đối chiếu lại từng ID. Không dùng payload hoặc giá trị do lượt này trả về để thực thi.
3. Phân tích lại câu gốc, pending và lịch sử bằng schema chi tiết của các ứng viên. Không dùng lại giá trị từ kết luận unsupported trước đó.
4. Kết quả quay về prepare/resolver/confirmation/dispatch/completion hiện hữu. Không xác nhận thay người dùng, không mở quyền và không gọi API ngay từ bộ tìm công cụ.
5. Mỗi lần diễn giải chỉ phục hồi một lần; nếu vẫn chưa xác định được thì hỏi lại. Không lặp vô hạn. Câu hủy, hỏi đáp, discovery giới thiệu và câu hỏi làm rõ đã có không bị bước phục hồi ghi đè.

Đây là cơ chế chung cho catalog, không có nhánh nhận diện riêng tên VINSCON20 hoặc regex riêng cho dự án lao động. V2 prototype vẫn giữ giới hạn hai action đọc và không được dùng làm đường ghi.

## 3. Ca hội thoại đã kiểm chứng bằng fixture

| Ca | Kết quả |
|---|---|
| Câu ngắn trong ảnh | Chọn tạo dự án, giữ `vinscon20`, hỏi Mã dự án; không tự lấy tên làm mã; chưa ghi |
| Câu dài trong ảnh | Giữ VINSCON20, 5 lao động, 6 ngày; hỏi mã còn thiếu, preview rồi mới POST giả lập |
| Bổ sung mã | Ghép vào cùng bản nháp, giữ thông tin đã cung cấp |
| Đồng ý tạo | Đúng một POST, workerIds do server phân giải; ngày làm được chuẩn hóa thành 1–6; kết quả có bảng chung |
| Gửi lại cùng request xác nhận | Trả kết quả đã lưu, không tạo thêm; fixture mô phỏng unique requestId của DB |
| Hủy xác nhận | Không POST/PATCH |
| Bỏ qua optional sau tạo | Không thêm bản ghi hoặc cập nhật ngoài yêu cầu |
| Đồng ý bổ sung địa điểm | Preview, xác nhận, một PATCH vào đúng dự án vừa tạo; tổng số POST vẫn một |
| Discovery chọn sai HR trên catalog đầy đủ | Phục hồi tìm được worker create từ danh mục được phép |
| Đọc/sửa/xóa thuộc các action khác | Cùng cơ chế phục hồi; không giới hạn vào create hoặc sản phẩm |
| Thiếu quyền/disabled, ID ngoài shortlist, JSON lỗi, provider lỗi, hủy | Dừng hoặc hỏi theo nhánh tương ứng; không biến thành lệnh ghi |

Mọi provider response đều là fixture; API và persistence dùng mock, có chặn fetch/network/DB ngoài mock. Các ca này không chứng minh độ chính xác ngôn ngữ hoặc mức bao phủ toàn bộ 1.004 action.

## 4. Kiểm tra và chi phí

- Workflow recovery + hội thoại lao động: **81 test pass**.
- P6 gate/deadline/cancel: **359 test pass**.
- V2 đọc: **122 test pass**.
- Hồi quy budget/presentation/formatter/reference/quotation: **69 test pass**.
- P5 dry-run: **52 test pass**; cập nhật harness phân biệt `capability-check` với discovery/interpretation, không đổi nhãn đã duyệt.
- Bộ migration provider/model: **109 test pass** (có 58 test semantic trùng với bộ recovery; không cộng lặp khi tính tổng).
- `npm run typecheck`: **pass**.

Nhánh unsupported có thể thêm tối đa hai bước gọi model logic: tìm ứng viên và phân tích schema đã thu hẹp. Bước tìm có giới hạn output 1.024 token, timeout transport 20 giây, outer timeout 25 giây và retry theo provider với `maxRetries=1`; bước phân tích dùng giới hạn interpreter hiện hữu. Request control/deadline/cancel hiện hành vẫn áp dụng khi được bật. Không có giới hạn thời gian cả turn mới cho môi trường đang tắt safe execution.

Dry-run 24 ca mỗi profile hiện ghi **27 request giả lập CAT-NARROW**, **54 CAT-PRODUCTION-SHAPED**; mỗi profile có 3 capability check. Profile sau có 1.003 workflow enabled từ catalog tổng 1.004, không đại diện quyền của một người dùng thật. Số request, bytes và source hash được lưu trong artifact P5; không coi bytes là token hoặc số tiền thật. Phải tính cả đường phục hồi và retries khi làm lại dự toán trước P5 live. Ngân sách live vẫn 0.

Chỉ thay backend và kiểm thử; không thay UI, `.env` thật, cap24, quyền hay chính sách xác nhận. Các báo cáo P6/V2 đã công bố được giữ nguyên; kết quả rerun ghi ở đây.

## 5. Phạm vi còn lại

Chưa chạy lại ca bằng model thật trên local, chưa nghiệm thu toàn web hoặc mở V2 ghi. Việc bao phủ chức năng và bổ sung action/adapter còn thiếu tiếp tục theo [W1–W6](pham-vi-bao-phu-toan-web-tro-ly-erp.md). Bản sửa này xử lý một điểm chung khiến action đã có vẫn có thể bị bỏ qua; không biến số lượng action trong catalog thành cam kết mọi yêu cầu đều thực thi được.
