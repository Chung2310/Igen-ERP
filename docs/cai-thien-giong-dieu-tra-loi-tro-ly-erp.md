# Cải thiện cách diễn đạt của trợ lý ERP

Ngày: 23/11/2026. Phạm vi: bản local, áp dụng chung cho các module. Không đổi API nghiệp vụ, quyền, flag hay quy tắc xác nhận.

## Vấn đề từ các ảnh

- Câu hoàn tất quá chung: “Đã hoàn tất yêu cầu · 1 kết quả”, không nói rõ vừa làm gì.
- Câu hỏi thiếu dữ liệu liệt kê tên trường như tài liệu kỹ thuật, dù đã có biểu mẫu.
- Sau tạo, lời mời bổ sung liệt kê nhiều trường, kèm “và 3 mục khác”.
- Câu hỏi làm rõ bị nối thêm hướng dẫn điền “[đối tượng]”, “[thông tin đã có]”, kể cả khi người dùng không hỏi cách viết.
- Chẩn đoán coverage như “chưa được gắn với trường lọc”, “chưa gọi API” lọt vào lời trả lời nghiệp vụ.
- Giọng điệu trong prompt chưa giải quyết được lời dẫn cố định từ server. Kết quả dạng bảng chủ động không gửi sang model biên tập, để giữ dữ liệu và tránh thêm chi phí.

## Cách sửa

### Giọng điệu chung

Xưng mình–bạn, nói thẳng kết quả hoặc phần còn thiếu, ngắn gọn và thân thiện. Tránh lời mở đầu rỗng, giọng hành chính và lặp “nhé”. Không bắt người dùng học cách viết câu lệnh.

Quy tắc lời dẫn ERP không kể API/workflow/mapping và không dùng Markdown trang trí hay mẫu trong ngoặc vuông. Hỏi đáp kiến thức vẫn được giữ định dạng, Markdown, mã nguồn hoặc thuật ngữ kỹ thuật khi người dùng yêu cầu.

### Lời dẫn từ server

- Thiếu trường: nêu ngắn thông tin cần bổ sung và chỉ tới biểu mẫu hiện có. Không thay đổi key, nhãn, trường bắt buộc hoặc option của form.
- Xác nhận: nói rõ thao tác sắp thực hiện từ tên action đã đăng ký. Giữ các cảnh báo riêng về mật khẩu, thay quyền, xóa dây chuyền và dữ liệu nhạy cảm.
- Hoàn tất: dùng tên thao tác thực tế thay cho câu “Đã hoàn tất yêu cầu”. Không báo đã ghi khi còn ở bước xác nhận.
- Một dòng kết quả có ít nhất hai trường: bỏ đuôi “· 1 kết quả” khi shared parser vẫn nhận được bảng. Bảng một cột giữ marker để không mất cấu trúc; bảng nhiều dòng giữ số lượng.
- Sau tạo: giữ câu hỏi bổ sung, nêu tối đa ba trường gợi ý và cho bỏ qua. Không thay cách giữ ID/chi nhánh riêng tư để bổ sung vào đúng hồ sơ vừa tạo.
- Không tìm thấy: dùng câu ngắn, tránh cách nói “kết quả phù hợp cho tra cứu học viên”. Không đổi cách truy vấn hoặc tự kết luận có/không có dữ liệu.

### Hỏi làm rõ và Markdown

- Chỉ đưa hướng dẫn cách hỏi khi người dùng thực sự xin hướng dẫn/ví dụ. Không tự gắn mẫu vào mọi câu làm rõ.
- Các chẩn đoán coverage được chuyển thành lời giải thích thông thường ở bước trình bày cuối. Validation, dấu hiệu repair và điều kiện chặn vẫn giữ nguyên bên trong, không thay điều kiện để làm test qua.
- Gỡ heading/emphasis Markdown trong lời dẫn ERP. Giữ nguyên các dòng dữ liệu, tên/mã có dấu câu, chuỗi được trích dẫn, URL, đoạn mã và giá trị trong preview.
- Prompt diễn giải được bổ sung yêu cầu câu `clarification` ngắn, tự nhiên, không có thuật ngữ triển khai hoặc mẫu bắt người dùng viết lại.

## Ví dụ sau sửa bằng dữ liệu giả

Thiếu thông tin:

> Bạn bổ sung mã, tên và số điện thoại trong biểu mẫu bên dưới nhé.

Chờ duyệt:

