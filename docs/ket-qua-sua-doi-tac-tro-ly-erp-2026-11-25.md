# Sửa các ca chưa đạt: đối tác lao động và tuyển sinh

Ngày 25/11/2026. **37/37 ca đọc đã có kết quả đúng ở lượt xác minh cuối của từng ca. Hai ca ghi chọn đúng thao tác nhưng còn thiếu dữ liệu; chưa thử hoàn tất ghi.**

Trước sửa: 11 ca đọc đạt, 26 chưa đạt, 2 ca ghi cần bổ sung. Sau sửa: 37 ca đọc đạt, 0 ca đọc chưa đạt, 2 ca ghi cần bổ sung.

## Thay đổi

- Sửa chung cách đối chiếu tên chỉ tiêu, xếp hạng, coverage và các dạng đường dẫn AST tương đương; vẫn kiểm tra trường, kiểu, toán tử, phủ định, kỳ, phạm vi và danh sách đầy đủ trước khi tính.
- Hỗ trợ nhiều aggregate cùng lúc; lọc nội dung text chỉ trên trường khai báo contains; chọn cột công khai. Không chạy code do model sinh.
- Sửa nhóm chức năng và option về đúng student-partner thay vì student. Cho danh mục nhóm thấy đủ chỉ tiêu; ưu tiên view phân tích tương đương khi được bật, giữ view cũ cho reference/pending. Không mở rộng quyền.
- Thêm bộ lọc ngày tạo đối tác và ngày đăng ký của học viên được giới thiệu, trạng thái, ngân hàng, ghi chú; giữ phép tính hoa hồng nghiệp vụ lũy kế hiện có. Bổ sung read action partner.referrals qua API chi tiết đã được cấp quyền.
- Chặn nhánh hỏi dữ liệu cập nhật hoa hồng chạy nhầm với GET chi tiết; hiển thị trạng thái và việc thiếu ngân hàng trong bảng compact. Dùng chung quy tắc che số tài khoản.
- Retry kiểm tra coverage/năng lực chỉ một lần trong ngân sách điều phối có sẵn, trên danh mục đã thu hẹp; không gửi lại toàn catalog ERP. Không đổi trần đọc 24.

## Kiểm thử thật và chi phí

- Model, HTTP API và DB Mongo local thật; không mock. Tài khoản ASD (tuna), chi nhánh Trụ sở chính; dùng dữ liệu QA đã tạo ở lượt trước. Không thêm/sửa dữ liệu nghiệp vụ trong đợt sửa này.
- Cổng QA riêng 3041 dùng router/auth/controller/service hiện tại và cùng DB với local; không phải toàn bộ lượt bấm UI trên cổng 3000.
- Đã chạy lại đủ 39 câu ở hai lượt đầu; các lượt tiếp theo chạy ca lỗi và ca hồi quy quan trọng. Bảng dưới lấy lượt xác minh mới nhất của mỗi ca, **không phải một lượt 39 câu đồng thời trên snapshot cuối**.
- 266 request model trong đợt sửa; tất cả HTTP 200; dùng GPT-6 Luna. Chưa phát sinh/kiểm thử fallback Haiku trong đợt này. 147 GET nghiệp vụ qua executor; tất cả HTTP 200.
- Chi thực tế riêng đợt sửa: **0.16150115 USD**. Tổng chi trong sổ hiện có: **0.21808090 USD**; giữ dự phòng DNS cũ **0.009485 USD**. Tổng chi + dự phòng **0.22756590 USD**, dưới trần **0,25 USD**. Không reset ngân sách.
- 9 collection nghiệp vụ giữ nguyên snapshot qua các lượt; cấu hình xác nhận/memory tạm thời được khôi phục sau từng lượt. Không gửi quyết định xác nhận, không có mutation nghiệp vụ qua assistant.

## Từng ca

