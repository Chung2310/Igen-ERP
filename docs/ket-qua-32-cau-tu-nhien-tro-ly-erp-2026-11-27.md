# Kiểm thử 32 câu tự nhiên qua backend local — 27/11/2026

Bản chạy: commit **615df4b2**, trước bản sửa nối câu “ok” ngày 27/11. **9 đạt, 2 trả thiếu, 14 lỗi, 2 thiếu khả năng, 1 chặn dữ liệu, 2 chặn do ca trước, 1 dừng giữa luồng vì ngân sách, 1 chưa chạy.** Trạng thái HTTP/assistant “completed” không tự được chấm đạt.

Đã khởi chạy 29/32 câu qua HTTP thật vào backend QA local, dùng AI thật OpenRouter, model chính GPT-6 Luna. Đây là kiểm thử đường backend thực tế và API GET local, **không phải thao tác trên giao diện trình duyệt**. Mỗi nhóm Q3–Q4 dùng chung conversation; không chèn phân hệ ẩn vào câu hỏi. Tên nhóm chỉ phục vụ chấm. Tester chọn option do server phát hành và trả lời làm rõ tối đa theo protocol. “Đạt” có thể bao gồm một lượt hỏi làm rõ hợp lệ.

## Chi phí và dữ liệu

- Trần mới riêng: **0,25 USD**. Chi phí provider ghi nhận **0,23931413 USD**; giữ chỗ chưa rõ chi phí **0,001387375 USD**. Tổng đã tính/giữ: **0,240701505 USD**. Dừng COST_RESERVE_LIMIT, không giải phóng khoản chưa rõ hoặc mở lại sổ.
- 235 lần gọi provider theo ledger: 234 đã quyết toán, 1 giữ chỗ chưa rõ. Đây là tổng các bước NLU/discovery/planning/review/rewrite và các lần chạy lại, không phải 235 câu độc lập.
- Chỉ dùng câu hỏi/nội dung QA giả. Guard chặn dữ liệu chưa xác minh giả lập trước khi gửi model. N03-04 vì vậy không có kết quả sản phẩm; không được đánh dấu failed của trợ lý.
- Chặn mọi HTTP nghiệp vụ khác GET. Audit hash các dòng được đánh dấu QA: **0 collection thay đổi**, **0 lần thử ghi nghiệp vụ**. Không khẳng định đã audit toàn bộ DB. Trạng thái assistant session/turn vẫn được lưu để kiểm tra hội thoại.
- Đã đối chiếu độc lập **23 nguồn GET local**, không nguồn nào lỗi HTTP. Backend QA 3043 đã được dừng; không thay web 3000.

## Từng câu

