# Kiểm thử các phân hệ khác và lỗi công nợ học phí

Ngày: 23/11/2026. Nhánh: `fix/erp-assistant-read-v2`. Mốc trước sửa: `de4665a1`; kết quả bên dưới chạy trên working tree đã sửa, có hash từng source trong các receipt.

## 1. Kết luận và giới hạn

- Đã tái hiện một nguyên nhân gây trả rỗng cho câu “học viên nào còn nợ học phí?”: lọc `student.list` bằng trạng thái hồ sơ `Nợ học phí`, thay vì tính công nợ. Học viên có thể có dư nợ mà không có nhãn này.
- Đã sửa theo cơ chế đối chiếu chỉ đọc dùng chung: đọc đủ học viên và phiếu thu trong cùng phạm vi được cấp quyền, tính tiền tại server, trả bảng công khai. Không dùng model để cộng tiền hoặc ghép định danh.
- AI thật đã trả đúng danh sách còn nợ và bác bỏ kết luận “tất cả học viên đều đã đóng học phí” trong cùng cuộc hội thoại giả lập.
- Mở rộng thêm 20 ca ở các khu vực khác. Tổng 21 ca mới thuộc 18 phân hệ; sau sửa, kết quả mới nhất của từng ca đều đạt. Đây là kết quả gộp hai batch, không phải một batch ban đầu đạt 21/21.
- Không đọc dữ liệu thật ở staging, không gửi tên/số điện thoại trong ảnh. Không xác nhận số 31 học viên trong ảnh bằng cách truy cập DB thật. Bản sửa hiện chỉ ở local, chưa deploy staging/production.
- Mọi thao tác ghi dừng ở xác nhận. Toàn bộ API nghiệp vụ và persistence được mock; không có request ghi nghiệp vụ, không có vi phạm network/DB guard trong các receipt.
- Chưa thể tuyên bố bao phủ mọi chức năng của web. Mỗi ca chỉ xác minh đúng hành vi và phạm vi nêu dưới đây; việc thực thi ghi sau xác nhận nằm ngoài phép thử này.

## 2. Ca công nợ học phí trong ảnh

Hai câu được giữ nguyên, không có dữ liệu định danh thật:

1. `học viên nào còn nợ học phí?`
2. `vậy là tất cả học viên đều đã đóng học phí rồi hả`

Fixture có 5 học viên, API cố ý giới hạn 2 dòng/trang; phiếu thu có 3 dòng, cũng giới hạn 2 dòng/trang. Không học viên nào có nhãn `Nợ học phí`.

| Học viên giả | Tổng học phí | Tiền đã thu được xác minh | Còn nợ | Kỳ vọng |
| --- | ---: | ---: | ---: | --- |
| HOC-VIEN-NO-QA-A | 5.000.000 | 3.000.000 từ hai phiếu thu | 2.000.000 | Có trong kết quả, dù paidAmount hồ sơ cũ ghi 5.000.000 |
| HOC-VIEN-NO-QA-B | 5.000.000 | 5.000.000 từ phiếu thu | 0 | Không có trong danh sách nợ |
| HOC-VIEN-NO-QA-C | 3.000.000 | 1.000.000 từ hồ sơ nhập cũ, chưa có phiếu thu | 2.000.000 | Có trong kết quả |
| HOC-VIEN-NO-QA-D | 0 | 0 | 0 | Học viên miễn phí không bị coi là nợ |
| HOC-VIEN-NO-QA-E | 3.000.000 | 0 | 3.000.000 | Có trong kết quả dù nằm ở trang 3 |

Quy tắc khớp màn Học phí hiện tại: nếu có phiếu thu thì dùng tổng phiếu thu; khi chưa có phiếu thu, dùng `paidAmount` để giữ dữ liệu nhập cũ. Công nợ = học phí − đã đóng, chỉ giữ số dư > 0.

Kết quả AI thật mới nhất:

