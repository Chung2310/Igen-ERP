# Kết quả AI thật: 9 kịch bản đào tạo, học phí và KPI

Ngày kiểm tra: 23/11/2026. Model: `openai/gpt-6-luna` qua OpenRouter. Dùng tên, mã và hồ sơ giả; không gửi tên trong ảnh. Chạy interpreter/service thật với API nghiệp vụ, quyền và persistence giả lập. Mọi thao tác ghi dừng ở xác nhận; không gọi API/DB nghiệp vụ thật, không deploy.

## Kết quả từng ca

**9/9 mục tiêu đạt sau hội thoại**, không đồng nghĩa 9 câu đều hoàn thành ngay từ câu đầu. Lượt đầy đủ cuối đạt 8/9; ca tiến độ được chạy bổ sung riêng với câu trả lời làm rõ hợp lệ. Source runtime không đổi giữa hai lượt này.

| ID | Yêu cầu với dữ liệu giả | Kết quả cuối | Bằng chứng kiểm tra |
| --- | --- | --- | --- |
| X01 | Báo cáo tiến độ `QA-KY-NANG-SO` | Đạt sau hỏi loại hồ sơ | Hỏi đó là khóa đào tạo, công việc/dự án hay lớp học. Sau khi trả lời “khóa đào tạo nội bộ ... Nhân sự”, trả đúng 3 người có tiến độ 0, 50, 100; không loại người đã hoàn thành, không lấy người của khóa khác. Không hiểu thành cập nhật phần trăm. |
| X02 | Khóa `QA-TIENG-ANH` hôm nay đi đủ không | Đạt, đọc hoàn tất | Đúng lớp/ngày; tổng 4 người, có mặt 1, đi muộn 1, vắng 1, chưa ghi nhận 1. Nêu rõ chưa ghi nhận không đồng nghĩa vắng. |
| X03 | Lịch học khóa `QA-KY-NANG-SO` | Đạt, đọc hoàn tất | Đúng lớp; có ngày trong tuần, khoảng ngày và giờ 19:00–21:00. Không lẫn lịch lớp Tiếng Anh. |
| X04 | Học viên `HOC-VIEN-QA-THU-PHI` nộp thêm 3 triệu | Đạt, dừng xác nhận | Đúng học viên và 3.000.000; hỏi phương thức thu bằng option, bổ sung ngày thu khi cần. Chưa tạo phiếu thu. |
| X05 | Trong quản lý lao động, sửa số mốc tháng thành 2 | Đạt, dừng xác nhận | Chọn đúng chính sách; `maxMonths=2`, giữ hai mốc đầu và mức tiền đã có. Chưa cập nhật bản ghi. |
| X06 | Tạo chính sách hoa hồng cuối năm, từ 01/12/2026 | Đạt, dừng xác nhận | Giữ tên/ngày hiệu lực; ban đầu đưa lựa chọn loại lao động và chu kỳ. Sau câu trả lời giả về mức 300.000, một tháng, điều kiện và chu kỳ, mới tới xác nhận. Không tự bịa quy tắc hoa hồng. |
| X07 | Đối tác giới thiệu nhiều lao động nhất tháng | Đạt, đọc hoàn tất | Trả cả QA-A và QA-B cùng 10 lượt; đúng tháng 11/2026, giữ đồng hạng. |
| X08 | Đối tác đang thiếu KPI tháng | Đạt, đọc hoàn tất | Chỉ trả QA-C: chỉ tiêu 5, thực tế 3, còn thiếu 2. Không trả QA-D chưa được đặt KPI. |
| X09 | Các đối tác đã đạt đủ KPI | Đạt, đọc hoàn tất | Trả QA-A và QA-B; không lẫn chưa đạt hoặc chưa thiết lập. |

Ca X01 có bổ sung quy tắc cho harness trả lời một lần khi trợ lý hỏi **đúng loại hồ sơ/phân hệ**. Câu trả lời làm rõ được lưu nguyên trong trace; không thay câu hỏi gốc, không nới điều kiện kết quả và không chấp nhận câu hỏi cập nhật phần trăm. Đây là bước con người cung cấp ngữ cảnh, không phải AI tự biết tên giả thuộc loại nào.

## Các sửa chung

