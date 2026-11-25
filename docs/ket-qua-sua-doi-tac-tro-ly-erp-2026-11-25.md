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