| Mã | Câu hỏi với dữ liệu thay thế | Kết quả | Đối chiếu |
| --- | --- | --- | --- |
| L01 | TRONG QUẢN LÝ LAO ĐỘNG, chỉnh sửa chính sách phần Số mốc tháng thành 2 tháng | CẦN BỔ SUNG | Giữ maxMonths=2, chọn đúng chính sách; cần thêm cấu hình mốc hoa hồng. |
| L02 | Thêm 1 chính sách hoa hồng mới - QA Chính sách lao động cuối năm, áp dụng từ 1/12/2026 | CẦN BỔ SUNG | Giữ tên/ngày bắt đầu; cần chọn loại lao động, chu kỳ và cấu hình hoa hồng. |
| L03 | Trong quản lí lao động, Đối tác nào giới thiệu được nhiều lao động nhất trong tháng | ĐẠT | Đúng đối tác giới thiệu nhiều lao động nhất tháng. |
| L04 | trong quản lí lao động, đối tác nào đang thiếu KPI tháng | ĐẠT | Đúng đối tác thiếu KPI, số thiếu 9. |
| L05 | trong quản lí lao động, các đối tác nào đã đạt đủ KPI | ĐẠT | Đúng đối tác đạt KPI, thực tế 2 / chỉ tiêu 1. |
| L06 | Trong quản lí lao động, Đối tác nào giới thiệu được ít lao động nhất trong tháng | ĐẠT | Đúng đối tác ít lượt nhất, gồm đối tác có 0 lượt. |
| P01 | Báo cáo tổng quan tình hình đối tác tuyển sinh hiện tại | ĐẠT | Tổng quan trạng thái đúng: 7 hoạt động, 3 tạm dừng. |
| P02 | Tổng số đối tác tuyển sinh của chi nhánh Trụ sở chính là bao nhiêu | ĐẠT | 10 đối tác trong phạm vi chi nhánh. |
| P03 | Hiện tại có bao nhiêu đối tác tuyển sinh đang hoạt động và bao nhiêu đối tác đang tạm dừng | ĐẠT | 7 hoạt động, 3 tạm dừng. |
| P04 | Danh sách các đối tác tuyển sinh đang tạm dừng (ngưng hoạt động) | ĐẠT | Đúng 3 đối tác tạm dừng. |
| P05 | Đối tác QA An Nhiên hiện đang hoạt động hay đã tạm dừng | ĐẠT | QA An Nhiên; bảng hiện rõ đang hoạt động = Có. |
| P06 | Tháng này có thêm bao nhiêu đối tác tuyển sinh mới | ĐẠT | 7 đối tác mới tháng này. |
| P07 | Tháng trước có thêm bao nhiêu đối tác tuyển sinh mới | ĐẠT | 3 đối tác mới tháng trước. |
| P08 | Trong số các đối tác đang hoạt động có bao nhiêu người đã phát sinh học viên giới thiệu | ĐẠT | 5 đối tác hoạt động đã giới thiệu học viên. |
| P09 | Tìm đối tác tuyển sinh có số điện thoại 0900090001 | ĐẠT | Đúng QA An Nhiên theo điện thoại giả. |
| P10 | Số điện thoại và email của đối tác QA Bình Minh là gì | ĐẠT | Đúng điện thoại và email giả của QA Bình Minh. |
| P11 | Đối tác QA Bình Minh đang dùng tài khoản ngân hàng nào để nhận hoa hồng | ĐẠT | QA Bình Minh: tài khoản ngân hàng Chưa cập nhật; không hỏi sửa hoa hồng. |
| P12 | Kiểm tra những đối tác tuyển sinh nào chưa cập nhật tài khoản ngân hàng nhận hoa hồng | ĐẠT | Đúng 6 đối tác thiếu số tài khoản. |
| P13 | Những đối tác nào đang còn nợ hoa hồng nhưng chưa có số tài khoản ngân hàng | ĐẠT | Đúng 2 đối tác vừa còn nợ vừa thiếu ngân hàng. |
| P14 | Tìm các đối tác tuyển sinh có ghi chú qua cộng đồng phụ huynh | ĐẠT | Đúng QA An Nhiên theo ghi chú cộng đồng phụ huynh. |
| P15 | Danh sách các đối tác tuyển sinh chưa giới thiệu được học viên nào | ĐẠT | Đúng 3 đối tác chưa giới thiệu học viên. |
| P16 | Đối tác tuyển sinh nào giới thiệu được nhiều học viên nhất | ĐẠT | QA An Nhiên, 4 học viên. |
| P17 | Đối tác tuyển sinh nào mang về tổng doanh số học phí cao nhất | ĐẠT | QA Trúc Mai, tổng học phí 50.000.000đ. |
| P18 | Đối tác tuyển sinh nào đang hoạt động nhưng giới thiệu được ít học viên nhất trong tháng này | ĐẠT | Đúng 3 đối tác hoạt động có 0 lượt trong kỳ. |
| P19 | Xếp hạng top 5 đối tác tuyển sinh có doanh số học phí cao nhất | ĐẠT | Đúng top 5 và thứ tự giảm dần học phí. |
| P20 | Tổng số học viên và tổng doanh số học phí do tất cả đối tác tuyển sinh mang về là bao nhiêu | ĐẠT | 14 học viên, 78.000.000đ trong cùng kết quả. |
| P21 | Tháng này các đối tác tuyển sinh đã giới thiệu được bao nhiêu học viên | ĐẠT | 9 học viên đăng ký trong tháng này. |
| P22 | Tháng trước các đối tác tuyển sinh đã giới thiệu được bao nhiêu học viên | ĐẠT | 5 học viên đăng ký tháng trước. |
| P23 | Tuần này có đối tác tuyển sinh nào giới thiệu học viên mới không | ĐẠT | Đúng 5 đối tác có học viên đăng ký trong tuần. |
| P24 | Đối tác QA Thu Ngân đã giới thiệu những học viên nào và tổng học phí bao nhiêu | ĐẠT | Đúng 2 học viên của QA Thu Ngân, tổng 5.000.000đ. |
| P25 | Xem lịch sử giới thiệu học viên của đối tác QA Bình Minh | ĐẠT | Đúng lịch sử 3 học viên của QA Bình Minh. |
| P26 | Đối tác QA Gia Hưng đã giới thiệu được bao nhiêu học viên | ĐẠT | QA Gia Hưng, 1 học viên. |
| P27 | Có đối tác nào đã giới thiệu học viên nhưng chưa phát sinh học phí (học phí bằng 0) không | ĐẠT | QA Gia Hưng: đã giới thiệu nhưng học phí bằng 0. |
| P28 | Lọc danh sách các đối tác tuyển sinh giới thiệu từ 1 học viên trở lên | ĐẠT | Đúng 7 đối tác có ít nhất 1 học viên. |
| P29 | Tổng hoa hồng phát sinh, đã thanh toán và còn phải trả cho tất cả đối tác tuyển sinh là bao nhiêu | ĐẠT | 5.400.000đ phát sinh, 1.450.000đ đã trả, 3.950.000đ còn nợ. |
| P30 | Hiện tại trung tâm còn nợ hoa hồng của những đối tác tuyển sinh nào | ĐẠT | Đúng 6 đối tác còn nợ trong phạm vi hiện tại. |
| P31 | Đối tác tuyển sinh nào đang có số tiền hoa hồng còn nợ cao nhất | ĐẠT | QA Trúc Mai, còn nợ cao nhất 3.000.000đ. |
| P32 | Lọc danh sách đối tác tuyển sinh còn nợ hoa hồng từ 300.000 trở lên | ĐẠT | Đúng 3 đối tác có số dư từ 300.000đ. |
| P33 | Hoa hồng của đối tác QA Bình Minh hiện tại là bao nhiêu, đã trả được bao nhiêu và còn nợ bao nhiêu | ĐẠT | QA Bình Minh: 500.000đ / 150.000đ / 350.000đ. |

