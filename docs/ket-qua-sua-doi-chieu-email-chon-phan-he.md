# Đối chiếu thiếu hợp đồng, email và lựa chọn phân hệ

Ngày kiểm tra: 23/11/2026. Phạm vi: sửa cơ chế dùng chung của trợ lý; kiểm thử cục bộ và gọi GPT-6 Luna bằng dữ liệu giả. Không deploy, không gọi API/DB nghiệp vụ thật, không xác nhận thao tác ghi. Trần gọi model của toàn đợt: **0,25 USD**.

## Thay đổi

### Đối chiếu lao động chưa có hợp đồng

Trước đây có thể chọn hai nguồn nhưng chưa có phép đối chiếu đáng tin cậy. Nay model chọn một quan hệ đã khai báo, server đọc danh sách lao động và đầy đủ các trang hợp đồng trong cùng phạm vi quyền, rồi lấy những lao động không xuất hiện trong hợp đồng bằng định danh nội bộ. Không ghép theo tên, không gửi khóa ghép cho model, không nhờ model tự tính danh sách.

`read-relations.ts` là cơ chế chung, với quan hệ đầu tiên `workers-without-contracts`. Các quan hệ khác cần đăng ký nguồn, khóa tham chiếu và trường công khai được duyệt; chưa hỗ trợ phép ghép tùy ý. Nguồn đối chiếu vẫn đi qua `prepare` → `dispatch` → `completeAssistantOperation`, kể cả trang đọc bổ sung.

Server từ chối kết luận nếu thiếu trang, trùng bản ghi giữa các trang, tổng số thay đổi, thiếu định danh/tham chiếu, hai nguồn khác phạm vi hoặc có bộ lọc làm mất hợp đồng. Giới hạn 500 bản ghi mỗi nguồn, tối đa 24 vòng phân trang và các budget hiện hữu; không tăng trần đọc hiện hành.

“Chưa có hợp đồng” có nghĩa không có hồ sơ hợp đồng chưa bị xóa trong nguồn cùng phạm vi. Không đồng nhất với “chưa ký” hoặc “không có hợp đồng còn hiệu lực”. Điều kiện thời gian/trạng thái/vị trí bổ sung chưa được phép toán này hỗ trợ vẫn phải hỏi rõ.

Sửa thêm lỗi bàn giao: giữ `requestCoverage` của kế hoạch tổng hợp để service kiểm tra lại; trước đây interpreter có thể xóa mất bằng chứng đã kiểm tra. Kết quả đối chiếu dùng bảng chung, chỉ gồm trường công khai trong catalog; ID, số điện thoại hoặc mã chưa được khai báo không tự xuất hiện.

### Email

`shared/email-policy.ts` quy định cú pháp email dùng chung: kiểm tra cấu trúc địa chỉ và miền có ít nhất hai phần, không ép miền phải nằm trong danh sách TLD công khai. Trợ lý và toàn bộ các Joi email schema hiện có dùng cùng chính sách; giữ nguyên yêu cầu bắt buộc/tùy chọn và giới hạn độ dài của từng schema.

`qa@example.test`, `qa@company.vn`, địa chỉ có `+tag` hợp lệ; sai cú pháp như hai dấu `@`, miền đơn, miền có hai dấu chấm hoặc chèn header bị từ chối. Không kiểm tra DNS, không khẳng định hộp thư tồn tại và không gửi email.

### Chọn phân hệ

Khi cần phân biệt các phân hệ, trợ lý trả lựa chọn có cấu trúc, UI dùng `StyledSelect` hiện có với nhãn “Chọn phân hệ”. Không tự chọn mặc định; nút tiếp tục chỉ khả dụng sau khi người dùng chọn. Hành vi áp dụng cho các phân hệ được cấp quyền, không hardcode UI riêng cho lao động/nhân sự.

Client chỉ gửi token lựa chọn; server giữ yêu cầu gốc và phân hệ tương ứng. Token có hạn 15 phút, gắn với lựa chọn và trạng thái pending; kiểm tra lại phân hệ còn được phép trước khi tiếp tục interpreter trong phạm vi đã chọn. Sau đó vẫn thu thập trường và xác nhận theo luồng bình thường. Lựa chọn workflow cũ vẫn tương thích.

## Kiểm thử offline

| Bộ kiểm tra | Kết quả |
| --- | --- |
| Routing, coverage, interpreter, đối chiếu, email, lựa chọn và hội thoại | 255/255 đạt |
| Form chung, bàn phím và lựa chọn phân hệ | 8/8 đạt |
| Dry-run 19 kịch bản bằng provider giả | 19/19 đạt; không có request thoát mock |
| Hai bộ matrix toàn catalog | 19.889/19.914 đạt; 25 lỗi giống baseline, không có lỗi mới |
| `npm run typecheck` | Đạt |

Matrix có 25 lỗi đã tồn tại: fixture pháp lý, kiểm kê và đối soát ngân hàng. Đã so sánh tên từng ca lỗi với `tmp/assistant-routing-fix/all-results.json`, tập chênh lệch rỗng. Đây không phải bằng chứng toàn web đã nghiệm thu.

