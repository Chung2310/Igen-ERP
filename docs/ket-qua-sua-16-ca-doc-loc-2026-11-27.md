# Sửa 14 ca lỗi và 2 ca trả thiếu — 27/11/2026

Đã sửa các điểm chung và bổ sung kiểm chứng offline cho 16 ca của bộ 32 câu. **16 ca có replay/kiểm tra hợp đồng đạt; toàn bộ hồi quy 1.053 test / 54 file đạt, typecheck và diff check đạt.** Đây là bằng chứng offline với đầu ra model điều khiển và API/DB giả lập, **không phải kết quả chạy lại 16 câu bằng AI thật**, cũng không chứng minh chọn action đúng cho mọi cách nói.

Không gọi model/provider, API nghiệp vụ hoặc Mongo thật. Không tạo dữ liệu, không triển khai staging/production. Sổ AI cũ vẫn 235 call, chi phí 0,23931413 USD + giữ chỗ chưa rõ 0,001387375 USD, COST_RESERVE_LIMIT; không mở lại hoặc giải phóng giữ chỗ.

## Những thay đổi dùng chung

1. **Ngữ cảnh đọc có scope.** Lưu action/version, yêu cầu và truy vấn đọc vừa thực hiện ở server, gắn user/company/branch/conversation/project. Hỏi tiếp cùng nguồn giữ bộ lọc và phạm vi, thay cột/sắp xếp theo yêu cầu mới. Không chép tập điều kiện sang nguồn khác hoặc thao tác ghi. Không âm thầm mở rộng một nhóm top-N/cực trị chưa có tham chiếu đủ chắc; hỏi rõ hồ sơ cần xem. Context native ID chỉ giữ ở server, không đưa vào prompt/public table.
2. **Biên dịch cách biểu diễn tương đương.** Các reference được giải từ cùng một đại từ số nhiều có thể là OR; không đổi quan hệ AND/OR được nêu rõ. Một danh từ nằm trong chính điều kiện đã được chứng minh không bị coi là điều kiện thứ hai. Vẫn kiểm tra nguồn, giá trị, phủ định, kỳ và predicate chưa được yêu cầu.
3. **Chọn đối tượng theo định danh.** Read contract khai báo cột nhãn nào tương ứng input tham chiếu native. Tên lớp đi qua batchId; tên sản phẩm qua productId; kho đã chọn qua warehouseId. Chỉ bỏ predicate nhãn trùng khi có cùng binding/tham chiếu đã chứng minh. Điều kiện text literal độc lập vẫn giữ nguyên.
4. **Tra cứu tham chiếu.** Dùng tên công khai đầy đủ nằm trong cách nói của người dùng; không đặt regex nhận diện từng câu. Khi native search không hiểu tên nói tự nhiên, thử lại đúng collection được cấp quyền, giữ các phạm vi khác và xác minh đủ trang trong giới hạn. Tái sử dụng trang đầu nếu truy vấn giống nhau. Giữ ID/nhãn bổ trợ trong projection riêng cho selector; projection kết quả công khai vẫn bỏ ID. Không đánh dấu toàn bộ tập tìm dự phòng là khớp tìm kiếm.
5. **Hỏi đúng điều chưa biết.** Thứ hạng chưa có chỉ tiêu hoặc điều kiện chưa có ngưỡng trả câu hỏi nghiệp vụ. Không ném lỗi schema vì ordering chưa rõ dimension, không bỏ câu hỏi cụ thể của action-fit để trả hướng dẫn chung. Mốc thời gian chưa đủ để gắn vào trường ngày thì hỏi kỳ; “hiện tại” là snapshot không bị ép thành khoảng ngày.
6. **Phân biệt miền và trạng thái.** Nếu discovery trả nhiều chủ thể cùng họ chức năng cho một mục tiêu chưa rõ miền, hiện lựa chọn phân hệ có sẵn. Khi đã nêu rõ một miền chuyên biệt như CTV bán lẻ, giữ miền đó. Không biến mọi danh từ đầu ra thành rào chặn module: nguồn sở hữu quan hệ ở phân hệ khác vẫn có thể phù hợp. Metadata vòng đời giúp phát hiện “chưa xong” chưa rõ có bao gồm hồ sơ đã hủy/đóng; hỏi rõ thay vì trả sai tập.
7. **Bảng có đối tượng và đủ cấp độ dòng.** Giữ tối thiểu trường nhận diện công khai khi chỉ chọn cột giá trị/trạng thái. Không thêm ID hay đọc mặc định thành lời. Envelope khai báo rows và total riêng được đọc đúng phần dữ liệu, tránh lấy tổng của collection khác. Báo trạng thái chưa ghi nhận là thiếu dữ liệu, không tự kết luận tất cả đi làm hoặc vắng.