- Câu đầu: bảng đúng A/C/E và từng khoản tiền trên.
- Câu tiếp: `Chưa phải tất cả học viên đã đóng đủ. Có 3 học viên còn nợ học phí.` và bảng đối chiếu.
- Mỗi lượt đọc 3 trang học viên + 2 trang phiếu thu. Hai lượt là 10 GET fixture; không gửi dữ liệu trả về cho model để tính toán.
- Hai lượt dùng 6 request model, chi phí 0,0049265 USD ở batch chạy lại cuối.

Các lỗi liên quan đã sửa:

1. Không thay phép tính công nợ bằng lọc trạng thái hồ sơ. Giữ cả hai nguồn qua bước thu hẹp catalog; khi model chỉ chọn một nguồn thì chỉ cho một lần sửa kế hoạch trong budget chung.
2. Chấp nhận model gắn cùng một phép đối chiếu đã đăng ký ở hai nguồn: server chuẩn hóa về nguồn trái. Vẫn từ chối nguồn thừa, toán tử lạ, thiếu quyền hoặc lọc hai nguồn khác phạm vi.
3. Không coi từ đệm “vậy”, “rồi”, “hả” là điều kiện bị bỏ sót. Nhận theo chữ tiếng Việt có dấu để không xóa “Hà” trong “Hà Nội”. Các ý “tất cả”, “đều”, “đã”, phủ định và số tiền vẫn phải được đối chiếu.
4. Thiếu trang, tổng thay đổi, dòng trùng, số tiền sai hoặc nguồn thiếu trường thì không kết luận đã đóng đủ/không có nợ. Giữ giới hạn 500 bản ghi mỗi nguồn và 24 trang; không gửi request trang 25. Không đổi trần đọc 24 hiện hành.
5. Chưa hỗ trợ tự suy diễn nợ theo một kỳ/tháng hoặc điều kiện bổ sung ngoài phép đối chiếu đã khai báo; phải hỏi/làm rõ, không âm thầm bỏ điều kiện để trả rỗng.

Đây là nguyên nhân đã tái hiện bằng code và fixture. Không có trace của phiên staging trong ảnh để khẳng định đó là nguyên nhân duy nhất của đúng phiên ấy.

## 3. Kết quả từng ca bằng AI thật

`Xác nhận` nghĩa là đúng action, đúng dữ liệu/đích đã giải quyết, dừng trước ghi. `Hoàn tất đọc` nghĩa là gọi đúng endpoint mock, trả giá trị công khai kỳ vọng bằng bảng dùng chung, không lộ ID nội bộ.