## Cách đọc kết quả và giới hạn

- Các câu theo tháng/tuần đếm học viên theo **ngày đăng ký trên hồ sơ**. Đây không phải nhật ký thời điểm gắn/chuyển đối tác; nếu cần lịch sử chuyển đối tác theo thời gian thì nguồn hiện tại chưa cung cấp. Tiêu đề kết quả đã nêu cơ sở ngày.
- Tiền hoa hồng và số đã trả/còn nợ vẫn lũy kế; không tự phân bổ hoa hồng theo tháng từ số tổng.
- Hai ca L01/L02 chưa đủ cấu hình để tới xác nhận; không tính chúng là tạo/sửa thành công.
- P01 chấp nhận tổng quan theo trạng thái đúng 7/3, không bắt buộc liệt kê đủ 10 dòng hồ sơ. Đây là chỉnh tiêu chí kiểm tra định dạng, không sửa số kỳ vọng để khớp kết quả sai.
- P11 có false fail ở harness do regex phân biệt chữ hoa: reply thật đã ghi rõ “Chưa cập nhật”. Rà lại bằng parser bảng và trường Tài khoản ngân hàng xác nhận đạt; giữ nguyên raw result và ghi correction trong artifact. P05 được siết tiêu chí để bắt buộc trạng thái thực sự xuất hiện, tránh chỉ kiểm tra tên đối tác.
- Kết quả này xác minh 39 câu đã yêu cầu trên fixture hiện tại, không chứng minh bao phủ toàn web hoặc mọi cách diễn đạt.

