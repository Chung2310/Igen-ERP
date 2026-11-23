# Giới hạn catalog và kiểm tra ngữ cảnh trợ lý ERP

Ngày thực hiện: 23/11/2026. Mốc đối chiếu: `1f95e4fc` (develop).

## Luồng sau sửa

1. Giới hạn bằng quyền và phân hệ người dùng nêu rõ trước khi gọi model. Không gọi discovery phân hệ khi chỉ còn một phân hệ.
2. Khi cần, chọn phân hệ rồi nhóm chức năng bằng danh mục mô tả ngắn, gồm loại hồ sơ, nhãn đầu vào/đầu ra và các lựa chọn có thật. Tên/mã bản ghi không tự quyết định phân hệ.
3. Nhóm còn lớn được chọn shortlist từ tối đa 120 mô tả ngắn. Chỉ tải schema của tối đa 24 action đã chọn. Không cắt lấy 24 action đầu danh sách.
4. Diễn giải yêu cầu bằng schema đã thu hẹp, sau đó kiểm tra action, phân hệ và từng điều kiện.
5. Nếu nhóm trả unsupported hoặc đề xuất trường không có, cho tìm lại một lần trong các nhóm còn lại của phân hệ đã chọn. Nếu thiếu coverage, cho sửa một lần trên action đã chọn (hoặc phạm vi composite đã thu hẹp). Các lần tìm/sửa dùng chung bộ đếm, giữ chỉ dẫn gốc và không lặp thêm toàn bộ chỉ dẫn vào prompt. Không ghi đè yêu cầu làm rõ hợp lệ của model bằng fallback tự động.
6. Khi vẫn mơ hồ, routing lỗi trên catalog lớn hoặc vượt giới hạn, hỏi lại. Không mở rộng trở lại toàn bộ catalog ERP.

Các giới hạn tập trung tại `server/assistant/interpretation-budget.ts`:

| Giới hạn | Giá trị |
| --- | ---: |
| Số lần gọi cho một lần diễn giải, gồm routing và sửa coverage | 6 |
| Số lần thử HTTP của mỗi lần gọi qua OpenRouter | 1 |
| Dung lượng prompt mỗi lần gọi | 96.000 byte |
| Tổng dung lượng prompt trong một lần diễn giải | 256.000 byte |
| Dung lượng mô tả năng lực trước khi gửi schema | 56.000 byte |
| Action có schema trong một lần diễn giải | 24 |
| Action có mô tả ngắn ở bước shortlist | 120 |
| Phân hệ sau discovery | 8 |
| Token đầu ra tối đa mỗi lần gọi | 4.096 |

Dung lượng tính bằng UTF-8 của messages và schema đã tính escape JSON, kèm 2 KB dự phòng. Đây là chốt dung lượng và số lần gọi của **semantic interpreter**, không phải hạn mức tiền của toàn bộ hội thoại. Viết lại câu trả lời và các lần diễn giải ở bước tiếp theo nằm ngoài bộ đếm này. Không thay đổi trần 24 lần đọc API nghiệp vụ.

## Ngữ cảnh

- Chấp nhận cụm đối tượng thuần như “các lao động” làm bằng chứng ngữ cảnh sau khi đã chọn phân hệ phù hợp.
- Không dùng cụm đối tượng đó để tự chọn phân hệ toàn cục.
- Không coi “các lao động chưa có hợp đồng”, “các lao động ở Hà Nội” hay “các lao động hôm nay” là ngữ cảnh thuần. Các điều kiện vẫn phải có mapping hợp lệ.
- Kiểm tra phân hệ người dùng nêu rõ; giữ cơ chế phân biệt dự án Nhân sự và dự án quản lý lao động. Với “dự án” chưa rõ loại và có cả hai loại khả dụng, hỏi chọn.
- Phân biệt số lượng tạo một bản ghi với ngưỡng lọc, và “quản lý” với địa chỉ “quận”. Giữ từ phủ định, kỳ, địa điểm và số lượng nhiều bản ghi trong kiểm tra.
- Có thể bỏ từ “tên”, “chọn” khi nội dung ngay sau đã có bằng chứng; chỉ bỏ “có” khi dùng làm từ hỏi tồn tại (“có ai”, “…nào”). Không bỏ điều kiện “có hợp đồng”.
- Evidence gộp ngữ cảnh với tên/reference được kiểm tra các mapping còn lại như bình thường. Không chấp nhận evidence gộp chứa điều kiện chưa được chứng minh chỉ vì có nhãn context.module.
- Bỏ qua reference tùy chọn qua form được lưu vào pending như đường chọn reference trực tiếp, tránh hỏi lặp. Không cho bỏ qua reference bắt buộc.

## Chạy offline

```powershell
npx vitest run --config server/assistant/testing/catalog-routing/vitest.config.mjs
npm run typecheck
```

Config kiểm thử dùng môi trường riêng, không tải `.env` ứng dụng. Provider, API, session và DB trong các hội thoại đều dùng mock. Setup chặn transport mạng, fetch không được mock và truy cập Mongo thật; cả request đã bị code bắt lỗi vẫn bị ghi nhận và làm test thất bại.

