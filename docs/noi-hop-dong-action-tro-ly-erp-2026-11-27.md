# Chuẩn hóa hợp đồng action dùng chung — 27/11/2026

Đổi cách server tiếp nhận các biểu diễn tương đương trước khi validation, áp dụng qua luồng chung của trợ lý. Không thêm luật nhận diện một câu hỏi cụ thể và không bỏ điều kiện nghiệp vụ để chạy được.

## Phạm vi

Catalog hiện có **1.022 action / 21 phân hệ**, gồm **362 hợp đồng phân tích đọc** với **2.102 field**. Đây là kiểm kê schema, không phải 1.022 ca nghiệp vụ đã đạt. Các action/phân hệ không được cấp cho tài khoản vẫn không được dùng.

Các điểm tích hợp: single interpreter, composite query, semantic bindings/reviewer, đầu `prepare()` trước cập nhật/tham chiếu, và `collectValues()`. Action đăng ký sau cũng dùng lớp chung nếu đi qua các đường này.

| Trước | Sau |
| --- | --- |
| Đúng field nhưng model dùng API key, nhãn, khác hoa/thường hoặc dấu gạch nên dễ bị từ chối | Chuẩn hóa dựa trên schema; chỉ chọn khi ánh xạ duy nhất. Alias mâu thuẫn không bị ghi đè âm thầm. |
| Field number nhận `"12"`, boolean nhận `"FALSE"` thì sai kiểu | Đổi về `12`, `false` theo kiểu khai báo rồi vẫn kiểm tra min/max/integer/options. Không đoán đơn vị tiền hay số có dấu phân cách mơ hồ. |
| JSON phải đúng ngay kiểu chuỗi và mọi lá scalar | Nhận object hoặc chuỗi JSON có schema, chuẩn hóa lá và tên trường lồng nhau theo schema, giữ field lạ để validator kiểm tra. Reference vẫn phân giải theo scope. |
| `filters` chỉ nhận 7 phép, dù `where` có 14 | Danh sách lọc nhận cùng các phép bắt đầu/kết thúc, thuộc/không thuộc tập, khoảng và rỗng; biên dịch vào AST chung. |
| Có cả `filters` và `where` thì từ chối | Ghép AND với nguyên cây `where`; không làm phẳng hoặc đổi OR/NOT. |
| AST đã chuẩn nhưng binding hoặc reviewer vẫn dùng tên tương đương khác | Chuẩn hóa địa chỉ theo cùng schema trước khi kiểm tra bằng chứng. |

Ngày có thực dạng `DD/MM/YYYY` được đổi thành ngày ISO trong payload của field date. Mã, tên và reference không bị đoán thành số/ngày. Giá trị mặc định và nguồn dữ kiện vẫn theo cơ chế trình bày hiện có.

## Kiểm chứng

- Kết quả cuối: **998 test / 51 file đạt**, `npm run typecheck` đạt và `git diff --check` đạt. Đây là hồi quy offline, không phải 998 câu người dùng được kiểm thử bằng AI thật.
- Hồi quy offline có bộ mới `action-contract-flexibility.test.ts`; kiểm tra schema thật trên các phân hệ, gồm 533 field số/boolean không phải reference.
- Hội thoại qua `processTurn` và dispatcher thật với fetch mock: lọc SKU dạng OR kết hợp ngưỡng tồn dạng AND trả đúng một dòng; sửa địa điểm bằng alias vẫn đến xác nhận và không hỏi lại lịch làm việc.
- Kiểm tra âm giữ field riêng tư/field không biết, alias trùng/mâu thuẫn, số sai hoặc quá lớn, ngày không có thực, thiếu required, giới hạn cây/mảng, đọc chưa đủ và thay đổi điều kiện so với lời người dùng.
- Log và kiểm kê local: `tmp/action-contract-flexibility-20261127/catalog-audit.json`, `tmp/action-contract-all-final.log`, `tmp/action-contract-typecheck-done.log`.
- Không gọi AI/provider, API nghiệp vụ hoặc DB thật trong lượt sửa này. Không thay kết quả 121 câu đã chạy thành “đạt” từ kết quả test code; hai ca tồn kho/IMEI của đợt trước vẫn cần xác minh AI mới sau sửa.

Form chọn, trường bắt buộc, xác nhận, quyền và giới hạn chi phí giữ nguyên. Chưa thêm nguồn dữ liệu hoặc phép tính chưa có trong hợp đồng, ví dụ xếp hạng sau tổng hợp theo nhóm vẫn cần khả năng thực thi tương ứng.