## Bằng chứng

- Báo cáo JSON đã rà: tmp/partner-local-qa/delivery-results.json.
- Trace/raw reply các lượt: tmp/partner-local-qa/fix-pass-1 đến fix-pass-4; lượt cuối ở tmp/partner-local-qa/results.json và calls.json. Không lưu access token trong artifact báo cáo.
- Test hồi quy dùng output AI thật đã thay dữ liệu giả: server/assistant/testing/catalog-routing/captured-partner-read.json. Các test offline chặn network/provider/DB thật.
- Typecheck và kết quả Vitest xem phần xác minh cuối bên dưới.

## Xác minh cuối

- `npm run typecheck`: **đạt, exit 0** trên mã cuối. Lượt kiểm tra có cache riêng cũng đạt; không có lỗi TypeScript còn mở.
- Bộ định tuyến/catalog: **419 test đạt / 23 file** trong đợt hồi quy đầy đủ.
- Bộ hội thoại/trình bày: **395 test đạt / 14 file** trong đợt hồi quy đầy đủ.
- Sau chỉnh thứ tự cột, che tài khoản và nhãn học phí cuối: **112 test liên quan đạt / 4 file** (partner-read-regression, list-analysis, result-format, worker-management-conversation). Các bộ có test trùng nhau, không cộng thành tổng test độc lập.
- Cổng gọi P6: **359 test đạt**; V2 đọc: **122 test đạt**. Không sửa chính sách gate hoặc bật production flag.
- `git diff --check`: không có lỗi whitespace. Hai file so sánh P6 được test sinh ra đã khôi phục về nội dung trước khi chạy; bằng chứng lượt chạy giữ trong tmp.
- Cổng QA 3041 đã dừng. Server local 3000 vẫn trả HTTP 200. Cấu hình người dùng đã khôi phục và snapshot nghiệp vụ không đổi.

## Bổ sung: câu hỏi thanh toán đủ 100% và kết quả rỗng

- Đã sửa đuôi hỏi “đã … chưa” dùng chung, giữ phủ định trong thân câu và tên bản ghi. Thanh toán đủ yêu cầu có hoa hồng phát sinh > 0 và số còn phải trả <= 0, không tính hồ sơ 0/0.
- Câu trong ảnh đã chạy AI/API/DB local thật: hoàn tất, 2 request model, chi thêm 0,00173468 USD, không mutation nghiệp vụ. Tổng sổ chi 0,21981558 USD; cộng dự phòng cũ vẫn dưới 0,25 USD.
- Đối chiếu lại đúng tài khoản ASD/Trụ sở chính và phiên hỏi lúc 17:47 ngày 25/11/2026: 10 đối tác, 6 còn nợ, 4 chưa phát sinh hoa hồng, 0 đã thanh toán đủ. Kết quả rỗng là đúng trong phạm vi này.
- Đã sửa phần trình bày chung cho read rỗng: trả lời kết luận theo câu hỏi và phạm vi hiện tại thay vì tiêu đề thao tác và “Không có kết quả phù hợp”. Chỉ thực hiện sau khi dữ liệu đầy đủ và kế hoạch hợp lệ; lỗi đọc/thiếu quyền không bị chuyển thành không có dữ liệu.
- Sau sửa: 431 test định tuyến, 399 test hội thoại đều đạt; typecheck exit 0. Kiểm tra cách trả lời mới bằng test offline, không gọi AI thêm cho thay đổi trình bày.
- Tại thời điểm bản sửa trên, lịch sử chi trả chưa được mở thành nguồn phân tích. Phần bổ sung bên dưới đã triển khai và kiểm tra nguồn này.

