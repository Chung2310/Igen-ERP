# Kết quả sửa và kiểm tra lại 30 ca cũ — 27/11/2026

**28/30 ca đạt bước kỳ vọng qua AI thật trên backend local; 2 ca chưa nghiệm thu AI thật sau bản sửa cuối.** Chưa kết luận đã sửa xong toàn bộ 30 ca.

| Trạng thái | Số ca |
| --- | ---: |
| Trả dữ liệu hoặc file | 19 |
| Dừng ở xác nhận ghi | 7 |
| Hỏi đúng thông tin thực sự còn thiếu | 2 |
| Chờ xác minh AI thật sau sửa | 2 |
| Tổng | 30 |

## Phạm vi

- Gọi HTTP thật tới backend QA local cổng 3043, cùng service/interpreter/dispatcher của trợ lý và DB local ASD, có gọi OpenRouter thật. Không phải kiểm tra giao diện trình duyệt trong đợt này.
- Lao động và Đối tác bán lẻ đã được bật trên local theo xác nhận của chủ dự án; các ca trước bị chặn cấu hình đã được kiểm tra lại.
- Dùng dữ liệu thay thế QA. Chuẩn bị fixture là bước riêng được người dùng cho phép; thao tác ghi do trợ lý đề xuất đều dừng ở xác nhận. HTTP ghi nghiệp vụ bị chặn.
- “Đạt” nghĩa là đạt bước cụ thể ghi trong bảng, không đồng nghĩa đã ghi thành công, bao phủ mọi cách diễn đạt hay toàn bộ module. Hai ca hỏi thiếu thông tin chưa hoàn tất nghiệp vụ.
- Chọn lần xác minh phù hợp sau sửa của từng ca. Không coi replay là AI thật, không coi lỗi khởi động driver/401 trước AI là lỗi sản phẩm.
- Báo cáo này chỉ cập nhật 30 ca cũ; không tính lại 6 ca mới trong báo cáo trước.

## Từng ca

