# Kế hoạch triển khai chức năng Bán lẻ — Ranking chi tiết theo nhu cầu

Phiên bản này mở rộng từ `ke-hoach-trien-khai-chuc-nang-ban-le.md`, bổ sung ba lớp quyết định:

1. **Mức nhu cầu kinh doanh** cho từng tính năng.
2. **Phạm vi MVP có thể kiểm chứng**, nhằm tránh hiểu một tên tính năng theo nhiều mức độ khác nhau.
3. **Hồ sơ nhu cầu chi tiết**, giải thích ai cần, vấn đề nào cần giải quyết, hệ thống phải đáp ứng gì và giá trị nào cần đo lường.

> **Giữ nguyên quyết định tạm hoãn:** B5 — Camera AI đo traffic và C9 — Tích hợp VNeID không nằm trong roadmap triển khai hiện tại.

## 1. Cách đọc ranking

### 1.1. Mức nhu cầu

| Mức | Ý nghĩa | Quy tắc sử dụng |
|---|---|---|
| **MUST** | Bắt buộc | Thiếu tính năng thì chưa hình thành được luồng bán lẻ tối thiểu, không kiểm soát được vận hành hoặc chưa đáp ứng điều kiện pháp lý khi go-live chính thức. |
| **SHOULD** | Nhu cầu cao | Không chặn MVP đầu tiên nhưng cần sớm để vận hành ổn định hoặc phục vụ nghiệp vụ phổ biến. |
| **COULD** | Nâng cao | Tạo thêm hiệu quả, doanh thu hoặc trải nghiệm nhưng chỉ nên làm sau khi có dữ liệu chứng minh nhu cầu. |
| **HOLD** | Tạm hoãn | Chưa đủ nhu cầu, điều kiện kỹ thuật, ngân sách hoặc cơ sở pháp lý để đưa vào roadmap hiện tại. |

### 1.2. Mức ưu tiên triển khai

| Ưu tiên | Ý nghĩa |
|---|---|
| **P0** | Nền tảng cần hoàn thành để chạy thử luồng bán hàng end-to-end. |
| **P1** | Cần cho go-live tại quầy và vận hành ổn định. |
| **P2** | Mở rộng nghiệp vụ, kênh bán hoặc tự động hóa sau khi P0–P1 ổn định. |
| **P3** | Tính năng nâng cao; cần business case, pilot hoặc ngân sách riêng. |
| **P4** | Tạm hoãn; chỉ đánh giá lại khi điều kiện thay đổi. |

**Nguyên tắc xếp hạng:** khả năng vận hành → pháp lý → quan hệ phụ thuộc → nhu cầu kinh doanh → độ sẵn sàng → độ khó. `Độ khó` và `Mức nhu cầu` được giữ thành hai trục độc lập; tính năng khó vẫn có thể bắt buộc, còn tính năng dễ chưa chắc cần làm sớm.

---

## 2. Nhóm A — Thuần phần mềm

| ID | Tính năng | Độ khó | Nhu cầu | Ưu tiên | Phạm vi MVP | Điều kiện nghiệm thu tối thiểu |
|---|---|:-:|:-:|:-:|---|---|
| **A1** | Đơn hàng bán lẻ | 2 | **MUST** | **P0** | Tạo đơn theo chi nhánh; chọn khách hàng tùy chọn; thêm sản phẩm, số lượng, giảm giá; ghi nhận phương thức và trạng thái thanh toán; hỗ trợ nháp, xác nhận, hủy. | Một thu ngân tạo được đơn hoàn chỉnh; tổng tiền được tính nhất quán; đơn đã xác nhận có mã duy nhất và lưu người tạo, chi nhánh, thời gian. |
| **A2** | Hóa đơn bán lẻ nội bộ | 2 | **MUST** | **P0** | Sinh hóa đơn HTML/PDF từ đơn đã xác nhận; có thông tin cửa hàng, dòng hàng, giảm giá, tổng tiền, phương thức thanh toán và khả năng in lại. Không coi đây là hóa đơn điện tử pháp lý. | Hóa đơn khớp 100% số liệu đơn hàng; in và tải lại được; mỗi lần in lại không tạo thêm doanh thu. |
| **A3** | Tự động xuất/nhập kho theo đơn | 2 | **MUST** | **P0** | Trừ tồn khi xác nhận bán; hoàn tồn khi hủy hợp lệ; tạo stock log tham chiếu đơn; chặn bán âm theo cấu hình. | Không có trường hợp đơn xác nhận nhưng thiếu stock log; thao tác lặp không làm trừ kho hai lần; truy vết được từ đơn sang giao dịch kho. |
| **A4** | Công nợ khách hàng cơ bản | 2 | **SHOULD** | **P1** | Cho phép bán nợ; lập sổ công nợ theo khách; ghi nhận thanh toán từng phần; hiển thị dư nợ và hạn thanh toán. | Tổng dư nợ bằng tổng phát sinh trừ tổng đã thu; mỗi điều chỉnh có người thực hiện, thời gian và lý do. |
| **A5** | Báo cáo doanh thu/lợi nhuận bán lẻ | 2 | **MUST** | **P0** | Báo cáo doanh thu, giá vốn và lợi nhuận gộp theo ngày, chi nhánh, sản phẩm và nhân viên; loại đơn hủy khỏi số liệu. | Tổng doanh thu đối soát được với danh sách đơn; bộ lọc dùng chung một nguồn dữ liệu; xuất được bảng kết quả cơ bản. |
| **A6** | Chốt ca/chốt sổ thu ngân | 2 | **MUST** | **P0** | Mở ca, đóng ca; tổng hợp doanh thu theo phương thức thanh toán; nhập tiền mặt thực đếm; ghi nhận chênh lệch và giải trình. | Mỗi thu ngân chỉ có một ca mở tại một quầy/chi nhánh; ca đóng lưu số kỳ vọng, thực tế, chênh lệch và người xác nhận. |
| **A7** | Chi phí/vận chuyển/chi tiêu chi nhánh | 1 | **COULD** | **P2** | Ghi khoản chi theo loại, ngày, số tiền, chi nhánh, người nhập và ghi chú; có danh sách và bộ lọc cơ bản. | Tổng chi theo bộ lọc khớp các bản ghi; chỉnh sửa/xóa được lưu audit hoặc giới hạn bằng quyền. |
| **A8** | Phân hạng khách hàng/VIP | 2 | **SHOULD** | **P2** | Cấu hình tier theo doanh số tích lũy; tự tính hạng; cho phép xem lịch sử thay đổi; chưa triển khai điểm thưởng phức tạp. | Khách đạt ngưỡng được cập nhật đúng hạng; hoàn/hủy đơn làm doanh số và hạng được tính lại nhất quán. |
| **A9** | Quản lý CTV/Đại lý và hoa hồng | 2 | **SHOULD** | **P2** | Gắn đơn với CTV/đại lý; cấu hình một số kiểu hoa hồng cơ bản; tính hoa hồng từ đơn hợp lệ; báo cáo theo kỳ. | Đơn hủy không phát sinh hoa hồng; số hoa hồng truy ngược được về đơn và chính sách áp dụng. |
| **A10** | Trả hàng nhà cung cấp | 2 | **SHOULD** | **P2** | Tạo phiếu trả NCC cho hàng lỗi/sai; chọn sản phẩm/lô nếu có; giảm tồn; lưu lý do và chứng từ; hỗ trợ dòng giá trị 0 đồng. | Phiếu đã xác nhận tạo stock log đúng chiều; không trả vượt tồn khả dụng; lịch sử truy vết được. |
| **A11** | Tài sản cố định | 2 | **SHOULD** | **P2** | Danh mục tài sản, nguyên giá, ngày sử dụng, bộ phận/chi nhánh, thời gian khấu hao; bảng khấu hao đường thẳng cơ bản. | Giá trị khấu hao theo kỳ tính nhất quán; không khấu hao vượt nguyên giá; xem được lịch sử điều chuyển/trạng thái. |
| **A12** | Nhắc công nợ quá hạn | 2 | **SHOULD** | **P1** | Job định kỳ tìm khoản quá hạn; gửi thông báo in-app và email theo mẫu; cấu hình tần suất; lưu trạng thái gửi. | Chạy lại job không gửi trùng ngoài chính sách; lỗi gửi được ghi log và thử lại có kiểm soát; không nhắc khoản đã tất toán. |
| **A13** | Trả hàng từ khách | 2 | **SHOULD** | **P2** | Tạo phiếu nhập trả từ KH; chọn đơn gốc; chọn sản phẩm/số lượng và lý do; hoàn tồn về đúng kho; ghi nhận hoàn tiền hoặc đổi hàng với phương thức; lưu lý do, người thực hiện và audit. | Phiếu trả liên kết đơn gốc; không trả vượt số lượng đã bán; tồn hoàn với stock log riêng; hoàn tiền có phương thức và audit; đơn gốc không bị sửa dữ liệu tài chính. |

**Thứ tự trong nhóm A:** A1 → A3 → A2 → A6 → A5 → A4 → A12 → A8/A10/A13 → A9 → A7/A11.

---

## 3. Nhóm B — Thiết bị và vận hành tại quầy

| ID | Tính năng | Độ khó | Nhu cầu | Ưu tiên | Phạm vi MVP | Điều kiện nghiệm thu tối thiểu |
|---|---|:-:|:-:|:-:|---|---|
| **B1** | Máy POS tại quầy | 3 | **MUST** | **P1** | Giao diện bán hàng chạy trên PC/tablet phổ thông; thao tác thêm hàng, chọn khách, thanh toán và hoàn tất đơn bằng cảm ứng hoặc chuột/phím. Chưa bắt buộc máy POS chuyên dụng. | Hoàn thành được luồng bán hàng trên thiết bị mục tiêu; bố cục dùng được ở độ phân giải quầy đã chọn; mất kết nối có thông báo rõ và không tạo đơn trùng. |
| **B2** | Quét barcode/QR sản phẩm | 2 | **MUST** | **P1** | Hỗ trợ máy quét HID USB/Bluetooth; quét để tìm và thêm sản phẩm vào giỏ; tăng số lượng khi quét lại; xử lý mã không tồn tại. | Mã hợp lệ thêm đúng SKU; mã lạ không làm hỏng giỏ; kiểm thử thành công trên ít nhất một mẫu thiết bị thực tế đã chọn. |
| **B3** | In hóa đơn nhiệt | 2 | **MUST** | **P1** | In khổ 80 mm trước, hỗ trợ nội dung từ A2, in lại và trạng thái lỗi; chọn một phương án driver/SDK chuẩn cho thiết bị pilot. | In đúng tiếng Việt, số tiền và dòng hàng; lỗi hết giấy/mất kết nối có hướng xử lý; in lại không tạo giao dịch mới. |
| **B4** | Ngăn kéo tiền tự động | 2 | **COULD** | **P1** | Gửi lệnh mở ngăn kéo qua máy in sau khi thanh toán tiền mặt thành công; có nút mở thủ công theo quyền. | Không tự mở với đơn chưa hoàn tất hoặc thanh toán không dùng tiền mặt; mọi lần mở thủ công được ghi audit. |
| **B5** | Camera AI đo traffic — tạm hoãn | 4 | **HOLD** | **P4** | Chưa triển khai. Khi xem xét lại, chỉ pilot một cửa ra/vào và xác định rõ độ chính xác, điều kiện ánh sáng, lưu trữ dữ liệu và phương án mua hay tự xây. | Chỉ được đưa lại vào roadmap sau khi có business case, đánh giá quyền riêng tư và tiêu chí pilot được phê duyệt. |
| **B6** | Đánh giá kỹ thuật sửa chữa qua QR | 2 | **COULD** | **P3** | Sinh QR duy nhất cho phiếu sửa chữa; khách chấm điểm và ghi nhận xét; giới hạn một phản hồi hợp lệ cho mỗi phiếu. | QR không làm lộ dữ liệu nhạy cảm; phản hồi gắn đúng phiếu/kỹ thuật viên; báo cáo điểm trung bình có bộ lọc thời gian. |
| **B7** | Wifi Marketing | 4 | **COULD** | **P3** | Pilot một chi nhánh với captive portal của nhà cung cấp; thu thông tin có thông báo đồng ý; đồng bộ hồ sơ/nguồn vào CRM. | Có bằng chứng đồng ý, chính sách lưu/xóa dữ liệu và chống tạo hồ sơ trùng; đo được số lượt kết nối và tỷ lệ cung cấp thông tin. |
| **B8** | Quét IMEI/serial | 2 | **SHOULD** | **P2** | Dùng chung máy quét B2; lưu IMEI/serial duy nhất khi nhập, bán, trả hoặc sửa chữa; hiển thị lịch sử dịch chuyển. | Chặn trùng IMEI/serial trong cùng phạm vi quản lý; mỗi mã truy ra được sản phẩm, trạng thái và lịch sử giao dịch. |
| **B9** | Nhận diện khuôn mặt khách VIP | 4 | **COULD** | **P3** | Chỉ pilot theo cơ chế khách chủ động đồng ý; đăng ký, nhận diện và thông báo cho nhân viên; có khả năng thu hồi đồng ý và xóa dữ liệu. | Có đánh giá quyền riêng tư, ngưỡng nhận diện và quy trình xử lý nhận nhầm; dữ liệu sinh trắc học được phân quyền và audit. |