## Bổ sung: lịch sử chi trả, lần gần nhất và tổng thực chi theo kỳ

- Nguyên nhân ảnh lúc 17:58: danh mục trợ lý chỉ có tổng đã trả lũy kế, chưa có nguồn lịch sử sự kiện chi trả; AI tự suy ra thiếu quyền từ danh mục không đáp ứng. Sau khi nối nguồn, AI đã chọn đúng nhưng bộ coverage còn chặn nhầm câu hỏi đầu ra và ngữ cảnh đã rõ.
- Đã thêm GET `/partners/payout-history` và action `partner.payouts.analysis`, dùng owner/chi nhánh tin cậy và quyền `relationship:read` đang có. Chỉ chiếu tên đối tác, ngày chi, số tiền và phương thức. Không trả ID, ghi chú hoặc tài khoản ngân hàng. Đọc bằng cursor, giới hạn 10.000 đối tác/khoản chi; quá lớn hoặc ngày/số tiền lỗi thì báo chưa đọc đủ, không tổng hợp một phần.
- Chuẩn hóa DD/MM/YYYY, ngày ISO và timestamp về lịch Việt Nam; lọc from/to bao gồm hai đầu. Dữ liệu cũ có độ chính xác theo ngày: giữ mọi khoản cùng ngày gần nhất, không bịa thứ tự trong ngày. Tổng thực chi lấy từ từng khoản trong lịch sử; hoa hồng phát sinh/còn nợ vẫn theo nguồn lũy kế hiện có, không tự phân bổ theo tháng.
- Mở rộng bộ phân tích dùng chung để tìm cực trị ngày, nhận diện câu hỏi đọc tự nhiên và đối chiếu các cột trả lời thực sự được chọn. Khôi phục chỉ các cụm ngữ cảnh/khả năng được khai báo, giữ kiểm tra phủ định, tên, kỳ và điều kiện chưa áp dụng. Bắt nhầm tổng thành trung bình và ngày chưa có trong đầu ra. Lưu năm output AI thật từng bị chặn thành fixture hồi quy.
- Chuẩn hóa lời làm rõ do model sinh khi nó tự kết luận cần cấp quyền/bật phân hệ. Lỗi quyền thật vẫn đi qua cổng server và giữ nguyên xử lý, không bị đổi thành không có dữ liệu.

| Ca AI thật sau sửa | Kết quả đối chiếu với API/DB local | Số request | Chi phí lượt đạt |
| --- | --- | --- | --- |
| Lần gần nhất trung tâm chi trả hoa hồng cho đối tác tuyển sinh là khi nào và cho ai | ĐẠT: 25/11/2026, đủ QA An Nhiên, QA Bình Minh, QA Thu Ngân, QA Trúc Mai cùng ngày | 2 AI + 1 GET | 0,00065504 USD |
| Tháng này trung tâm đã chi trả tổng cộng bao nhiêu tiền hoa hồng cho đối tác tuyển sinh | ĐẠT: 01/11–30/11/2026, tổng thực chi 1.450.000 đồng | 2 AI + 1 GET | 0,00060754 USD |