Các thay đổi đều ở interpreter/compiler, common service/dispatch, collector, resolver và presentation contract. Không có bộ `if câu hỏi == ...` hoặc chọn action bằng mẫu của 16 câu. Form/option, required fields, quyền, scope và bước xác nhận giữ nguyên. Reference đã được người dùng nhắc nhưng chưa nhận diện được trở thành phần phải chọn, kể cả native filter vốn optional; không đọc toàn bộ dữ liệu thay cho đối tượng chưa biết.

## Hợp đồng nguồn được hoàn thiện

- Thêm **worker.project.workers.list**: GET `/worker-management/projects/:id/workers`, tái sử dụng project selector. API kiểm tra công ty/chi nhánh/dự án, chỉ lấy workerIds được phân công và còn trong scope, chỉ chọn trường công khai, chặn kết quả vượt 1.000 thay vì cắt ngầm. Không coi phân công là có mặt/chấm công.
- `/schedule` nhận batchId, giữ owner/branch và giới hạn lớp ở truy vấn nguồn; không lấy booking không liên quan. Lịch lớp có startAt/endAt với +07:00 để lọc đúng khoảng giờ. Query ngày là bao ngoài thô của predicate datetime chính xác, không thay predicate bằng cả ngày. NLU được yêu cầu giữ nghĩa của buổi/giờ; độ chính xác AI thực tế vẫn cần chạy lại.
- `/inventory/warehouses/balances` nhận productId; kiểm tra sản phẩm trong công ty, giữ warehouse/branch scope cả số dư và catalog.
- `hr.contract.expiring.list` khai báo expiryAlerts, expiryAlertTotal và các trường con được phép; không dùng total/contracts của danh sách hợp đồng chung.

## Đối chiếu từng ca