**Cổng triển khai nhóm B:** phải chọn trước bộ thiết bị pilot và ma trận tương thích. B1–B3 là bộ tối thiểu; B4 chỉ bật khi máy in hỗ trợ và quy trình kiểm soát tiền mặt yêu cầu.

---

## 4. Nhóm C — Đối tác, API và điều kiện bên ngoài

| ID | Tính năng | Độ khó | Nhu cầu | Ưu tiên | Phạm vi MVP | Điều kiện nghiệm thu tối thiểu |
|---|---|:-:|:-:|:-:|---|---|
| **C1** | Hóa đơn điện tử hợp lệ pháp lý | 4 | **MUST** | **P1** | Tích hợp một nhà cung cấp đã ký hợp đồng; phát hành từ đơn hợp lệ; nhận mã/trạng thái; tra cứu, tải, thay thế hoặc hủy theo quy trình được nhà cung cấp hỗ trợ. | Đối soát được đơn ERP với hóa đơn nhà cung cấp; lỗi API không làm phát hành trùng; lưu request ID, trạng thái và audit; nghiệp vụ được kế toán/pháp lý nghiệm thu. |
| **C2** | Gửi SMS tự động | 2 | **SHOULD** | **P2** | Tích hợp một SMS Brandname; quản lý mẫu; gửi cho một số sự kiện ưu tiên; lưu trạng thái gửi và chi phí ước tính. | Chỉ gửi cho người nhận hợp lệ theo chính sách đồng ý; chống gửi trùng; callback được cập nhật; có hạn mức và quyền gửi. |
| **C3** | Gửi Zalo ZNS/OA | 3 | **SHOULD** | **P2** | Tích hợp một OA; dùng template đã duyệt; gửi cho các sự kiện phù hợp; lưu mã giao dịch và trạng thái. | Dữ liệu khớp template; xử lý được hết hạn token/rate limit; không gửi lại ngoài chính sách retry. |
| **C4** | TikTok/Messenger marketing | 3 | **COULD** | **P3** | Chọn một kênh đã được cấp quyền để pilot; hỗ trợ một use case rõ ràng thay vì xây omnichannel đầy đủ ngay từ đầu. | Chỉ triển khai khi nền tảng phê duyệt quyền và use case; có quản lý đồng ý, rate limit, lỗi token và báo cáo kết quả cơ bản. |
| **C5** | Đồng bộ đơn hàng sàn TMĐT | 4 | **SHOULD** | **P2** | Làm một sàn đầu tiên theo kiến trúc adapter; nhập đơn, khách, dòng hàng, phí và trạng thái; lưu external ID; webhook kết hợp job đối soát. | Một đơn ngoài chỉ tạo một đơn ERP; cập nhật trạng thái có idempotency; lỗi/rate limit có retry; đối soát phát hiện đơn thiếu. |
| **C6** | Đồng bộ giá hai chiều | 4 | **SHOULD** | **P2** | Sau C5, chọn một nguồn giá chuẩn; đồng bộ giá cho một sàn; có hàng đợi, lịch sử, cảnh báo xung đột và thao tác đồng bộ lại. | Không tạo vòng lặp cập nhật; thay đổi có version/thời gian; lỗi một SKU không chặn toàn bộ batch; người dùng thấy trạng thái gần nhất. |
| **C7** | Marketing Automation orchestration | 3 | **SHOULD** | **P2** | Sau khi có ít nhất một kênh C2/C3, cấu hình trigger, đối tượng, mẫu, lịch gửi, giới hạn tần suất và kết quả chiến dịch. | Một sự kiện chỉ kích hoạt đúng workflow đủ điều kiện; có dry-run/danh sách ước tính; chống spam và dừng chiến dịch được. |
| **C8** | AI hỏi đáp chính sách công ty | 3 | **COULD** | **P3** | Nhập một tập tài liệu chính sách đã duyệt; hỏi đáp có trích nguồn nội bộ; phân quyền theo tài liệu; có phản hồi khi không đủ dữ liệu. | Câu trả lời hiển thị nguồn; không truy xuất tài liệu ngoài quyền; bộ câu hỏi nghiệm thu đạt ngưỡng do nghiệp vụ thống nhất trước pilot. |
| **C9** | Tích hợp VNeID — tạm hoãn | 5 | **HOLD** | **P4** | Chưa triển khai hoặc làm mock integration. Chỉ đánh giá lại sau khi xác nhận doanh nghiệp đủ điều kiện truy cập và có tài liệu tích hợp chính thức. | Có văn bản/quyền truy cập, đầu mối pháp lý, sandbox hoặc tài liệu API hợp lệ trước khi lập kế hoạch kỹ thuật. |
| **C10** | Chống chụp/copy dữ liệu khách hàng | 3 | **SHOULD** | **P3** | Trên web: phân quyền, che dữ liệu nhạy cảm, watermark theo người dùng, giới hạn export và audit. Chặn screenshot ở tầng OS chỉ thuộc phạm vi mobile app native sau này. | Không tuyên bố chặn tuyệt đối trên web; các hành vi xem/export nhạy cảm được phân quyền và ghi log; kiểm thử theo vai trò. |
| **C11** | Đo lường tương tác KH đa kênh | 3 | **COULD** | **P3** | Thu thập và tổng hợp số liệu tương tác (lượt xem, hỏi đáp, click, chuyển đổi) từ các kênh đã tích hợp qua API; dashboard so sánh hiệu quả kênh; không gộp với đơn ERP khi chưa mapping rõ. | Số liệu chỉ lấy từ kênh có quyền API; nhãn nguồn rõ ràng; màn hình chỉ đọc và hiển thị, không thực hiện hành động gửi tin; ranh giới với C7 được làm rõ. |

**Cổng triển khai nhóm C:** không bắt đầu phát triển tích hợp thật trước khi có tài khoản sandbox/API, hợp đồng hoặc quyền ứng dụng tương ứng. Mỗi đối tác/kênh phải được tách thành adapter để thay thế và bảo trì độc lập. C11 chỉ khả thi sau khi có ít nhất một adapter kênh từ C2–C5 hoạt động và API cấp đủ quyền đọc số liệu tổng hợp.

---

## 5. Hồ sơ nhu cầu chi tiết A1–C10

Phần này mô tả nhu cầu ở mức **nghiệp vụ + chức năng**. Đây là cơ sở để phỏng vấn nghiệp vụ và lập backlog; chưa thay thế tài liệu đặc tả màn hình, mô hình dữ liệu hoặc API chi tiết.

### 5.1. Nhóm A — Thuần phần mềm

#### A1 — Đơn hàng bán lẻ

- **Người dùng chính:** Thu ngân, nhân viên bán hàng, quản lý cửa hàng và kế toán bán hàng.
- **Vấn đề nghiệp vụ:** ERP hiện chưa có bản ghi trung tâm đại diện cho một giao dịch bán lẻ. Nếu đơn chỉ được ghi rời rạc ở kho, hóa đơn hoặc sổ thu tiền thì không thể đối soát xuyên suốt và các module sau không có nguồn dữ liệu chuẩn.
- **Nhu cầu chi tiết:** Người dùng cần tạo và quản lý toàn bộ vòng đời đơn tại đúng chi nhánh, ghi nhận người bán, khách hàng, sản phẩm, giá, giảm giá, thuế/phí nếu áp dụng, phương thức thanh toán và trạng thái xử lý.
- **Tình huống sử dụng:** Thu ngân tạo đơn tại quầy; nhân viên lập đơn trước rồi khách thanh toán sau; quản lý tra cứu hoặc hủy đơn sai; kế toán đối soát đơn với tiền và hóa đơn.
- **Yêu cầu chức năng chính:**
  - Tạo đơn nháp, thêm/xóa dòng hàng và thay đổi số lượng trong giới hạn tồn kho/chính sách bán.
  - Lấy giá bán hiện hành nhưng lưu snapshot giá tại thời điểm tạo đơn.
  - Áp dụng giảm giá theo quyền; mọi thay đổi giá thủ công phải lưu người thực hiện và lý do.
  - Tính tổng trước giảm, giảm giá, thuế/phí, số cần thu, số đã thu và số còn nợ.
  - Hỗ trợ xác nhận, hoàn tất, hủy; không cho sửa tùy tiện các trường tài chính sau khi hoàn tất.
  - Tìm kiếm theo mã đơn, khách hàng, nhân viên, chi nhánh, ngày và trạng thái.
- **Giá trị/KPI cần theo dõi:** Thời gian trung bình tạo đơn, tỷ lệ đơn bị hủy/sửa, tỷ lệ sai lệch tổng tiền và tỷ lệ giao dịch hoàn tất thành công.
- **Điều kiện/phụ thuộc:** Danh mục sản phẩm, giá bán, chi nhánh, người dùng/phân quyền và quy tắc thanh toán phải có dữ liệu chuẩn.
- **Lý do xếp hạng:** **MUST/P0** vì A1 là nguồn giao dịch gốc cho kho, hóa đơn, công nợ, ca bán và báo cáo.

#### A2 — Hóa đơn bán lẻ nội bộ

- **Người dùng chính:** Thu ngân, khách mua hàng, quản lý cửa hàng và bộ phận chăm sóc khách hàng.
- **Vấn đề nghiệp vụ:** Khách cần chứng từ ngay sau khi mua, còn cửa hàng cần bản thể hiện thống nhất để tra cứu và xử lý khiếu nại trước khi tích hợp hóa đơn điện tử pháp lý.
- **Nhu cầu chi tiết:** Hệ thống phải tạo chứng từ bán lẻ từ dữ liệu đơn đã xác nhận, bảo đảm nội dung không bị nhập lại và không nhầm với hóa đơn điện tử hợp lệ pháp lý.
- **Tình huống sử dụng:** In tại quầy sau thanh toán; tải PDF gửi khách; in lại khi mất hóa đơn; tra cứu chứng từ theo đơn.
- **Yêu cầu chức năng chính:**
  - Sinh số chứng từ duy nhất theo quy tắc cấu hình và liên kết một-một với đơn bán.
  - Hiển thị thông tin cửa hàng, thời gian, nhân viên, dòng hàng, giảm giá, tổng tiền và phương thức thanh toán.
  - Hỗ trợ mẫu HTML/PDF và khổ in phổ thông; dữ liệu tiền tệ phải dùng cùng phép tính với A1.
  - Cho phép in/tải lại theo quyền và lưu lịch sử thao tác cần thiết.
  - Hiển thị rõ đây là hóa đơn/chứng từ nội bộ, không thay thế C1.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ hóa đơn khớp đơn, tỷ lệ in thành công, thời gian phát hành sau checkout và số yêu cầu xử lý do sai nội dung.
- **Điều kiện/phụ thuộc:** Phụ thuộc A1 và thông tin pháp nhân/chi nhánh; mẫu chứng từ phải được nghiệp vụ phê duyệt.
- **Lý do xếp hạng:** **MUST/P0** vì chứng từ là phần tối thiểu của trải nghiệm bán hàng và đối soát giao dịch.

#### A3 — Tự động xuất/nhập kho theo đơn

- **Người dùng chính:** Thu ngân, thủ kho, quản lý cửa hàng và kế toán kho.
- **Vấn đề nghiệp vụ:** Nếu bán hàng và kho cập nhật bằng hai thao tác riêng, nhân viên dễ quên trừ tồn, trừ hai lần hoặc hoàn tồn sai, làm tồn hệ thống không phản ánh tồn thực tế.
- **Nhu cầu chi tiết:** Mọi chuyển trạng thái có tác động kho của đơn phải tự động sinh giao dịch kho đúng chiều, có tính nguyên tử, chống lặp và truy vết được.
- **Tình huống sử dụng:** Xác nhận đơn làm giảm tồn; hủy/hoàn hợp lệ làm hoàn tồn; đối soát một sản phẩm từ stock log về đơn nguồn.
- **Yêu cầu chức năng chính:**
  - Kiểm tra tồn khả dụng trước khi xác nhận theo chính sách bán âm của doanh nghiệp.
  - Trừ đúng kho/chi nhánh và đúng số lượng khi đơn đạt trạng thái quy định.
  - Dùng mã tham chiếu/idempotency để retry không tạo thêm stock log.
  - Hoàn tồn theo nghiệp vụ hủy/hoàn, không sửa hoặc xóa lịch sử kho đã phát sinh.
  - Cảnh báo và cung cấp danh sách đối soát nếu đơn và kho lệch trạng thái.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ đơn có stock log đầy đủ, số giao dịch kho trùng, số lần bán vượt tồn và chênh lệch tồn khi kiểm kê.
- **Điều kiện/phụ thuộc:** Phụ thuộc A1, cấu trúc kho/chi nhánh, định danh SKU và quy tắc trạng thái đơn.
- **Lý do xếp hạng:** **MUST/P0** vì sai tồn kho ảnh hưởng trực tiếp khả năng bán hàng và độ tin cậy của ERP.

#### A4 — Công nợ khách hàng cơ bản

