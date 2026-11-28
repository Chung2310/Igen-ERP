# Kết quả thực tế 30 ca cũ và 6 ca mới — 27/11/2026

> Cập nhật sau khi bật module local: xem [kết quả sửa và kiểm tra lại 30 ca cũ](ket-qua-sua-30-ca-cu-tro-ly-erp-2026-11-27.md). Số liệu bên dưới giữ nguyên như lịch sử lần đo trước.

Chưa đủ điều kiện nghiệm thu toàn bộ. **12/36 ca đạt bước kỳ vọng; 14 ca chưa đạt; 2 ca đã sửa và replay đạt nhưng chưa có AI mới sau sửa; 7 ca bị chặn cấu hình; 1 ca chưa kết luận.** Đạt bước kỳ vọng gồm trả dữ liệu/file, dừng đúng xác nhận hoặc hỏi đúng thông tin thực sự còn thiếu, không đồng nghĩa mọi yêu cầu đã được ghi thành công.

| Nhóm | Đạt bước kỳ vọng | Chưa đạt | Replay đạt, chờ AI mới | Chặn cấu hình | Chưa kết luận | Tổng |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 30 cũ | 9 | 12 | 1 | 7 | 1 | 30 |
| 6 mới | 3 | 2 | 1 | 0 | 0 | 6 |
| Tổng | 12 | 14 | 2 | 7 | 1 | 36 |

## Cách kiểm tra và giới hạn

- Gọi HTTP thật vào trợ lý ERP local QA cổng 3043, cùng code service/interpreter/dispatcher và DB local. Đây là kiểm tra backend hội thoại; **không phải kiểm tra giao diện trình duyệt ở lượt này**.
- Dùng câu thay tên/mã bằng QA; không gọi lại 7 ca có module worker/retail-partner đang bị tắt ở công ty. Probe ban đầu có 861 action được phép; không suy từ con số catalog rằng tài khoản dùng được mọi chức năng.
- Luôn xác nhận trong tiến trình QA; mọi HTTP ghi nghiệp vụ bị chặn. Không gửi nút xác nhận. Không thay cấu hình alwaysConfirm của người dùng.
- Chạy lại 29 ca có quyền; kiểm lại 6 ca sau bản sửa giữa đợt, trong đó S8-R026 dừng giữa chừng do dự phòng chi phí. Không tính các lần 401 chưa tới AI hoặc lỗi khởi động driver thành lỗi sản phẩm; log gốc giữ nguyên.
- Trần riêng mới 0,25 USD: đã ghi nhận **0.22269895 USD**, giữ chỗ chưa rõ kết quả **0.01653412 USD**; cộng **0.23923307 USD**. Còn 0.01076693 USD nhưng không đủ khoản dự phòng lượt tiếp theo; latch COST_RESERVE_LIMIT được giữ, không mở lại. Không gộp hoặc xóa sổ/khoản giữ chỗ cũ.
- Sau khi dừng AI, replay ba bộ phản hồi AI đã lưu qua service hiện tại + GET local, **0 request provider mới**. Hai ca replay đạt được tách riêng; S8-R026 hết exception nhưng vẫn chưa đủ thông tin nên còn chưa đạt.
- Hash các collection nghiệp vụ có bản ghi gắn QA trước/sau không đổi; 0 request ghi nghiệp vụ bị thử. Phạm vi hash chỉ bao phủ bản ghi QA được gắn nhãn, không chứng minh toàn DB bất biến. Có lưu turn/session và file xuất của trợ lý.

## 30 ca cũ