| Ca | Yêu cầu dùng dữ liệu giả | Kết quả mới nhất | Request model | GET fixture |
| --- | --- | --- | ---: | ---: |
| N01 | Trong Kho, tạo danh mục DANH-MUC-QA-MOI, mã DM-QA-MOI | Đạt — xác nhận `category.create` | 3 | 0 |
| N02 | Trong Kho, xem danh sách sản phẩm | Đạt — hoàn tất đọc, có SAN-PHAM-QA-01 | 3 | 1 |
| N03 | Tạo khách hàng KHACH-HANG-QA-MOI, điện thoại giả | Đạt — xác nhận `customer.create` | 3 | 0 |
| N04 | Sửa địa chỉ KHACH-HANG-QA-01 thành 25 Đường Kiểm Thử | Đạt — xác nhận `customer.update`, đúng hồ sơ | 2 | 2 |
| N05 | Tạo thư mục TAI-LIEU-QA-MOI trong Tài nguyên | Đạt — xác nhận POST `/resources/folder` | 2 | 1 |
| N06 | Xem danh sách phòng chat | Đạt — hoàn tất đọc, có PHONG-CHAT-QA-01 | 2 | 1 |
| N07 | Thêm cộng tác viên DOI-TAC-TUYEN-SINH-QA | Đạt — xác nhận POST `/partners`, đúng Đối tác tuyển sinh | 2 | 0 |
| N08 | Trong Bán lẻ, xem ca POS hiện tại | Đạt — hoàn tất đọc, đúng ca và thu ngân giả | 2 | 1 |
| N09 | Xem các chính sách hoa hồng Đối tác bán lẻ | Đạt — hoàn tất đọc, có DOI-TAC-BAN-LE-QA | 1 | 1 |
| N10 | Trong Sửa chữa, xem danh sách phiếu sửa chữa | Đạt — hoàn tất đọc, có SC-QA-01 và khách giả | 4 | 1 |
| N11 | Xem các quỹ tiền mặt và tài khoản ngân hàng | Đạt — hoàn tất đọc, có QUY-TIEN-MAT-QA | 2 | 1 |
| N12 | Xem chiến dịch email lễ tết ở Marketing tự động | Đạt — hoàn tất đọc, đúng EMAIL-LE-TET-QA | 2 | 1 |
| N13 | Xem chiến dịch trong Chiến dịch nội dung | Đạt — hoàn tất đọc, đúng CHIEN-DICH-NOI-DUNG-QA | 3 | 1 |
| N14 | Tạo lead LEAD-QA-MOI, email leadqa@example.test | Đạt — xác nhận `omni-inbox.leads.create` | 2 | 0 |
| N15 | Xem tài liệu trong Kho tri thức công ty | Đạt — hoàn tất đọc, không nhầm sang Kho sản phẩm | 2 | 1 |
| N16 | Trong Tra cứu pháp lý, xem tình trạng kho văn bản | Đạt — hoàn tất đọc, documents=12/chunks=36 | 3 | 1 |
| N17 | Thêm bảng giá BG-QA-01, DICH-VU-QA, gói, 250000 | Đạt — xác nhận `quotation.catalog.create` | 2 | 0 |
| N18 | Trong Y tế, tạo BENH-NHAN-QA-MOI | Đạt — xác nhận `healthcare.patient.create` | 2 | 0 |
| N19 | Tạo KIENTRUC-QA-MOI, 150 m², 2 tầng, hiện đại | Đạt — xác nhận `architect.project.create` | 2 | 0 |
| N20 | Trong Kho, xóa danh mục DANH-MUC-QA-01 | Đạt — xác nhận `category.delete`, đúng danh mục | 3 | 1 |
| N21 | Hai lượt hỏi về học viên nợ học phí | Đạt — hoàn tất cả hai lượt, đúng 3 người và dư nợ | 6 | 10 |

Lượt đầu đạt 15/21. Sáu ca N01/N02/N08/N10/N18/N20 bị hỏi phân hệ dù model đã chọn đúng action. Sau sửa chạy lại cả sáu, thêm N15 và N21 hồi quy: 8/8 đạt.

## 4. Các sửa chung khác phát hiện trong đợt này

- Coverage trước đó bỏ dấu rồi coi “chữa” trong “sửa chữa” là “chưa”, “quỹ” là “quý”; dẫn tới đòi bộ lọc không tồn tại. Phân biệt chữ có dấu trước khi kiểm tra các tín hiệu lọc. Kiểm tra thật “chưa thanh toán” và “quý 4” vẫn bị chặn nếu chưa áp điều kiện.
- Từ nhãn ghép phân hệ (`Kho & Sản phẩm`, `Bán lẻ & POS`, `Sửa chữa & bảo hành`) và nhãn `Quản lý …`, suy ra tên khu vực công khai dùng chung cho kiểm tra ngữ cảnh. Không thêm danh sách ngoại lệ riêng vào từng action. Kiểm tra ranh giới từ để “khóa học” không được coi là “Kho”; điều kiện thêm vẫn phải có mapping.
- Kiểm tra kho văn bản là thao tác ERP chỉ đọc, không bị đổi thành câu hỏi pháp luật gọi POST. Câu hỏi kiến thức pháp luật thực sự vẫn giữ đường cũ.
- Kết quả sức khỏe kho có trường số `documents` được giữ là object thống kê, không bị nhầm là mảng tài liệu và mất các trường còn lại.
- Fixture sản phẩm, khách hàng, chat được chỉnh đúng envelope controller; bổ sung revision cho fixture khách hàng. Đây là sửa harness, không phải thay API production để làm test qua.