- **Người dùng chính:** Nhân viên bán hàng, kế toán công nợ, quản lý cửa hàng và nhân viên thu hồi nợ.
- **Vấn đề nghiệp vụ:** Các đơn bán chịu hoặc thanh toán nhiều lần không thể quản lý chỉ bằng trạng thái “đã/chưa thanh toán”; doanh nghiệp cần biết từng khách còn nợ bao nhiêu và khoản nào đã quá hạn.
- **Nhu cầu chi tiết:** Hệ thống cần lập sổ công nợ phát sinh từ đơn, ghi nhận từng lần thu/điều chỉnh và cung cấp số dư có thể đối soát theo khách hàng.
- **Tình huống sử dụng:** Bán nợ theo hạn mức; khách trả một phần; kế toán điều chỉnh có phê duyệt; quản lý xem tuổi nợ và lịch sử thu.
- **Yêu cầu chức năng chính:**
  - Tạo khoản phải thu từ phần chưa thanh toán của đơn và lưu ngày đến hạn.
  - Ghi nhận thanh toán một phần/toàn phần, phương thức, chứng từ và người thu.
  - Tính số dư từ ledger thay vì cho sửa trực tiếp con số tổng.
  - Hỗ trợ điều chỉnh bằng bút toán có lý do, quyền và audit.
  - Tra cứu theo khách, chi nhánh, hạn thanh toán và trạng thái quá hạn.
- **Giá trị/KPI cần theo dõi:** Tổng dư nợ, tỷ lệ nợ quá hạn, thời gian thu tiền trung bình, tỷ lệ thanh toán được đối soát và số điều chỉnh thủ công.
- **Điều kiện/phụ thuộc:** Phụ thuộc A1, hồ sơ khách hàng chuẩn, chính sách bán nợ/hạn mức và phân quyền tài chính.
- **Lý do xếp hạng:** **SHOULD/P1**; rất cần nếu có bán nợ nhưng không chặn pilot chỉ thanh toán đủ tại quầy.

#### A5 — Báo cáo doanh thu/lợi nhuận bán lẻ

- **Người dùng chính:** Chủ doanh nghiệp, quản lý vùng/chi nhánh, kế toán quản trị và trưởng nhóm bán hàng.
- **Vấn đề nghiệp vụ:** Không có báo cáo thống nhất thì doanh nghiệp không biết doanh thu đến từ đâu, sản phẩm nào có lãi hoặc số liệu quầy có khớp với giao dịch nguồn hay không.
- **Nhu cầu chi tiết:** Hệ thống phải tổng hợp doanh thu và lợi nhuận gộp trực tiếp từ đơn hợp lệ, giá vốn và các điều chỉnh được định nghĩa rõ.
- **Tình huống sử dụng:** Xem kết quả trong ngày; so sánh chi nhánh; phân tích sản phẩm/nhân viên; đối soát khi số liệu bất thường.
- **Yêu cầu chức năng chính:**
  - Định nghĩa rõ trạng thái đơn được tính doanh thu và cách xử lý hủy/hoàn.
  - Tính doanh thu thuần, giá vốn và lợi nhuận gộp từ dữ liệu có thể truy ngược.
  - Lọc theo thời gian, chi nhánh, sản phẩm/danh mục, nhân viên và phương thức thanh toán.
  - Cho phép drill-down từ chỉ số tổng về danh sách đơn cấu thành.
  - Xuất dữ liệu cơ bản với cùng bộ lọc và múi giờ báo cáo.
- **Giá trị/KPI cần theo dõi:** Thời gian có báo cáo sau giao dịch, chênh lệch so với đơn nguồn, biên lợi nhuận gộp và tỷ lệ báo cáo phải điều chỉnh thủ công.
- **Điều kiện/phụ thuộc:** Phụ thuộc A1, A3 và phương pháp xác định giá vốn; cần chốt quy tắc ghi nhận doanh thu với kế toán.
- **Lý do xếp hạng:** **MUST/P0** vì báo cáo vừa tạo giá trị quản trị vừa là công cụ phát hiện sai dữ liệu trong pilot.

#### A6 — Chốt ca/chốt sổ thu ngân

- **Người dùng chính:** Thu ngân, ca trưởng, quản lý cửa hàng và kế toán quỹ.
- **Vấn đề nghiệp vụ:** Doanh thu trên hệ thống không tự chứng minh số tiền thực tế tại quầy. Thiếu chốt ca khiến không xác định được trách nhiệm và nguyên nhân chênh lệch tiền mặt.
- **Nhu cầu chi tiết:** Mỗi ca bán cần có thời điểm mở/đóng, người chịu trách nhiệm, tổng tiền kỳ vọng theo phương thức, số thực đếm và giải trình chênh lệch.
- **Tình huống sử dụng:** Thu ngân nhận quỹ đầu ca; bán trong ca; bàn giao/đóng ca; ca trưởng xác nhận chênh lệch; kế toán đối soát.
- **Yêu cầu chức năng chính:**
  - Chỉ cho một ca hợp lệ đang mở theo người/quầy theo quy tắc đã chốt.
  - Ghi quỹ đầu ca, tiền thu/chi liên quan và tổng theo từng phương thức thanh toán.
  - Tính tiền kỳ vọng nhưng không hiển thị cho thu ngân trước khi nhập số thực đếm nếu quy trình yêu cầu blind count.
  - Bắt buộc lý do khi chênh lệch vượt ngưỡng và hỗ trợ bước xác nhận của quản lý.
  - Khóa thay đổi tùy tiện sau đóng ca; điều chỉnh phải có audit.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ ca đóng đúng giờ, giá trị/tần suất chênh lệch, số ca bị mở treo và thời gian đối soát cuối ngày.
- **Điều kiện/phụ thuộc:** Phụ thuộc A1 và cấu hình quầy/chi nhánh, phương thức thanh toán, quyền thu ngân–ca trưởng.
- **Lý do xếp hạng:** **MUST/P0** vì là kiểm soát nền tảng đối với tiền và trách nhiệm vận hành tại quầy.

#### A7 — Chi phí/vận chuyển/chi tiêu chi nhánh

- **Người dùng chính:** Quản lý chi nhánh, kế toán nội bộ và nhân viên được ủy quyền chi.
- **Vấn đề nghiệp vụ:** Các khoản chi nhỏ tại cửa hàng thường nằm ngoài hệ thống bán hàng, làm quản lý không thấy đầy đủ dòng tiền hoạt động hoặc phải tổng hợp thủ công.
- **Nhu cầu chi tiết:** Cần một sổ ghi chi phí vận hành đơn giản theo chi nhánh, loại chi và chứng từ, nhưng không biến ERP bán lẻ thành hệ thống kế toán tổng hợp đầy đủ.
- **Tình huống sử dụng:** Ghi phí giao hàng, mua vật tư, sửa chữa nhỏ hoặc chi khác; quản lý duyệt; kế toán lọc và xuất danh sách.
- **Yêu cầu chức năng chính:**
  - Nhập ngày, số tiền, loại chi, chi nhánh, người chi, đối tượng nhận, ghi chú và tệp chứng từ nếu có.
  - Phân quyền tạo, duyệt, sửa/hủy và xem dữ liệu theo chi nhánh.
  - Lưu audit cho thay đổi tài chính; không xóa cứng khoản đã duyệt.
  - Tổng hợp theo kỳ/loại/chi nhánh và xuất danh sách phục vụ đối soát.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ khoản chi có chứng từ, thời gian nhập/duyệt, tổng chi theo doanh thu và số điều chỉnh sau duyệt.
- **Điều kiện/phụ thuộc:** Cần danh mục chi phí, chi nhánh, luồng duyệt và ranh giới tích hợp với kế toán.
- **Lý do xếp hạng:** **COULD/P2** vì hữu ích cho quản trị nhưng không chặn luồng bán hàng lõi.

#### A8 — Phân hạng khách hàng/VIP

- **Người dùng chính:** Nhân viên bán hàng, chăm sóc khách hàng, marketing và quản lý CRM.
- **Vấn đề nghiệp vụ:** Khi mọi khách được phục vụ như nhau, doanh nghiệp khó nhận diện khách giá trị cao và không có tiêu chí nhất quán để ưu đãi/chăm sóc.
- **Nhu cầu chi tiết:** Hệ thống cần tự xếp hạng khách dựa trên tiêu chí kinh doanh minh bạch và cung cấp hạng đó tại các điểm tương tác phù hợp.
- **Tình huống sử dụng:** Sau giao dịch hệ thống tính lại hạng; nhân viên nhận biết khách VIP khi tạo đơn; marketing lọc nhóm khách; quản lý xem biến động hạng.
- **Yêu cầu chức năng chính:**
  - Cấu hình tên hạng, ngưỡng doanh số, kỳ xét và điều kiện loại trừ đơn hủy/hoàn.
  - Tính tự động từ dữ liệu giao dịch và lưu lịch sử lên/xuống hạng.
  - Hiển thị hạng trên hồ sơ khách và màn hình bán hàng theo quyền.
  - Cho phép điều chỉnh thủ công có thời hạn/lý do nếu chính sách cho phép.
  - Không bao gồm ví điểm thưởng phức tạp trong MVP.
- **Giá trị/KPI cần theo dõi:** Số khách theo hạng, doanh thu/tần suất mua theo hạng, tỷ lệ giữ chân và số điều chỉnh hạng thủ công.
- **Điều kiện/phụ thuộc:** Phụ thuộc A1, định danh khách hàng không trùng và chính sách tier được phê duyệt.
- **Lý do xếp hạng:** **SHOULD/P2** vì chỉ tạo giá trị rõ sau khi đã tích lũy dữ liệu bán hàng đủ tin cậy.

#### A9 — Quản lý CTV/Đại lý và hoa hồng

- **Người dùng chính:** Quản lý kênh bán, CTV/đại lý, kế toán hoa hồng và nhân viên bán hàng.
- **Vấn đề nghiệp vụ:** Thiếu liên kết rõ giữa đơn và nguồn giới thiệu dẫn đến tranh chấp doanh số, tính hoa hồng bằng bảng tính và khó kiểm soát đơn hủy/hoàn.
- **Nhu cầu chi tiết:** Mỗi đơn đủ điều kiện cần gắn được với đối tác và chính sách hoa hồng có hiệu lực, tạo số phải trả có thể truy vết.
- **Tình huống sử dụng:** Gán CTV khi lập đơn; hệ thống tính hoa hồng khi đơn hoàn tất; kế toán chốt kỳ; quản lý xử lý điều chỉnh.
- **Yêu cầu chức năng chính:**
  - Quản lý hồ sơ/trạng thái CTV, đại lý và phạm vi chi nhánh/kênh được áp dụng.
  - Cấu hình hoa hồng theo tỷ lệ hoặc số cố định, thời gian hiệu lực và đối tượng hàng hóa.
  - Gắn nguồn đối tác vào đơn và lưu snapshot chính sách đã áp dụng.
  - Chỉ ghi nhận hoa hồng khi đạt điều kiện; đảo/điều chỉnh khi đơn hủy hoặc hoàn.
  - Lập bảng kê theo kỳ với trạng thái dự kiến, duyệt và đã thanh toán.
- **Giá trị/KPI cần theo dõi:** Doanh thu theo đối tác, chi phí hoa hồng/doanh thu, tỷ lệ đơn tranh chấp và thời gian chốt kỳ.
- **Điều kiện/phụ thuộc:** Phụ thuộc A1, hồ sơ đối tác, chính sách hoa hồng, quy trình duyệt và thanh toán.
- **Lý do xếp hạng:** **SHOULD/P2**; quan trọng khi kênh CTV/đại lý có tỷ trọng thực tế nhưng không thuộc MVP bán tại quầy.

#### A10 — Trả hàng nhà cung cấp

- **Người dùng chính:** Thủ kho, nhân viên mua hàng, kế toán kho và quản lý chi nhánh.
- **Vấn đề nghiệp vụ:** Hàng lỗi/sai quy cách trả NCC nếu chỉ điều chỉnh tồn thủ công sẽ mất dấu lý do, chứng từ và nghĩa vụ hoàn tiền/đổi hàng.
- **Nhu cầu chi tiết:** Cần phiếu trả NCC riêng liên kết nguồn nhập, làm giảm tồn đúng kho và theo dõi kết quả xử lý với nhà cung cấp.
- **Tình huống sử dụng:** Phát hiện hàng lỗi khi nhận/kiểm kê; lập phiếu; phê duyệt và xuất trả; ghi nhận NCC đổi hàng hoặc hoàn tiền ngoài phạm vi kho.
- **Yêu cầu chức năng chính:**
  - Chọn NCC, kho, sản phẩm, số lượng, lô/serial nếu áp dụng, lý do và chứng từ liên quan.
  - Kiểm tra quyền sở hữu/tồn khả dụng và không cho trả vượt số lượng hợp lệ.
  - Có trạng thái nháp, duyệt, đã xuất trả, hủy; chỉ trạng thái phù hợp mới tác động tồn.
  - Sinh stock log truy vết về phiếu; hỗ trợ trường hợp giá trị 0 đồng.
  - Lưu ghi chú kết quả xử lý và tham chiếu chứng từ tài chính nếu có.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ hàng trả theo NCC/sản phẩm, thời gian xử lý phiếu, giá trị đang chờ xử lý và số sai lệch tồn liên quan.
- **Điều kiện/phụ thuộc:** Phụ thuộc module kho, hồ sơ NCC, dữ liệu lô/serial nếu có và quy trình duyệt.
- **Lý do xếp hạng:** **SHOULD/P2** vì hoàn thiện vòng đời kho nhưng không chặn giai đoạn bán hàng đầu tiên.

#### A11 — Tài sản cố định