- Hai lượt đạt không có coverage-repair, không thay bằng số lũy kế và không hỏi người dùng viết lại yêu cầu. Không coi đây là bằng chứng mọi cách diễn đạt đã đạt.
- Toàn đợt sửa nguồn chi trả này, gồm các lượt tái hiện chưa đạt, chi thêm **0,013816635 USD**. Sổ tổng đã chi **0,23363222 USD**, giữ nguyên dự phòng cũ **0,009485 USD**; tổng đã chi + giữ chỗ **0,24311722 USD < 0,25 USD**. Hai lần bị chặn do dự phòng cứng được lưu lại; chỉ thử lại với đầu ra/giá nhà cung cấp bị siết hơn và tính lại từng wire trước khi gửi, không bỏ khoản đã chi hoặc giải phóng dự phòng cũ. Giới hạn giá trong QA không đổi chính sách model/fallback production.
- Sau mã cuối: **454 test định tuyến / 24 file**, **399 test hội thoại / 14 file**, `npm run typecheck` exit 0. Các bộ có test trùng, không cộng thành số ca độc lập. Test offline chặn provider/DB/network thật.
- Snapshot 9 collection nghiệp vụ không đổi ở cả hai lượt đạt; cấu hình xác nhận/memory tạm thời đã khôi phục. Không có thao tác ghi nghiệp vụ.
- Bằng chứng tổng hợp: `tmp/partner-local-qa/payout-delivery-results.json`; raw request/reply ở `payout-latest-success`, `payout-month-success`. Các lượt lỗi giữ ở `payout-before-coverage-fix`, `payout-before-context-fix`, `payout-month-before-fix`.

## Bổ sung: nền tảng hiểu ngữ cảnh theo ý nghĩa dùng chung

- Đã thay đối chiếu câu chữ bằng khung ý nghĩa độc lập và binding được server kiểm tra ở đường mới; dùng chung cho các module, giữ form/option/xác nhận và dispatch/completion hiện có. Production chưa bật.
- Tài liệu triển khai và giới hạn: [Hiểu ngữ cảnh theo ý nghĩa](kien-truc-hieu-ngu-canh-theo-y-nghia-tro-ly-erp.md).
- Hồi quy cuối: 506 test định tuyến, 401 test hội thoại, typecheck exit 0. Replay ba frame/plan AI thật thành fixture offline.
- AI thật: đọc lần chi gần nhất đạt; tạo đối tác tuyển sinh dừng đúng xác nhận; nhận diện đúng module Lao động chưa khả dụng của ASD, không chuyển sang đối tác lao động. Không bật module/quyền để làm cho test đạt.
- Chi thêm toàn đợt 0,00485828 USD gồm lượt thăm dò lỗi; tổng đã chi + dự phòng cũ là 0,24797550/0,25 USD. Không mutation nghiệp vụ; cấu hình QA đã khôi phục.
- Artifact tổng hợp: `tmp/partner-local-qa/semantic-delivery-results.json`. Không dùng số test hồi quy hoặc ba ca thật để suy ra tỷ lệ hiểu đúng trên toàn web.


## Bổ sung 26/11: sửa chặn nhầm yêu cầu rõ và giữ ngữ cảnh nối tiếp

### Nguyên nhân và thay đổi dùng chung

Đã đối chiếu đúng hai lượt trong phiên local ASD lúc 19:11 và 19:21 ngày 25/11: cả hai bị chặn ở bước lập/kiểm tra kế hoạch, journal không có bước API. Câu trả lời “cần làm rõ yêu cầu về Tra cứu lịch sử/Trình bày danh sách” là thuật ngữ nội bộ bị đưa thành câu hỏi cho người dùng. Không phải đã đọc DB rồi không thấy học viên. Raw model output của hai lượt gốc không được lưu, nên không kết luận chắc chúng dùng alias cụ thể nào.

Bản sửa áp dụng ở interpreter/validator/service dùng chung:

- Chuẩn hóa các alias đích action tương đương, vẫn kiểm tra ý định và chiều đọc/ghi. Trong lần chạy thật mới, kế hoạch lịch sử dùng `query:partner.referrals:actionId` và đã được chấp nhận đúng nghĩa.
- Kế hoạch không hợp lệ được sửa nội bộ tối đa một lần, giữ bản ý nghĩa đã cache và danh mục đã chọn. Hết lượt sửa trả lỗi lập phương án; không đổ thành thiếu thông tin, thiếu quyền hay mất kết nối.
- Giữ bằng chứng ý nghĩa riêng ở server qua ranh giới kế hoạch nhiều nguồn và kiểm tra lại trước dispatch. Không quay về coverage câu chữ khi đã có bằng chứng ý nghĩa; JSON/client không tự cấp được bằng chứng.
- Câu nối tiếp giữ tên đối tác cha đã được người dùng nêu và xuất hiện chung trong các dòng học viên. Không tự chọn học viên đầu tiên, không áp dụng ngoại lệ nhiều dòng này cho thao tác ghi. Sau lỗi lập phương án có thể giữ tên duy nhất đã nêu ở câu trước.
- Giữ form, option, schema, quyền, dispatch/completion và xác nhận. Không thay model chính/dự phòng hoặc bật production flag.