| Mã | Câu dùng để test | Kết luận | Kết quả thực tế / việc còn thiếu |
| --- | --- | --- | --- |
| S2-R002 | tạo 1 dự án mới tên QA Du An Moi 20261126 trong mục quản lí lao động Mình chọn Tên lao động: QA Công Nhân Dũng — Chi nhánh Trụ sở chính, QA Công Nhân Chi — Chi nhánh Trụ sở chính, QA Công Nhân Bình — Chi nhánh Trụ sở chính, QA Công Nhân An — Chi nhánh Trụ sở chính, QA Công Nhân Chi — Chi nhánh Trụ sở chính; Các ngày trong tuần · Các ngày trong tuần: Thứ 2, Thứ 4, Thứ 6, Thứ 3, Thứ 5, Thứ 7. | Bị chặn cấu hình | Probe tài khoản local: phân hệ worker chưa bật trong công ty; không đổi cấu hình/quyền và không gọi lại AI cho ca này. |
| S2-R005 | Dự án QA Nhà máy A có ai đi muộn | Bị chặn cấu hình | Probe tài khoản local: phân hệ worker chưa bật trong công ty; không đổi cấu hình/quyền và không gọi lại AI cho ca này. |
| S2-R007 | Cập nhật địa điểm cho Dự án QA Nhà máy B thành 140 Đường QA | Bị chặn cấu hình | Probe tài khoản local: phân hệ worker chưa bật trong công ty; không đổi cấu hình/quyền và không gọi lại AI cho ca này. |
| S3-R022 | Học viên nào thường xuyên vắng ở lớp QA Anh văn 01 | Đạt bước kỳ vọng | Hỏi đúng ngưỡng còn thiếu của “thường xuyên vắng”: số buổi hoặc tỷ lệ chuyên cần. Đây là đạt bước hỏi lại, chưa phải đã trả danh sách học viên. |
| S3-R030 | Học viên nào chưa đóng học phí lớp QA Anh văn 01 | Chưa đạt | Kế hoạch cần ghép ghi danh lớp, hồ sơ học viên và học phí; hợp đồng quan hệ hiện tại chưa hỗ trợ đủ lớp/phép ghép. Vẫn lỗi lập kế hoạch, chưa trả danh sách đúng lớp. |
| S3-R040 | Tổng số học viên còn nợ trung tâm | Chưa đạt | Chưa thực hiện được tổng số học viên còn nợ; quan hệ đối chiếu học phí chưa có đầu ra đếm phù hợp được nối vào luồng này. Không lấy số lượng toàn bộ học viên thay số người còn nợ. |
| S3-R048 | Mình chọn Tên hoặc mã kỳ thi, hạng hoặc ngày dự kiến: Testing · 18/09/2026 · Sắp diễn ra. - Mình chọn Tên hoặc mã kỳ thi, hạng hoặc ngày dự kiến: API TESTING ABC · 2027-01-01 · Sắp diễn ra. | Đạt bước kỳ vọng | Câu chỉ có các lựa chọn kỳ thi, chưa nêu muốn làm gì; bot hỏi đúng thao tác và kỳ thi cần dùng. Không tự đoán sửa/tạo. |
| S3-R064 | Danh sách các thiết bị đang sẵn sàng sử dụng | Chưa đạt | Đã biên dịch được trạng thái AVAILABLE nhưng chọn “thiết bị” thành một danh mục reference không tồn tại, dẫn tới không có option khả dụng. Chưa đạt; cần thống nhất loại thiết bị với phạm vi loại trừ Phòng học của web. |
| S3-R083 | Gửi email nhắc đóng học phí hàng loạt theo mẫu Nhắc phí cho các học viên còn nợ học phí | Chưa đạt | Chưa thực hiện được chuỗi chọn người còn nợ -> lấy email -> áp mẫu -> bản xác nhận gửi hàng loạt. Có API gửi email riêng không đồng nghĩa đã có luồng bulk đủ dữ liệu. |
| S4-R010 | Đối tác QA Bình Minh đang dùng tài khoản ngân hàng nào để nhận hoa hồng | Chưa kết luận | Lượt mới hỏi chọn phân hệ; driver tiếp tục quá muộn nên option đã hết hiệu lực. Không tính lỗi driver thành lỗi hiểu câu, cũng không tính là đã trả được ngân hàng. Sửa ô trống/Chưa cập nhật đã qua offline; chưa xác minh lại đầy đủ qua AI thật. |
| S4-R047 | Chi trả 200.000 tiền hoa hồng cho đối tác QA Bình Minh hôm nay bằng chuyển khoản ngân hàng | Đạt bước kỳ vọng | Tới bản xác nhận: QA Bình Minh, 200.000, ngày 27/11/2026, chuyển khoản. Không gửi xác nhận và không chi trả. |
| S4-R049 | Chi trả 410.000 hoa hồng cho đối tác QA Thu Ngân kèm ghi chú Quyết toán hoa hồng tháng 11/2026 | Đạt bước kỳ vọng | Qua form chọn Chuyển khoản và bổ sung ngày 27/11/2026, tới bản xác nhận QA Thu Ngân, 410.000, giữ ghi chú Quyết toán hoa hồng tháng 11/2026. Không gửi xác nhận. |
| S4-R050 | Xuất file excel danh sách toàn bộ đối tác tuyển sinh | Đạt bước kỳ vọng | AI thật đã xuất XLSX 10 đối tác. Document lưu thật có 10 dòng, các cột Đối tác/Mã/Điện thoại/Email/Trạng thái; đối chiếu nguồn GET 10 dòng. |
| S6-R003 | Hôm nay thu tiền mặt bao nhiêu, chuyển khoản về bao nhiêu? | Replay đạt; chờ AI mới | AI thật đã chọn đúng nguồn tiền theo phương thức nhưng trả thiếu khi API bỏ nhóm có số tiền 0. Đã sửa shared complete-groups; replay nguyên phản hồi AI qua service và GET local trả tiền mặt 0, chuyển khoản 0. Chưa có lượt AI mới sau bản sửa cuối. |
| S6-R009 | Tháng này cửa hàng có bao nhiêu đơn hoàn tất, bao nhiêu đơn bị hủy, bao nhiêu đơn chưa xong? | Chưa đạt | Vẫn từ chối thống kê đủ ba nhóm hoàn tất/hủy/chưa xong. Đã bỏ hạn chế kế hoạch phải có >=2 nguồn và giữ đọc không làm hết hạn draft, nhưng phép gom nhiều trạng thái thành nhóm nghiệp vụ còn thiếu. Không coi sửa side effect là toàn ca đã đạt. |
| S6-R019 | Top 10 mặt hàng bán chạy nhất tháng này là những món nào? | Đạt bước kỳ vọng | AI thật sau sửa chọn retail.report.products; GET báo cáo tháng 11/2026 trả Bộ sạc QA, SKU QA-SAC-20W, số lượng bán ròng 4. API chỉ có một sản phẩm phát sinh nên không bịa thêm 9 mặt hàng. Đối chiếu GET xác nhận 1 dòng. |
| S6-R023 | Tháng này có bao nhiêu khách mang hàng đến trả hoặc đổi? Cửa hàng phải hoàn lại bao nhiêu tiền? | Chưa đạt | Chưa chọn/biểu diễn đủ nguồn trả-đổi, đếm khách khác nhau và tổng hoàn tiền. Cần phép distinct/quan hệ đọc có hợp đồng, không bỏ đầu ra đếm khách. |
| S6-R027 | Những khách hàng nào hiện đang nợ tiền cửa hàng? Tổng tiền khách còn nợ là bao nhiêu? | Đạt bước kỳ vọng | AI thật trả QA Khách Còn nợ và tổng 2.000.000; đối chiếu GET đầy đủ cùng kết quả. Không có thao tác ghi. |
| S6-R043 | Hiện cửa hàng đang chạy những mã giảm giá nào còn hạn sử dụng? | Chưa đạt | AI thật vẫn báo thiếu nguồn danh sách mã đang chạy. Đã đăng ký GET /retail/coupons, giữ retail:manage, phân trang và bộ lọc active/thời hạn; fixture qua. Chưa được AI thật xác minh sau sửa do trần chi phí. |
| S7-R002 | Báo cáo tổng quan tình hình đối tác bán lẻ hiện tại của cửa hàng | Bị chặn cấu hình | Probe tài khoản local: phân hệ retail-partner chưa bật trong công ty; không đổi cấu hình/quyền và không gọi lại AI cho ca này. |
| S7-R003 | Hiện tại cửa hàng có bao nhiêu cộng tác viên bán lẻ và bao nhiêu đại lý hoặc nhà cung cấp | Bị chặn cấu hình | Probe tài khoản local: phân hệ retail-partner chưa bật trong công ty; không đổi cấu hình/quyền và không gọi lại AI cho ca này. |
| S7-R004 | Có đối tác bán lẻ nào đang ngừng hoạt động không | Bị chặn cấu hình | Probe tài khoản local: phân hệ retail-partner chưa bật trong công ty; không đổi cấu hình/quyền và không gọi lại AI cho ca này. |
| S7-R008 | Xem thông tin chi tiết của cộng tác viên bán lẻ QA Đại lý Đông | Bị chặn cấu hình | Probe tài khoản local: phân hệ retail-partner chưa bật trong công ty; không đổi cấu hình/quyền và không gọi lại AI cho ca này. |
| S8-R011 | Báo cáo nhanh tình hình kho Trụ sở chính hôm nay: tổng tiền hàng tồn kho và tổng số máy còn lại | Chưa đạt | Timeout trước khi có kết quả đủ tổng giá trị và số lượng tồn. Giữ nguyên khoản dự phòng chưa rõ chi phí; chưa có lượt kiểm lại hoàn chỉnh. |
| S8-R022 | Xuất file excel bảng tồn kho hiện tại của kho Trụ sở chính để tôi gửi kế toán đối chiếu | Chưa đạt | Vẫn thiếu nguồn bảng tồn kho theo kho trong catalog; không thay bằng báo cáo đối soát hoặc danh sách sản phẩm thiếu số tồn/giá trị. Bộ xuất Excel chung đã sửa, riêng nguồn tồn này chưa hoàn thành. |
| S8-R026 | Lần nhập hàng gần nhất là ngày nào, nhập của nhà cung cấp nào và giá trị bao nhiêu | Chưa đạt | Lượt AI đầu lỗi khi tìm cực trị trên ngày nhận trống; lượt kiểm lại bị trần chi phí dừng. Đã sửa xử lý ngày tùy chọn, replay không còn exception nhưng trả rỗng, chưa trả đủ ngày/nhà cung cấp/giá trị. Còn phải giải quyết ngày nhận tùy chọn so với ngày xác nhận nhập kho. |
| S8-R045 | Tạo giúp tôi phiếu xuất 1 máy QA Sản phẩm 06 từ kho Trụ sở chính để bộ phận kế toán sử dụng nội bộ | Chưa đạt | Chưa có action tạo phiếu xuất nội bộ với hợp đồng dòng hàng trong catalog; bot chưa đưa được form/xác nhận phù hợp. Không thay bằng điều chuyển hoặc xuất linh kiện sửa chữa. |
| S8-R052 | Tạo giúp tôi phiếu điều chuyển 2 máy QA Sản phẩm 04 từ kho Trụ sở chính sang kho QA Phụ | Đạt bước kỳ vọng | Dừng hỏi rõ giới hạn kho nhận/chi nhánh nhận trước khi điều chuyển, không tự đổi kho QA Phụ sang kho mặc định rồi ghi. Đạt bước làm rõ đích; chưa tạo phiếu. |
| S8-R061 | Xuất file excel toàn bộ lịch sử giao dịch kho để tôi đối soát sổ sách cuối tháng | Đạt bước kỳ vọng | AI thật sau sửa đã xuất file XLSX 7 dòng lịch sử kho. Kiểm tra document lưu thật: 8 cột công khai, 7 dòng; không chỉ dựa vào câu báo đã xuất. |
| S8-R071 | Chuyển giúp tôi 1 máy QA Sản phẩm 04 đang còn trong kho Trụ sở chính sang kho QA Phụ theo IMEI | Chưa đạt | Lượt này lỗi lập kế hoạch chuyển theo IMEI, chưa hỏi/giữ đủ IMEI, số lượng và kho nguồn. Trước từng đạt bước hỏi nhưng lần mới không ổn định; không giữ nhãn đạt cũ. |

