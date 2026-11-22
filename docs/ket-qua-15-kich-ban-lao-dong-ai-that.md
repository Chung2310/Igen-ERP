# Kiểm thử 15 tình huống quản lý lao động bằng AI thật

Ngày kiểm thử: **21/11/2026**, khoảng 16:34–16:37 giờ Việt Nam. Mã nền: `89f27c830b2258b3a7ac6d9201e64c245ee97599`, nhánh `fix/erp-assistant-read-v2`.

## Kết quả chính

**Ca tạo dự án có nêu rõ quản lý lao động đã chọn đúng `worker.project.create`, không chuyển sang Nhân sự.** AI giữ đúng tên dự án, năm lao động và sáu ngày làm việc; server hỏi mã dự án còn thiếu bằng form. Sau khi điền mã nhân tạo, kết quả dừng tại bản xác nhận. Không tạo dự án.

Trong **15 ca chính**, **12 ca đạt tới kết quả đọc hoặc bản xác nhận đúng mục tiêu**, **3 ca chưa đạt tiêu chí hoàn tất**: L10, L11 và L14. Đây là kết quả một lượt chạy trên corpus nhân tạo, không phải tỷ lệ accuracy đại diện toàn hệ thống. L06 đạt sau khi người kiểm thử chọn phân hệ lao động trong danh sách làm rõ, không phải AI tự chọn ngay lần đầu.

Hai ca đối chứng được báo riêng: câu tạo dự án chưa nói phân hệ đã hỏi Nhân sự hay quản lý lao động; câu nêu rõ Nhân sự đã chọn đúng `project.create` và tới xác nhận.

**37 request model thật, chi phí provider báo là 0.20886525 USD**, dưới trần 1 USD/60 request. Không có lỗi provider, request nghiệp vụ ghi hoặc truy cập DB thật. Không gửi tên trong ảnh; mọi tên người, dự án, công ty, địa chỉ và chi nhánh đều là dữ liệu thay thế.

## Phạm vi đã kiểm thử

| Thành phần | Cách chạy |
| --- | --- |
| AI | `openai/gpt-6-luna` thật qua OpenRouter, chỉ provider OpenAI, không fallback |
| Luồng server | `processTurn` thật, semantic interpreter thật, catalog thật, guard phân hệ, resolver, form, preview, dispatch/completion đọc và xuất workbook thật |
| Dữ liệu | Fixture nhân tạo: 7 lao động, 3 dự án lao động, 3 hợp đồng, chấm công mẫu; một dự án Nhân sự có tên trùng dự án lao động |
| Quyền và workflow | Fixture tài khoản quản trị, workflow mặc định được bật; không sử dụng quyền/cấu hình tài khoản local thực |
| Session và tài liệu | In-memory; không đọc lịch sử chat hoặc ghi Mongo thật |
| API nghiệp vụ | GET trả fixture trong process. Bất kỳ method khác GET/HEAD bị chặn trước transport; route chưa mock làm test thất bại |
| Thao tác ghi | Bật `alwaysConfirm` trong fixture, không xác nhận bất kỳ action ghi nào |
| Thao tác đọc | Có thể xác nhận riêng khi catalog chứng minh method GET; L09/L11 đã đi nhánh này |
| Giao diện local | Đã quan sát phiên đăng nhập tại `http://localhost:3000/tro-ly-ai`; không gửi 15 câu qua UI để tránh reference/lịch sử thật đi kèm prompt |

**Đây là kiểm thử AI thật cùng luồng xử lý server local trên fixture nghiệp vụ. Chưa phải kiểm thử HTTP/UI/DB end-to-end bằng tài khoản thực.** Chưa kiểm chứng việc lưu thành công sau xác nhận, phân quyền thực, tạo xong rồi bổ sung trường tùy chọn, hay toàn bộ website. Các flag V2/cổng thực thi mới được giữ tắt trong fixture; không bật production hoặc sửa runtime.

## Danh sách 15 ca

Tên bên dưới đều là thay thế; số dòng đối chiếu ảnh giữ nguyên.