- **Người dùng chính:** Kế toán tài sản, hành chính, quản lý chi nhánh và người quản lý tài sản.
- **Vấn đề nghiệp vụ:** Thiết bị/cơ sở vật chất không được quản lý tập trung khiến khó biết vị trí, người chịu trách nhiệm, trạng thái và giá trị còn lại.
- **Nhu cầu chi tiết:** Hệ thống cần sổ tài sản cơ bản và lịch khấu hao để quản trị nội bộ, có ranh giới rõ với kế toán tài chính chính thức.
- **Tình huống sử dụng:** Ghi tăng tài sản; bàn giao cho chi nhánh/bộ phận; điều chuyển; tính khấu hao; ghi giảm/thanh lý.
- **Yêu cầu chức năng chính:**
  - Quản lý mã tài sản, nhóm, nguyên giá, ngày sử dụng, vị trí, người/bộ phận quản lý và trạng thái.
  - Lập lịch khấu hao đường thẳng theo thời gian sử dụng và ngày bắt đầu.
  - Lưu lịch sử điều chuyển, tạm ngừng, ghi giảm và tài liệu bàn giao.
  - Không cho tổng khấu hao vượt nguyên giá; mọi điều chỉnh phải có audit.
  - Xuất sổ tài sản và bảng khấu hao theo kỳ/chi nhánh.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ tài sản có người/vị trí rõ, chênh lệch kiểm kê, tài sản quá hạn kiểm tra và giá trị còn lại theo kỳ.
- **Điều kiện/phụ thuộc:** Cần chính sách tài sản/khấu hao, danh mục chi nhánh–bộ phận và xác định dữ liệu nào đồng bộ sang kế toán.
- **Lý do xếp hạng:** **SHOULD/P2** nhưng độc lập với bán lẻ lõi nên có thể triển khai theo nguồn lực riêng.

#### A12 — Nhắc công nợ quá hạn

- **Người dùng chính:** Kế toán công nợ, nhân viên phụ trách khách hàng, quản lý và khách hàng nhận thông báo.
- **Vấn đề nghiệp vụ:** Theo dõi hạn thanh toán thủ công dễ bỏ sót, nhắc không đều hoặc liên hệ nhầm khách đã trả.
- **Nhu cầu chi tiết:** Hệ thống phải tự xác định khoản quá hạn từ ledger công nợ, tạo công việc/thông báo đúng người và kiểm soát tần suất liên hệ.
- **Tình huống sử dụng:** Job hàng ngày phát hiện quá hạn; gửi in-app/email; nhân viên xem danh sách cần xử lý; dừng nhắc khi tất toán hoặc có thỏa thuận mới.
- **Yêu cầu chức năng chính:**
  - Xác định quá hạn theo ngày đến hạn, số dư còn lại và múi giờ doanh nghiệp.
  - Cấu hình ngưỡng ngày, tần suất, người phụ trách, mẫu nội dung và kênh gửi.
  - Chống gửi trùng trong cùng chu kỳ; lưu từng lần gửi, trạng thái và lỗi.
  - Cho phép tạm hoãn/miễn nhắc có lý do và thời hạn theo quyền.
  - Tự ngừng workflow khi khoản nợ được tất toán/điều chỉnh không còn quá hạn.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ nợ quá hạn được nhắc đúng hạn, tỷ lệ thu sau nhắc, số lần gửi lỗi/trùng và tuổi nợ trung bình.
- **Điều kiện/phụ thuộc:** Phụ thuộc A4, email đã cấu hình, dữ liệu liên hệ hợp lệ và chính sách giao tiếp với khách.
- **Lý do xếp hạng:** **SHOULD/P1** vì tự động hóa một rủi ro tiền tệ trực tiếp, nhưng chỉ có ý nghĩa sau A4.

#### A13 — Trả hàng từ khách

- **Người dùng chính:** Thu ngân, nhân viên bán hàng, quản lý cửa hàng và kế toán bán lẻ.
- **Vấn đề nghiệp vụ:** Khi khách trả lại hàng, nếu chỉ hủy hoặc sửa đơn gốc thì mất dấu lịch sử bán, số liệu báo cáo và trách nhiệm nhân viên. Cần phiếu trả riêng để hoàn tồn và hoàn tiền có thể truy vết.
- **Nhu cầu chi tiết:** Hệ thống cần luồng nhập trả hàng từ khách tách biệt đơn gốc, tự động hoàn tồn kho đúng chiều và ghi nhận hình thức hoàn trả (tiền mặt, chuyển khoản, đổi hàng).
- **Tình huống sử dụng:** Khách mang hàng về ngay ngày mua do lỗi; trả trong thời hạn bảo hành đổi trả; đổi size/màu; trả một phần đơn nhiều sản phẩm.
- **Yêu cầu chức năng chính:**
  - Tạo phiếu trả liên kết đơn gốc; chọn sản phẩm, số lượng và lý do trả.
  - Không cho trả vượt số lượng đã bán trong đơn gốc; kiểm tra thời hạn chính sách đổi trả.
  - Sinh stock log hoàn tồn về kho nguồn theo quy tắc nghiệp vụ; không sửa stock log gốc.
  - Ghi nhận hình thức hoàn trả (hoàn tiền mặt, chuyển khoản, đổi hàng mới) với số tiền, phương thức và người thực hiện.
  - Cập nhật sổ công nợ nếu đơn gốc có phần bán nợ liên quan.
  - Tìm kiếm phiếu trả theo đơn gốc, khách hàng, nhân viên, ngày và lý do.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ hàng trả/doanh thu, lý do trả phổ biến, giá trị hoàn tiền theo phương thức, thời gian xử lý phiếu và tần suất trả theo sản phẩm.
- **Điều kiện/phụ thuộc:** Phụ thuộc A1, A3, chính sách đổi trả của doanh nghiệp, phân quyền và quy tắc hoàn tiền.
- **Lý do xếp hạng:** **SHOULD/P2** vì là nghiệp vụ bán lẻ phổ biến nhưng có thể xử lý hạn chế bằng hủy đơn trong giai đoạn pilot đầu tiên.

### 5.2. Nhóm B — Thiết bị và vận hành tại quầy

#### B1 — Máy POS tại quầy

- **Người dùng chính:** Thu ngân, nhân viên bán hàng, quản lý cửa hàng và bộ phận IT hỗ trợ thiết bị.
- **Vấn đề nghiệp vụ:** Luồng bán hàng dù có trên web vẫn có thể chậm hoặc khó dùng tại quầy nếu màn hình không tối ưu cho thao tác liên tục, cảm ứng và thiết bị ngoại vi.
- **Nhu cầu chi tiết:** Cửa hàng cần một workspace POS ổn định trên thiết bị được chọn, tập trung vào tốc độ checkout, khả năng phục hồi lỗi và thao tác tối thiểu.
- **Tình huống sử dụng:** Mở ca; tìm/quét hàng; chọn khách; nhận thanh toán; in hóa đơn; chuyển giao hoặc đóng ca.
- **Yêu cầu chức năng chính:**
  - Giao diện thích nghi với PC/tablet mục tiêu, vùng chạm đủ rõ và ưu tiên thao tác bàn phím/máy quét.
  - Duy trì giỏ đang làm khi lỗi tạm thời; cảnh báo rõ trạng thái gửi đơn để tránh bấm lặp.
  - Tích hợp luồng A1, A2, A6 và điểm nối B2/B3/B4 trong một màn hình/quy trình nhất quán.
  - Hiển thị chi nhánh, quầy, ca và người đăng nhập; không cho bán nhầm phạm vi.
  - Có cơ chế khóa/đăng xuất nhanh và phân quyền các thao tác nhạy cảm như giảm giá, hủy đơn, mở ngăn kéo.
- **Giá trị/KPI cần theo dõi:** Thời gian checkout, số thao tác mỗi đơn, tỷ lệ đơn bị tạo trùng, thời gian gián đoạn quầy và số yêu cầu hỗ trợ thiết bị.
- **Điều kiện/phụ thuộc:** Phụ thuộc P0, thiết bị/màn hình mục tiêu, mạng tại cửa hàng. **Cần chốt chiến lược đồng bộ trước khi thiết kế:** (a) *Phục hồi kết nối* — giữ giỏ hàng local, hiển thị lỗi rõ khi mất mạng, không tạo đơn khi offline; hoặc (b) *Offline-first* — tạo đơn local, đồng bộ lên server khi có mạng kèm cơ chế phát hiện và giải quyết xung đột tồn kho. Khuyến nghị bắt đầu với (a) cho giai đoạn pilot để đơn giản hóa kỹ thuật; chỉ xem xét (b) khi có bằng chứng thực tế về đường mạng không ổn định tại cửa hàng.
- **Lý do xếp hạng:** **MUST/P1** vì cần cho go-live tại quầy, nhưng chỉ triển khai hiệu quả sau khi luồng nghiệp vụ P0 ổn định.

#### B2 — Quét barcode/QR sản phẩm

- **Người dùng chính:** Thu ngân, nhân viên kho và nhân viên kiểm hàng.
- **Vấn đề nghiệp vụ:** Tìm sản phẩm bằng tên/mã thủ công làm chậm checkout và tăng nguy cơ chọn nhầm biến thể.
- **Nhu cầu chi tiết:** Máy quét HID phải được coi như kênh nhập mã đáng tin cậy, ánh xạ đúng barcode/QR sang SKU và phản hồi ngay cho người dùng.
- **Tình huống sử dụng:** Quét lần đầu để thêm hàng; quét lặp để tăng số lượng; quét mã chưa khai báo; quét tại các màn hình nhập/xuất kho phù hợp.
- **Yêu cầu chức năng chính:**
  - Nhận chuỗi quét mà không phụ thuộc con trỏ đang nằm ở ô nhập không liên quan.
  - Ánh xạ một mã duy nhất tới đúng SKU/biến thể và phát hiện dữ liệu mã bị trùng.
  - Tăng số lượng theo chính sách khi quét lặp, đồng thời kiểm tra tồn/giới hạn bán.
  - Phản hồi âm thanh/hình ảnh rõ cho thành công, mã lạ hoặc hàng không được phép bán.
  - Cho phép nhập mã thủ công làm fallback khi thiết bị lỗi.
- **Giá trị/KPI cần theo dõi:** Thời gian thêm sản phẩm, tỷ lệ mã không nhận diện, tỷ lệ chọn nhầm SKU và số lần phải nhập tay.
- **Điều kiện/phụ thuộc:** Phụ thuộc dữ liệu barcode sạch, A1/B1 và ít nhất một mẫu máy quét thực tế để kiểm thử.
- **Lý do xếp hạng:** **MUST/P1** vì ảnh hưởng trực tiếp tốc độ và độ chính xác của quầy bán lẻ.

#### B3 — In hóa đơn nhiệt

- **Người dùng chính:** Thu ngân, khách hàng và IT/cửa hàng phụ trách thiết bị.
- **Vấn đề nghiệp vụ:** Khách tại quầy thường cần chứng từ giấy ngay, nhưng trình duyệt, driver và máy in nhiệt có khác biệt dễ gây lỗi định dạng hoặc không in được.
- **Nhu cầu chi tiết:** Hệ thống cần quy trình in đáng tin cậy cho một cấu hình pilot chuẩn, có trạng thái lỗi và thao tác in lại an toàn.
- **Tình huống sử dụng:** Tự động hỏi/in sau thanh toán; in lại từ lịch sử đơn; xử lý hết giấy, mất kết nối hoặc sai máy in.
- **Yêu cầu chức năng chính:**
  - Chuẩn hóa mẫu 80 mm trước, bảo đảm tiếng Việt, cắt dòng, số tiền và mã đơn đọc được.
  - Chọn rõ phương án in qua trình duyệt, local bridge hoặc SDK theo thiết bị pilot.
  - Không đánh dấu “đã in thành công” chỉ dựa trên việc tạo nội dung nếu không có xác nhận phù hợp.
  - Cho phép in lại theo quyền mà không tạo đơn/hóa đơn mới.
  - Cung cấp hướng dẫn fallback khi thiết bị lỗi, gồm tải/in A4 nếu cần.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ in thành công lần đầu, thời gian từ thanh toán đến bản in, số lần in lại và số sự cố theo model thiết bị.
- **Điều kiện/phụ thuộc:** Phụ thuộc A2, B1, model máy in/driver, kết nối thực tế và mẫu nội dung được duyệt.
- **Lý do xếp hạng:** **MUST/P1** vì là yêu cầu vận hành phổ biến tại quầy và phải được kiểm chứng trên phần cứng thật.

#### B4 — Ngăn kéo tiền tự động

- **Người dùng chính:** Thu ngân, ca trưởng, kiểm soát nội bộ và IT thiết bị.
- **Vấn đề nghiệp vụ:** Mở ngăn kéo không gắn với giao dịch làm giảm kiểm soát tiền mặt; ngược lại, tích hợp không đúng có thể mở kéo ở thời điểm không an toàn.
- **Nhu cầu chi tiết:** Ngăn kéo chỉ được kích hoạt tự động khi giao dịch tiền mặt hoàn tất, đồng thời mọi lần mở ngoài luồng phải được kiểm soát.
- **Tình huống sử dụng:** Mở sau khi nhận tiền mặt; ca trưởng mở thủ công để kiểm kê; xử lý khi máy in/kết nối kéo bị lỗi.
- **Yêu cầu chức năng chính:**
  - Gửi đúng lệnh qua máy in/thiết bị trung gian tương thích sau sự kiện thanh toán thành công.
  - Không mở tự động cho đơn nháp, thất bại, bị hủy hoặc thanh toán không tiền mặt.
  - Nút mở thủ công yêu cầu quyền và lý do; lưu người, thời gian, ca/quầy.
  - Hiển thị lỗi nhưng không làm mất trạng thái giao dịch đã thanh toán.
  - Có quy trình fallback vật lý và bàn giao chìa khóa ngoài hệ thống.