Một lần gọi UI suite rộng ban đầu quét cả bản sao dưới `tmp/resolve-develop-production`, báo 12 lỗi thuộc sáu ca ChatbotWidget về welcome/navigation/greeting/prompt library bị chạy lặp. File form thay đổi đạt; lần kiểm tra form cô lập chỉ chạy source chính. Không tuyên bố UI suite toàn dự án đạt.

Đã render fixture dùng component thật ở 390, 768 và 1440 px, kiểm tra không tràn ngang, chọn bằng bàn phím, trạng thái chưa chọn/disabled, lỗi email liên kết và dark mode. Đây là fixture tách biệt, không phải phiên ERP có dữ liệu thật. Ảnh và JSON kiểm thử lưu tại `tmp/assistant-relations-email-module-2026-11-23/`.

## AI thật và chi phí

Đã chạy một lượt đầy đủ, **19/19 kịch bản đạt**, model `openai/gpt-6-luna` qua OpenRouter. Có **60 request model**, tổng chi phí từ `usage.cost`: **0,0368014 USD / trần 0,25 USD**. Không có lần thử trả phí khác trong đợt này. Dự phòng chi phí còn treo bằng 0; không có stop do budget hoặc lỗi provider. Không dùng dry-run để chấm độ chính xác model.

| Ca | Kiểm tra | Kết quả cuối | Request model |
| --- | --- | --- | ---: |
| L01 | Tạo dự án lao động, 5 người, 6 ngày làm | Xác nhận; đúng tên, mã, thành viên và ngày | 3 |
| L02 | Chấm công hôm nay | Hoàn tất; đúng ngày | 3 |
| L03 | Chấm công theo dự án | Hoàn tất; đúng dự án | 4 |
| L04 | Đi muộn | Hoàn tất; đúng mode và dự án | 3 |
| L05 | Vắng | Hoàn tất; đúng mode và dự án | 3 |
| L06 | Đổi địa điểm dự án chưa rõ phân hệ | Dropdown Nhân sự/Quản lý lao động → chọn lao động → xác nhận đúng dự án và địa điểm | 5 |
| L07 | Gỡ người khỏi dự án | Xác nhận; đúng dự án và người | 3 |
| L08 | Dự án thiếu lao động | Hoàn tất; đúng mode | 3 |
| L09 | Vắng trên 3 buổi | Hỏi kỳ → hoàn tất; giữ dự án, kỳ và ngưỡng | 3 |
| L10 | Tạo lao động | Thu thập/cho bỏ qua liên kết tùy chọn → xác nhận | 4 |
| L11 | Lao động chưa có hợp đồng | Hoàn tất; đúng cả 4 người, có đủ hai nguồn | 3 |
| L12 | Xuất danh sách hợp đồng Excel | Hoàn tất; tệp XLSX hợp lệ trong bộ nhớ fixture | 3 |
| L13 | Chuyển lao động thời vụ | Xác nhận; đúng người và loại lao động | 3 |
| L14 | Xóa hợp đồng | Xác nhận; đúng hợp đồng của người được nêu | 3 |
| L15 | Đổi đơn vị sử dụng lao động | Xác nhận; đúng hợp đồng và đơn vị | 3 |
| C01 | Tạo dự án chưa nêu phân hệ | Dừng ở dropdown Nhân sự/Quản lý lao động | 2 |
| C02 | Tạo dự án nêu rõ Nhân sự | Xác nhận trong Nhân sự | 2 |
| E01 | Học viên, `qa@example.test` | Xác nhận; schema API cục bộ hợp lệ | 4 |
| E02 | Học viên, `qa@company.vn` | Xác nhận; schema API cục bộ hợp lệ | 3 |

L11 trả chính xác `LAO-DONG-MAU-02`, `LAO-DONG-MAU-03`, `LAO-DONG-MAU-06`, `LAO-DONG-MAU-07`; không trả ba người đã có hợp đồng. Phân trang và người trùng tên được kiểm tra thêm bằng hội thoại offline, không chỉ fixture live một trang.

10 ca ghi đều dừng ở xác nhận; 8 ca đọc hoàn tất; 1 ca mơ hồ dừng để chọn phân hệ. Số request ghi nghiệp vụ bị thử gửi: **0**; vi phạm guard network/DB: **0**. Session và document persistence cũng là mock. Không gửi tên từ ảnh người dùng.

Receipt, request count, hash source và output model nằm trong `tmp/assistant-relations-email-module-2026-11-23/live-01/live-observations.json`; Vitest có `live-01-results.json`. Các lần offline lỗi trong quá trình phát triển không bị tính là lượt AI thật và không có chi phí.

## Giới hạn nghiệm thu

- Lượt AI thật dùng interpreter/service thật nhưng quyền, persistence và API nghiệp vụ là fixture. Không chứng minh deployment hay dữ liệu thực tế của một tài khoản đã chạy đúng.
- Thao tác ghi dừng trước xác nhận; kiểm thử schema API email chỉ validate cục bộ, không tạo học viên.
- Số action trong catalog và matrix không tương đương mọi câu hỏi trên toàn web đều được hỗ trợ.