| Ca / dòng ảnh | Yêu cầu kiểm thử | Action quan sát | Điểm dừng và đánh giá |
| --- | --- | --- | --- |
| L01 / 2 | Tạo `QA-LAB-NEW-20` trong quản lý lao động, chọn lao động 01–05 và thứ 2–7 | `worker.project.create` | **Đạt.** Hỏi mã qua form; điền `QA-PREVIEW-20`; confirmation giữ đúng 5 đối tượng, tên, mã và 6 ngày. Không POST |
| L02 / 3 | Báo cáo chấm công lao động hôm nay | `worker.report` | **Đạt.** Completed; request có ngày Việt Nam `2026-11-21` |
| L03 / 4 | Báo cáo chấm công trong `QA-KHO-01` | `worker.report` | **Đạt.** Completed; projectId đúng fixture |
| L04 / 5 | Ai đi muộn trong `QA-KHO-01` | `worker.report` | **Đạt.** Completed; đúng dự án và `mode=late` |
| L05 / 6 | Ai vắng trong `QA-KHO-01` | `worker.report` | **Đạt theo khả năng báo cáo hiện tại.** Completed; đúng dự án và `mode=absent`; không nâng thành kết luận nghỉ có xác nhận |
| L06 / 7 | Đổi địa điểm `QA-BANLE-02` thành `140 Đường Kiểm Thử` | `worker.project.update` | **Đạt sau làm rõ.** Có lựa chọn Nhân sự/lao động; chọn lao động; confirmation đúng dự án và địa điểm. Không PATCH |
| L07 / 8 | “xóa nhân sự LAO-DONG-MAU-06 khỏi dự án QA-LAB-03” | `worker.project.worker.remove` | **Đạt.** Confirmation đúng dự án + lao động; không chọn xóa hồ sơ nhân sự, không DELETE |
| L08 / 9 | Dự án nào thiếu lao động | `worker.report` | **Đạt.** Completed; `mode=shortage` |
| L09 / 10 | Lao động vắng trên 3 buổi trong `QA-LAB-03` | `worker.report` | **Đạt.** Hỏi khoảng ngày bằng 2 trường date; bổ sung 01–21/11/2026; completed đúng dự án/khoảng ngày/ngưỡng 3 |
| L10 / 11 | Thêm `LAO-DONG-MAU-08` vào quản lý lao động | `worker.create` | **Chưa đạt.** Đọc đúng tên/action nhưng lặp lựa chọn dự án tùy chọn sau khi bỏ qua; chưa tới confirmation |
| L11 / 12 | Lao động chưa có hợp đồng | `worker.list` sau lựa chọn làm rõ | **Không đạt.** Điều kiện “chưa có hợp đồng” bị mất; trả toàn bộ 7 lao động thay vì 4 người chưa có hợp đồng |
| L12 / 13 | Xuất Excel danh sách hợp đồng lao động | `worker.labor.contract.list` | **Đạt trên fixture một trang.** Completed; workbook `.xlsx` có 3 hợp đồng và ngày Việt Nam. Không chứng minh xuất hết nhiều trang |
| L13 / 14 | Chuyển `LAO-DONG-MAU-07` sang thời vụ | `worker.update` | **Đạt.** Confirmation đúng lao động, `laborType=seasonal`. Không PATCH |
| L14 / 15 | Xóa hợp đồng của `LAO-DONG-MAU-04` | `worker.labor.contract.delete` | **Chưa tới confirmation.** AI yêu cầu mã hợp đồng; server đưa 3 mã nhưng nhãn không có tên lao động. Tester dừng, không tự chọn mã dựa trên ID kín |
| L15 / 16 | Đổi đơn vị sử dụng của `LAO-DONG-MAU-05` | `worker.labor.contract.update` | **Đạt ở bước chuẩn bị.** Confirmation đúng hợp đồng của lao động 05 và `clientName=CÔNG TY MẪU QA-EMPLOYER`. Không PATCH |

Với L09, kết quả hiện tại đếm ngày có lịch làm nhưng chưa có giờ vào, kèm lời nhắc cần đối chiếu trước khi xác nhận vắng. Chưa kiểm chứng nghiệp vụ nghỉ phép hoặc phân biệt mọi nguyên nhân không có chấm công.

## Hai ca đối chứng phân hệ

| Ca | Câu hỏi | Quan sát |
| --- | --- | --- |
| C01 | Tạo dự án mới tên `QA-TYPE-CHOICE` | Hỏi bằng chữ dự án thuộc Nhân sự hay quản lý lao động; chưa chuẩn bị/lưu nhầm một bên. Chưa có selection box ở nhánh câu trả lời này |
| C02 | Tạo `QA-HR-ONLY` trong phân hệ Nhân sự | `project.create`, confirmation đúng tên; không nhầm sang worker |

C01 đạt tiêu chí **hỏi phân hệ rồi dừng**, không yêu cầu tiến tới confirmation khi người dùng chưa chọn. Không gộp hai ca đối chứng vào tỷ lệ 12/15.

## Ba điểm cần xử lý tiếp

### 1. L11: mất điều kiện lọc khi chọn action

Trace thật cho thấy AI ban đầu trả unsupported; recovery tìm `worker.list` và `worker.labor.contract.list`, rồi server đưa lựa chọn. Sau khi chọn tra cứu lao động, AI trả đúng action nhưng vẫn nói rõ trong `clarification` rằng bộ tra cứu chưa lọc được người chưa có hợp đồng. `values` là `{}`.

Nhánh `workflowSelection` trong `server/assistant/service.ts` thấy actionId trùng lựa chọn nên gọi `prepare` ngay. Cảnh báo điều kiện chưa được đáp ứng không ngăn thực thi. Sau xác nhận GET, kết quả là cả 7 lao động, gồm 3 người đã có hợp đồng. Đây là lỗi mất điều kiện qua luồng chọn thao tác; không thể quy toàn bộ cho model không hiểu câu hỏi.