### AI thật trên dữ liệu giả

Chạy qua assistant, xác thực, API và DB local thật trên server QA riêng 3041. API học viên thực tế theo phạm vi công ty trả 47 dòng, gồm 3 dòng ngoài fixture. Preflight dừng trước khi gọi model; sau đó chỉ riêng harness QA thêm điều kiện tên `QA ` cho GET `/students`, còn middleware xác thực/quyền/chi nhánh và controller giữ nguyên. 44 học viên được phép kiểm thử đều là dữ liệu giả. Không đổi truy vấn trên app chính 3000 và không gửi tên trong ảnh cho provider. Đây là giới hạn dữ liệu của đợt kiểm thử, không phải kiểm tra toàn bộ dữ liệu tài khoản.

| Ca | Kết quả thực tế | Request AI | GET nghiệp vụ | Chi phí |
| --- | --- | --- | --- | --- |
| Xem lịch sử giới thiệu học viên của đối tác QA Bình Minh | Đạt, đúng 3 học viên; đối chiếu tên với API chi tiết đối tác | 3 | 5 | 0,001708275 USD |
| đưa ra danh sách học viên | Đạt, bảng 44 học viên trong fixture, không hỏi lại thuật ngữ nội bộ | 4 | 1 | 0,001618550 USD |
| cho mình danh sách những học viên của đối tác vừa hỏi | Đạt, cùng phiên lịch sử, đúng 3 học viên của QA Bình Minh, không hỏi chọn lại đối tác | 3 | 5 | 0,001821125 USD |
| Thêm đối tác tuyển sinh QA Kiểm Thử 26011, số điện thoại giả | Đạt, giữ tên và số điện thoại, dừng ở xác nhận | 3 | 0 | 0,001265500 USD |

Tổng **13 request AI**, **0,006413450 USD / trần riêng 0,25 USD**, không còn giữ chỗ chưa quyết toán ở sổ mới. Đây là trần riêng được duyệt cho đợt này; sổ cũ và khoản dự phòng cũ không thay đổi. Không gọi API ghi nghiệp vụ, snapshot 9 collection trước/sau khớp; cấu hình xác nhận/memory tạm đã khôi phục.

Bằng chứng: `tmp/context-fix-real-20261126/results.json`, `calls.json`, `ledger.json`; trace hai lỗi gốc đã thay tên ở `tmp/partner-local-qa/context-failures.json`. Bốn frame/plan AI thật được bổ sung vào fixture hồi quy `server/assistant/testing/catalog-routing/captured-semantic-context.json`. Bộ replay chỉ mô phỏng các bước chọn nhóm cần thiết khi thu hẹp danh mục, không gọi provider/API/DB thật.

Bốn ca đạt trên dữ liệu giả không chứng minh đã hiểu mọi ngữ cảnh hoặc bao phủ toàn web. Đợt này không kiểm thử ghi thực tế, không kiểm tra giao diện bằng trình duyệt.

Xác minh cuối trên mã bàn giao: **521 test định tuyến/ngữ cảnh / 25 file**, **406 test hội thoại/trình bày / 14 file** đều đạt; hai bộ có ca trùng nên không cộng thành số ca độc lập. `npm run typecheck` exit 0; `git diff --check` không lỗi whitespace. Log cuối ở `tmp/partner-local-qa/context-fix-offline-final.log`, `context-fix-conversation-final.log`, `context-fix-typecheck-final.log`. Server QA 3041 đã dừng; app chính được khởi động lại bằng lệnh dev hiện có và trả HTTP 200 trên cổng 3000. Chưa đẩy Git trong đợt này.