- **Giá trị/KPI cần theo dõi:** Số lần mở không gắn giao dịch, lỗi mở kéo, chênh lệch tiền mặt và thời gian xử lý tại quầy.
- **Điều kiện/phụ thuộc:** Phụ thuộc B3, model máy in/kéo, A6 và chính sách kiểm soát tiền mặt.
- **Lý do xếp hạng:** **COULD/P1** vì hữu ích cho combo POS nhưng không chặn bán nếu cửa hàng chấp nhận mở thủ công.

#### B5 — Camera AI đo traffic (tạm hoãn)

- **Người dùng chính:** Quản lý vận hành, marketing, quản lý cửa hàng và bộ phận bảo mật/dữ liệu.
- **Vấn đề nghiệp vụ:** Doanh nghiệp muốn biết lượng khách ghé cửa hàng để tính tỷ lệ chuyển đổi, nhưng số liệu camera dễ sai do góc đặt, ánh sáng, nhân viên đi lại và nhiều lối vào.
- **Nhu cầu chi tiết:** Nếu mở lại, nhu cầu phải được đóng khung thành pilot đo lượt vào/ra tại một điểm, kèm đánh giá mua giải pháp hay tự xử lý AI và giới hạn dữ liệu thu thập.
- **Tình huống sử dụng:** Đếm lượt theo giờ/ngày; so sánh với số đơn; phát hiện thời điểm đông; đánh giá hiệu quả chiến dịch tại cửa hàng.
- **Yêu cầu chức năng chính khi xem xét lại:**
  - Xác định định nghĩa một lượt khách và cách loại nhân viên/lượt quay lại.
  - Chọn thiết bị/nhà cung cấp, vị trí lắp và cơ chế lấy số liệu tổng hợp.
  - Không lưu hoặc nhận diện danh tính nếu mục tiêu chỉ là đếm người.
  - Đối soát mẫu thủ công để đo sai số theo điều kiện thực tế.
  - Thiết lập thời hạn lưu dữ liệu, quyền truy cập và thông báo phù hợp.
- **Giá trị/KPI cần theo dõi:** Sai số so với đếm mẫu, tỷ lệ chuyển đổi traffic→đơn, uptime thiết bị và chi phí trên mỗi điểm lắp.
- **Điều kiện/phụ thuộc:** Business case, phê duyệt quyền riêng tư, khảo sát cửa hàng, ngân sách thiết bị/đường truyền và API nhà cung cấp.
- **Lý do xếp hạng:** **HOLD/P4** vì chi phí và rủi ro cao trong khi nhu cầu/giá trị chưa được chứng minh.

#### B6 — Đánh giá kỹ thuật sửa chữa qua QR

- **Người dùng chính:** Khách sửa chữa, kỹ thuật viên, quản lý dịch vụ và chăm sóc khách hàng.
- **Vấn đề nghiệp vụ:** Phản hồi miệng hoặc biểu mẫu chung khó gắn đúng phiếu/kỹ thuật viên, dễ bị trùng và không tạo dữ liệu cải thiện chất lượng.
- **Nhu cầu chi tiết:** Mỗi phiếu dịch vụ đủ điều kiện cần sinh liên kết đánh giá riêng, cho khách phản hồi đơn giản và bảo vệ thông tin phiếu.
- **Tình huống sử dụng:** Khách quét QR khi nhận máy; chấm điểm và nhận xét; quản lý xem điểm theo kỹ thuật viên/thời gian; CSKH xử lý đánh giá thấp.
- **Yêu cầu chức năng chính:**
  - Sinh token/QR khó đoán, hết hạn theo chính sách và không chứa dữ liệu cá nhân trực tiếp.
  - Chỉ cho đánh giá phiếu ở trạng thái phù hợp; kiểm soát một phản hồi hợp lệ hoặc quy tắc sửa phản hồi.
  - Thu điểm, tiêu chí phụ, nhận xét và sự đồng ý liên hệ lại nếu cần.
  - Gắn phản hồi với phiếu/kỹ thuật viên nhưng hạn chế công khai danh tính khách.
  - Tạo cảnh báo/quy trình xử lý khi điểm thấp và báo cáo xu hướng.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ phản hồi, điểm trung bình, tỷ lệ đánh giá thấp được xử lý và thời gian phản hồi của CSKH.
- **Điều kiện/phụ thuộc:** Phụ thuộc module phiếu sửa chữa/bảo hành chưa có trong roadmap lõi, hồ sơ kỹ thuật viên và trang công khai an toàn.
- **Lý do xếp hạng:** **COULD/P3** vì dễ pilot nhưng chỉ có ý nghĩa sau khi quy trình sửa chữa số hóa.

#### B7 — Wifi Marketing

- **Người dùng chính:** Khách tại cửa hàng, marketing, CRM, quản lý chi nhánh và IT mạng.
- **Vấn đề nghiệp vụ:** Cửa hàng muốn biến lượt truy cập wifi thành dữ liệu chăm sóc, nhưng captive portal có thể làm giảm trải nghiệm và tạo rủi ro đồng ý/lưu dữ liệu.
- **Nhu cầu chi tiết:** Pilot phải chứng minh có thể thu lead hợp lệ với sự đồng ý rõ, đồng bộ CRM không trùng và đo được hiệu quả so với chi phí thiết bị/dịch vụ.
- **Tình huống sử dụng:** Khách chọn wifi; xem thông báo và nhập/xác thực thông tin; hệ thống ghi nguồn/chi nhánh; marketing tạo phân khúc theo chính sách.
- **Yêu cầu chức năng chính:**
  - Hiển thị captive portal thân thiện trên mobile và nêu rõ mục đích sử dụng dữ liệu.
  - Thu tối thiểu trường cần thiết; lưu bằng chứng đồng ý, thời gian, nguồn và phiên kết nối.
  - Chuẩn hóa số điện thoại/email và hợp nhất với khách hiện có theo quy tắc an toàn.
  - Tách đồng ý dùng wifi với đồng ý nhận marketing nếu chính sách yêu cầu.
  - Nhận số liệu kết nối tổng hợp và xử lý khi API/thiết bị mất đồng bộ.
- **Giá trị/KPI cần theo dõi:** Lượt kết nối, tỷ lệ hoàn thành portal, tỷ lệ lead hợp lệ/trùng, tỷ lệ đồng ý marketing và chi phí trên lead.
- **Điều kiện/phụ thuộc:** Thiết bị/nhà cung cấp captive portal, API, chính sách dữ liệu, CRM và một chi nhánh pilot.
- **Lý do xếp hạng:** **COULD/P3** vì cần đầu tư ngoài và phải chứng minh hiệu quả/tuân thủ trước khi mở rộng.

#### B8 — Quét IMEI/serial

- **Người dùng chính:** Thủ kho, thu ngân, kỹ thuật viên sửa chữa và chăm sóc bảo hành.
- **Vấn đề nghiệp vụ:** Với hàng điện tử hoặc thiết bị, quản lý theo số lượng SKU không đủ để biết chính xác chiếc nào đã nhập, bán, trả hay đang bảo hành.
- **Nhu cầu chi tiết:** Mỗi IMEI/serial phải là định danh duy nhất gắn với SKU và có lịch sử dịch chuyển xuyên suốt vòng đời.
- **Tình huống sử dụng:** Quét khi nhập kho; chọn đúng serial khi bán; tiếp nhận bảo hành/sửa chữa; trả NCC; tra cứu nguồn gốc.
- **Yêu cầu chức năng chính:**
  - Định nghĩa định dạng/độ dài theo loại sản phẩm và hỗ trợ quét hoặc nhập tay có xác nhận.
  - Chặn trùng trong phạm vi toàn công ty hoặc phạm vi đã chốt.
  - Ràng buộc serial với SKU, kho, trạng thái và giao dịch hiện tại.
  - Không cho bán/trả một serial không ở trạng thái hợp lệ.
  - Hiển thị timeline nhập–điều chuyển–bán–trả–sửa chữa có tham chiếu chứng từ.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ giao dịch hàng serial có mã đầy đủ, số mã trùng/sai, thời gian tra cứu bảo hành và chênh lệch kiểm kê theo serial.
- **Điều kiện/phụ thuộc:** Phụ thuộc B2, quy trình kho, A1/A10 và mô hình dữ liệu serial; giá trị tăng thêm khi có module sửa chữa.
- **Lý do xếp hạng:** **SHOULD/P2** nếu ngành hàng bắt buộc theo dõi từng thiết bị; có thể hạ ưu tiên với hàng tiêu dùng thông thường.

#### B9 — Nhận diện khuôn mặt khách VIP

- **Người dùng chính:** Khách tự nguyện tham gia, nhân viên bán hàng, quản lý CRM và bộ phận bảo mật/dữ liệu.
- **Vấn đề nghiệp vụ:** Nhân viên muốn nhận biết khách VIP sớm để phục vụ phù hợp, nhưng nhận diện sinh trắc học có rủi ro nhận nhầm, xâm phạm riêng tư và tạo cảm giác bị giám sát.
- **Nhu cầu chi tiết:** Chỉ pilot theo cơ chế opt-in rõ ràng, mục đích giới hạn, dữ liệu được bảo vệ và khách có thể rút lại đồng ý/xóa mẫu.
- **Tình huống sử dụng:** Khách đăng ký; camera tại điểm xác định phát hiện; hệ thống gửi thông báo kín cho nhân viên; nhân viên xác minh trước khi hành động.
- **Yêu cầu chức năng chính:**
  - Thu đồng ý riêng cho sinh trắc học, nêu mục đích, thời hạn và cách rút lại.
  - Lưu template/định danh an toàn, phân quyền nghiêm ngặt và audit truy cập.
  - Cấu hình ngưỡng tin cậy; không tự quyết quyền lợi hoặc tiết lộ danh tính chỉ dựa vào AI.
  - Có quy trình xác minh, xử lý nhận nhầm và phản ánh của khách.
  - Xóa/vô hiệu hóa dữ liệu khi khách rút đồng ý hoặc hết thời hạn.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ nhận diện đúng trong pilot, tỷ lệ false positive, tỷ lệ khách opt-in/rút lại, phản hồi trải nghiệm và giá trị phục vụ tăng thêm.
- **Điều kiện/phụ thuộc:** Đánh giá quyền riêng tư/pháp lý, thiết bị/SDK, chính sách bảo mật, A8 và phê duyệt pilot ở phạm vi nhỏ.
- **Lý do xếp hạng:** **COULD/P3** vì lợi ích chưa chắc bù chi phí và rủi ro dữ liệu sinh trắc học.

### 5.3. Nhóm C — Đối tác, API và điều kiện bên ngoài

#### C1 — Hóa đơn điện tử hợp lệ pháp lý

- **Người dùng chính:** Kế toán bán hàng/thuế, thu ngân, quản lý doanh nghiệp và khách hàng.
- **Vấn đề nghiệp vụ:** Chứng từ nội bộ A2 không đáp ứng yêu cầu phát hành hóa đơn điện tử. Tích hợp thiếu kiểm soát có thể phát hành trùng, sai dữ liệu hoặc không xử lý được thay thế/hủy.
- **Nhu cầu chi tiết:** ERP phải kết nối một nhà cung cấp được doanh nghiệp lựa chọn, chuyển dữ liệu đơn sang hóa đơn đúng quy trình và lưu trạng thái pháp lý có thể đối soát.
- **Tình huống sử dụng:** Phát hành từ đơn; nhận mã/số và bản thể hiện; tra cứu/gửi khách; xử lý lỗi; thay thế, điều chỉnh hoặc hủy theo quy trình được duyệt.
- **Yêu cầu chức năng chính:**
  - Ánh xạ thông tin người bán/mua, hàng hóa, thuế, giảm giá và thanh toán theo hợp đồng/API thực tế.
  - Chỉ phát hành từ đơn đủ điều kiện và dùng idempotency/request ID để chống trùng.
  - Lưu trạng thái chờ, thành công, thất bại, cần xử lý; đồng bộ lại qua callback hoặc job đối soát.
  - Lưu mã tra cứu, số hóa đơn, bản thể hiện và lịch sử thao tác theo chính sách lưu trữ.
  - Hỗ trợ nghiệp vụ sau phát hành theo quyền, không sửa trực tiếp dữ liệu pháp lý.
  - Có hàng đợi/fallback khi nhà cung cấp gián đoạn và màn hình cho kế toán xử lý ngoại lệ.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ phát hành thành công, thời gian phát hành, số hóa đơn trùng/sai, số ngoại lệ chờ xử lý và chênh lệch đối soát.
- **Điều kiện/phụ thuộc:** Phụ thuộc A1, dữ liệu pháp nhân/thuế, hợp đồng, chứng thư/quyền truy cập, sandbox và quy trình được kế toán/pháp lý phê duyệt.
- **Lý do xếp hạng:** **MUST/P1** cho go-live chính thức, nhưng phụ thuộc luồng đơn ổn định và điều kiện nhà cung cấp.