Ưu tiên cao: bảo toàn điều kiện chưa hỗ trợ qua discovery → chọn action → prepare. Chỉ trả danh sách “chưa có hợp đồng” khi có phép đối chiếu đáng tin cậy; trước đó phải nói rõ chưa thực hiện được điều kiện, không trả danh sách chung như kết quả hoàn chỉnh. Cần thiết kế/test riêng trước khi sửa.

### 2. L10: bỏ qua reference tùy chọn trong form bị hỏi lại

AI chọn đúng `worker.create`, giữ đúng `fullName`. Server hỏi dự án tùy chọn. Gửi đúng shape UI đang dùng: `formValues.skipReferenceKeys=["projectId"]`, nhưng cả 4 vòng tiếp theo vẫn hiện lựa chọn dự án đó.

Đối chiếu source: nhánh form truyền danh sách bỏ qua vào `applyReferenceSelections`; khi vào `prepare`, việc lưu `skippedReferenceKeys` lại đọc `input.skipReferenceKeys` ở cấp ngoài. Vì UI gửi bên trong `formValues`, thông tin bỏ qua không được giữ cho lần chuẩn bị sau. Việc này tái hiện không cần gọi AI thêm: replay cùng output thật vẫn lặp.

Raw live lần đầu còn có nhãn `WRONG_VALUE:fullName` vì harness so với `resolved` khi action chưa sẵn sàng. Tên trong preview thực tế đúng; phép chấm này đã sửa trong replay. Không coi nhãn thừa đó là lỗi hiểu tên.

### 3. L14: nhận đúng thao tác nhưng cần thêm lựa chọn hợp đồng

AI chọn `worker.labor.contract.delete` nhưng không đưa tên lao động vào selector; hỏi mã hợp đồng. Server trả ba lựa chọn dạng `MẪU-QA — mã HD-QA-*`, không thể hiện người lao động tương ứng. Dù fixture chỉ có một hợp đồng của lao động 04, luồng chưa dùng được dữ kiện đó để thu hẹp danh sách.

Đây là **điểm chưa hoàn tất theo yêu cầu ban đầu**, không phải bằng chứng đã xóa nhầm hay action không tồn tại. Test chủ động không chọn ngầm một mã bằng dữ liệu nội bộ. Cần cải thiện truyền selector người lao động và nhãn hợp đồng; khi một người có nhiều hợp đồng thì vẫn phải hỏi người dùng chọn.

## Kiểm chứng và evidence

- Dry-run cuối: **17/17 pass về an toàn/plumbing**, không có network hoặc phí model; không dùng kết quả này để chấm AI.
- Live ban đầu: **13/17 pass, 4 fail**; C01 bị harness chấm quá hẹp vì chỉ nhận lựa chọn có cấu trúc, mặc dù câu trả lời thật đã hỏi đúng phân hệ.
- Sau sửa **chỉ cách chấm của harness**, replay cả 37 output AI đã lưu qua cùng luồng server, chặn toàn bộ network: **14/17 pass, 3 chưa đạt** là L10/L11/L14. Không sửa runtime hoặc gọi lại AI để có con số này.
- `npm run typecheck`: pass sau khi thêm harness.
- Đã đọc lại workbook bằng XLSX parser: sheet `Danh sách` có 6 cột, đúng 3 hợp đồng fixture; không chỉ kiểm tra chữ ký ZIP. Phạm vi file ghi rõ chỉ trang API trả về.
- Các kết quả tra cứu đã được shared result-table parser nhận dạng; không thấy ID bản ghi nội bộ trong reply/preview đã kiểm tra.
- Bộ kiểm tra không áp trần đọc mới. Riêng L01 có 20 GET fixture trước confirmation do tra cứu 5 lao động và bổ sung mã; không dùng thời gian fixture để suy ra latency DB thật.

Evidence và cách tái chạy nằm tại [thư mục worker-live-preview](../server/assistant/testing/worker-live-preview/README.md):

- [Trace live nguyên gốc](../server/assistant/testing/worker-live-preview/live-observations.json).
- [Replay với phép chấm đã sửa](../server/assistant/testing/worker-live-preview/replay-observations.json).
- [Corpus thay thế](../server/assistant/testing/worker-live-preview/cases.mjs).
- [Harness](../server/assistant/testing/worker-live-preview/worker.live.ts) và [fixture](../server/assistant/testing/worker-live-preview/fixtures.ts).
- [Workbook mẫu](../server/assistant/testing/worker-live-preview/live-export.xlsx).

Kết quả chứng minh ca tạo dự án lao động trong bộ kiểm thử này đã đi đúng phân hệ và tới xác nhận. Chưa đủ cơ sở kết luận tất cả yêu cầu thêm/sửa/xóa đều hoạt động trên tenant thực hoặc mọi câu diễn đạt đều đúng; đặc biệt tên mã nhân tạo có thể dễ nhận diện hơn tên tự nhiên và chưa thử nhiều lần lặp.
