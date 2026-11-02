# Module mã ưu đãi bán lẻ

## Khảo sát và lựa chọn tích hợp

Luồng bán lẻ hiện có: POS → báo giá tại server → lưu đơn nháp → xác nhận đơn trong MongoDB transaction → xuất kho, hóa đơn và sự kiện kế toán. Module mới dùng chung luồng này để giảm giá phản ánh vào thuế, công nợ, hóa đơn và báo cáo qua `orderDiscount`; không phát sinh cơ chế thanh toán riêng.

## Phạm vi bản đầu

- Màn hình Bán lẻ → Mã ưu đãi. Quyền `retail:manage` theo cơ chế hiện hành; quyền này hiện cũng cấp cho người vận hành POS.
- Dữ liệu độc lập theo công ty và chi nhánh. Mã duy nhất trong chi nhánh, chuẩn hóa chữ hoa; không đổi mã sau khi tạo.
- Tạo/sửa tên, loại giảm theo tiền hoặc phần trăm, đơn tối thiểu, trần giảm, thời gian bắt đầu/kết thúc, tổng lượt sử dụng và trạng thái bật/tắt. Để trống trần giảm hoặc lượt sử dụng nghĩa là không giới hạn.
- Không xóa mã để giữ tham chiếu lịch sử; tắt mã bằng trường Cho phép sử dụng trong màn hình sửa.
- Một mã mỗi đơn, không cộng dồn giảm thủ công ở dòng hoặc đơn. Giảm trên tiền hàng trước thuế, không giảm phí giao hàng; vẫn kiểm tra hạn mức giảm giá chi nhánh.
- Bắt đầu có hiệu lực tại `startsAt`, hết hiệu lực ngay tại `endsAt`. Giao diện nhập giờ địa phương, API lưu thời điểm ISO.
- Báo giá và giữ đơn không giữ lượt. Xác nhận đơn kiểm tra lại điều kiện hiện tại; cập nhật bộ đếm cùng transaction xuất kho và tạo hóa đơn. Cạnh tranh lượt cuối không được vượt hạn mức; giao dịch thất bại không mất lượt.
- Hủy toàn bộ đơn đã xác nhận hoàn một lượt cho mã dùng chung cùng transaction hủy đơn. Mã riêng theo khách không hoàn lượt khi hủy. Đổi/trả sau bán không tự hoàn lượt. Số lượt hiển thị là lượt đang được sử dụng, không phải số lần áp dụng tích lũy.
- Đơn lưu mã và snapshot tên, mức giảm thực tế, phiên bản. Sửa chương trình không thay đổi đơn đã xác nhận. Đơn nháp phải kiểm tra lại khi thanh toán; dữ liệu offline cũng qua server khi đồng bộ.
- Cập nhật chương trình dùng phiên bản để tránh ghi đè thay đổi từ màn hình khác. Không thể hạ giới hạn xuống dưới số lượt đang dùng.

## API

`GET /api/v1/retail/coupons?page=1`, `POST /api/v1/retail/coupons`, `PUT /api/v1/retail/coupons/:id`, cùng query scope `companyCode`, `branchId`. PUT yêu cầu `version` hiện tại. Danh sách phân trang 20 mã.

Các API báo giá/tạo/sửa đơn nhận thêm `couponCode`. Giá trị giảm và snapshot do server tính, không lấy từ client. Xóa nội dung ô mã và lưu lại đơn sẽ gỡ mã.

## Vận hành

Không cần backfill đơn cũ. Collection `retailcoupons` có unique index `(companyCode, branchId, code)`; môi trường tắt tự tạo index cần tạo index trước khi sử dụng. MongoDB replica set là điều kiện của giao dịch bán lẻ hiện có. Chưa triển khai lên môi trường chạy thật.

## Mở rộng sau

Đã có mã riêng theo khách và cấp mã sinh nhật tự động. Chưa bao gồm áp dụng theo SKU/danh mục, phát mã hàng loạt theo chiến dịch khác, gửi mã qua marketing, hoặc phân quyền quản lý ưu đãi riêng. Các nội dung này cần chốt nghiệp vụ trước khi mở rộng.

## Điều kiện hạng khách hàng

Trường customerTierCodes lưu danh sách mã hạng lấy từ cài đặt module Khách hàng của công ty. Danh sách rỗng hoặc mã cũ chưa có trường này nghĩa là tất cả khách hàng. Giao diện cho phép chọn nhiều hạng; không tự bao gồm hạng cao hơn. API GET /api/v1/retail/coupons/tiers cung cấp danh sách cho người có quyền quản lý mã.

Khi báo giá, lưu đơn nháp và xác nhận đơn, server đọc hạng hiện tại trên hồ sơ khách hàng đang hoạt động trong cùng công ty. Khi xác nhận, hồ sơ được đọc trong transaction bán hàng. Mã giới hạn theo hạng yêu cầu chọn khách; không lấy hạng từ client và không tự nâng hạng dựa trên đơn đang thanh toán. Hạng đã bị xóa khỏi cài đặt phải được sửa lại trong chương trình ưu đãi trước khi dùng.

## Mã riêng theo khách và quà sinh nhật