#### C2 — Gửi SMS tự động

- **Người dùng chính:** Chăm sóc khách hàng, marketing, kế toán công nợ, quản trị hệ thống và khách nhận tin.
- **Vấn đề nghiệp vụ:** Gửi thủ công không nhất quán và khó theo dõi, trong khi tự động hóa thiếu kiểm soát dễ gây spam, vượt chi phí hoặc gửi nhầm dữ liệu.
- **Nhu cầu chi tiết:** Hệ thống cần một kênh SMS có template, trigger, consent, hạn mức và trạng thái giao nhận rõ ràng.
- **Tình huống sử dụng:** Xác nhận giao dịch, nhắc công nợ, thông báo trạng thái dịch vụ hoặc một chiến dịch được phê duyệt.
- **Yêu cầu chức năng chính:**
  - Quản lý template/version và biến dữ liệu được phép; preview trước khi kích hoạt.
  - Chuẩn hóa số điện thoại và kiểm tra điều kiện đồng ý/opt-out theo loại thông điệp.
  - Gửi qua queue với idempotency, rate limit, hạn mức ngân sách và quyền kích hoạt.
  - Nhận callback trạng thái, lưu mã nhà cung cấp, lỗi và số lần retry.
  - Có danh sách chặn, cửa sổ giờ gửi và báo cáo số lượng/chi phí/kết quả.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ gửi thành công, tỷ lệ phản hồi/thu tiền theo use case, tỷ lệ opt-out, tin trùng và chi phí trên kết quả.
- **Điều kiện/phụ thuộc:** Hợp đồng SMS Brandname, template được duyệt, dữ liệu liên hệ/consent và trigger nguồn như A12.
- **Lý do xếp hạng:** **SHOULD/P2** vì hữu ích sau khi nghiệp vụ nguồn ổn định và có thỏa thuận nhà cung cấp.

#### C3 — Gửi Zalo ZNS/OA

- **Người dùng chính:** Chăm sóc khách hàng, marketing, vận hành và khách hàng dùng Zalo.
- **Vấn đề nghiệp vụ:** Zalo có quy tắc OA/template và trạng thái token riêng; tích hợp như một kênh gửi tự do sẽ dễ vi phạm chính sách hoặc thất bại không kiểm soát.
- **Nhu cầu chi tiết:** ERP cần gửi đúng loại thông báo qua OA/ZNS đã được duyệt, quản lý template/credential và cập nhật trạng thái giao dịch.
- **Tình huống sử dụng:** Thông báo đơn/dịch vụ, nhắc lịch hoặc use case giao dịch được Zalo phê duyệt; theo dõi kết quả và lỗi.
- **Yêu cầu chức năng chính:**
  - Quản lý OA, token/credential và trạng thái kết nối theo tenant/doanh nghiệp.
  - Đồng bộ hoặc cấu hình template ID, version, biến bắt buộc và điều kiện sử dụng.
  - Kiểm tra số điện thoại/dữ liệu đầu vào trước khi đưa vào queue.
  - Xử lý token hết hạn, rate limit, callback và mã lỗi bằng retry có giới hạn.
  - Lưu consent/chính sách liên hệ, lịch sử gửi và báo cáo theo template/use case.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ gửi/nhận, lỗi template/token, thời gian khôi phục kết nối, tỷ lệ phản hồi và chi phí theo use case.
- **Điều kiện/phụ thuộc:** OA/ZNS được phê duyệt, template hợp lệ, API credential và nền tảng gửi/consent dùng chung có thể tái sử dụng từ C2.
- **Lý do xếp hạng:** **SHOULD/P2** vì là kênh giá trị cao nhưng hoàn toàn phụ thuộc phê duyệt bên ngoài.

#### C4 — TikTok/Messenger marketing

- **Người dùng chính:** Marketing, chăm sóc khách hàng, quản trị kênh số và khách hàng trên nền tảng tương ứng.
- **Vấn đề nghiệp vụ:** Mong muốn “nhắn đa kênh” thường quá rộng; mỗi nền tảng có quyền, loại tin và cửa sổ tương tác khác nhau nên không thể giả định một API chung đáp ứng mọi use case.
- **Nhu cầu chi tiết:** Chọn đúng một kênh và một use case đã được nền tảng cho phép để pilot, sau đó mới đánh giá mở rộng.
- **Tình huống sử dụng:** Tiếp nhận phản hồi/lead hoặc gửi thông tin trong phạm vi phiên tương tác được phép; chuyển hội thoại cần người xử lý.
- **Yêu cầu chức năng chính:**
  - Xác định rõ tài khoản/trang, quyền ứng dụng, loại thông điệp và điều kiện người nhận.
  - Nhận/gửi qua adapter riêng, lưu external ID và chống xử lý webhook trùng.
  - Quản lý token, rate limit, lỗi quyền và quy trình tái ủy quyền.
  - Lưu consent/ngữ cảnh phiên và không gửi ngoài phạm vi chính sách nền tảng.
  - Định tuyến cho nhân viên khi automation không xử lý được và đo kết quả use case.
- **Giá trị/KPI cần theo dõi:** Số lead/hội thoại hợp lệ, tỷ lệ phản hồi, thời gian phản hồi, lỗi quyền/API và chuyển đổi theo kênh.
- **Điều kiện/phụ thuộc:** Tài khoản doanh nghiệp, app review/quyền API, chính sách nền tảng hiện hành, owner vận hành và use case cụ thể.
- **Lý do xếp hạng:** **COULD/P3** vì độ bất định bên ngoài cao và giá trị cần được chứng minh bằng pilot hẹp.

#### C5 — Đồng bộ đơn hàng sàn TMĐT

- **Người dùng chính:** Nhân viên vận hành sàn, kho, kế toán bán hàng, chăm sóc khách hàng và quản lý đa kênh.
- **Vấn đề nghiệp vụ:** Nhập đơn thủ công từ nhiều sàn gây chậm xử lý, trùng đơn, sai tồn và không có một nơi đối soát trạng thái.
- **Nhu cầu chi tiết:** ERP cần nhận đơn từ một sàn đầu tiên qua adapter độc lập, ánh xạ dữ liệu chuẩn và duy trì đồng bộ có thể phục hồi/đối soát.
- **Tình huống sử dụng:** Nhận đơn mới; cập nhật thanh toán/đóng gói/giao/hủy; đồng bộ khách, phí và dòng hàng; phát hiện đơn bị bỏ sót.
- **Yêu cầu chức năng chính:**
  - Lưu shop/kênh, external order ID và raw reference đủ để điều tra nhưng bảo vệ dữ liệu nhạy cảm.
  - Ánh xạ SKU/biến thể, khách, địa chỉ, khuyến mại, phí, thanh toán và trạng thái theo quy tắc rõ.
  - Xử lý webhook có chữ ký/idempotency, kết hợp polling/job đối soát khi cần.
  - Không tạo trùng khi sự kiện đến lại hoặc đến sai thứ tự; lưu lịch sử trạng thái ngoài và trong ERP.
  - Đưa đơn lỗi mapping vào hàng chờ xử lý thủ công, không làm mất sự kiện.
  - Tách adapter từng sàn khỏi mô hình đơn chuẩn để thay đổi độc lập.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ đơn đồng bộ tự động, độ trễ, số đơn trùng/thiếu, tỷ lệ lỗi mapping và thời gian xử lý ngoại lệ.
- **Điều kiện/phụ thuộc:** Phụ thuộc A1/A3, mapping SKU, tài khoản shop/API, quy trình fulfillment và quyết định ERP hay sàn là nguồn chuẩn từng trạng thái.
- **Lý do xếp hạng:** **SHOULD/P2** khi doanh thu đa kênh đủ lớn; không cần làm sớm nếu doanh nghiệp chưa bán trên sàn.

#### C6 — Đồng bộ giá hai chiều

- **Người dùng chính:** Quản lý giá, vận hành sàn, quản lý sản phẩm và IT tích hợp.
- **Vấn đề nghiệp vụ:** Giá khác nhau giữa ERP và kênh bán gây sai cam kết với khách; “hai chiều” không có nguồn chuẩn dễ tạo vòng lặp và ghi đè thay đổi hợp lệ.
- **Nhu cầu chi tiết:** Doanh nghiệp phải chốt nguồn chuẩn và quy tắc ưu tiên, sau đó đồng bộ giá có version, trạng thái, xung đột và khả năng chạy lại theo SKU.
- **Tình huống sử dụng:** ERP phát hành giá mới; sàn phản hồi; phát hiện người dùng sửa trực tiếp trên sàn; xử lý batch lỗi một phần.
- **Yêu cầu chức năng chính:**
  - Quản lý mapping SKU/kênh và loại giá áp dụng, gồm thời gian hiệu lực nếu cần.
  - Lưu version/timestamp/nguồn thay đổi để chống vòng lặp và phát hiện dữ liệu cũ.
  - Đưa thay đổi vào queue, giới hạn tốc độ và cô lập lỗi theo SKU.
  - Hiển thị giá mong muốn, giá kênh gần nhất, thời điểm đồng bộ và lỗi.
  - Cảnh báo xung đột; áp dụng quy tắc tự xử lý hoặc yêu cầu người có quyền quyết định.
  - Có thao tác retry/đồng bộ lại và audit thay đổi giá.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ SKU đồng bộ, độ trễ cập nhật, số xung đột, số lỗi theo kênh và doanh thu bị ảnh hưởng bởi sai giá.
- **Điều kiện/phụ thuộc:** Phụ thuộc C5/adapter kênh, master sản phẩm, chính sách giá và API hỗ trợ thao tác tương ứng.
- **Lý do xếp hạng:** **SHOULD/P2** nhưng chỉ làm sau khi đồng bộ đơn và định danh sản phẩm đã ổn định.

#### C7 — Marketing Automation orchestration

- **Người dùng chính:** Marketing, CRM, chăm sóc khách hàng, quản lý thương hiệu và quản trị hệ thống.
- **Vấn đề nghiệp vụ:** Các kênh rời rạc tạo gửi trùng, quá tần suất và không biết chiến dịch nào tạo kết quả. Tự động hóa thiếu guardrail có thể ảnh hưởng khách hàng và chi phí.
- **Nhu cầu chi tiết:** Cần lớp điều phối trigger→đối tượng→template→kênh→lịch gửi→kết quả, với kiểm soát consent, tần suất và khả năng dừng.
- **Tình huống sử dụng:** Cảm ơn sau mua; sinh nhật; nhắc công nợ; win-back; chiến dịch theo phân khúc.
- **Yêu cầu chức năng chính:**
  - Tạo workflow từ trigger/schedule, điều kiện lọc và hành động kênh đã kết nối.
  - Preview/dry-run đối tượng và nội dung trước khi kích hoạt; hỗ trợ phê duyệt nếu cần.
  - Kiểm tra consent, danh sách chặn, quiet hours và frequency cap trên toàn kênh.
  - Dùng idempotency theo workflow–sự kiện–người nhận để chống gửi trùng.
  - Theo dõi trạng thái từng bước, cho pause/stop và xử lý retry có kiểm soát.
  - Gắn kết quả chiến dịch với đơn/thu tiền khi có thể, tránh chỉ đo số tin đã gửi.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ gửi/đọc/phản hồi theo kênh, chuyển đổi/doanh thu, opt-out, số người bị vượt tần suất và chi phí chiến dịch.
- **Điều kiện/phụ thuộc:** Ít nhất một kênh C2/C3 hoạt động, dữ liệu khách/consent, trigger nguồn và owner phê duyệt nội dung.
- **Lý do xếp hạng:** **SHOULD/P2** vì có giá trị sau khi kênh và dữ liệu nền hoạt động ổn định.

#### C8 — AI hỏi đáp chính sách công ty

- **Người dùng chính:** Nhân viên, quản lý, HR/hành chính và chủ sở hữu tài liệu chính sách.
- **Vấn đề nghiệp vụ:** Nhân viên mất thời gian tìm tài liệu hoặc hỏi lặp lại; chatbot không có nguồn và phân quyền có thể trả lời sai hoặc làm lộ nội dung nội bộ.
- **Nhu cầu chi tiết:** Trợ lý chỉ trả lời từ tập tài liệu được duyệt, hiển thị nguồn, tôn trọng quyền truy cập và biết từ chối khi không đủ căn cứ.
- **Tình huống sử dụng:** Hỏi quy định nghỉ phép, chi phí, quy trình nội bộ; mở nguồn để kiểm tra; phản hồi câu trả lời sai; chuyển câu hỏi cho owner.
- **Yêu cầu chức năng chính:**
  - Ingest/version tài liệu được owner phê duyệt và loại bỏ bản hết hiệu lực.
  - Lập chỉ mục kèm metadata quyền, đơn vị, ngày hiệu lực và nguồn.
  - Truy xuất theo quyền người hỏi; không đưa đoạn tài liệu ngoài quyền vào prompt/kết quả.
  - Trả lời kèm trích dẫn nội bộ; nêu rõ không đủ thông tin thay vì suy đoán.
  - Lưu feedback, câu hỏi không trả lời được và audit phù hợp để cải thiện kho tri thức.
  - Có bộ câu hỏi vàng do nghiệp vụ duyệt để đánh giá trước mỗi thay đổi lớn.