## 5. Kiểm tra offline và phần chưa phủ

- Suite liên quan: **330/330** đạt sau các sửa runtime cuối cùng (`offline-public-names.json`). Sau đó bổ sung kiểm tra chính xác từng dòng tiền và chặn trước request trang 25: **7/7** test học phí đạt (`offline-financial-guards.json`). Tổng có 331 test duy nhất trong suite này; không cộng số lần chạy lặp.
- `npm run typecheck`: đạt sau sửa TypeScript.
- Ma trận rộng: **19.894/19.914** đạt, còn **20 lỗi đã có trong baseline**, không có lỗi mới; 5 lỗi cũ ở kho pháp lý đã hết. Đã so tên test với `tmp/assistant-routing-fix/all-results.json`.
- Các nhóm còn lỗi trong ma trận: `legal.document.list`, `legal.document.search`, `legal.document.answer`, `inventory.count.item.update`, `inventory.count.recreate`, `finance.treasury.bank-lines.match`. Đây là test thất bại cần phân tích riêng, chưa khẳng định mọi lỗi đều do runtime thay vì fixture/đặc tả test.
- Phân hệ `partner` tương thích cũ không có action thực thi khả dụng; không tính là đã phủ. Hai phân hệ Đối tác tuyển sinh và Đối tác lao động là các catalog riêng.
- Không sửa UI, không kiểm tra hiển thị bằng trình duyệt và không chạy build frontend vì đợt này không đổi frontend.

## 6. Chi phí thực tế và bằng chứng

Model: `openai/gpt-6-luna`, OpenRouter/OpenAI, không fallback provider. Dùng `usage.cost` từ receipt; kể cả lượt thất bại. Các lượt chạy tuần tự, mỗi batch nhận trần bằng phần còn lại của ngân sách chung; có dự trữ chi phí trước khi gửi, giới hạn số request và giới hạn output. Không tăng giới hạn chi phí khi sửa lỗi.

| Lượt | Phạm vi | Request model | Chi phí USD |
| --- | --- | ---: | ---: |
| `live-debt-01` | N21, phát hiện model gắn toán tử ở cả hai nguồn | 3 | 0,0022884 |
| `live-debt-02` | N21, câu đầu đúng, câu tiếp bị chặn bởi từ đệm | 7 | 0,0061831 |
| `live-all-01` | 21 ca, 15 đạt, 6 lỗi tên phân hệ ngắn | 54 | 0,0368609 |
| `live-rerun-01` | 6 ca sửa + N15/N21 hồi quy, 8 đạt | 25 | 0,0154015 |
| **Tổng đợt này** | Kể cả lỗi/chạy lại | **89** | **0,0607339** |
| Các đợt trước đã ghi sổ | 19 ca cũ + 9 ca bổ sung và chạy lại | 141 | 0,1029288 |
| **Tổng cộng ngân sách chung** | Trần 0,25 USD | **230** | **0,1636627** |
| **Còn lại** | Chưa sử dụng | — | **0,0863373** |

Tất cả reservation đã tất toán; `violations=[]`, `forbiddenBusinessWrites=[]` trong các receipt AI thật.

Artifacts tại `tmp/assistant-other-modules-2026-11-23/`:

- `live-*/live-observations.json`: request stages, usage/cost, output model, hội thoại, GET mock, hash source và safety outcome.
- `live-all-01-results.json`, `live-rerun-01-results.json`: kết quả Vitest thực tế; không xóa lần thất bại.
- `offline-public-names.json`, `offline-financial-guards.json`, `matrix-final.json`, `typecheck-final.log`.
- `replay-debt-final-results.json`: replay output AI đã thu được, không tính là lượt AI mới.

Harness: `server/assistant/testing/worker-live-preview-v2/`; ca và fixture mới trong `module-scenarios.ts`. Các ca N không được thêm ngầm vào tập chạy trả phí mặc định: phải chọn ID rõ ràng.