| Mã | Chức năng | Kết luận | Kết quả thực tế |
| --- | --- | --- | --- |
| S2-R002 | Tạo dự án lao động | Đạt: xác nhận | Đúng 5 lao động, 6 ngày trong tuần; nhập mã QA-OLD30-NEW qua form. Không tạo. |
| S2-R005 | Lao động đi muộn theo dự án | Đạt nhánh rỗng | Không có dòng phù hợp, GET đối chiếu cũng trả 0. Chưa chứng minh nhánh có người đi muộn. |
| S2-R007 | Sửa địa điểm dự án | Đạt: xác nhận | Địa điểm 140 Đường QA; không hỏi lại lịch làm việc đã có. Không cập nhật. |
| S3-R022 | Học viên thường xuyên vắng | Đạt: hỏi thiếu tiêu chí | Hỏi số buổi vắng hoặc tỷ lệ chuyên cần; chưa có ngưỡng nên chưa trả danh sách. |
| S3-R030 | Học viên chưa đóng đủ học phí theo lớp | Đạt: dữ liệu | 2 học viên, nợ 4.000.000 và 2.000.000 đồng; khớp GET nguồn, gồm người đã đóng một phần. |
| S3-R040 | Tổng học viên còn nợ | Đạt: dữ liệu | 17 học viên; đối chiếu nguồn học phí, tất cả số dư còn lại > 0. |
| S3-R048 | Chọn kỳ thi nhưng chưa nói thao tác | Đạt: hỏi thiếu thông tin | Hỏi muốn làm gì và chọn kỳ thi nào; không tự suy ra thao tác ghi từ hai lựa chọn rời rạc. |
| S3-R064 | Thiết bị sẵn sàng | Đạt: dữ liệu | 1 máy chiếu QA sẵn sàng, loại trừ phòng học. Nhãn một số cột phụ còn dùng tên chung chưa đẹp. |
| S3-R083 | Nhắc học phí hàng loạt | Đạt: xác nhận | Thu tiêu đề/nội dung qua form, đọc trước số người nhận và dừng xác nhận. Không gửi email. |
| S4-R010 | Ngân hàng nhận hoa hồng | Đạt: dữ liệu | Đúng QA Bình Minh; ba thông tin ngân hàng chưa cập nhật được trả là chưa cập nhật. |
| S4-R047 | Chi hoa hồng 200.000 | Đạt: xác nhận | Giữ số tiền, ngày hôm nay, chuyển khoản. Không chi trả. |
| S4-R049 | Chi hoa hồng 410.000 | Đạt: xác nhận | Giữ số tiền/ghi chú; tester chọn chuyển khoản và nhập ngày bằng form. Không chi trả. |
| S4-R050 | Excel đối tác tuyển sinh | Đạt: file | Xuất 10 dòng đối tác trong phạm vi được phép. |
| S6-R003 | Thu tiền mặt/chuyển khoản hôm nay | Đạt: dữ liệu | Trả riêng tiền mặt 0, chuyển khoản 0. |
| S6-R009 | Đơn hoàn tất/hủy/chưa xong | Đạt: dữ liệu | 1 hoàn tất, 1 hủy, 1 chưa xong; tên cột rõ, khớp nguồn. |
| S6-R019 | Top 10 sản phẩm bán chạy | Đạt: dữ liệu | Nguồn có 1 mặt hàng phù hợp: Bộ sạc QA; không tạo thêm cho đủ 10. |
| S6-R023 | Khách đổi/trả và tiền hoàn | Đạt: dữ liệu | 2 chứng từ hoàn tất thuộc 1 khách khác nhau, 200.000 đồng đã hoàn. Không coi đây là tiền phải trả còn tồn. |
| S6-R027 | Khách còn nợ và tổng nợ | Đạt: dữ liệu | QA Khách Còn nợ: 2.000.000 đồng; tổng 2.000.000 đồng. |
| S6-R043 | Coupon đang chạy/còn hạn | Đạt: dữ liệu | Đúng 1 mã QA-OLD30-VALID, khớp trạng thái và thời hạn nguồn. |
| S7-R002 | Tổng quan đối tác bán lẻ | Đạt: dữ liệu | 6 đối tác: 5 hoạt động, 1 ngừng; kèm các chỉ tiêu vai trò. |
| S7-R003 | Đối tác theo vai trò | Đạt: dữ liệu | 2 cộng tác viên, 2 đại lý, 3 nhà cung cấp. Có hồ sơ nhiều vai trò, không cộng thành số đối tác duy nhất. |
| S7-R004 | Đối tác ngừng hoạt động | Đạt: dữ liệu | Đúng QA Nhà cung cấp Cũ30, mã QA-OLD30-NCC, trạng thái ngừng. |
| S7-R008 | Chi tiết cộng tác viên trùng tên | Đạt: dữ liệu | Hai QA Đại lý Đông, phân biệt bằng mã QA-OLD30-CTV/QA-DTBL-01; cả hai có vai trò cộng tác viên. |
| S8-R011 | Tổng giá trị và số lượng tồn | Chưa nghiệm thu AI thật | AI hỏi đúng phạm vi “máy”; sau trả lời làm rõ, NLU giữ cả hai chỉ tiêu. Guard dừng trước planner tiếp theo, chưa có số tổng cuối. |
| S8-R022 | Excel tồn kho | Đạt: file | Chọn option kho KHO-MAIN do server cấp, xuất 4 dòng tại thời điểm đo trước khi thêm SKU serial QA. |
| S8-R026 | Lần nhập gần nhất | Đạt: dữ liệu | 14:22 ngày 27/11/2026, QA Thiết bị Bắc, 300.000 đồng; chỉ phiếu đã nhận/xác nhận. |
| S8-R045 | Xuất kho nội bộ | Đạt: xác nhận | Đúng kho, sản phẩm 06/SKU006, số lượng 1, mục đích kế toán sử dụng nội bộ. Không tạo phiếu. |
| S8-R052 | Điều chuyển theo số lượng | Đạt: xác nhận | 2 sản phẩm SKU004; chọn KHO-MAIN → QA-OLD30-PHU, nhập lý do qua form. Không điều chuyển. |
| S8-R061 | Excel toàn bộ lịch sử kho | Đạt: file | 12 dòng từ sổ giao dịch đã ghi sổ, không lấy danh sách phiếu nháp thay thế. |
| S8-R071 | Điều chuyển theo IMEI | Chưa nghiệm thu AI thật | Đã sửa điều kiện kho nguồn và tra IMEI khác serial; replay hợp đồng/integration đạt. AI lần cuối trước sửa vẫn fail; sau sửa chưa chạy lại do dừng trần. |