> Bạn xem lại thông tin bên dưới rồi xác nhận để mình tạo cộng tác viên lao động nhé.

Tạo thành công:

> Mình đã tạo cộng tác viên lao động

Sau câu này là bảng Mã/Tên/Điện thoại dùng chung, với dữ liệu giả DT-QA-01/DOI-TAC-QA/0900000001.

Hỏi bổ sung:

> Bạn có muốn bổ sung không? Mình có thể thêm email, mã số thuế, người đại diện hoặc thông tin còn thiếu khác. Bạn gửi thông tin cần thêm, hoặc nói “bỏ qua” nhé.

Khi không áp dụng được điều kiện:

> Mình chưa xử lý được điều kiện “Hôm nay có ai nghỉ phép không”. Phần yêu cầu này chưa được thực hiện.

Câu cuối vẫn là thông báo chưa thực hiện, không phải kết quả tra cứu nghỉ phép. Việc sửa câu chữ không chứng minh luồng tra cứu đó đã hoạt động; không thay lỗi nghiệp vụ bằng một câu trả lời giả.

## Những gì được giữ nguyên

- Nội dung tên, mã, số tiền, ngày giờ và các giá trị người dùng đã cung cấp.
- Bảng kết quả dùng shared parser, kể cả sau biên tập theo cài đặt người dùng.
- Form, reference option, workflow/module option và token xác nhận.
- Quyền, pending, kiểm tra trước ghi và completion hook chung.
- Không hiển thị trường mặc định; không hỏi lại thông tin đã có.
- Thao tác chưa chắc kết quả vẫn ở trạng thái uncertain, không đổi thành thành công.
- Kết quả có bảng vẫn không gọi model thêm để viết lại. Cơ chế biên tập theo cài đặt hiện có tiếp tục được dùng cho phần khác; không bật một lượt gọi mới trên mọi câu.

## Kiểm tra thực tế

- `npm run typecheck`: đạt.
- Suite catalog/định tuyến/dữ liệu: **331/331 đạt**.
- Suite câu chữ và hội thoại mở rộng: **283/309 đạt**, **26 lỗi cũ** tái hiện trên baseline trước sửa presentation; **không có test thất bại mới** sau khi cập nhật các assertion phụ thuộc đúng chữ hoa của nhãn trường. Các kiểm tra dữ liệu, pending, form và API payload vẫn giữ.
- **23 test thêm vào phạm vi so với baseline đều đạt**, gồm giọng điệu, guard của bước viết lại, bảo toàn dữ liệu và render component. Trong đó kiểm tra render React bằng shared UI hiện có: **7/7 đạt**. Không cộng chồng các số này thành một tổng test duy nhất.
- Baseline dùng Vite load overlay cho đúng năm file presentation trước sửa, giữ nguyên working tree và các sửa công nợ đã có. Danh sách file thực sự load được lưu để đối chiếu.
- Không gọi model/provider thật, API nghiệp vụ thật hoặc DB thật. Không có chi phí model mới.
- Kiểm tra render là SSR component, chưa phải kiểm tra bằng trình duyệt tại 390/768/1440 px. Không sửa file UI production trong đợt này.
- Chưa deploy staging/production. Tin nhắn đã lưu không bị viết lại hàng loạt; thay đổi chính áp dụng cho câu trả lời mới.

## File và bằng chứng

- `server/assistant/reply-presentation.ts`: giọng điệu, câu hỏi/form/xác nhận, làm sạch lời dẫn và chẩn đoán cuối.
- `server/assistant/result-format.ts`: lời dẫn kết quả đọc/ghi.
- `server/assistant/completion.ts`: câu hỏi bổ sung sau tạo.
- `server/assistant/request-guidance.ts`: bỏ hướng dẫn mẫu không được yêu cầu.
- `server/assistant/service.ts`: nối các helper vào luồng chung.
- `server/assistant/semantic-interpreter.ts`: cách viết clarification trong prompt.
- Tests: `reply-tone.test.ts`, `reply-rules.test.ts`, `reply-tone-render.test.tsx` và các test hội thoại hiện có.
- Config offline: `server/assistant/testing/reply-tone/vitest.config.mjs`.
- Artifact: `tmp/assistant-reply-tone-2026-11-23/` gồm `baseline.json`, `baseline-overlay-loads.json`, `offline-final.json`, `catalog-regression.json`, `render.json`, `typecheck-final.log`, `samples.json`.