## 6 ca mới

| Mã | Câu dùng để test | Kết luận | Kết quả thực tế / việc còn thiếu |
| --- | --- | --- | --- |
| S1-R008 | Những nhân sự có tên bắt đầu bằng QA nào hôm nay chưa chấm công? | Đạt bước kỳ vọng | Dùng biến thể ghi rõ tên bắt đầu QA để tách dữ liệu giả khỏi một nhân sự không gắn QA: trả 7 hồ sơ QA chưa chấm công. Đối chiếu nguồn 8 dòng trước lọc; hai hồ sơ cùng tên không bị gộp thành một người. |
| S3-R065 | Hiện có thiết bị nào đang bảo trì không | Replay đạt; chờ AI mới | AI thật mới lỗi vì NLU mở rộng “Hiện” thành “hiện tại” và snapshot không được hạ đúng. Đã sửa marker thời điểm hiện tại có reviewer xác minh; replay nguyên phản hồi AI qua service + GET local đã trả đúng không có bản ghi bảo trì. Chưa chạy AI mới sau sửa cuối; chưa có fixture dương bảo trì. |
| S4-R012 | Những đối tác nào đang còn nợ hoa hồng nhưng chưa có số tài khoản ngân hàng | Đạt bước kỳ vọng | AI thật lọc đồng thời còn nợ hoa hồng và chưa có tài khoản ngân hàng; trả QA Bình Minh, QA Vân Anh. GET đối chiếu 10 đối tác cho cùng 2 kết quả. |
| S4-R013 | Tìm các đối tác tuyển sinh có ghi chú qua cộng đồng phụ huynh | Đạt bước kỳ vọng | Tra cứu notes contains đúng nội dung, nguồn đủ 10 đối tác, không có kết quả. Chỉ đạt ca âm tính; chưa chứng minh đã tìm được một bản ghi có ghi chú này. |
| S6-R013 | Hôm nay có đơn hàng nào bị hủy không? Lý do hủy là gì và ai hủy? | Chưa đạt | Vẫn không trả đủ đơn hủy hôm nay, lý do và người hủy. Contract nguồn đọc thiếu đầu ra/quan hệ cần thiết; không tự suy tên từ ID nội bộ. |
| S8-R030 | Hiện có phiếu nhập hàng nào nhân viên tạo nháp hoặc chưa hoàn thành cần tôi xử lý không | Chưa đạt | Vẫn hỏi thừa về điều kiện “cần tôi xử lý” thay vì thực hiện gọn việc tìm phiếu nháp/chưa hoàn tất. Chưa nghiệm thu ngữ cảnh quy trình chung. |