- Khi tạo mã, bật **Dành riêng cho một khách hàng**, tìm và chọn người nhận. Server xác minh hồ sơ đang hoạt động trong cùng công ty, tự lấy tên/mã khách; bỏ qua tên do client gửi. Người nhận cố định sau khi tạo.
- Mã riêng bắt buộc `usageLimit = 1`. Người khác hoặc đơn chưa chọn khách không áp dụng được, kể cả biết mã. Kiểm tra quyền sở hữu khi báo giá, lưu nháp, xác nhận đơn, và trong cập nhật nguyên tử trừ lượt. Đơn thất bại rollback lượt; hủy đơn đã xác nhận không trả lượt cho mã riêng. Mã chung vẫn giữ cơ chế hoàn lượt cũ.
- Mã riêng có thể kèm điều kiện hạng, thời gian, đơn tối thiểu và trần giảm như mã chung. POS hiển thị mã còn hiệu lực/chưa dùng khi chọn khách, nhân viên chọn Áp dụng. Server vẫn kiểm tra tổng tiền, hạng hiện tại và hạn mức giảm của chi nhánh.
- Trong **Bán lẻ → Mã ưu đãi → Tự động tặng mã sinh nhật**, cấu hình riêng cho mỗi chi nhánh. Mặc định tắt; bản nháp mặc định giảm 10%, thời hạn 7 ngày, không có đơn tối thiểu hay trần giảm. Chỉ cấp sau khi người quản lý bật và lưu. Thời hạn cho phép 1–90 ngày, giảm theo tiền hoặc phần trăm.
- Dựa trên `Customer.dateOfBirth`, chỉ khách hoạt động. Một mã/khách/năm/chi nhánh, gắn người nhận, dùng một lần. Sinh ngày 29/2 nhận ngày 28/2 trong năm không nhuận. Thời gian hiệu lực từ 00:00 giờ Việt Nam ngày sinh nhật, hết hạn đúng 00:00 sau số ngày cấu hình.
- Scheduler chạy sau kết nối DB, ngay lúc khởi động và mỗi 5 phút, chỉ với công ty bật bán lẻ và chi nhánh hoạt động. Quét bù sinh nhật còn trong khoảng hiệu lực; không cấp mã đã hết hạn. POS cũng kiểm tra cấp quà khi truy vấn mã của khách. Chạy đồng thời/chạy lại không cấp trùng cùng năm. Đổi ngày sinh hoặc cấu hình không tạo thêm quà trong năm đã cấp.
- Thay đổi cấu hình chỉ áp dụng cho lần cấp mới. Tắt chương trình dừng cấp mới; mã đã tặng giữ điều kiện đã cấp, có thể tắt từng mã trong danh sách. Không xóa dữ liệu chương trình để giữ phiên bản chỉnh sửa.
- Có thể chọn gửi Email trong từng chương trình; mã vẫn hiển thị tại POS và danh sách quản lý. Zalo/SMS đang phát triển. Không bật chương trình hay gửi thông báo thật trong quá trình phát triển.

API bổ sung (giữ quyền `retail:manage` và scope hiện có):

- `GET /retail/coupons/available?customerId=...`: mã riêng còn hạn, chưa dùng của khách thuộc công ty/chi nhánh; có kiểm tra cấp quà sinh nhật đang bật.
- `GET /retail/coupons/birthday-program`: đọc cấu hình, mặc định tắt khi chưa lưu.
- `PUT /retail/coupons/birthday-program`: lưu cấu hình với `version`, chống ghi đè đồng thời.
- POST/PUT mã nhận `customerId` (null = mã chung). Các trường `customerName`, `customerCode`, `source`, `issuanceKey`, `usedCount` do server kiểm soát.

Index cần có trước khi bật tính năng nếu môi trường tắt tự tạo index:

- `retailbirthdayprograms`: unique `(companyCode, branchId)`.
- `retailcoupons`: unique `(companyCode, branchId, issuanceKey)` với partial filter `{ issuanceKey: { $type: "string" } }`.
- Giữ unique `(companyCode, branchId, code)`; thêm index tra cứu `(companyCode, branchId, customerId, endsAt)`.

Không cần sửa dữ liệu mã cũ: `customerId` thiếu/null nghĩa là mã chung.

## Chương trình tự động theo hoạt động

Màn hình **Bán lẻ → Mã ưu đãi → Tự động tặng mã** mở popup danh sách chương trình. Có thể tạo nhiều chương trình và bật/tắt độc lập; popup tạo/sửa giữ kiểu giao diện chung của mã ưu đãi.

Hai hoạt động hiện có:

- **Sinh nhật khách hàng**: một mã/khách/năm/chương trình. Giữ quy tắc ngày 29/2 và giờ Việt Nam như trên.
- **Đơn hàng đạt mức tiền**: xét từng đơn có `status=completed`, `paymentStatus=paid`, `dueAmount=0`. Giá trị xét bằng `grandTotal - refundedAmount`, gồm thuế/phí giao hàng; đạt ngưỡng khi lớn hơn hoặc bằng mức cấu hình. Không cộng dồn nhiều đơn. Mỗi đơn đủ điều kiện được tặng một mã/chương trình cho lần mua sau.