`semantic-routing-budget.test.ts` tái hiện phản hồi từng bị từ chối ở câu báo cáo chấm công với catalog 1.003 action khả dụng, kiểm tra sửa coverage có giới hạn, schema ngoại quyền, lựa chọn mơ hồ, shortlist lấy được action cuối danh sách và chặn prompt/lịch sử quá lớn trước khi gọi provider.

Để xuất dung lượng từng bước:

```powershell
$env:ASSISTANT_ROUTING_BUDGET_OUTPUT = "$env:TEMP/assistant-routing-measurements.json"
npx vitest run --config server/assistant/testing/catalog-routing/vitest.config.mjs
```

Số đo dùng phản hồi model giả lập, kiểm chứng luồng và dung lượng gửi. Chưa đo độ chính xác ngôn ngữ, độ trễ hay chi phí với model thật. Catalog quá rộng hoặc một schema quá lớn có thể cần người dùng nói rõ hơn; đây là hành vi dừng có chủ đích thay cho gửi toàn bộ catalog.

## Kết quả mốc giới hạn catalog (trước đợt sửa coverage/chọn nhóm)

- Bộ tập trung: **210/210 ca qua**, gồm 15 ca mới về routing/budget/ngữ cảnh. Không có lần cố truy cập mạng hoặc Mongo thật.
- Ca báo cáo chấm công với 1.003 action khả dụng: 3 lần gọi mock, dung lượng kiểm tra lần lượt **8.990 / 7.837 / 38.574 byte**. Không có lần mở rộng sang schema toàn catalog. Trường hợp cần sửa coverage: thêm đúng một lần, prompt sửa **35.440 byte**, chỉ chứa schema action đã chọn.
- Hồi quy rộng: **19.914 ca trên 1.004 action / 21 phân hệ**, **19.889 qua, 25 thất bại**. So với kết quả develop trước sửa, danh sách 25 ca thất bại giống hệt, không thêm ca thất bại. Các ca này thuộc fixture hội thoại pháp luật (17), kiểm kê (5) và ghép giao dịch ngân hàng (3); đợt sửa routing không xử lý các fixture đó.
- `npm run typecheck`: qua.
- Chỉ dùng fixture nhân tạo và mock; không gọi AI thật, API nghiệp vụ hoặc DB thật. Không deploy hay push Git trong đợt này.

Bằng chứng cục bộ ở `tmp/assistant-routing-fix/accepted-results.json`, `measurements.json`, `all-results.json`, `all-function-matrix.json`, `all-function-conversations.json` và `typecheck-accepted.log`. Đối chiếu hồi quy trước sửa tại `tmp/assistant-web-retest-2026-11-23/results.json`.

## Kết quả sửa coverage/chọn nhóm ngày 23/11/2026

- **235/235** test tập trung qua. Fixture gồm phản hồi AI thật đã ghi lại, trường hợp số lượng tạo, ngữ cảnh trộn tên/reference, nhãn form, từ nối tới giá trị, mapping một nguồn đọc, trường riêng tư và khóa nhóm ngoài quyền.
- Hồi quy **19.914 ca / 21 phân hệ**: 19.889 qua, 25 ca lỗi giống baseline, không thêm ca lỗi. Typecheck qua.
- Lượt AI đầy đủ cuối: **15/19** ca đạt. Sau sửa hai trường hợp coverage còn lại, chỉ gọi AI kiểm lại L06/L12; xuất Excel đã hoàn tất, còn L06 hỏi đúng loại dự án. Đối chiếu lấy kết quả mới nhất của từng ca: **16/19**, gồm các ca ghi chỉ tới xác nhận. Đây là bộ 19 ca và hai lần kiểm lại, không phải một lượt 19 ca liền trên cùng snapshot cuối.
- Chi phí lượt đầy đủ cuối **0,03829550 USD**, hai ca kiểm lại **0,00532790 USD**. Tổng cả bốn lượt của đợt sửa (kể cả lượt phát hiện metadata lặp) **0,14624240 USD**, dưới trần chung 0,25 USD; không có chi phí dự phòng chưa đối soát. Request lớn nhất của bộ xác minh cuối **52.488 byte**.
- Còn L06 cần người dùng xác định phân hệ; L11 cần phép đối chiếu/loại trừ giữa lao động và hợp đồng được hỗ trợ rõ ràng; E01 có chênh lệch validation email miền `.test` giữa preview/API. Không bỏ chữ “chưa” hoặc nới kiểm tra điều kiện để tính các ca này là thành công.
- Không gửi lệnh ghi API nghiệp vụ, không dùng DB thật, không deploy. Dữ liệu, quyền và session là fixture; AI thật qua OpenRouter/GPT-6 Luna. Chưa kiểm thử UI hoặc thao tác ghi thực tế.

Báo cáo từng ca và toàn bộ chi phí: `tmp/assistant-coverage-groups-live-2026-11-23/ket-qua-sua-coverage-chon-nhom.md`; số liệu máy đọc: `summary.json` cùng thư mục. Bằng chứng offline cuối: `tmp/assistant-routing-fix/coverage-groups-handoff.json`, `coverage-groups-handoff-all.json`, `coverage-groups-handoff-final-typecheck.log`.