## Phần đã sửa chung trong đợt này

1. Xuất Excel từ nguồn đọc được cấp quyền: nhận goal export/định dạng XLSX, giữ bộ lọc, đọc đủ trang và chạy exporter trước nhánh chỉ trả phân tích trong chat. Kiểm chứng AI thật: S4-R050 10 dòng, S8-R061 7 dòng.
2. Cho kế hoạch đọc có một nguồn, giữ kiểm quyền và whitelist output; count là kết quả tính đã xác minh, không mở cột API tùy ý. S6-R009 vẫn thiếu biểu diễn nhóm nghiệp vụ nên chưa đạt.
3. Đăng ký các hàng báo cáo typed cho sản phẩm bán và tiền thu theo phương thức, dùng chung lọc/sort/aggregate. Nguồn giữ nguyên API/scoping/quyền. S6-R019 đã đạt AI thật.
4. Phân biệt nhóm số tiền 0 với thiếu dữ liệu: chỉ bổ sung 0 sau khi nguồn tổng hợp đầy đủ và miền phương thức đã được server duyệt. Replay S6-R003 trả hai số 0; chưa AI mới sau sửa này.
5. Biên dịch enum gốc và nhãn hiển thị chính thức; giữ phủ định và lựa chọn thực tế. Marker thời điểm hiện tại được reviewer xác minh có thể mở rộng tên gọi mà không bị coi là ngày lọc mới; ngày cụ thể/kỳ quá khứ và ghi vẫn bị kiểm soát. Replay S3-R065 đạt ca âm tính sau sửa cuối.
6. Trường public được yêu cầu nhưng đang trống trên GET trả Chưa cập nhật thay câu đã hoàn tất chung; không bịa trường chưa có trong response. S4-R010 mới qua offline, lượt thực tế chưa kết luận do option hết hạn.
7. Cực trị ngày bỏ qua ngày tùy chọn trống, vẫn từ chối ngày hỏng. S8-R026 không còn exception trong replay, nhưng còn thiếu quyết định nguồn ngày nghiệp vụ nên chưa đạt.
8. Bổ sung nguồn quản trị mã giảm giá đúng GET /retail/coupons và quyền retail:manage, giữ phân trang. Chưa kiểm AI thật sau sửa do trần chi phí.

## Việc còn mở

Các lỗi chưa đạt có cả thiếu hợp đồng nguồn/action (tồn kho, xuất nội bộ, dữ liệu đơn hủy), thiếu toán tử/quan hệ (khách distinct, học phí theo lớp, count sau đối chiếu, gửi hàng loạt), và lỗi biên dịch ngữ cảnh. Nới validation chung không tự tạo ra dữ liệu hoặc chuỗi thao tác còn thiếu. Không đổi nhãn 14 ca này thành đạt dựa trên số unit test.

Hồi quy cuối: **929 test / 46 file qua**, typecheck qua. Đây là kiểm tra code bổ sung; không phải 929 câu thực tế và không thay cho bảng 36 ca trên.

Chứng cứ: `tmp/sheet-36-followup-20261127/reviewed-final.json` (từng ca, số call/chi phí), `results.json`, `retries.json`, `continued.json`, `ledger.json`, `events.json`, `actual-inspection.json`, `retry-inspection.json`, `oracle.json`, `captured-replay.json`, `business-before.json`, `business-after.json`. Replay chỉ kiểm chứng phản hồi đã lưu đi qua code/API hiện tại; không đo độ ổn định của một lượt suy luận mới.