## Sửa ở luồng dùng chung

1. Giữ mục tiêu, chỉ tiêu và điều kiện qua lượt làm rõ, kiểm tra scope phiên; câu mới độc lập không kế thừa yêu cầu cũ.
2. Dành chỗ cho action/nguồn liên quan toàn cục trong shortlist, tránh nhóm ưu tiên chiếm hết chỗ của action đúng.
3. Chuẩn hóa enum, ngày tương đối theo đồng hồ cố định, literal trong mảng/JSON và binding đầu ra tổng hợp. Giữ phủ định, ngưỡng số, điều kiện thực; không bỏ bộ lọc để tránh từ chối.
4. Khai báo điều kiện nghiệp vụ đã được endpoint bảo đảm. Tham chiếu kho nguồn của điều chuyển chỉ được chấp nhận khi đúng field khai báo và đúng giá trị nguyên văn; giữ kiểm tra công ty, chi nhánh và tồn kho.
5. Gợi ý lựa chọn có fallback danh sách đúng scope khi từ khóa không khớp; resolver không tự chọn bản ghi. Không hỏi phần tử bắt buộc của mảng tùy chọn vắng trong yêu cầu sửa.
6. Bổ sung hợp đồng nguồn đọc đúng: học phí đối chiếu thanh toán, thiết bị không lẫn phòng, nhập đã nhận, tồn kho có giá trị, ledger đã ghi sổ, báo cáo trạng thái đơn/khách hoàn/đối tác. Đây là nguồn dữ liệu có schema, không phải luật bắt từng câu.
7. Báo cáo tính sẵn dùng bảng kết quả chung, giữ đủ chỉ tiêu được hỏi. Email hàng loạt thu nội dung bằng form, đọc trước snapshot người nhận gắn scope/nội dung và xác nhận trước gửi.
8. Native transfer tra cả IMEI và serial, giữ kiểm tra tồn kho/transaction hiện có.

## Hai ca còn chờ

- **S8-R011:** hợp đồng và giữ ngữ cảnh qua offline. AI thật đã giữ tổng giá trị + tổng số lượng sau câu trả lời làm rõ nhưng chưa qua planner do giới hạn chi phí. GET độc lập của toàn kho là **32 đơn vị / 324.622.221 đồng**; đây là số đối chiếu, chưa phải câu trả lời cuối của bot. Không tự đổi “máy” thành toàn bộ hàng trước khi người dùng đồng ý.
- **S8-R071:** sửa kho nguồn và lookup IMEI đã qua replay/integration; chưa có AI mới sau sửa tới form/xác nhận. Sản phẩm serial QA riêng có số giả 000000000000030, qty 1; không dùng sản phẩm quản lý số lượng để giả làm serial.

## Đối chiếu dữ liệu và giới hạn