| Mã | Nhóm | Câu hỏi | Đánh giá | Kết quả thực tế / căn cứ |
| --- | --- | --- | --- | --- |
| N01-01 | Nhân sự | Nay mọi người đi làm đủ không? | THIẾU | Trả 8 trạng thái chấm công nhưng thiếu tên, tổng hợp và kết luận đủ/vắng. Chưa trả lời trọn câu hỏi. |
| N01-02 | Nhân sự | Có ai sắp hết hợp đồng mà mình cần để ý không? | THIẾU | Trả 4 dòng “Chưa thiết lập”, thiếu tên nhân sự và ngày hết hạn nên không sử dụng được. |
| N01-03 | Nhân sự | Bên kế toán giờ còn những ai nhỉ? | ĐẠT | Sau khi làm rõ phòng Tài chính QA, trả đúng 3 nhân sự QA đối chiếu nguồn local. |
| N01-04 | Nhân sự | Cho mình số liên lạc của mấy bạn đó luôn. | LỖI | Còn nhớ 3 tên ở lượt trước, nhưng server từ chối phép OR các reference. Replay offline: thêm conditionLogic.any cho 3 reference thì qua validation. |
| N02-01 | Quản lý lao động | Nay bên Nhà máy A có thiếu người không? | ĐẠT | Dự án QA Nhà máy A: định biên 6, phân bổ 2, còn thiếu 4. Đây là thiếu định biên, chưa chứng minh vắng mặt thực tế. |
| N02-02 | Quản lý lao động | Mấy hôm nay có ai hay đi muộn không? | THIẾU KHẢ NĂNG | Đã làm rõ >=2 buổi đi muộn trong 7 ngày, nhưng chưa có phép tổng hợp số buổi đi muộn theo lao động để đáp ứng. |
| N02-03 | Quản lý lao động | Công trình Nhà máy A đang có những ai làm vậy? | LỖI | Không chọn được thao tác xem lao động trong dự án; trả hướng dẫn chung. |
| N02-04 | Quản lý lao động | Trong đó có bạn nào hôm nay chưa thấy đi làm không? | CHẶN BỞI CA TRƯỚC | Không gọi AI vì N02-03 chưa có kết quả làm tập tham chiếu. |
| N03-01 | Khóa học / học viên | Lớp tiếng Anh tối nay có học không? | LỖI | Lọc literal title bằng tên hiển thị lớp, trong khi lịch dùng mã lớp + tên khóa. Trả rỗng không đủ căn cứ; nguồn độc lập chỉ có lịch buổi sáng. |
| N03-02 | Khóa học / học viên | Có bạn nào nghỉ nhiều quá không nhỉ? | THIẾU KHẢ NĂNG | Đã làm rõ lớp, >=3 buổi vắng/tháng, nhưng chưa có nguồn/phép tính tương ứng. |
| N03-03 | Khóa học / học viên | Cho mình xem mấy bạn còn thiếu tiền học. | ĐẠT | 17 dòng còn nợ khớp nguồn balances. Một số dữ liệu nguồn cũ chưa xác minh giả lập: chặn gửi nội dung đó tới provider; không đưa dữ liệu cá nhân vào báo cáo. |
| N03-04 | Khóa học / học viên | Trong đó có ai chưa đóng đồng nào không? | CHẶN DỮ LIỆU | Lịch sử chứa bản ghi chưa xác minh giả lập từ N03-03; guard chặn trước NLU. Chưa kết luận chất lượng sản phẩm. |
| N04-01 | Đối tác tuyển sinh | Dạo này bên nào giới thiệu học viên tốt nhất? | LỖI | AI nhận ra “tốt nhất” chưa rõ chỉ tiêu, nhưng parser từ chối ordering không rõ dimension, thành lỗi kỹ thuật thay vì hỏi tiêu chí. |
| N04-02 | Đối tác tuyển sinh | Mình còn phải trả hoa hồng cho những ai nữa? | ĐẠT | Bản chạy lại trả đúng 6 đối tác còn nợ hoa hồng và số dư theo nguồn. Lời mở đầu chỉ nhắc 3 tên, bảng vẫn đủ 6. |
| N04-03 | Đối tác tuyển sinh | Có những đối tác nào chưa giới thiệu được học viên nào vậy? | LỖI | Chọn đúng partner.analysis và điều kiện số học viên = 0, nhưng binding/kiểm tra ngữ nghĩa vẫn bị từ chối. |
| N04-04 | Đối tác tuyển sinh | Mấy người đó vẫn đang hợp tác với mình chứ? | CHẶN BỞI CA TRƯỚC | Không gọi AI vì N04-03 chưa có tập đối tác kết quả. |
| N05-01 | Đối tác lao động | Tháng này bên nào gửi người về nhiều nhất? | ĐẠT | QA Cung ứng An Phát đứng đầu tháng, 2 lượt giới thiệu; khớp KPI nguồn. |
| N05-02 | Đối tác lao động | Có bên nào đang hụt chỉ tiêu nhiều không? | LỖI | Câu “hụt chỉ tiêu nhiều” chưa rõ ngưỡng bị lỗi lập kế hoạch thay vì hỏi phần thiếu. |
| N05-03 | Đối tác lao động | Cho mình xem những bên chưa đạt tháng này. | ĐẠT | Đúng QA Cung ứng Bình Minh: chỉ tiêu 10, thực tế 1, còn thiếu 9. |
| N05-04 | Đối tác lao động | Bên nào chỉ cần thêm vài người là đủ rồi? | LỖI | Hỏi tiếp đối tác chỉ còn thiếu vài người bị lỗi lập kế hoạch, chưa trả được kết quả. |
| N06-01 | Bán lẻ / POS | Nay bán buôn thế nào? | LỖI | Câu bán buôn/bán hàng bị trả không hỗ trợ chung, chưa hỏi rõ hoặc đưa nguồn tổng quan. |
| N06-02 | Bán lẻ / POS | Tiền khách còn nợ có nhiều không? | ĐẠT | Sau làm rõ, trả khách QA còn nợ và tổng 2.000.000 đồng, khớp nguồn độc lập. |
| N06-03 | Bán lẻ / POS | Cho mình xem mấy đơn vẫn chưa xong. | LỖI | Đã làm rõ chưa hoàn tất và chưa hủy, nhưng kế hoạch cuối chỉ loại completed; đưa cả đơn cancelled QA-DON-01 vào kết quả. |
| N06-04 | Bán lẻ / POS | Đơn nào bị ngâm lâu nhất rồi? | LỖI | Mất phạm vi đơn chưa xong của lượt trước: chọn đơn completed cũ nhất toàn bộ danh sách, thay vì đơn đang chờ lâu nhất. |
| N07-01 | Đối tác bán lẻ | Giờ còn bao nhiêu đại lý đang làm với mình? | ĐẠT | Đếm đúng 2 đại lý đang hoạt động. |
| N07-02 | Đối tác bán lẻ | Có bên nào mình còn chưa trả hoa hồng không? | LỖI | Bản chạy lại vẫn chọn partner.analysis của tuyển sinh dù đã làm rõ hoa hồng cộng tác viên bán lẻ; kết thúc lỗi kế hoạch. |
| N07-03 | Đối tác bán lẻ | Tìm giúp mình bên Đông ấy. | ĐẠT | Sau làm rõ tên, tìm đúng 2 QA Đại lý Đông; phân biệt bằng mã công khai, có số liên hệ. |
| N07-04 | Đối tác bán lẻ | Cho mình điện thoại để gọi họ luôn. | LỖI | Hỏi tiếp số điện thoại của tập vừa tìm bị từ chối kế hoạch/binding. |
| N08-01 | Kho sản phẩm | Cái máy hôm trước khách hỏi còn hàng không? | LỖI | Lấy cả từ loại “Máy” vào productName literal; trả rỗng dù nguồn có QA Điện thoại Cũ 30, tồn 1. Driver lượt đầu cũng đã trả lời một thông báo kỹ thuật như thể câu hỏi làm rõ; không tính đó là hỏi lại hợp lệ. |
| N08-02 | Kho sản phẩm | Có món nào sắp hết mà mình cần nhập thêm không? | LỖI | Đã chọn đúng warehouseId nhưng thêm điều kiện warehouseName bằng “Trụ sở chính”, khác tên thật “Kho bán hàng - Trụ sở chính”; lọc mất hàng tồn thấp. |
| N08-03 | Kho sản phẩm | Bộ sạc bên kho chính còn không nhỉ? | DỪNG NGÂN SÁCH | Đã bắt đầu NLU nhưng dừng trước khi hoàn tất toàn luồng do COST_RESERVE_LIMIT. Không chấm đạt/lỗi nghiệp vụ. |
| N08-04 | Kho sản phẩm | Thế mấy kho khác còn hàng đó không? | CHƯA CHẠY | Không gửi request vì trần dự phòng đã dừng; không có kết quả của N08-03 để hỏi tiếp. |