| Ca | Sửa / kết quả offline được kiểm chứng |
| --- | --- |
| N01-01 | Tên nhân sự giữ cạnh trạng thái; hiển thị tỷ lệ đã ghi nhận và nói rõ chưa đủ dữ liệu khi chưa chấm công. Không suy ra vắng từ thiếu ghi nhận. |
| N01-02 | Đọc đúng alert rows/alert total; tên, loại hợp đồng, ngày hết hạn có trong bảng. Total lệch số alert phải dừng, không dựng bảng “Chưa thiết lập”. |
| N01-04 | Replay ba người “mấy bạn đó” qua OR đúng, giữ điều kiện nguồn; không chọn dòng đầu. |
| N02-03 | Có nguồn đọc phân công thật; kiểm tra source scope và hội thoại chọn dự án → danh sách lao động qua common dispatch. |
| N03-01 | Replay đổi tên lớp từ title ghép sang selector batchId. Hội thoại fixture lọc buổi tối chỉ giữ sự kiện 19h, loại 08h, query ngày vẫn được giới hạn. Chưa đo lại NLU thật có giữ đủ nghĩa “tối nay” không. |
| N04-01 | Ordering không rõ chỉ tiêu được giữ để hỏi tiêu chí; không lỗi parser. |
| N04-03 | Entity “học viên” nằm trong điều kiện 0 lượt giới thiệu không tạo binding predicate trùng; giữ đúng bộ lọc bằng 0. |
| N05-02 | Điều kiện chưa định lượng trả câu hỏi tiêu chí/ngưỡng, không tự chọn một đối tác cực trị. |
| N05-04 | Câu hỏi ngưỡng được giữ; lượt bổ sung tối đa 3 người vẫn có mục tiêu/KPI/tháng trước đó, không lỗi quote do thiếu câu gốc. |
| N06-01 | Giữ câu hỏi cụ thể về loại hoạt động/chỉ tiêu từ bước kiểm tra nguồn thay vì trả hướng dẫn thao tác chung. Không giả báo cáo bán buôn bằng số liệu bán lẻ. |
| N06-03 | Khi cách hiểu trạng thái chưa rõ, hỏi ongoing hay có cả hủy/đóng; khi đã loại cả completed/cancelled thì giữ đúng predicate. Không dùng điều kiện chưa từng được user bổ sung. |
| N06-04 | Sau query chưa hoàn tất/chưa hủy và reload session, hỏi lâu nhất chỉ trả đơn đang chờ; không chọn đơn completed cũ nhất toàn bộ nguồn. Chạy cả semantic flag true/false. |
| N07-02 | Câu chung có nhiều owner được đưa module option trước planning/API; câu đã nêu CTV bán lẻ không bị khóa sang tuyển sinh. Đây là kiểm chứng bước chọn nguồn/làm rõ, chưa phải báo cáo hoa hồng toàn bộ CTV bằng AI thật. |
| N07-04 | Hỏi số điện thoại nối tiếp giữ search/phạm vi cũ và nhận diện công khai, không bị coi là thêm điều kiện không có căn cứ. |
| N08-01 | Thiếu tên thì mở selector, chưa đọc tồn toàn bộ. Với tên nói tự nhiên, tìm được sản phẩm ở trang 2, giữ ID riêng ở server qua chọn và revalidation, dispatch productId/warehouseId đúng, bảng nhận diện được sản phẩm. |
| N08-02 | Chọn kho native rồi không so literal nhãn “Trụ sở chính” với tên kho dài; quantity <=2 vẫn được giữ. Lọc text chính xác được yêu cầu riêng không bị đổi thành fuzzy. |

## Bằng chứng và giới hạn

- `server/assistant/testing/catalog-routing/captured-natural16.json`: chỉ giữ text/meaning/plan/fit tổng hợp của 16 ca; không chứa token/header hay bản ghi kinh doanh thô. Fixture không tự là nhãn đúng: test có kỳ vọng độc lập và các biến thể dữ liệu âm/dương.
- `natural16-read-regression.test.ts`: replay compiler, dữ liệu/logic, giới hạn không nới scope hoặc literal sai. `remaining-twelve-conversation.test.ts`: vòng session/reload, form lựa chọn, common dispatch, sản phẩm trang sau và lịch buổi tối. Các test cũ xác nhận ghi vẫn dừng ở preview/xác nhận.
- `warehouse-product-scope.test.ts`, `worker-project.service.test.ts`, `schedule.controller.test.ts`: điều kiện công ty/chi nhánh, sản phẩm/dự án ngoài scope và truy vấn nguồn.
- Log local: `tmp/natural16-fix-20261127/regression-done.log`, `typecheck-done.log`. Guard cấm model/network/Mongo thật; request không được mock làm test thất bại.
- Đính chính log cũ: N06-03 chỉ chọn phân hệ, chưa bổ sung “chưa hủy”; fresh retry N07-02 chỉ có câu chung, lượt CTV thuộc conversation trước. Báo cáo 32 câu đã sửa phần diễn giải, không đổi số liệu AI thật lịch sử.

Chưa chạy lại AI thật/web/staging sau sửa; chưa sửa nhãn Sheet thành passed. Không mở rộng hai ca thiếu khả năng tổng hợp số buổi vắng/đi muộn hoặc coi các ca bị chặn/chưa chạy khác là đã đạt. Bước xác minh tiếp theo cần chạy lại bộ câu bằng AI thật trong một ngân sách được duyệt; mọi thao tác ghi vẫn dừng ở xác nhận.