- **Giá trị/KPI cần theo dõi:** Tỷ lệ câu hỏi có nguồn hợp lệ, độ chính xác trên bộ câu hỏi vàng, tỷ lệ không trả lời đúng lúc, thời gian tìm thông tin và feedback người dùng.
- **Điều kiện/phụ thuộc:** Kho tài liệu sạch, phân quyền tài nguyên, LLM/embedding provider, chính sách dữ liệu và owner duy trì nội dung.
- **Lý do xếp hạng:** **COULD/P3** vì chất lượng phụ thuộc mạnh vào dữ liệu và không thuộc luồng bán lẻ cốt lõi.

#### C9 — Tích hợp VNeID (tạm hoãn)

- **Người dùng chính:** HR, pháp chế/tuân thủ, ứng viên/nhân viên và quản trị bảo mật.
- **Vấn đề nghiệp vụ:** Mong muốn xác thực danh tính/lý lịch không đồng nghĩa doanh nghiệp có quyền truy cập VNeID; giả định API hoặc phạm vi dữ liệu khi chưa có căn cứ sẽ tạo kế hoạch không khả thi.
- **Nhu cầu chi tiết:** Trước mọi phát triển, phải xác định use case pháp lý cụ thể, tư cách truy cập, dữ liệu được phép nhận, cơ chế đồng ý và tài liệu tích hợp chính thức.
- **Tình huống sử dụng khi được phép:** Người dùng chủ động xác thực; hệ thống nhận kết quả tối thiểu cần thiết; HR xem trạng thái chứ không thu thập vượt mục đích.
- **Yêu cầu chức năng chính khi xem xét lại:**
  - Có văn bản xác nhận quyền/đầu mối tích hợp và phạm vi use case được phép.
  - Phân tích luồng consent, định danh, callback và cách xác minh tính toàn vẹn dữ liệu.
  - Chỉ lưu trường tối thiểu; mã hóa, phân quyền, audit và chính sách xóa rõ ràng.
  - Có sandbox/tài liệu API thực tế trước khi ước lượng kỹ thuật.
  - Chuẩn bị quy trình thay thế khi dịch vụ không khả dụng hoặc người dùng không tham gia.
- **Giá trị/KPI cần theo dõi:** Chỉ xác định sau khi use case hợp pháp được phê duyệt; có thể gồm thời gian xác minh, tỷ lệ thành công và số hồ sơ cần xử lý thủ công.
- **Điều kiện/phụ thuộc:** Phê duyệt pháp lý, quyền truy cập chính thức, tài liệu/sandbox, owner dữ liệu và đánh giá bảo mật.
- **Lý do xếp hạng:** **HOLD/P4** vì điều kiện tiên quyết nằm ngoài quyền chủ động và chưa đủ cơ sở để lập backlog triển khai.

#### C10 — Chống chụp/copy dữ liệu khách hàng

- **Người dùng chính:** Chủ doanh nghiệp, quản lý CRM, nhân viên được cấp quyền, bảo mật và kiểm soát nội bộ.
- **Vấn đề nghiệp vụ:** Dữ liệu khách có thể bị xem/xuất/chia sẻ sai mục đích. Trên web không thể bảo đảm chặn tuyệt đối screenshot hoặc camera ngoài, nên yêu cầu phải tập trung giảm rủi ro và truy trách nhiệm.
- **Nhu cầu chi tiết:** Áp dụng phòng vệ nhiều lớp: quyền tối thiểu, che dữ liệu, giới hạn export/copy, watermark và audit; khả năng chặn screenshot ở OS chỉ thuộc ứng dụng native.
- **Tình huống sử dụng:** Nhân viên xem hồ sơ cần thiết; quản lý xuất dữ liệu có phê duyệt; hệ thống ghi hành vi nhạy cảm; điều tra khi có dấu hiệu rò rỉ.
- **Yêu cầu chức năng chính:**
  - Phân quyền theo vai trò, chi nhánh và mục đích; mặc định che trường nhạy cảm khi không cần đầy đủ.
  - Watermark màn hình/tệp xuất với người dùng, thời gian hoặc định danh truy vết phù hợp.
  - Giới hạn số lượng/tần suất export; yêu cầu lý do/phê duyệt với thao tác rủi ro cao.
  - Ghi audit lượt xem dữ liệu nhạy cảm, reveal, export và thay đổi quyền; cảnh báo mẫu hành vi bất thường.
  - Vô hiệu hóa copy ở vị trí phù hợp chỉ là biện pháp cản trở, không được coi là bảo mật tuyệt đối.
  - Nếu có mobile native, đánh giá cờ chặn screenshot theo OS và ngoại lệ trải nghiệm riêng.
- **Giá trị/KPI cần theo dõi:** Số lượt export/reveal, sự kiện bị chặn/cảnh báo, thời gian điều tra, phạm vi dữ liệu mỗi vai trò và số ngoại lệ quyền.
- **Điều kiện/phụ thuộc:** Mô hình phân quyền/chi nhánh, phân loại dữ liệu, audit log, quy trình phê duyệt và chính sách phản ứng sự cố.
- **Lý do xếp hạng:** **SHOULD/P3**; bảo vệ dữ liệu là nhu cầu thật nhưng lời hứa “chống chụp tuyệt đối” không khả thi trên web và phần native cần dự án riêng.

## 6. Ranking tổng thể 1–31

Thứ tự dưới đây là thứ tự khuyến nghị để phân tích, thiết kế và triển khai. Các mục cùng mức ưu tiên có thể chạy song song nếu không có quan hệ phụ thuộc và đội ngũ đủ năng lực.

| Hạng | ID | Ưu tiên | Nhu cầu | Lý do xếp hạng / điều kiện |
|---:|---|:-:|:-:|---|
| **1** | A1 | P0 | MUST | Gốc của toàn bộ dữ liệu bán hàng và các tính năng phía sau. |
| **2** | A3 | P0 | MUST | Hoàn thiện tác động tồn kho của đơn; phải thiết kế cùng A1 để tránh sai lệch dữ liệu. |
| **3** | A2 | P0 | MUST | Tạo chứng từ giao khách và hoàn thành luồng checkout cơ bản. |
| **4** | A6 | P0 | MUST | Kiểm soát tiền và trách nhiệm thu ngân khi vận hành thực tế. |
| **5** | A5 | P0 | MUST | Cho phép đối soát và đánh giá dữ liệu bán hàng ngay từ pilot. |
| **6** | B1 | P1 | MUST | Đưa luồng P0 vào giao diện quầy có thể sử dụng hàng ngày. |
| **7** | B2 | P1 | MUST | Tăng tốc nhập hàng vào giỏ; phụ thuộc thiết bị pilot nhưng tích hợp tương đối thẳng. |
| **8** | B3 | P1 | MUST | Hoàn thiện chứng từ giấy tại quầy; cần kiểm thử thiết bị thật. |
| **9** | C1 | P1 | MUST | Bắt buộc trước go-live chính thức khi nghiệp vụ phải phát hành hóa đơn điện tử hợp lệ. |
| **10** | A4 | P1 | SHOULD | Cần ngay nếu doanh nghiệp có bán nợ hoặc thu tiền nhiều lần. |
| **11** | A12 | P1 | SHOULD | Tự động hóa sau A4; giảm bỏ sót khoản quá hạn. |
| **12** | B4 | P1 | COULD | Hoàn thiện combo POS nhưng không chặn bán hàng nếu mở ngăn kéo thủ công. |
| **13** | A8 | P2 | SHOULD | Tăng khả năng chăm sóc và phân khúc khách sau khi có dữ liệu doanh số. |
| **14** | A10 | P2 | SHOULD | Hoàn thiện vòng đời kho đối với hàng lỗi/trả NCC. |
| **15** | A13 | P2 | SHOULD | Hoàn thiện vòng đời bán lẻ với luồng khách trả hàng; cần chính sách đổi trả rõ. |
| **16** | B8 | P2 | SHOULD | Cần cho ngành hàng quản lý theo IMEI/serial; dùng chung thiết bị B2. |
| **17** | A9 | P2 | SHOULD | Mở kênh CTV/đại lý sau khi đơn và đối soát ổn định. |
| **18** | A7 | P2 | COULD | Bổ sung góc nhìn chi phí chi nhánh, nhưng chưa thay thế hệ thống kế toán. |
| **19** | A11 | P2 | SHOULD | Module quản trị tài sản độc lập, ít phụ thuộc luồng bán lẻ lõi. |
| **20** | D1 | P2 | SHOULD | Nền tảng module sửa chữa; không có D1 thì D2/D3/D4 không hoạt động được. |
| **21** | D2 | P2 | SHOULD | Cải thiện trực tiếp trải nghiệm KH và hiệu suất dịch vụ; phụ thuộc D1 và ít nhất một kênh C2/C3. |
| **22** | D3 | P2 | SHOULD | Kiểm soát chi phí linh kiện; điều kiện để D4 có dữ liệu chính xác. |
| **23** | D4 | P2 | SHOULD | Báo cáo hiệu quả dịch vụ sửa chữa; chỉ có giá trị sau khi D1–D3 có đủ dữ liệu. |
| **24** | E1 | P2 | SHOULD | Nền tảng nhân sự; cần trước E2, E3 và phân quyền theo chi nhánh. |
| **25** | E2 | P2 | SHOULD | Dữ liệu đầu vào cho tính lương E4; nhu cầu thực tế khi chuỗi nhiều cửa hàng. |
| **26** | E3 | P2 | SHOULD | Giá trị quản trị rõ sau khi dữ liệu bán hàng A1/A5 đủ tin cậy; phụ thuộc E1. |
| **27** | C5 | P2 | SHOULD | Mở rộng đa kênh; chỉ ưu tiên khi doanh nghiệp thực sự bán trên sàn. |
| **28** | C6 | P2 | SHOULD | Phụ thuộc adapter và định danh sản phẩm ổn định từ C5. |
| **29** | C2 | P2 | SHOULD | Kênh thông báo phổ biến; cần hợp đồng và chính sách gửi. |
| **30** | C3 | P2 | SHOULD | Mở thêm kênh sau khi mô hình template, consent và log đã rõ. |
| **31** | C7 | P2 | SHOULD | Chỉ có giá trị sau khi ít nhất một kênh gửi hoạt động ổn định. |
| **32** | B6 | P3 | COULD | Dễ pilot nhưng chỉ có ý nghĩa khi module sửa chữa D1 đã hình thành. |
| **33** | C8 | P3 | COULD | Cần kho tri thức sạch và bộ tiêu chí chất lượng trước khi pilot. |
| **34** | C10 | P3 | SHOULD | Nên làm bảo vệ dữ liệu nền tảng trên web; phần chống screenshot phụ thuộc mobile native. |
| **35** | C4 | P3 | COULD | Rủi ro quyền nền tảng và chính sách kênh; chỉ làm một use case pilot. |
| **36** | B7 | P3 | COULD | Cần đầu tư thiết bị/nhà cung cấp và đánh giá hiệu quả thu lead. |
| **37** | E4 | P3 | SHOULD | Cần dữ liệu chấm công E2 ổn định và công thức lương được nghiệp vụ phê duyệt riêng. |
| **38** | C11 | P3 | COULD | Chỉ có giá trị sau khi đa kênh hoạt động và API cấp đủ quyền đọc số liệu tổng hợp. |
| **39** | E5 | P3 | COULD | Cải thiện onboard; phụ thuộc chất lượng tài liệu sẵn có và owner nội dung. |
| **40** | E6 | P3 | COULD | Doanh nghiệp có thể dùng tạm Zalo; chỉ đầu tư sau khi module lõi ổn định. |
| **41** | B9 | P3 | COULD | Chi phí, quyền riêng tư và nguy cơ nhận nhầm cao hơn lợi ích chưa kiểm chứng. |
| **42** | B5 | P4 | HOLD | Tạm hoãn; chỉ mở lại khi có business case và pilot được duyệt. |
| **43** | C9 | P4 | HOLD | Tạm hoãn do điều kiện truy cập và pháp lý chưa nằm trong quyền chủ động của đội phát triển. |

---

## 7. Roadmap 4 giai đoạn sau khi bổ sung ranking

### Giai đoạn 1 — Pilot luồng bán hàng (P0)

**Phạm vi:** A1, A3, A2, A6, A5.

**Kết quả đầu ra:** một chi nhánh pilot có thể tạo đơn, trừ kho, in/tải hóa đơn nội bộ, chốt ca và đối soát doanh thu trên web/PC.

**Điều kiện qua giai đoạn:** dữ liệu đơn–kho–ca–báo cáo đối soát được; không có lỗi tạo đơn/trừ kho trùng; phân quyền và audit tối thiểu đã hoạt động.

### Giai đoạn 2 — Go-live tại quầy (P1)

**Phạm vi:** B1, B2, B3, C1; bổ sung A4/A12 nếu có bán nợ; B4 nếu quy trình tiền mặt yêu cầu.

**Kết quả đầu ra:** vận hành được trên thiết bị quầy đã chọn, quét mã và in nhiệt; phát hành hóa đơn điện tử qua một nhà cung cấp; kiểm soát công nợ khi áp dụng.

**Điều kiện qua giai đoạn:** hoàn tất UAT trên thiết bị thật; có quy trình fallback khi máy in/API lỗi; kế toán và vận hành ký nghiệm thu các luồng liên quan.

### Giai đoạn 3 — Mở rộng nghiệp vụ và kênh bán (P2)