GET độc lập không dùng LLM xác nhận: 17 học viên nợ; 2 người nợ trong lớp; 1 thiết bị sẵn sàng; 1 coupon còn hiệu lực; trạng thái đơn 1/1/1; 2 chứng từ hoàn thuộc 1 khách, 200.000 đồng đã hoàn; đối tác tổng 6, hoạt động/ngừng 5/1, vai trò 2/2/3; ledger 12 dòng. Xem `tmp/sheet-old30-round2-20261127/oracles.json`.

Đã thêm fixture QA thiếu. Có một lần sửa tên hiển thị ba document QA của sản phẩm serial thành “QA Điện thoại Cũ30”; snapshot phase 2 lấy sau thay đổi fixture này. Không sửa bản ghi không gắn QA để làm test đạt.

Audit trước/sau từng giai đoạn: **0 request ghi nghiệp vụ bị thử; hash các collection chứa bản ghi QA được theo dõi không đổi sau chuẩn bị fixture**. Chỉ chứng minh phạm vi QA có gắn nhãn, không chứng minh toàn DB bất biến. Session/turn và tài liệu Excel của trợ lý có được lưu.

## Chi phí

Hai trần riêng 0,25 USD được chủ dự án cấp nối tiếp; giữ nguyên sổ cũ và khoản chưa rõ kết quả.

| Đợt | Trần USD | Đã ghi nhận USD | Giữ chỗ chưa rõ USD | Tổng tính vào trần USD |
| --- | ---: | ---: | ---: | ---: |
| 1 | 0,25 | 0,23863860 | 0,00137288 | 0,24001148 |
| 2 | 0,25 | 0,23175160 | 0,00580925 | 0,23756085 |

Đợt 2 dừng ở `COST_RESERVE_LIMIT`: còn 0,01243915 USD sau giữ chỗ nhưng không đủ dự phòng request tiếp theo. Không mở lại latch, không hoàn khoản giữ chỗ của timeout chưa xác định. Chi phí này gồm các lần chạy thất bại và kiểm lại, không chỉ các kết quả cuối.

## Kiểm chứng code

- `npm run typecheck`: đạt.
- `npx vitest run --config server/assistant/testing/catalog-routing/vitest.config.mjs`: **973 test / 50 file đạt**; không gọi provider/DB thật trong bộ này.
- Native transfer integration: **20 test đạt** trên MongoMemoryReplSet riêng, tắt tải binary lúc chạy; gồm IMEI khác serial. Không dùng DB ASD cho integration.
- Không sửa frontend trong phần này; không chạy build giao diện, không tuyên bố kiểm tra browser/ba kích thước màn hình.

## Artefact local

Các file `tmp/` được giữ local, không vào Git mặc định. Sổ chi phí có usage/output provider, không chứa trong báo cáo này.

| Nhóm | Nguồn |
| --- | --- |
| Câu và lần chạy đầu đủ 30 | `tmp/sheet-old30-fixall-20261127/cases.json`, `results.json` |
| Lần kiểm lại đầu | `tmp/sheet-old30-fixall-20261127/results-retry.json` |
| Tạo dự án đến xác nhận | `tmp/sheet-old30-fixall-20261127/create-followup.json` |
| Excel tồn kho | `tmp/sheet-old30-fixall-20261127/export-followup.json` |
| 17 ca còn lại | `tmp/sheet-old30-round2-20261127/results.json` |
| 9 ca kiểm lại | `tmp/sheet-old30-round2-20261127/results-retry.json` |
| Học phí/trạng thái đơn/hoàn hàng cuối | `tmp/sheet-old30-round2-20261127/results-final.json` |
| Tồn kho lần cuối và dừng chi phí | `tmp/sheet-old30-round2-20261127/results-last2.json` |
| Audit sau cùng | `tmp/sheet-old30-round2-20261127/business-after-phase2.json` |
| Sổ chi phí | `ledger.json` trong từng thư mục đợt |
| Bộ hồi quy cuối | `tmp/sheet-old30-round2-20261127/offline-last-all.log` |
| Integration transfer | `tmp/sheet-old30-round2-20261127/transfer-memory.log` |