1. **Metadata đọc/ghi:** GET hoặc hợp đồng `readOnly` luôn là đọc. Trước đây “tạo” trong “đào tạo” khiến báo cáo tiến độ bị gắn nhầm hành động tạo. Thêm kiểm tra toàn catalog cho bất biến này.
2. **Khám phá nhóm chức năng:** cho phép khai báo thêm nhóm nghiệp vụ cho năng lực đọc dùng chung. Báo cáo điểm danh lớp hiện diện trong nhóm điểm danh; chi tiết/lịch định kỳ lớp hiện diện trong nhóm lịch học. Ưu tiên để báo cáo xuất hiện trong ví dụ rút gọn, tránh bị CRUD đăng ký trước che khuất. Không gửi cả nghìn schema, không tăng giới hạn 6 call/24 schema/bytes.
3. **Ranh giới đọc:** yêu cầu rõ là báo cáo/xem chỉ được xét công cụ đọc khi không có pending. Lệnh hỗn hợp hoặc “xem trước” được giữ luồng xác nhận hiện hữu; không tự biến các POST preview thành GET.
4. **Lịch lớp:** đưa ngày trong tuần và giờ bắt đầu/kết thúc vào danh sách kết quả công khai của chi tiết lớp. Tận dụng dữ liệu API và formatter chung, không tạo API lịch khác.
5. **Coverage:** chấp nhận từ nối “phần” trước nội dung trường JSON đã được ánh xạ; câu hỏi cuối “không” trong mô tả báo cáo đọc không bị nhầm với bộ lọc phủ định. Các điều kiện như “chưa có hợp đồng”, địa điểm hoặc ngày bổ sung vẫn phải được giữ.
6. **Đường dẫn coverage:** chuẩn hóa `actionId` thành `action`, `values.analysis.*` thành `analysis.*`; vẫn kiểm tra field/phép phân tích thật, không chấp nhận trường tùy ý. Tránh một vòng tìm nhóm sai chỉ vì khác cách viết đường dẫn.
7. **Trạng thái phân tích:** khai báo alias cho giá trị enum trong hợp đồng phân tích, kiểm chứng và áp dụng ở interpreter lẫn execution chung. “Thiếu KPI” là chưa đạt, “chưa đặt KPI” là chưa thiết lập. Giữ dấu tiếng Việt khi đối chiếu để phân biệt **đạt/đặt**; cụm không dấu hoặc phủ định mơ hồ phải hỏi lại. Các bộ lọc khác vẫn được giữ.
8. **Lựa chọn:** giữ các phân hệ đã khám phá qua vòng sửa coverage để có thể đưa option; khi tên tham chiếu không khớp, có thể bỏ riêng từ tìm kiếm lỗi để đưa lựa chọn vẫn trong cùng quyền, chi nhánh và quan hệ cha. Không tự chọn một bản ghi khác, không nới scope khi lookup bị từ chối.

## Kiểm tra offline và hồi quy

- **308/308** test routing, metadata, coverage, phân tích, formatter, email, lựa chọn và hội thoại đạt.
- Dry-run 9 ca đạt trước khi gọi AI; replay output AI đã lưu dùng để xác nhận sửa coverage, chọn lớp và trạng thái KPI, không phát sinh phí.
- Matrix: **19.889/19.914** đạt. Có 25 lỗi giống baseline trước đợt này; đối chiếu tên từng ca cho tập chênh lệch rỗng.
- Trong quá trình sửa, bộ lọc đọc từng làm 9 ca POST preview thất bại. Đã sửa phân biệt “xem trước” và chạy lại toàn matrix; 9 ca đó không còn là lỗi mới.
- `npm run typecheck` và `git diff --check`: đạt.
- Không thay UI trong đợt này; không tuyên bố đã kiểm tra giao diện hay nghiệm thu toàn web.

## Toàn bộ lượt gọi có tính phí

| Lượt | Phạm vi | Kết quả raw harness | Request model | USD từ usage |
| --- | --- | --- | ---: | ---: |
| live-01 | 9 ca | 2/9; lưu đủ lỗi để điều tra | 27 | 0,0225199 |
| live-02 | 9 ca sau sửa đợt đầu | 5/9 | 26 | 0,0219205 |
| live-03 | 9 ca trên source cuối | 8/9; X01 dừng hỏi đúng loại hồ sơ | 24 | 0,0187450 |
| live-04 | X01, gồm trả lời làm rõ | 1/1 | 4 | 0,0029420 |
| **Đợt 9 ca** | Gồm mọi lần lỗi và chạy lại | 9 mục tiêu cuối đạt | **81** | **0,0661274** |
| Lượt 19 ca trước | Đã báo cáo riêng | 19/19 | 60 | 0,0368014 |
| **Tổng cộng** | So với trần 0,25 USD | Dự phòng chưa tất toán bằng 0 | **141** | **0,1029288** |

Một lỗi kiểm tra ban đầu của harness: bắt buộc `periodAnchor` phải là ngày 1. API thực tế nhận một ngày bất kỳ thuộc tháng cần xem. Đã sửa để kiểm tra **đúng tháng**, không thay đổi nghiệp vụ. Vì vậy raw live-01 có thêm lỗi assertion ở X07/X09 dù tháng và kết quả đúng; giữ nguyên receipt cũ, không sửa lịch sử để tăng điểm.

Trước mỗi lượt gọi tiếp, lấy 0,25 USD trừ cả receipt lượt 19 ca trước và mọi lượt trong đợt này. Guard còn dự phòng chi phí trước request, giới hạn giá/provider/output/call count và dừng nếu thiếu usage hoặc transport không chắc chắn. Không reset ngân sách khi chạy lại.

Tất cả bốn lượt: **0 request ghi nghiệp vụ**, **0 vi phạm network/DB guard**, không xác nhận thao tác ghi. Những lượt GET được phép vẫn trả dữ liệu fixture trong bộ nhớ.

## Artifact

Thư mục: `tmp/assistant-extra-nine-2026-11-23/`.

- `live-01` đến `live-04` chứa `live-observations.json`: input, câu hỏi lại, phần bổ sung của người dùng giả, action/pending, trace API giả, output và usage của từng lần gọi model, hash source.
- `offline-final.json`, `matrix-final.json`, `typecheck-final.log`, các report replay và dry-run lưu kiểm tra tương ứng.
- Harness nằm tại `server/assistant/testing/worker-live-preview-v2/`; 9 ca là X01–X09, tách lựa chọn bằng biến môi trường. Chạy mặc định vẫn giữ bộ 19 ca cũ.

Kết quả này chứng minh đường xử lý trên fixture và những câu đã kiểm tra. Không chứng minh mọi cách diễn đạt, dữ liệu thật, quyền của mọi tài khoản hoặc thao tác sau khi xác nhận ghi đã được nghiệm thu.
