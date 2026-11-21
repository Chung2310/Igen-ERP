# Kết quả P1 — Nhãn lựa chọn sản phẩm trùng tên

Ngày: **21/11/2026**. Phạm vi: chỉ P1 theo lệnh chủ dự án; **P2 chưa triển khai, chưa deploy**.

## Thay đổi

Trong [executor.ts](../server/assistant/executor.ts), bổ sung `productCode` vào nhóm mã công khai của `referenceOptionDisambiguators`. Giữ formatter nhãn và parser lựa chọn hiện có, không đổi schema client/server.

Trước đây hai bản ghi cùng tên `Tai nghe Sóng` đều có nhãn `Tai nghe Sóng [trùng tên, cần thêm thông tin]`, bị gộp thành một lựa chọn. Sau sửa:

- `Tai nghe Sóng [mã: SP-SONG-DEN]`
- `Tai nghe Sóng [mã: SP-SONG-TRANG]`

`referenceOptionLabel` chỉ thêm phần phân biệt khi có nhãn trùng; `matchesReference` dùng cùng danh sách mã để nhận lại lựa chọn. Giá trị gửi lại vẫn là nhãn công khai đã được server đưa ra, được kiểm tra với pending trước khi phân giải lại target. Không dùng ID nội bộ để phân biệt, không lấy dòng đầu và không gọi thêm AI cho lượt bấm chọn.

Runtime chỉ thay một dòng metadata; không thay resolver exact getter, quyền, confirmation, dispatch/completion, budget24 hoặc journal. Trường `productCode` là mã sản phẩm công khai; các bản ghi không có trường này giữ cách phân biệt cũ.

## Kiểm chứng

Harness dùng `processTurn`, executor/resolver, catalog, budget, formatter/completion thật; interpretation scripted, quyền/workflow và persistence/API được mock. Chặn network/provider/DB thật như lớp B ban đầu.

Trước patch, hai test O02 mới đều **fail đúng tại việc chờ hai lựa chọn khác mã**, trong khi runtime chỉ trả một lựa chọn mơ hồ. Sau patch, **22/22 test pass, exit0**, gồm9 ca P1 và13 ca kiểm chứng/hồi quy hiện hữu trong harness.

| Ca P1 | Kết quả |
|---|---|
| Chọn mã đen | collecting → completed, detail đúng product P2 |
| Chọn mã trắng | collecting → completed, detail đúng product P3; không dùng variant ID |
| Nhập mã bằng lời | Vẫn hoàn tất đúng P3 |
| Hai bản ghi đều thiếu mã | Vẫn hỏi, không gọi primary detail |
| Hai bản ghi cùng mã | Vẫn hỏi, không gọi primary detail |
| Pending còn nhãn cũ mơ hồ | Không tự chọn; hỏi tên lại theo hành vi hiện có. Người dùng nêu lại tên thì thấy hai lựa chọn mới và chọn đúng P3 |
| Client gửi option không được đưa ra | Bị từ chối, không gọi primary detail |
| Mất quyền sau khi hiện lựa chọn | Bị từ chối trước primary detail; đây là kiểm chứng orchestration với ACL mock |
| Workflow yêu cầu confirmation | Sau chọn vẫn chờ xác nhận; chỉ sau xác nhận hợp lệ mới detail đúng P3 |

Hai ca bấm chọn có đúng một lần interpretation ở lượt hỏi đầu, không tăng khi bấm; nhãn và option không chứa product ID/variant ID. Kết quả thành công có bảng qua shared parser và journal step completed. Các ca list/detail không mơ hồ, API lỗi, fallback và chuỗi nhiều bước tiếp tục pass.

**Giới hạn còn nguyên:** F101 vẫn tái hiện false-negative ngoài100 bản ghi; detail thông thường vẫn3 physical reads/1 charged, chuỗi9 bước vẫn27/9. Test pass ở các ca này là tái hiện hiện trạng, không phải đã sửa các lỗi thuộc P2 hoặc accounting.

## Bằng chứng và cách tái chạy

```sh
node node_modules/vitest/vitest.mjs run --config server/assistant/testing/layer-b-product-audit/vitest.config.mjs --reporter=verbose --reporter=json --outputFile=server/assistant/testing/layer-b-product-audit/p1-vitest-results.json
npm run typecheck
```

- [Hồi quy](../server/assistant/testing/layer-b-product-audit/product-read.test.mjs), [kết quả Vitest](../server/assistant/testing/layer-b-product-audit/p1-vitest-results.json), [trace sau P1](../server/assistant/testing/layer-b-product-audit/p1-observations.json).
- [Trace baseline](../server/assistant/testing/layer-b-product-audit/observations.json) và [kết quả14 test ban đầu](../server/assistant/testing/layer-b-product-audit/vitest-results.json) được giữ nguyên; không ghi đè bằng lần đo sau patch.
- SHA256 executor sau P1: `5feb5c2b7d5f6fe691cfdcae971b716fec83acc7093e0491c5364d2868550978`.

`npm run typecheck`: **pass, exit0**. Không sửa frontend, không build frontend hoặc kiểm chứng giao diện bằng trình duyệt; các kết luận trên là hợp đồng phản hồi và hội thoại server cục bộ.

Rollback là bỏ `productCode` khỏi danh sách disambiguators; không có migration/persistence shape mới. Nhãn mới đã lưu trong pending vẫn là dữ liệu công khai và đối chiếu theo cơ chế cũ; khi không phân biệt được thì hỏi lại, không tự chuyển target. Dừng tại P1 để chủ dự án rà.