Điều kiện mua hàng `orderMinTotal` độc lập với `minSubtotal` (đơn tối thiểu để sử dụng mã quà). Ví dụ đơn đã trả đủ từ 2.000.000 ₫ → tặng mã giảm 100.000 ₫, dùng một lần trên đơn tiếp theo từ 500.000 ₫ trong 7 ngày.

- Chỉ xét đơn hoàn tất thanh toán từ lần bật chương trình gần nhất (`activatedAt`); không tặng hồi tố cho toàn bộ lịch sử mua hàng. Khi bật lại, mốc xét đơn bắt đầu lại từ thời điểm đó.
- Thời hạn quà mua hàng bắt đầu từ `completedAt`, không kéo dài do scheduler chạy lại. Đơn cũ đã ngoài thời hạn quà không được cấp nữa.
- Scheduler chạy lúc khởi động và mỗi 5 phút; POS cũng đánh giá chương trình khi tra mã riêng của khách. Chỉ công ty có phân hệ bán lẻ và chi nhánh đang hoạt động được quét nền.
- Khóa chống trùng: `auto:<programId>:order:<orderId>` hoặc `auto:<programId>:birthday:<customerId>:<year>`. Sửa điều kiện không cấp lại mã cho cùng đơn/năm đã được tặng. Không thay đổi loại hoạt động sau khi tạo.
- Mã quà lưu `automationId`, `sourceOrderId` và `triggerThreshold` của lần cấp. Khi báo giá/thanh toán, kiểm tra lại trạng thái/giá trị đơn gốc trong scope công ty, chi nhánh và người nhận. Hủy đơn hoặc hoàn tiền xuống dưới ngưỡng khiến mã chưa dùng không áp dụng được và không hiện trong danh sách mã còn dùng tại POS. Mã đã dùng không tự đảo ngược ưu đãi trên giao dịch khác.
- Nhiều chương trình có thể cùng tặng mã cho một hoạt động; đơn mua sau vẫn chỉ sử dụng một mã. Tắt chương trình dừng cấp mới, không thu hồi các mã đã cấp còn hợp lệ.
- Chương trình sinh nhật cũ được hiển thị/sửa thông qua adapter, không sao chép hoặc đổi khóa cấp quà cũ. Giữ API `birthday-program` cho tương thích; chương trình mới nằm trong collection `retailcouponautomations`.

API (cùng quyền và scope quản lý mã):

- `GET /retail/coupons/automations`: danh sách các chương trình, gồm cấu hình sinh nhật cũ nếu có.
- `POST /retail/coupons/automations`: tạo chương trình với `name`, `trigger` (`birthday` hoặc `order_total`), `orderMinTotal`, `enabled` và cấu hình phần thưởng hiện có.
- `PUT /retail/coupons/automations/:id`: cập nhật theo `version`; không đổi hoạt động.

Index bổ sung: `retailcouponautomations(companyCode, branchId, enabled, trigger)` và `retailorders(companyCode, branchId, status, completedAt)`. Tiếp tục dùng unique issuance key của mã ưu đãi. Email được hỗ trợ theo cấu hình từng chương trình; Zalo/SMS chưa hỗ trợ. Không bật chương trình thật trong quá trình phát triển.


### Gửi mã cho khách hàng
- Trong popup tạo/sửa chương trình, chọn Email. Zalo và Số điện thoại (SMS) hiển thị nhưng bị khóa với nhãn Đang phát triển; API cũng từ chối các kênh này.
- deliveryChannels: ["email"] bật gửi; mảng rỗng tắt gửi. Bỏ qua trường khi cập nhật sẽ giữ nguyên cấu hình trước đó, tương thích client cũ. Áp dụng cả chương trình sinh nhật cũ.
- Dùng cấu hình SMTP của đúng công ty và email của khách đang hoạt động trong cùng công ty. Thư chứa mã, ưu đãi, điều kiện, hạn dùng theo giờ Việt Nam và giới hạn đúng người nhận/một lần.
- Chỉ mã mới có trạng thái chờ gửi ngay trong thao tác cấp mã nguyên tử. Bật Email không gửi lại mã đã cấp trước đó. Scheduler kiểm tra mỗi 5 phút, độc lập với việc khách mở POS.
- Trạng thái trên danh sách mã: Chờ gửi, Đang gửi/chờ xác nhận, Đã gửi, Gửi thất bại, Không gửi. Khách thiếu email hoặc mã không còn hợp lệ được ghi lý do và không gửi thư. Công ty thiếu SMTP ghi lỗi; cần cấu hình SMTP trước khi chọn Email.
- Claim nguyên tử tránh nhiều worker gửi cùng một mã. Không tự gửi lại lỗi SMTP không rõ kết quả hoặc trường hợp tiến trình dừng sau khi claim; cần đối soát trước khi xử lý lại. Chưa có nút gửi lại trong giao diện. Đã gửi nghĩa là SMTP chấp nhận, không đảm bảo thư đã tới hộp thư khách.
- Kiểm thử dùng mailer giả lập, không gửi thư thật.
