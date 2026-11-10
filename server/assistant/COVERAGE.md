# Phạm vi trợ lý thao tác ERP

Catalog chỉ đưa vào executor các route có hợp đồng dữ liệu, quyền và cách phân giải bản ghi rõ ràng. API gốc tiếp tục xác thực người dùng, công ty và chi nhánh.

## Số liệu hiện tại

- Inventory hiện có 1.183 route API; coverage gồm 3 adapter từ CRUD tổng quát chưa có trong inventory, tổng cộng 1.186 route. Inventory nhận diện quyền tường minh cho 960 route.
- 793 hợp đồng sinh từ API và 47 adapter thủ công, tổng cộng 840 route đã nối; 26 adapter mới thuộc Quản lý y tế.
- 0 route đang chờ rà soát; trợ lý chưa gọi các route này.
- 346 route đã được đánh giá và chủ ý chưa nối; lý do cụ thể được liệt kê riêng trong `UNSUPPORTED.md`.
- Các route tạo bằng vòng lặp và helper đã được mở rộng thành path cụ thể; inventory không còn route động chưa phân giải.

Danh sách đầy đủ từng route chưa nối, lý do và tệp nguồn được sinh tại [UNSUPPORTED.md](./UNSUPPORTED.md).

### Thao tác theo phân hệ

| Phân hệ | Hợp đồng sinh |
| --- | ---: |
| chat | 32 |
| company-knowledge | 14 |
| customer | 13 |
| finance | 67 |
| hr | 138 |
| inventory | 62 |
| marketing | 11 |
| omni-inbox | 24 |
| partner | 43 |
| repair | 34 |
| resource | 17 |
| retail | 74 |
| retail-partner | 17 |
| social-marketing | 118 |
| student | 99 |
| worker | 30 |

### Lý do route còn chờ

| Lý do | Số route |
| --- | ---: |
| **Tổng đang chờ rà soát** | **0** |

Các route đã đánh giá và chủ ý chưa nối được thống kê riêng: 346 route. Chúng gồm thao tác có side effect khi đọc, route cần chọn tệp/tài khoản/phiên theo luồng riêng, route trùng workflow chuẩn hoặc cần xác nhận/kiểm soát chưa có trong chat. Danh sách và lý do từng route nằm trong [UNSUPPORTED.md](./UNSUPPORTED.md).

## Adapter thủ công

Các adapter dưới đây là route cố định, được khai báo riêng và có kiểm tra khớp với catalog:

Quản lý y tế bổ sung 26 adapter được liệt kê trong `manual-route-coverage.json`: tổng quan (1), bệnh nhân (4), lượt khám và phiếu bệnh viện (4), lịch hẹn (3), chăm sóc (3), danh mục và nhân viên (4), nhập Excel (7). Các alias GET danh sách lượt khám/lịch hẹn/chăm sóc không tạo workflow trùng; trợ lý gọi POST `/search` để giữ nội dung tìm kiếm trong body. Xem chi tiết cách dùng và giới hạn nhập Excel tại [README.md](./README.md#workflow-quản-lý-y-tế).

| Route | Thao tác |
| --- | --- |
| `POST /auth/register-user` | Tạo nhân viên |
| `GET /auth/users` | Tra cứu nhân viên |
| `GET /auth/branches` | Tra cứu chi nhánh |
| `PATCH /auth/users/:id` | Cập nhật nhân viên |
| `PATCH /kanban/tasks/:id` | Cập nhật tiến độ công việc |
| `GET /repair/tickets/:id/refunds` | Tra cứu tổng hợp hoàn tiền sửa chữa |
| `POST /repair/tickets/:id/refunds` | Tạo hoàn tiền sửa chữa có xác nhận |
| `GET /repair/tickets/:id/refunds/vouchers` | Tra phiếu chi hoàn tiền sửa chữa |
| `POST /customers` | Tạo khách hàng |
| `GET /customers/:id/transactions` | Tra lịch sử giao dịch khách hàng |
| `GET /customers/:id/transactions/:kind/:sourceId` | Xem giao dịch khách hàng |
| `GET /omni-inbox/accounts` | Tra cứu tài khoản hộp thư |
| `GET /marketing-campaigns/accounts` | Tra cứu tài khoản chiến dịch |
| `GET /company-knowledge/accounts` | Tra cứu tài khoản kho tri thức |
| `GET /marketing-contents` | Tra cứu nội dung marketing đã lưu |
| `GET /omni-inbox/leads` | Tra cứu khách tiềm năng CRM |
| `POST /omni-inbox/leads` | Tạo khách tiềm năng CRM |
| `PATCH /omni-inbox/leads/:id` | Cập nhật khách tiềm năng CRM |
| `GET /crud/stock-logs` | Tra phiếu nhập xuất kho |

## Các luồng vẫn bị khóa

Những route dưới đây cần kiểm soát bổ sung trước khi đưa vào hội thoại:

- Nhắc nợ tài chính: workflow chuẩn đã có danh sách lượt chạy theo chi nhánh, chi tiết thống kê và chạy lượt mới sau xác nhận. `POST /finance/reminders/deliveries/:id/retry` vẫn bị khóa vì route cũ nhận cả delivery nội bộ lẫn sự kiện Marketing có thể gửi ra ngoài; trợ lý chỉ dùng workflow riêng cho retry nội bộ. `POST /retail/reports/debt-reminders/run` là alias báo cáo cũ gọi cùng service nhưng thiếu hợp đồng riêng; workflow bán lẻ dùng `POST /retail/debt-reminders/run` theo chi nhánh sau xác nhận.
- Email nhắc công nợ bán lẻ: trợ lý liệt kê riêng email lỗi tạm thời còn lượt, hiển thị chính xác người nhận, địa chỉ, mã đơn, tiêu đề/nội dung thư và số lượt gửi trước khi xác nhận. Endpoint chỉ xếp lại đúng email đã chọn bằng cập nhật nguyên tử; thông báo nội bộ, lỗi vĩnh viễn và email hết lượt không có trong danh sách thử lại.
- Hậu mãi/công nợ bán lẻ: đối soát hoặc thu hồi yêu cầu và một số thao tác đảo vẫn cần phân giải chứng từ, kiểm tra phiên bản và khóa chống trùng. Hai alias cũ `/retail/receivables/adjustments` và `/retail/receivables/:entryId/reversal` đổi schema/định danh theo cờ chuyển đổi; trợ lý giữ chúng bị khóa và dùng route Finance ổn định `/finance/receivables/:id/adjustments` hoặc `/finance/receivables/:id/entries/:entryId/reversal`, nơi người dùng chọn khoản phải thu và bút toán theo tên/mã trước khi xác nhận.
- Chiến dịch marketing: danh sách cũ tự đồng bộ thống kê/trạng thái nên trợ lý dùng endpoint tóm tắt chỉ đọc theo tên; báo cáo mới chỉ chạy cho một chiến dịch được chọn theo tên trong tối đa 31 ngày, trả số liệu tổng hợp theo trạng thái, kênh, ngày và chất lượng, không trả URL/nội dung bài/lỗi tự do. Route analytics cũ vẫn bị khóa vì truy vấn rộng. Dự toán AI hiện tại tự rà soát và cập nhật lượt AI đã hết hạn; tạo chiến dịch qua chat chưa mở vì workflow có nhiều lượt AI tính phí, khoảng ngày chưa giới hạn và tùy chọn kích hoạt đăng ngay. Trợ lý chỉ đưa từng slot lỗi được chọn theo tên/ngày/kênh/chủ đề vào hàng đợi; không mở `POST /marketing-campaigns/:id/retry-all` vì API đặt lại toàn bộ slot lỗi của chiến dịch đang chạy, không có giới hạn số lượng và có thể dẫn đến đăng lại hàng loạt. Kích hoạt chiến dịch và chuẩn bị bài theo lô cũng tiếp tục trong giao diện vì có thể khởi chạy nhiều slot cùng lúc. Lịch phiên bản gọn, hoàn tác phiên bản Content Sheet có xác nhận và thay đổi trạng thái đã có workflow riêng.
- Thiết bị tại quầy/tệp: in hóa đơn, xuất báo cáo và tải tệp cần luồng thiết bị hoặc tải riêng.
- Tạo ảnh hàng loạt: biên tập/chia sẻ mẫu cần thao tác trên canvas, layer và URL ảnh; AI chỉnh cảnh có tính phí và nhận tệp đính kèm; xem trước trả ảnh PNG; tạo job nhận tối đa 100 dòng dữ liệu và lưu ảnh lên kho tệp. Chat chỉ tra danh sách/chi tiết tóm tắt mẫu theo tên và trạng thái job, hủy job đang chạy hoặc thử lại riêng ảnh lỗi; chỉnh mẫu, xem trước, upload và tạo job tiếp tục trong giao diện.
- `PUT /batches/:id/attendance` thay toàn bộ danh sách điểm danh; không dùng khi người dùng chỉ yêu cầu sửa một học viên. Trợ lý dùng `PATCH /batches/:id/attendance/learner` để chọn đúng học viên trong roster của lớp theo tên và cập nhật riêng trạng thái.
- `POST /exams/:id/import-results` là luồng nhập Excel ghép học viên bằng số điện thoại. Service có thể tự gán học viên chưa thuộc roster kỳ thi và ghi từng dòng trước khi xử lý dòng tiếp theo, nên lỗi giữa chừng có thể để lại kết quả cập nhật một phần. Giữ nhập tệp trong giao diện; trợ lý dùng chấm điểm theo roster kỳ thi đã chọn, có xác nhận và kiểm tra học viên thuộc đúng kỳ thi.
- `GET/POST /repair/feedback/:token` là biểu mẫu công khai dùng token truy cập; chỉ nối thao tác tạo liên kết nội bộ, không để trợ lý đọc/gửi phản hồi thay khách.
- Lịch sử video tại `GET /gemini/media-history?type=video` chưa mở cho trợ lý: API có thể đồng bộ job, tải video lên Cloudinary và cập nhật dữ liệu ngay trong truy vấn GET. Lịch sử ảnh/giọng đọc đã có hợp đồng riêng.
- `POST /worker-management/partners/payouts/:payoutId/reverse` và xuất báo cáo hoa hồng cần đối chiếu bản ghi, kiểm soát kiểm toán hoặc luồng tệp riêng.
- `PATCH /retail/warranty/serial/:id` là endpoint tương thích cần ID nội bộ; trợ lý dùng route theo IMEI/sê-ri/mã vạch hiển thị đã nối ở `/retail/warranty/serial/by-code/:code`.
- `PATCH /auth/bank-settings` cần luồng cập nhật riêng; API nhận dữ liệu xác thực ngân hàng và việc cập nhật thiếu trường có thể ghi đè cấu hình hiện tại.
- Lưu cấu hình SMTP qua chat vẫn bị khóa vì cần mật khẩu ứng dụng; chat lưu lịch sử nên không thu thập bí mật này. Người dùng có thể lưu cấu hình trong giao diện SMTP với trường mật khẩu được che.
- Google Drive nhóm: `GET /integrations/google-drive/resources/group/:roomId` có thể tự tạo thư mục và cấp quyền đọc công khai; xóa tệp Drive vẫn cần mã nội bộ và chưa có bước kiểm tra/xác nhận theo tên.
- Các luồng QR, OAuth, upload, secret, tích hợp ngoài, route thiếu quyền tường minh, cấu trúc động và cấu hình thay toàn bộ vẫn bị khóa cho đến khi có hợp đồng an toàn.

## Phạm vi vừa bổ sung

- Khi tạo hoặc sửa bản ghi, trợ lý đưa ra các lựa chọn liên kết theo tên để người dùng chủ động chọn (ví dụ nhân sự thuộc phòng ban nào, sản phẩm thuộc danh mục nào); không tự lấy giá trị mặc định hoặc tự chọn kết quả đầu tiên. Quan hệ lồng nhau được đề xuất theo thứ tự phụ thuộc (ví dụ chọn sản phẩm trước rồi mới chọn SKU) và có thể lọc theo bản ghi cha ở path/query (ví dụ chọn lớp trước rồi mới chọn học viên trong lớp). Khi sửa, chỉ hỏi lựa chọn cho quan hệ người dùng muốn đổi; liên kết tùy chọn chỉ có thể bỏ qua nếu người dùng không yêu cầu cụ thể. Nếu người dùng yêu cầu tạo/đổi liên kết mà phạm vi không có lựa chọn, trợ lý báo rõ và dừng để hỏi lại. Người dùng không cần biết ID nội bộ.

- Hồ sơ học viên: xem thông tin cơ bản và tiến độ học tập qua `GET /students/:id` và `GET /students/:id/learning-history`, chọn học viên theo tên/số điện thoại/email. Kết quả tiến độ chỉ gồm số lớp/khóa, buổi tham gia, tỷ lệ chuyên cần, bài tập, bài kiểm tra và tên khóa học; không trả ghi chú riêng tư, thông tin sức khỏe, giấy tờ hay dữ liệu thanh toán. Xóa trực tiếp vẫn khóa để buộc đi qua bước xem trước ảnh hưởng.

- Điểm danh lớp: `GET /batches/:id/attendance/learners` trả tối đa 100 lựa chọn hiện có trong lớp theo tên/số điện thoại; `PATCH /batches/:id/attendance/learner` sửa đúng một học viên theo lớp/ngày/trạng thái đã chọn. API giữ nguyên các bản ghi khác, xác minh roster và giới hạn buổi học; chat yêu cầu xác nhận.
- Lộ trình học và lớp: tạo/sửa lớp bằng cách chọn khóa học, lộ trình đang hoạt động, chặng học thuộc khóa học đã chọn và giảng viên theo tên. API danh sách chặng giới hạn theo quyền, công ty/chi nhánh và khóa học; thông tin lộ trình có thể tra cứu/tạo/sửa, học viên lớp được chọn theo tên.
- Kỳ thi: xem roster học viên đang gán và roster thí sinh đã đăng ký theo kỳ thi; chọn tên/số điện thoại để gỡ học viên đang gán hoặc cập nhật điểm/kết quả cho thí sinh đã đăng ký. Danh sách chỉ đọc tên, số điện thoại, điểm/kết quả hiện tại; mã nội bộ và học phí được giữ kín. Ghi điểm/gỡ học viên cần xác nhận; API kiểm tra quan hệ kỳ thi, ngày thi, lớp đã hoàn thành ít nhất 85% buổi học, thang điểm và ngưỡng đạt. Gỡ học viên xóa mục lịch sử thi khỏi hồ sơ và đặt trạng thái về “Đang học”, nên trợ lý phải nêu rõ trước khi xác nhận. Hoàn tất kết quả có thể kết thúc lớp, ghi nhận hoàn thành khóa học hoặc tạo yêu cầu học lại. Gán học viên mới vẫn bị khóa do API chưa xác minh điều kiện ghi danh.

- Dự án phụ đề video: tra cứu danh sách/chi tiết theo tên với projection an toàn; tạo bản nháp với tự phân tích luôn tắt; cập nhật tên, chế độ, bối cảnh và liên kết nội dung marketing/chiến dịch. Liên kết được gợi ý theo tên và người dùng chọn rõ ràng; cập nhật một liên kết giữ nguyên các liên kết chưa nêu. Phân tích, nhận dạng lời thoại, tạo bối cảnh AI, kết xuất, tải video/phụ đề và thao tác job vẫn dùng giao diện do có xử lý tệp, tác vụ nền hoặc chi phí AI.
- Hủy dự án phụ đề theo tên sau xác nhận; gợi ý loại dự án đã hoàn tất hoặc đã hủy, tác vụ đang chạy chỉ nhận yêu cầu dừng. Kết quả chỉ trả tên và trạng thái.
- Thử lại dự án phụ đề lỗi hoặc đã hủy theo tên sau xác nhận; hệ thống có thể chạy lại phân tích, nhận diện lời thoại, tạo ngữ cảnh hoặc kết xuất và có thể dùng dịch vụ AI tính phí. Kết quả chỉ nêu loại tác vụ và trạng thái xếp hàng.
- Tạo ảnh hàng loạt: theo dõi tiến độ, hủy lượt đang chạy và thử lại riêng ảnh lỗi. Lượt được chọn theo tên mẫu, trạng thái, tiến độ và thời điểm; chỉ hiện lượt đủ điều kiện, yêu cầu xác nhận và chỉ trả các trường tổng hợp an toàn.
- Mẫu tạo ảnh hàng loạt: xem danh sách và chi tiết theo tên; chỉ hiện tên, trạng thái chia sẻ, phiên bản, lượt dùng và thời điểm cập nhật. Có thể đổi tên mẫu đã chọn sau xác nhận; thao tác chỉ đổi tên, còn canvas, lớp, ảnh nền và thiết kế giữ nguyên. Cấu hình lớp, ảnh nền, URL và nội dung thiết kế bị lọc.
- Mẫu cộng đồng: xem theo tên, chia sẻ/ngừng chia sẻ mẫu do chính người dùng tạo sau xác nhận, hoặc sao chép mẫu đang công khai vào doanh nghiệp. Cấu hình ảnh/lớp và ID nội bộ không trả về chat.
- Danh sách từng ảnh trong lượt tạo hàng loạt vẫn bị khóa vì chứa giá trị đầu vào, URL kết quả và lỗi theo dòng; dùng trang chi tiết tổng hợp để kiểm tra tiến độ.

- Nội dung marketing: xem chi tiết theo tiêu đề; tạo, sửa và xóa bản nháp độc lập qua các route `/marketing-contents/assistant/drafts`. Trợ lý chỉ sửa/xóa bản nháp chưa lên lịch, chưa gắn Campaign và chưa đăng; chỉ sửa các trường văn bản được cho phép, giữ nguyên kênh, giới hạn caption TikTok 2.200 ký tự và yêu cầu xác nhận cho mọi thao tác ghi. Các route tổng quát `POST /marketing-contents`, `PATCH /marketing-contents/:id` và `DELETE /marketing-contents/:id` vẫn bị khóa vì payload rộng có thể thay đổi lịch hoặc liên kết Campaign.
- Tạo, cập nhật và hủy chi nhánh đang chờ thiết lập chủ theo mã/tên; yêu cầu `access:manage` và xác nhận, giới hạn theo công ty hiện tại. Chỉ admin được hủy và API từ chối nếu chi nhánh đã có chủ. Kết quả chỉ hiện thông tin cơ bản; gán chủ chi nhánh, mật khẩu, vị trí và IP chấm công vẫn dùng luồng riêng.
- Phòng ban: danh sách hiển thị trưởng phòng, trạng thái, thứ tự và số nhân sự; chọn trưởng phòng theo tên nhân sự cùng công ty. Cập nhật metadata giữ nguyên tên hiện tại; xóa cần xác nhận và sẽ bỏ gán phòng ban của nhân viên đang thuộc phòng đó.
- SMTP công ty: xem cấu hình máy chủ, tài khoản và địa chỉ gửi cùng trạng thái mật khẩu đã lưu; kiểm tra kết nối hoặc gửi email thử đến địa chỉ tài khoản hiện tại sau xác nhận. Kết quả không trả mật khẩu hay mã thư; lưu/cập nhật cấu hình cần dùng giao diện có trường mật khẩu được che.
- Xem tổng hợp tối đa 200 email chúc mừng sinh nhật/ngày lễ gần nhất theo trạng thái với `settings:manage`; chỉ trả tổng lượt, số đã gửi/lỗi/đang chờ/bỏ qua, không trả email, tiêu đề, nội dung hay lỗi kỹ thuật từng người. Xem tóm tắt cấu hình cùng quyền, chỉ gồm trạng thái bật, giờ gửi và số ngày ngoại lệ; mẫu HTML, tiêu đề và token tải ảnh được loại bỏ. Xem trước mẫu email dùng thông tin tài khoản hiện tại; HTML hiển thị thành văn bản thuần, không lưu hoặc gửi thư.
- Ghi nhận VAT từ hóa đơn bán lẻ đã phát hành sau khi chọn chi nhánh tài chính; hóa đơn nguồn không bị thay đổi.
- Đảo phiếu xuất kho thủ công mục đích nội bộ/hủy; chặn phiếu bán, phiếu nguồn và phiếu đã đảo.
- Chuyển một IMEI/serial đang trong kho sang kho hoạt động khác trong cùng chi nhánh bằng tên/mã serial và tên kho nhận; tạo/nhận chứng từ trong một thao tác sau khi nêu lý do và xác nhận. Điều chuyển khác chi nhánh dùng luồng gửi/nhận hiện có; kết quả không hiển thị ID nội bộ.
- Hoàn tác một phiên bản Content Sheet theo tên chiến dịch và số phiên bản nền/thời điểm; chỉ phiên bản có thay đổi, chưa phải bản ghi hoàn tác, thuộc chiến dịch đã chọn mới được chọn. Cần `marketing:post` và xác nhận; API chặn hoàn tác lặp, kết quả chỉ có số dòng đã khôi phục và số xung đột.
- Xóa mềm tối đa 20 hồ sơ lao động theo tên; yêu cầu `people:manage`, đúng phạm vi công ty/chi nhánh và xác nhận.
- Đảo khoản thu hoặc điều chỉnh phải thu chưa bị đảo; chỉ áp dụng khi khoản phải thu còn hiệu lực, có lý do, xác nhận và khóa chống trùng. Trợ lý không cho chọn bút toán khác loại hoặc bút toán đã đảo.
- Xem trạng thái Telegram của tài khoản đang đăng nhập, tạo mã liên kết có hạn hoặc hủy liên kết hiện tại và tạo mã mới; yêu cầu `social-integration:read/manage`, xác nhận thao tác ghi và chỉ hiện mã mới, không hiện Telegram ID.
- Tra cứu trạng thái kho tri thức qua `GET /gemini/knowledge-health`; chỉ trả số liệu tổng hợp, chủ đề và cảnh báo, không trả nội dung tài liệu, mã công ty, lịch sử trả lời hay chi tiết mâu thuẫn.
- Xóa toàn bộ tài liệu, mảnh tri thức và FAQ của công ty qua `POST /gemini/clear-knowledge`; yêu cầu `company-knowledge:manage`, xác nhận rõ và kết quả chỉ báo hoàn tất.
- Workflow hội thoại Page Facebook: xem các phiên bản theo tên Page; yêu cầu AI đề xuất câu hỏi sau xác nhận; tạo bản nháp gồm mục tiêu, 1–12 trường và lời kết; kích hoạt bản nháp đã chọn theo mục tiêu/phiên bản/trạng thái sau xác nhận. Chỉ Page Facebook đang kết nối trong công ty được chọn. Bản nháp chưa tác động đến khách; kích hoạt sẽ thay luồng đang hoạt động. Kết quả không đưa ID Page/tài liệu hay metadata nội bộ vào hội thoại.
- Thông báo cá nhân: tra cứu theo loại/trạng thái, chọn một mục theo tiêu đề và thời điểm để đánh dấu đã đọc hoặc xóa, hoặc đánh dấu toàn bộ đã đọc. API giới hạn đúng người nhận; các thao tác ghi cần xác nhận và không trả recipient ID, action nội bộ hay metadata.
- Cập nhật lĩnh vực đào tạo của tài khoản đang đăng nhập qua `PATCH /auth/business-settings`; nhận một giá trị hợp lệ, yêu cầu `people:manage` và xác nhận, đồng thời lọc thông tin ngân hàng khỏi kết quả.
- Tạo liên kết đánh giá cho phiếu sửa chữa đã hoàn tất qua `POST /repair/tickets/:id/feedback-qr`; phân giải phiếu theo tên/mã và chi nhánh, yêu cầu `repair:manage` cùng xác nhận. Kết quả chỉ trả mã phiếu và liên kết công khai; không gửi cho khách.
- Tra cứu thiết bị đã bán qua `POST /repair/tickets/lookup-device` bằng IMEI, số sê-ri hoặc mã vạch; yêu cầu `repair:manage` và chọn chi nhánh tiếp nhận. Kết quả chỉ gồm mã thiết bị, đơn bán, tên/mã khách hàng và trạng thái hạn bảo hành; số điện thoại, ID nội bộ và hồ sơ serial thô bị loại bỏ. Đây là truy vấn chỉ đọc nên không yêu cầu xác nhận.
- Gửi một email qua `POST /send-email`; yêu cầu `people:manage`, một địa chỉ nhận, tiêu đề và nội dung có giới hạn, rồi xác nhận bản xem trước. Không cung cấp chế độ kiểm tra SMTP cho trợ lý, không lưu nội dung email trong kết quả hội thoại và không tự gửi lại khi kết quả chưa rõ.
- Cập nhật riêng một trường cấu hình tiêu chuẩn qua `PUT /student-management/standard-fields/:moduleKey`, chọn phân hệ và trường bằng tên hiển thị. Trợ lý đọc cấu hình hiện tại, chỉ thay trường được chọn và giữ nguyên các trường còn lại; cần `settings:manage` và `settings:read`, xác nhận trước khi lưu. Nếu danh sách cấu hình thiếu, trùng, sai định dạng hoặc trường không xác định duy nhất thì dừng; khi ẩn trường, hệ thống cũng bỏ trạng thái bắt buộc.
- Cập nhật hạn bảo hành khách hàng/nhà cung cấp qua `PATCH /retail/warranty/serial/by-code/:code`; yêu cầu `retail:manage`, IMEI/sê-ri/mã vạch duy nhất trong công ty và chi nhánh đã chọn, ngày bắt đầu, số tháng nguyên từ 0 đến 1200 và xác nhận. ID nội bộ không cần nhập; mã trùng bị từ chối và kết quả chỉ trả các trường thiết bị cùng thời hạn vừa cập nhật.
- Đồng bộ lịch nghỉ lễ Việt Nam đã duyệt cho năm 2026, tạo ngày nghỉ/nghỉ bù/ngày làm việc bù trong lịch công ty và cập nhật ngày theo tên hoặc ngày; chỉ admin/superadmin có `timekeeping:manage` và mỗi thay đổi cần xác nhận. Đồng bộ giữ các ngày thủ công và trạng thái bật/tắt; ngày hệ thống chỉ cho bật/tắt, tắt cần lý do; ngày do quản trị viên tạo có thể đổi nội dung. Xung đột ngày nghỉ và ngày làm việc bù bị API từ chối.
- Nhắc công nợ bán lẻ: chạy lượt nhắc cho chi nhánh được chọn theo tên sau xác nhận; xem lịch sử và thống kê delivery theo lượt chạy. Kết quả chỉ có ngày, trạng thái và số lượng tổng hợp, không hiển thị người nhận, email, nội dung nhắc hoặc mã nội bộ.
- Google Drive cá nhân: liệt kê tệp/thư mục của tài khoản đang đăng nhập, mở thư mục theo tên, đổi tên mục đã chọn hoặc chuyển tệp (không chuyển thư mục) từ thư mục gốc vào thư mục cá nhân đã chọn theo tên sau xác nhận; kết quả chỉ trả tên, loại, kích thước và ngày tạo. Drive nhóm, link chia sẻ, mã Drive và tài khoản khác không được đưa vào hội thoại.
- Chiến dịch email lễ/tết: tạo bản nháp tắt, tra cứu theo tên/ngày, bật hoặc tắt trạng thái riêng sau xác nhận, hoặc xóa chiến dịch đã chọn theo tên. Nội dung HTML không xuất hiện trong kết quả; bật chiến dịch có thể gửi email vào ngày đã đặt.
- Tạo ảnh hàng loạt: tra cứu tối đa 50 lượt gần nhất trong doanh nghiệp theo mẫu và tiến độ; chỉ hiện trạng thái, số ảnh thành công/thất bại và thời điểm, không trả dữ liệu ảnh, URL, mã lượt, người tạo hoặc lỗi kỹ thuật.
- Điểm danh trực tuyến: gửi mã dùng một lần, hiệu lực 5 phút, qua email cho học viên đủ điều kiện trong lớp và ngày đã chọn theo tên; thao tác cần xác nhận, mã/email không xuất hiện trong kết quả và yêu cầu không tự chạy lại khi chưa rõ kết quả.
- Tạo gợi ý chủ đề, trụ cột nội dung, ý tưởng chiến dịch, bản nháp bài đăng chỉ văn bản, tối ưu lời thoại và prompt ảnh qua các route `/gemini/marketing-*` và `/gemini/optimize-*`; yêu cầu `marketing:manage` và xác nhận trước thao tác có thể dùng số dư AI. Gợi ý chủ đề tính phí kể cả khi dùng nội dung dự phòng. Các bản nháp không tự lưu, đăng bài, tạo ảnh hay phát sinh tệp âm thanh; kết quả đã lọc ID, URL và thông tin mô hình nội bộ.
- Xem tối đa 100 nhật ký phản hồi AI gần đây và đánh giá phản hồi đã chọn theo kênh/thời điểm qua `/gemini/ai-reply-logs`; đọc cần `omni-inbox:read`, cập nhật cần `omni-inbox:manage` và xác nhận. Kết quả chỉ hiện kênh, trạng thái, đánh giá và thời điểm; nội dung khách hàng, câu trả lời AI, ngữ cảnh và ghi chú nội bộ không được đưa vào chat.
- Tra hội thoại Facebook, Zalo và TikTok gần đây của tài khoản đang đăng nhập; cả ba cần `omni-inbox:read`. Kết quả chỉ hiện kênh, tên khách, thời điểm hoạt động, số tin chưa đọc, trạng thái và dấu VIP; không đồng bộ nền, đọc nội dung tin nhắn hay đưa mã người nhận/tài khoản và trạng thái AI vào chat.
- Xem tối đa 50 mục lịch sử ảnh/giọng đọc của tài khoản đang đăng nhập qua `/gemini/media-history`; yêu cầu `marketing:read`. Chỉ hiện tiêu đề, loại tệp, giọng đọc, thời lượng, thời điểm và liên kết Cloudinary hợp lệ; prompt, ID tài khoản và metadata nhà cung cấp bị lọc. Video không được gọi vì API GET có thể đồng bộ job, tải tệp và cập nhật dữ liệu.
- Xóa mục lịch sử ảnh/giọng đọc đã chọn bằng tên/thời điểm qua `DELETE /gemini/media-history/:id`; yêu cầu `marketing:manage` và xác nhận. Chỉ xóa bản ghi lịch sử trong ứng dụng, không xóa tệp Cloudinary.
- Tra danh sách voice và model ElevenLabs bằng `marketing:read`, rồi tạo giọng đọc bằng tên voice/model và tối đa 5.000 ký tự qua `POST /elevenlabs/generate-voice`; yêu cầu `marketing:manage` và xác nhận trước khi dùng số dư AI. Chat chỉ nhận tên/mô tả model, tên/nhóm voice, số ký tự, thời lượng và liên kết Cloudinary; mã provider, khóa và metadata kỹ thuật không được trả về.
- Tra cứu dữ liệu đầu vào kỳ lương và cập nhật lương thỏa thuận, ngày/giờ công đối soát, phụ cấp, thưởng hoặc khấu trừ cho một nhân viên theo tên/chi nhánh. Cần quyền quản lý lương và quyền xem nhân sự; ghi lý do, xác nhận và kiểm tra phiên bản hiện tại. Kỳ đã khóa bị API từ chối; ID nhân viên, người sửa và nội dung kiểm toán không xuất hiện trong kết quả chat.
- Tra cứu các khoản lương ghi đè thủ công theo kỳ, tên nhân viên và chi nhánh. Có thể ghi đè tối đa 20 nhân viên trong một lượt nháp, với các trường lương được API cho phép, biến tùy chỉnh đang hoạt động hoặc khôi phục về giá trị hệ thống. Mỗi dòng cần cùng một lý do; số 0 là giá trị ghi đè. Hệ thống tự kiểm tra phiên bản, nhân viên thuộc lượt, quyền và trạng thái nháp; kết quả chỉ liệt kê tên, trường đã đổi và trạng thái từng dòng, không trả ID hay nhật ký kiểm toán.
- Tạo bản nháp lượt chạy lương định kỳ cho kỳ và chi nhánh đã chọn; ngày đầu/cuối kỳ do hệ thống tự tính, lượt bị từ chối nếu chồng lấn ngày với lượt định kỳ khác. Thao tác không tính lương, khóa công hay phát hành phiếu; cần quyền quản lý lương và xác nhận.
- Tra cứu lượt chạy lương theo kỳ/loại/trạng thái trong chi nhánh; kết quả chat không hiển thị ID hay phiên bản nội bộ, dùng các giá trị này để chọn lượt cho thao tác tiếp theo.
- Đồng bộ công đã duyệt vào lượt lương được chọn theo kỳ/loại/trạng thái; hệ thống tự lấy phiên bản, dùng mã xác nhận làm khóa chống lặp, bắt buộc xác nhận và chỉ trả trạng thái, số nhân viên cùng số lỗi chặn.
- Khóa snapshot công của lượt đã đồng bộ; chỉ cho khóa lượt nháp còn đúng phiên bản và không có lỗi chặn. Kết quả chỉ hiển thị kỳ, thời điểm khóa và số nhân viên, không trả snapshot chi tiết.
- Tính hoặc tính lại lương trên lượt còn nháp sau khi khóa snapshot công; dùng phiên bản hiện tại và mã chống lặp, yêu cầu xác nhận. Chat chỉ hiển thị lần tính, trạng thái, số nhân viên, lỗi chặn và cảnh báo; không hiển thị dòng lương hay tổng tiền.
- Chuyển lượt lương nháp sang chờ duyệt qua `POST /payroll/runs/:id/review`; cần `payroll-period:manage`, không được có lỗi chặn hoặc vấn đề đối soát, còn phiên bản do hệ thống tự lấy và xác nhận trước khi ghi.
- Chốt lượt đã duyệt qua `POST /payroll/runs/:id/close`; cần `payroll-period:manage`, lần tính hiện hành phải hoàn tất và checksum hợp lệ. Kết quả chỉ hiện kỳ/trạng thái/thời điểm chốt; thao tác không phát hành phiếu lương hay chuyển tiền.
- Mở lại lượt đang duyệt hoặc đã chốt qua `POST /payroll/runs/:id/reopen`; cần `payroll-period:manage`, lý do bắt buộc và xác nhận. API từ chối khi có khoản thanh toán đã xác nhận hoặc lượt đã thanh toán.
- Đánh dấu lượt đã thanh toán qua `POST /payroll/runs/:id/mark-paid`; cần `payroll-payment:manage`, lý do xác nhận khoản chi thực tế đã thực hiện và xác nhận thao tác. Đây chỉ là cập nhật trạng thái, không thực hiện chuyển tiền; kết quả không chứa dữ liệu lương chi tiết.
- Tra cứu các đợt thanh toán của lượt lương đã chọn theo kỳ và chi nhánh; cần `payroll-payment:read`. Chat chỉ hiển thị tổng tiền, trạng thái, ngày thanh toán, thời điểm tạo và số nhân viên; mã thanh toán, dòng nhân viên, bằng chứng và ghi chú tự do bị loại bỏ.
- Tạo một đợt thanh toán nháp trong lượt đã chốt; cần quyền quản lý thanh toán, tra cứu lượt lương và nhân sự. Chọn nhân viên theo tên, phân bổ số nguyên VND khớp tổng và không vượt phần còn phải trả; yêu cầu xác nhận và khóa chống ghi trùng. Đây chỉ là kế hoạch phân bổ, không chuyển tiền.
- Hủy đợt thanh toán nháp theo lượt lương, tổng tiền, trạng thái và ngày; cần lý do cùng xác nhận. Chỉ hủy trạng thái nháp, giải phóng phần phân bổ và không chuyển tiền.
- Xác nhận thanh toán chỉ sau khi chuyển tiền thực tế bên ngoài hệ thống; cần ngày chuyển và ghi chú đã đối chiếu. Chỉ cho đợt nháp trong lượt đã chốt; API không gửi lệnh ngân hàng.
- Đảo đợt đã xác nhận trong lượt đang chốt hoặc đã thanh toán; yêu cầu lý do và xác nhận. Thao tác cập nhật sổ thanh toán, không thu hồi tiền từ ngân hàng. Cả ba thao tác đều phân giải lượt theo kỳ, chi nhánh theo tên và đợt theo tổng tiền/trạng thái/ngày; kết quả không lộ ID, dòng nhân viên, ghi chú hay bằng chứng.

- Xem dòng lương của một nhân viên theo tên trong lượt đã chọn qua GET /payroll/runs/:id/lines/:employeeId; yêu cầu quyền kỳ lương, thanh toán lương và nhân sự. Quản trị viên chưa gắn chi nhánh phải chọn chi nhánh bằng tên; trợ lý chỉ trả tổng thu nhập, khấu trừ và thực nhận, không đưa mã nhân viên, tài khoản ngân hàng, công thức hay phiên bản nội bộ vào chat.
- Tra trạng thái đối soát của lượt đã chọn theo tên nhân viên; kết quả cho biết đã xác nhận chưa, dữ liệu có cần phát hành lại không và khoản nào còn khiếu nại. Nội dung trao đổi, chi tiết số tiền, mã khiếu nại, ID nhân viên và snapshot không hiển thị.
- Phát hành bản lương tạm tính cho nhân viên trong lượt đã chọn; yêu cầu `payroll-period:manage`, chi nhánh được chọn theo tên, phiên bản hiện hành, lượt nháp không có lỗi chặn và xác nhận. Kết quả chỉ trả số nhân viên; thao tác không duyệt, chốt hay thanh toán lương.
- Thu hồi phiếu lương đã công bố cho một nhân viên theo tên trong lượt đã chọn; yêu cầu xác nhận cùng quyền quản lý thanh toán, tra cứu kỳ lương và nhân sự. Kết quả chỉ trả trạng thái thu hồi, không hiển thị mã nhân viên, lượt lương hay checksum.
- Kế toán trả lời hoặc đánh dấu đã xử lý khiếu nại đang mở cho nhân viên được chọn theo tên trong lượt lương; cần `payroll-period:manage` cùng quyền đọc nhân sự, nêu khoản lương và nội dung xử lý. Trợ lý xác minh đúng một khiếu nại còn mở, tự lấy phiên bản và mã khiếu nại, yêu cầu xác nhận rồi chỉ trả tên, kỳ, thao tác và số khiếu nại còn lại.
- Kế toán xem yêu cầu kiểm tra phiếu lương theo lượt đã chọn, rồi phản hồi yêu cầu đang mở theo tên nhân viên/kỳ/trạng thái. Cần `payroll-period:read` để xem và `payroll-period:manage` cùng nội dung phản hồi để xử lý; thao tác yêu cầu xác nhận, còn ID yêu cầu, mã nhân viên, mã phiên bản và dữ liệu kiểm toán không xuất hiện trong chat.
- Xem lỗi và cảnh báo của lượt lương đã chọn; kết quả chỉ gồm mã lỗi, trường liên quan, mức độ, mô tả và cách xử lý. ID lượt lương, nhân viên và dữ liệu kỹ thuật bị loại bỏ.

Các thao tác trên chỉ trả trường kết quả đã cho phép và giữ ID nội bộ ngoài nội dung chat.

## Kiểm thử

Ngày 2026-11-01: khóa rõ 5 route payload động/nhạy cảm (publish Facebook tổng quát, xác thực token mạng xã hội và thay toàn bộ danh sách chia sẻ). Catalog: 812/1.126 route đã nối, 154 đang chờ rà soát, 160 chủ ý chưa nối; 519 test trong 7 tệp trợ lý và `npm run typecheck` đạt.

Ngày 2026-11-01: rà soát và ghi lý do cho 30 route không có quyền tường minh; các luồng xác thực, tích hợp, tệp/media, thiết bị điểm danh, phiếu lương HTML, telemetry và phản hồi public-token không được gọi như thao tác nghiệp vụ. Catalog hiện có 812/1.126 route đã nối, 159 đang chờ rà soát, 155 chủ ý chưa nối. Test expanded-catalog đạt 160 test; xác minh lại toàn bộ suite và typecheck.

Ngày 2026-11-01: rà soát 9 route trùng đường dẫn của OAuth, webhook thanh toán, auth, VietQR và chat tổng quát; ghi lý do không dùng trong workflow nghiệp vụ. Catalog: 812/1.126 route đã nối, 189 đang chờ rà soát, 125 chủ ý chưa nối. Test expanded-catalog đạt 159 test; xác minh lại toàn bộ suite và typecheck.

Ngày 2026-11-01: rà soát và ghi lý do cho 29 route thiếu hợp đồng ghi thuộc các luồng render hàng loạt, timeline caption, payroll, điểm danh cả lớp, khôi phục/in POS và gửi marketing. Catalog hiện có 812/1.126 route đã nối, 198 đang chờ rà soát, 116 chủ ý chưa nối; không còn route động chưa phân giải. 516 test trong 7 tệp trợ lý và `npm run typecheck` đạt.

Ngày 2026-11-01: xác minh gợi ý và phân giải quan hệ theo tên/mã khi tạo hoặc sửa, gồm phòng ban nhân sự, danh mục sản phẩm, bản ghi phụ thuộc và tên trùng; lựa chọn hiển thị không chứa ID nội bộ. 515 test trong 7 tệp trợ lý và `npm run typecheck` đạt. Build catalog: 812/1.126 route đã nối, 227 đang chờ rà soát, 87 chủ ý chưa nối; không có route động chưa phân giải. Chưa chạy live LLM hoặc ghi dữ liệu production.

Ngày 2026-11-01: thêm xem hồ sơ cơ bản và tiến độ học tập của học viên theo tên/số điện thoại/email; kiểm thử xử lý trùng tên bằng lựa chọn có số điện thoại, chiếu kết quả an toàn và tóm tắt chuyên cần/bài tập/khóa học. 3 tệp kiểm thử trợ lý đạt 395 test; `npm run typecheck`, inventory và bộ sinh catalog đạt. Xóa trực tiếp vẫn bị khóa để giữ bước xem trước ảnh hưởng.

Ngày 2026-10-31: 8 tệp kiểm thử catalog trợ lý, executor, formatter kết quả và API/service payroll đạt (322 test); `npm run typecheck` và bộ sinh coverage đạt. Chưa chạy live LLM hoặc thao tác trên dữ liệu production.

Ngày 2026-11-01: kiểm thử catalog và executor đạt (331 test trong 2 tệp); `npm run typecheck` và bộ sinh coverage đạt. Chưa chạy live LLM hoặc ghi dữ liệu production.

Ngày 2026-11-01: kiểm thử catalog và executor đạt (342 test trong 2 tệp); `npm run typecheck` và bộ sinh coverage đạt. Bổ sung xác nhận/hủy/đảo đợt thanh toán lương với scope chi nhánh admin và xác minh trạng thái trước khi ghi. Chưa chạy live LLM hoặc ghi dữ liệu production.

Ngày 2026-11-01: bổ sung ghi đè khoản lương theo tên nhân viên, lọc kết quả tra cứu thanh toán và tạo đợt thanh toán nháp. 3 tệp kiểm thử trợ lý đạt (365 test); typecheck và bộ sinh coverage đạt. Chưa chạy live LLM hoặc ghi dữ liệu production.

Ngày 2026-11-01: các quan hệ dữ liệu tạo/sửa được đề xuất theo tên/mã và phải được chọn rõ ràng; workflow không thể đặt mặc định quan hệ. Tạo/sửa nhân sự đã kiểm tra với API thật trong test và danh mục sản phẩm đã kiểm tra danh sách danh mục có lọc trạng thái. Tệp Drive cá nhân được phép di chuyển vào thư mục đã chọn theo tên sau xác nhận. 5 tệp kiểm thử trợ lý đạt (396 test); `npm run typecheck` đạt. Chưa chạy live LLM hoặc ghi dữ liệu production.

Ngày 2026-11-01: bổ sung workflow dự án phụ đề video để tra cứu theo tên, tạo bản nháp không tự chạy AI, cập nhật và chọn liên kết nội dung/chiến dịch theo tên. 5 tệp kiểm thử trợ lý đạt (407 test); `npm run typecheck`, inventory và bộ sinh catalog đạt. Các thao tác xử lý video, job và tệp vẫn khóa trong chat.

Ngày 2026-11-01: thêm lựa chọn roster theo tên/số điện thoại và cập nhật trạng thái điểm danh của một học viên, giữ nguyên các bản ghi khác và giới hạn theo lớp. Service test xác nhận từ chối học viên không thuộc roster và giữ nguyên bản ghi khác; 7 tệp kiểm thử trợ lý/điểm danh đạt (413 test). `npm run typecheck`, inventory và bộ sinh catalog đạt.

Ngày 2026-11-01: thêm endpoint danh sách chặng lộ trình theo khóa học, giới hạn theo lộ trình đang hoạt động và phạm vi công ty/chi nhánh; trợ lý đề xuất lộ trình/chặng/khóa học/giảng viên theo tên khi tạo hoặc sửa lớp. Thêm kiểm thử phân giải lựa chọn phụ thuộc và xác nhận các thao tác gán học viên/điểm kỳ thi chưa an toàn vẫn khóa. 400 test trong 4 tệp đạt; `npm run typecheck`, inventory và bộ sinh catalog đạt.

Ngày 2026-11-01: thêm xem danh sách/chi tiết mẫu thiết kế và trạng thái job theo tên, hủy lượt đang chạy và thử lại riêng ảnh lỗi; lựa chọn theo tên mẫu/trạng thái/tiến độ/thời điểm, yêu cầu xác nhận và lọc dữ liệu đầu ra. Danh sách ảnh từng dòng tiếp tục bị khóa vì có giá trị đầu vào và URL kết quả. Hồi quy liên kết tên và thao tác đạt (393 test trong 3 tệp); `npm run typecheck`, inventory và bộ sinh catalog đạt.

Ngày 2026-11-01: bổ sung gợi ý danh mục khóa học, phòng ban, người quản lý tài sản và nhà cung cấp khi tạo/sửa dữ liệu liên quan. Nối chuyển Trưởng nhóm, đổi vai trò và gỡ thành viên chat theo tên phòng/thành viên; danh sách chỉ trả lựa chọn khi người gọi là Trưởng nhóm của phòng nhóm, giữ ID nội bộ ngoài kết quả. Thêm hủy/thử lại dự án phụ đề theo tên, yêu cầu xác nhận, lọc trạng thái và kết quả; thử lại cảnh báo khả năng phát sinh phí AI. Thêm xem mẫu cộng đồng, chia sẻ/ngừng chia sẻ mẫu của chính người dùng và sao chép mẫu công khai theo tên sau xác nhận. Với đơn bán lẻ, đề xuất mã ưu đãi theo tên khách hàng và chi nhánh qua endpoint chỉ đọc; liên kết được phân giải thành mã ưu đãi nội bộ trước khi ghi. 3 tệp kiểm thử trợ lý đạt 430 test; `npm run typecheck` và bộ sinh catalog đạt. Kiểm tra bổ sung xác nhận gợi ý liên kết con có thể dùng bản ghi cha ở path, như chọn lớp trước khi gợi ý học viên. Coverage hiện nối 789/1.118 route, còn 329 route đang khóa để rà soát quyền, tích hợp và rủi ro nghiệp vụ. Chưa chạy live LLM hoặc ghi dữ liệu production.

Ngày 2026-11-01: thêm roster học viên đang gán riêng cho kỳ thi để gỡ một học viên theo tên/số điện thoại; endpoint chỉ liệt kê học viên có `examId` khớp và giữ học phí/mã nội bộ ngoài kết quả. Ghi điểm hàng loạt/kết quả và gỡ học viên đều yêu cầu xác nhận. Gỡ cũng xóa mục lịch sử kỳ thi và đặt trạng thái học viên về “Đang học”; tác động này phải nêu rõ trước khi xác nhận. Kiểm thử catalog xác nhận mọi trường liên kết ID trong body, kể cả JSON lồng nhau, đều cần danh sách tham chiếu theo tên; chỉ miễn trừ mã số thuế và ngữ cảnh phiên/thiết bị POS. Gán học viên mới vẫn khóa do API chưa xác minh điều kiện ghi danh. 5 tệp kiểm thử liên quan đạt 439 test; `npm run typecheck`, inventory và bộ sinh catalog đạt. Coverage nối 794/1.120 route, còn 326 route chờ rà soát. Chưa chạy live LLM hoặc ghi dữ liệu production.

Ngày 2026-11-01: mở workflow gán học viên vào kỳ thi theo tên/số điện thoại. Trợ lý chỉ gợi ý học viên thuộc lớp của kỳ thi, đã đóng đủ học phí và chưa có kỳ thi hiện hành; thao tác yêu cầu xác nhận, máy chủ kiểm tra lại toàn bộ điều kiện và ghi lịch sử học viên cùng danh sách thí sinh trong một giao dịch. Gợi ý không trả học phí hoặc ID nội bộ. 5 tệp kiểm thử liên quan đạt 447 test; `npm run typecheck`, inventory và bộ sinh catalog đạt. Coverage nối 796/1.121 route, còn 325 route chờ rà soát. Chưa chạy live LLM hoặc ghi dữ liệu production.

Ngày 2026-11-01: kiểm tra hồi quy việc gợi ý/giải quyết quan hệ theo tên khi tạo hoặc sửa, bao gồm phòng ban, danh mục sản phẩm và dữ liệu liên kết lồng nhau; nếu người dùng yêu cầu liên kết mà không có lựa chọn hợp lệ thì thao tác dừng. Nối tra danh mục quyền và vai trò trong công ty, cập nhật quyền theo tên với xác nhận; khóa thao tác danh mục quyền toàn hệ thống và xóa cấu hình vai trò. 474 test trong 4 tệp trợ lý, `npm run typecheck`, inventory (1.124 route API, 904 có quyền) và build catalog (807/1.125 đã nối, 317 chờ rà soát) đạt. Không ghi dữ liệu production.

Ngày 2026-11-01: bổ sung danh sách email nhắc công nợ bán lẻ có thể thử lại, chỉ gồm lỗi tạm thời còn lượt và có tên/email người nhận, mã đơn, tiêu đề/nội dung thư để kiểm tra. Thao tác thử lại yêu cầu xác nhận và cập nhật trạng thái nguyên tử; thông báo nội bộ, lỗi vĩnh viễn và email hết lượt bị loại khỏi danh sách. 148 test Vitest trong 2 tệp, 14 test `node:test`, `npm run typecheck`, inventory và bộ sinh catalog đạt. Coverage nối 798/1.122 route, còn 324 route chờ rà soát. Chưa chạy live LLM hoặc gửi email thực tế.

Ngày 2026-11-01: xác minh quy tắc chọn các trường liên kết theo tên cho workflow tạo/sửa, kể cả quan hệ phụ thuộc và JSON lồng nhau. Bộ test trợ lý đạt 442 test trong 4 tệp; 14 test `node:test` về nhắc nợ đạt. Email nhắc nợ thử lại hiển thị địa chỉ nhận, đơn hàng, tiêu đề và nội dung trước xác nhận; nếu nội dung thay đổi sau xem trước thì không xếp gửi. `npm run typecheck`, inventory (1.121 endpoint) và build catalog (798 route đã nối, 324 route chờ rà soát) đều đạt. Không gửi email thật hoặc ghi dữ liệu production.


Ngày 2026-11-01: mở workflow thử lại thông báo nhắc nợ nội bộ theo tên khách hàng/mã công nợ. Danh sách chỉ gồm lỗi tạm thời còn lượt, lọc theo chi nhánh và không gồm sự kiện Marketing gửi ra ngoài; bản xem trước hiện đúng tiêu đề/nội dung, xác nhận lại bị chặn nếu trạng thái đã đổi. 443 test Vitest trong 4 tệp, 14 test node:test, npm run typecheck, inventory và build catalog đạt; coverage 800/1.124 route, còn 324 route chờ rà soát. Không gửi thông báo/email production.

Ngày 2026-11-01: nối phân tích video, nhận dạng lời thoại, tạo caption ngữ cảnh và kết xuất từ dự án chọn theo tên. Cả bốn thao tác yêu cầu quyền marketing:post và xác nhận; kết xuất bắt buộc chọn xem trước hay bản cuối, kết quả chỉ trả trạng thái và không lộ mã job, provider hoặc chi phí. 439 test trong 3 tệp trợ lý và npm run typecheck đạt; catalog 794 hợp đồng + 19 adapter = 813 route đã nối, còn 313 route chờ rà soát.

Ngày 2026-11-01: nối thao tác bỏ đề xuất AI của order và sửa/đăng ngay slot chiến dịch theo tham chiếu người dùng chọn bằng tên; gợi ý slot được giới hạn theo lịch, trạng thái và nền tảng, ghi dữ liệu cần xác nhận. Thay ảnh slot tiếp tục chờ vì yêu cầu upload byte ảnh. Catalog hiện có 793 hợp đồng + 19 adapter = 812 route đã nối, còn 314 route chờ rà soát.

Ngày 2026-11-01: sửa nhãn quan hệ FAQ/Content Sheet để chọn theo thông tin dễ nhận biết, đồng thời không cho chọn FAQ đã duyệt hoặc revision đã hoàn tác khi bỏ qua/hoàn tác. Gợi ý và phân giải lựa chọn dùng cùng nhãn; kết quả đọc dùng nhãn trường tiếng Việt. 492 test trong 4 tệp trợ lý và `npm run typecheck` đạt. Coverage hiện tại không đổi: 812/1.126 route đã nối, 314 route đang chờ rà soát.



Ngày 2026-11-02: hoàn tất đánh giá 154 route cuối còn chờ. Các thao tác bảo mật, tích hợp, tệp, QR/khuôn mặt, token công khai, quản trị tenant và CRUD động được ghi rõ lý do chưa mở; catalog còn 812/1.126 route đã nối, 0 chờ rà soát và 314 chủ ý chưa nối. Các liên kết khi tạo được đề xuất bằng tên/mã; khi sửa chỉ hỏi liên kết người dùng muốn đổi.

Ngày 2026-11-02: báo cáo route chưa hỗ trợ hiện ghi lý do cạnh từng method/path và vị trí route nguồn; kiểm thử xác nhận đủ 314 route đều có dòng giải thích. Build catalog: 812 route nối, 0 chờ rà soát, 314 chủ ý chưa nối; 520 test trợ lý và typecheck đạt.