**Phạm vi theo nhu cầu thực tế:** A8, A10, A13, B8, A9, A7, A11, D1, D2, D3, D4, E1, E2, E3, C5, C6, C2, C3, C7.

**Kết quả đầu ra:**
- *Bán lẻ mở rộng:* CRM phân hạng khách, luồng trả hàng từ KH, kênh CTV/đại lý và quản lý serial.
- *Sửa chữa & Bảo hành:* phiếu tiếp nhận số hóa, trạng thái có thông báo tự động, kho linh kiện và báo cáo doanh thu dịch vụ.
- *Nhân sự & KPI:* hồ sơ nhân viên, chấm công qua app và theo dõi target real-time.
- *Đa kênh:* đồng bộ sàn TMĐT, đồng bộ giá và marketing automation.

**Điều kiện chọn tính năng:** mỗi tính năng phải có owner nghiệp vụ, chỉ số thành công, dữ liệu đầu vào và đối tác/API sẵn sàng nếu có. Không bắt buộc làm toàn bộ P2 cùng lúc.

### Giai đoạn 4 — Pilot tính năng nâng cao (P3)

**Phạm vi có chọn lọc:** B6, C8, C10, C4, B7, E4, C11, E5, E6, B9.

**Kết quả đầu ra:**
- *Nhân sự:* tính lương tự động từ dữ liệu chấm công, kho đào tạo và chat nội bộ.
- *Phân tích đa kênh:* dashboard đo lường tương tác KH từ các kênh đã tích hợp.
- *Bảo mật & Nâng cao:* chống sao chép dữ liệu, AI hỏi đáp chính sách, wifi marketing và nhận diện khuôn mặt VIP.

**Nguyên tắc:** chỉ triển khai pilot nhỏ, có thời hạn và chỉ số đo lường rõ; quyết định tiếp tục hay dừng dựa trên kết quả thực tế.

**Ngoài roadmap:** B5 và C9 tiếp tục ở P4/HOLD.

---

## 8. Ước lượng Timeline

> **Điều kiện áp dụng:** 2 developer fullstack + AI Agent (Cursor / Claude) sử dụng liên tục. Nền tảng ERP cơ bản đã có (auth, user, product, kho). Số ngày dưới đây là **thời gian tường** (calendar days) với 2 dev chạy song song, đã bao gồm buffer review + UAT.

### 8.1. Quy tắc ước lượng

| Độ khó | Thời gian (2 dev + AI Agent) | Ghi chú |
|:-:|---|---|
| **1** | 1–2 ngày | AI sinh gần xong, chỉ cần review và test |
| **2** | 3–5 ngày | AI tạo skeleton + logic cơ bản, dev tinh chỉnh edge case |
| **3** | 7–10 ngày | Logic phức tạp hoặc tích hợp ngoài, AI hỗ trợ ~40–50% |
| **4** | 13–18 ngày | API bên thứ 3 — AI giúp phần code, phần chờ sandbox/hợp đồng không đổi |
| **5** | HOLD | Chưa đủ điều kiện |

**Buffer mỗi giai đoạn:** +20% cho fix bug, UAT thật và tài liệu bàn giao.

> ⚠️ **AI Agent không rút ngắn được:** thời gian chờ sandbox/hợp đồng bên thứ 3 (C1, C5), test thiết bị phần cứng thật (B1, B3, B4) và UAT với người dùng thực tế.

---


### 8.2. Giai đoạn 1 — Pilot luồng bán hàng (P0) · ~3 tuần

**Mục tiêu:** 1 chi nhánh pilot chạy end-to-end: tạo đơn → trừ kho → in chứng từ → chốt ca → báo cáo.

| ID | Tính năng | Độ khó | Ngày | Phân công gợi ý |
|---|---|:-:|:-:|---|
| A1 | Đơn hàng bán lẻ | 2 | 3 | Dev 1 — luồng đơn, trạng thái, phân quyền |
| A3 | Tự động xuất/nhập kho theo đơn | 2 | 2 | Dev 1 — stock log, idempotency |
| A2 | Hóa đơn bán lẻ nội bộ | 2 | 2 | Dev 2 — template HTML/PDF |
| A6 | Chốt ca/chốt sổ thu ngân | 2 | 2 | Dev 2 — mở/đóng ca, đối soát tiền |
| A5 | Báo cáo doanh thu/lợi nhuận | 2 | 2 | Dev 2 — aggregate pipeline |
| — | Buffer UAT + fix | — | 3 | Cả 2 dev |
| **Tổng** | | | **~14 ngày (~3 tuần)** | |

> **Thứ tự bàn giao:** A1 → A3 (song song A2) → A6 → A5 → UAT end-to-end.

---

### 8.3. Giai đoạn 2 — Go-live tại quầy (P1) · ~6 tuần

**Mục tiêu:** POS chạy trên thiết bị thật, quét mã, in nhiệt, hóa đơn điện tử, kiểm soát công nợ.

| ID | Tính năng | Độ khó | Ngày | Phân công gợi ý |
|---|---|:-:|:-:|---|
| B1 | Giao diện POS tại quầy | 3 | 5 | Dev 1 — UI POS, thiết bị pilot |
| B2 | Quét barcode/QR sản phẩm | 2 | 2 | Dev 1 — HID input, ánh xạ SKU |
| B3 | In hóa đơn nhiệt | 2 | 2 | Dev 1 — template 80mm, test máy in |
| B4 | Ngăn kéo tiền tự động | 2 | 2 | Dev 1 — lệnh mở qua máy in, audit log |
| C1 | Hóa đơn điện tử hợp lệ | 4 | 8 | Dev 2 — adapter nhà cung cấp, idempotency |
| A4 | Công nợ khách hàng | 2 | 3 | Dev 2 — ledger, thanh toán từng phần |
| A12 | Nhắc công nợ quá hạn | 2 | 2 | Dev 2 — job định kỳ, gửi thông báo |
| — | Buffer UAT + fix thiết bị | — | 6 | Cả 2 dev |
| **Tổng** | | | **~30 ngày (~6 tuần)** | |

> ⚠️ **C1:** 8 ngày là thời gian code. Cần **ký hợp đồng + lấy sandbox ngay từ Giai đoạn 1** để không bị block. Nếu chưa có sandbox khi bắt đầu P1, C1 kéo thêm 2–3 tuần chờ bên ngoài.

> **Phân chia dev:** Dev 1 lo toàn bộ layer thiết bị (B1–B4), Dev 2 lo tích hợp ngoài + công nợ (C1, A4, A12).

---

### 8.4. Giai đoạn 3 — Mở rộng nghiệp vụ (P2) · chọn lọc

**Mục tiêu:** Bổ sung theo nhóm ưu tiên thực tế — không làm tất cả cùng lúc.

#### Nhóm Bán lẻ mở rộng · ~2 tuần

| ID | Tính năng | Độ khó | Ngày |
|---|---|:-:|:-:|
| A8 | Phân hạng khách hàng/VIP | 2 | 3 |
| A13 | Trả hàng từ khách | 2 | 3 |
| A10 | Trả hàng NCC | 2 | 3 |
| B8 | Quét IMEI/serial | 2 | 3 |
| A9 | CTV/Đại lý & hoa hồng | 2 | 4 |
| A7 | Chi phí/vận chuyển chi nhánh | 1 | 2 |
| A11 | Tài sản cố định & khấu hao | 2 | 3 |
| **Subtotal** | | | **~21 ngày (~2.5 tuần)** |

#### Nhóm Sửa chữa & Bảo hành · ~2 tuần

| ID | Tính năng | Độ khó | Ngày |
|---|---|:-:|:-:|
| D1 | Phiếu tiếp nhận sửa chữa | 2 | 3 |
| D2 | Quản lý trạng thái & thông báo KH | 2 | 3 |
| D3 | Xuất nhập linh kiện | 3 | 5 |
| D4 | Báo cáo doanh thu sửa chữa | 2 | 2 |
| **Subtotal** | | | **~13 ngày (~2 tuần)** |

#### Nhóm Nhân sự & KPI · ~2 tuần

| ID | Tính năng | Độ khó | Ngày |
|---|---|:-:|:-:|
| E1 | Hồ sơ nhân sự | 2 | 3 |
| E2 | Chấm công | 3 | 5 |
| E3 | KPI & phân target | 3 | 5 |
| **Subtotal** | | | **~13 ngày (~2 tuần)** |

#### Nhóm Đa kênh & Marketing · ~3.5 tuần

| ID | Tính năng | Độ khó | Ngày |
|---|---|:-:|:-:|
| C2 | Gửi SMS tự động | 2 | 3 |
| C3 | Gửi Zalo ZNS/OA | 3 | 5 |
| C7 | Marketing Automation | 3 | 7 |
| C5 | Đồng bộ đơn sàn TMĐT | 4 | 9 |
| C6 | Đồng bộ giá hai chiều | 4 | 7 |
| **Subtotal** | | | **~31 ngày (~3.5 tuần)** |

> 💡 **Thứ tự gợi ý trong P2:** Làm từng nhóm thành mini-milestone 2–3 tuần. Ưu tiên nhóm nào tạo doanh thu hoặc tiết kiệm chi phí nhiều nhất cho doanh nghiệp (thường là D1–D4 hoặc E1–E3 trước).

---

### 8.5. Giai đoạn 4 — Tính năng nâng cao (P3) · on-demand

Mỗi tính năng P3 là một quyết định riêng — pilot trước, commit sau.

| ID | Tính năng | Độ khó | Ngày | Điều kiện tiên quyết |
|---|---|:-:|:-:|---|
| E4 | Tính lương cơ bản | 4 | 12 | E2 ổn định + công thức lương được HR duyệt |
| C10 | Chống chụp/copy dữ liệu | 3 | 6 | Thiết kế phân quyền xong |
| C8 | AI hỏi đáp chính sách | 3 | 7 | Kho tài liệu sạch + LLM provider |
| B6 | Đánh giá sửa chữa qua QR | 2 | 3 | D1 đã có |
| C11 | Đo lường tương tác đa kênh | 3 | 6 | Ít nhất 1 adapter kênh C2–C5 |
| E5 | Đào tạo & kho tài liệu | 3 | 7 | Content owner xác nhận |
| E6 | Chat nội bộ & phân công việc | 4 | 10 | E1 xong, cân nhắc dùng lib sẵn |
| C4 | TikTok/Messenger marketing | 3 | 7 | Quyền API nền tảng được cấp |
| B7 | Wifi Marketing | 4 | 9 | Thiết bị/nhà cung cấp captive portal |
| B9 | Nhận diện khuôn mặt VIP | 4 | 14 | Đánh giá quyền riêng tư + SDK |

---

### 8.6. Tổng quan timeline

```
Tháng 1      [P0 — Pilot bán hàng]    ██████░░░░░░░░░░░░  ~3 tuần
Tháng 2–3    [P1 — Go-live tại quầy]  ░░░████████████░░░  ~6 tuần
                                        ↑ Ký C1 ngay từ tháng 1
Tháng 4–7    [P2 — Mở rộng]           ░░░░░░░░░░░░██████  chọn lọc từng nhóm
Tháng 8+     [P3 — Nâng cao]          ░░░░░░░░░░░░░░░░░█  on-demand / pilot
```

| Giai đoạn | Thời gian | Số tính năng | Kết quả |
|---|:-:|:-:|---|
| **P0 — Pilot** | **~3 tuần** | 5 | Bán hàng, trừ kho, in chứng từ, chốt ca, báo cáo |
| **P1 — Go-live** | **~6 tuần** | 7 | POS thật, quét mã, in nhiệt, hóa đơn điện tử |
| **P0 + P1** | **~9 tuần (~2.5 tháng)** | 12 | Hệ thống vận hành được tại quầy |
| **P2 — Mở rộng** | ~3.5 tháng (nếu làm tất cả) | 19 | CRM, SCBH, nhân sự, đa kênh |
| **P3 — Nâng cao** | On-demand | 10 | Pilot từng tính năng |

> **Lưu ý:** Đầu tư 2–3 ngày đầu Sprint 1 để thiết lập prompt chuẩn, quy ước schema và pattern có sẵn để AI tham chiếu. Với logic tài chính, stock và idempotency — luôn dành 10–15 phút review kỹ output AI trước khi merge.

---

### 8.7. Phạm vi AI Agent trong dự án này

```
✅ AI Agent xử lý TỐT (tiết kiệm 55–70% thời gian):
   • Sinh model / interface / schema từ mô tả nghiệp vụ
   • Tạo Joi validation + Swagger docs cho 100% API
   • Viết unit test cho service logic
   • Refactor, chuẩn hóa code theo layered pattern
   • Dịch yêu cầu nghiệp vụ thành aggregation pipeline / query

⚠️ AI Agent cần REVIEW KỸ (tiết kiệm 30–45%):
   • Idempotency / race condition (trừ kho, chốt ca)
   • Webhook từ sàn TMĐT (thứ tự event không đoán được)
   • Logic phân quyền nhiều cấp
   • Tính toán tài chính (làm tròn, múi giờ, snapshot giá)

❌ AI Agent KHÔNG thay thế được:
   • Quyết định thiết kế schema khi có trade-off nghiệp vụ
   • UAT với người dùng thật tại quầy
   • Chờ sandbox / ký hợp đồng nhà cung cấp (C1, C5)
   • Test thiết bị phần cứng (máy in, máy quét, ngăn kéo tiền)
   • Họp chốt quy trình với kế toán / vận hành
```