## Giới hạn và hiệu chỉnh công cụ kiểm thử

1. Parser kết quả của driver ban đầu đọc nhầm JSON null ở hai ca đầu. Đã khôi phục từ response lưu, không gọi lại AI, giữ bản gốc và driver-notes.json.
2. Guard ban đầu nhầm placeholder công khai “Chưa cập nhật” thành tên người. Đã xác minh đây là enum schema, chỉ bỏ đúng placeholder khỏi blacklist rồi chạy lại N04-02/N07-02 cùng ledger. Các chặn tên/email/điện thoại chưa xác minh khác vẫn giữ. Kết quả trong bảng dùng lần chạy lại; tổng chi phí bao gồm cả lần trước.
3. N01-04 được phục hồi từ turn hoàn tất trong DB sau khi driver bị dừng; không phát lại request. Kết quả thực tế vẫn là failed.
4. N08-01 có lỗi protocol driver đã nêu trong bảng; không dùng lượt đầu đó chứng minh bot hỏi làm rõ đúng. Lỗi lookup cuối vẫn có đối chiếu nguồn độc lập.
5. Tên lớp, tên sản phẩm, tên kho hiển thị khác khóa/nhãn nguồn; kết quả rỗng chưa chứng minh không có dữ liệu. Follow-up mất tập kết quả và implicit reference OR bị từ chối là nhóm lỗi chung, không phải tất cả đều do AI quên tên.

## Bằng chứng cục bộ

- tmp/natural-search-20261127/results.json, results-retests.json, review.json: response và đánh giá; raw dữ liệu chỉ giữ local.
- ledger.json, events.json, guard-correction.json: chi phí, API thực tế, điều chỉnh guard.
- native-source-snapshots.json, business-before-phase2.json, business-after-phase2.json: đối chiếu và audit.
- reference-union-replay.json: N01-04 thất bại với frame gốc; qua validator khi biểu diễn tường minh OR các reference.

Không sửa số liệu này thành “đạt” từ unit test hoặc từ bản sửa sau chạy. Bản sửa nối lời đồng ý/phản hồi làm rõ được ghi riêng trong docs/sua-noi-ngu-canh-hoi-thoai-tro-ly-erp-2026-11-27.md; chưa chạy lại AI thật sau sửa vì sổ đã dừng.
