# Kiểm tra tích hợp Báo giá — 07/11/2026

- Nguồn QUOS: `9fa13e566d3d935b1c432f63badcbcc27fd97745`; checkout QUOS có thay đổi cục bộ được giữ nguyên.
- `npm run test:quotation`: 184 test qua (92 test engine Node và 92 test Vitest). Gồm công ty/chi nhánh, quyền xem/duyệt/tải, xung đột sửa/duyệt, quản lý sản phẩm, giữ bản nháp khi job lỗi, khử trùng job, transport ERP, ledger AI và registry Tài nguyên.
- Kiểm thử danh mục độc lập: cùng SKU, sửa bảng giá Báo giá không đổi bản ghi giá Kho/POS. HTTP hoạt động khi doanh nghiệp chỉ bật `quotation`; API nhập sản phẩm Kho ERP không tồn tại.
- Cài dependency bằng `yarn install --frozen-lockfile`: qua; giữ nguyên các phiên bản thư viện ERP cũ.
- `npm run typecheck` và `npm run build`: qua, gồm API, web, worker Marketing và worker Báo giá.
- Browser fixture: 8 màn hình × 390/768/1440 px, không có lỗi JavaScript hoặc tràn chiều ngang. Rà form tạo báo giá khách, ngân sách và keyboard/dialog. Axe không báo lỗi WCAG A/AA trên Tổng quan, hai form tạo mới và màn hình Ngân sách tối trong fixture cuối.

## Rà bảng giá, luồng sản phẩm và tạo lại dự toán

- Sửa tiền tệ báo giá khách bị mặc định VND; chặn chọn nhiều tiền tệ trong cùng chứng từ; chụp cả thuộc tính sản phẩm. HTTP test đi từ sản phẩm USD → báo giá khách → dự toán, giữ giá 10 USD dù giá danh mục đã thay đổi.
- Các lệnh tạo báo giá kiểm tra `catalogUpdatedAt` từ lần chọn sản phẩm. Giá/thông tin/trạng thái đã đổi trả 409; thiếu phiên bản trả 428. Chặn dòng sản phẩm trùng; bỏ lỗi frontend thay số lượng 0 bằng số lượng cũ. Giá trên chứng từ đã lưu không đổi theo danh mục.
- Tải đủ các trang danh mục khi chọn sản phẩm và sau import, giữ sản phẩm đã xóa trong màn quản lý. Import kiểm tra khoảng ngày sau khi hợp nhất với ngày cũ, hợp nhất thuộc tính theo tên chuẩn hóa và kiểm tra giới hạn 50 trường. File lỗi không áp dụng một phần.
- Thêm `POST /quotes/:id/recalculate` và nút **Tạo lại dự toán từ câu trả lời**. Kiểm thử câu trả lời hợp lệ/sai trường, thiếu quyền/phiên bản, chứng từ đã duyệt, lỗi AI và kết quả AI đến sau khi tab khác sửa/duyệt. Giữ VAT/phí vận chuyển, giá của dòng không đổi quy cách, câu hỏi chưa trả lời và sản phẩm đang gợi ý chưa có giá. Không phục hồi các câu hỏi/sản phẩm nguồn cũ sau khi tạo lại.
- Browser thật: nhập XLSX có tên file/sheet/cột tiếng Việt và thuộc tính Màu; chọn sản phẩm nhập 250.000 VND để tạo báo giá; sửa giá danh mục thành 300.000 VND rồi tạo dự toán vẫn nhận 250.000 VND. Luồng quản lý sản phẩm, tăng giá, xóa/khôi phục, xuất đúng hai SKU, hợp đồng/nghiệm thu và quyền chỉ xem tiếp tục qua.
- Form trả lời và hộp xác nhận được render sáng/tối ở 390/768/1440 px, không tràn ngang. Đã sửa tương phản vùng câu hỏi ở chế độ tối và vị trí dialog. Hộp xác nhận dùng modal gốc, focus nút Hủy, Escape đóng và trả focus về nút mở; Axe không báo lỗi A/AA tại hai vùng này. Phiên browser cuối không có lỗi JavaScript hoặc HTTP ngoài dự kiến; dữ liệu QA đã dọn sạch.
- Không gọi dịch vụ AI trả phí trong đợt này. Thành công của tạo lại được kiểm thử HTTP với engine AI giả lập; browser gọi API thật bằng doanh nghiệp QA không có gói AI, nhận lỗi rõ ràng và giữ câu trả lời đang nhập/dự toán đã lưu. Cần UAT nội dung thực tế với gói AI hợp lệ.
- Smoke test chốt ngày 07/11: 43/43 ca qua trong 5 file, gồm catalog transaction, route HTTP sản phẩm/báo giá/dự toán, tải danh mục theo trang, tạo lại từ câu trả lời và focus hộp xác nhận. Typecheck, build và ESLint các helper/service mới qua; không để app/worker chạy khi bàn giao theo yêu cầu chỉ chỉnh sửa và smoke test.

## Hồi quy ngoài module

15 test Node của cấu hình module/module guard qua. Test quyền Kho tri thức từng lỗi sẵn ở HEAD đã được xử lý bằng cách thêm guard quản lý vào route `/simulate-page-chat`, thống nhất với guard cấp module và các route mô phỏng khác. Bộ test access/feature-permissions hiện qua.

## Kiểm tra trên ERP đang chạy

Đăng nhập bằng doanh nghiệp/tài khoản kiểm thử tạm chỉ bật Báo giá, không dùng fixture thay API: 21 thao tác API qua, gồm tải mẫu (201), tạo báo giá khách (201), sửa bảng giá (200), tạo hợp đồng (201), ký hợp đồng (200), tạo nghiệm thu (201) và hoàn tất nghiệm thu (200). Sửa bảng giá bằng phiên bản cũ bị chặn 409 đúng thiết kế. Bấm lưu hợp đồng và biên bản trong browser thành công. Mở đủ 8 màn hình trong khung ERP thật; không có lỗi JavaScript, HTTP 4xx thừa hoặc tràn ngang. Chi tiết hợp đồng/nghiệm thu được render ở 390/768/1440 px, nút lưu hoạt động và không tràn ngang. Kiểm tra 390 px không còn ô chọn chi nhánh che logo. Dữ liệu doanh nghiệp/tài khoản/job tạm được dọn sạch; hàng đợi không còn job kiểm thử.

Đã sửa Header/ChatbotWidget gọi API Chấm công/Trợ lý khi module tương ứng chưa bật; chặn đăng ký Messenger rỗng khi chưa chọn tài khoản; bổ sung điều kiện module cho đường dẫn Trợ lý AI. Dọn hai tiến trình dev trùng và cache Vite, chạy lại một phiên ERP.

Với tài khoản kiểm thử không có gói AI, worker trả lỗi rõ ràng và giữ nguyên bản nháp như mong đợi; không gọi nhà cung cấp hoặc phát sinh lượt AI. MongoDB thực tế là replica set `rs0`, Redis trả PONG, worker Báo giá đã đăng ký và hàng đợi hoạt động.

## Kiểm tra sâu bổ sung

- Đã tái hiện rồi sửa API trả 409 sau khi đã lưu bảng giá: chỉ kiểm tra phiên bản client ở lần đọc đầu của chứng từ trong request; lần đọc lại sau khi ghi trả đúng dữ liệu mới. Ghi có điều kiện vẫn chặn sửa từ phiên bản cũ.
- Đã tái hiện rồi sửa hai cập nhật cùng mili giây có thể ghi đè nhau: phiên bản `updatedAt` của lần ghi có kiểm soát luôn tăng ít nhất 1 ms so với phiên bản đã đọc.
- Đã sửa quyền giao diện hợp đồng/nghiệm thu: người có quyền quản lý chứng từ tương ứng được lưu mà không cần quyền sửa báo giá; người chỉ đọc không được hiển thị trường chỉnh sửa/nút lưu.
- Test HTTP đi hết duyệt dự toán → tạo hợp đồng → sửa → ký → nghiệm thu từng phần → sửa → hoàn tất. Chặn hợp đồng trùng, tạm ứng vượt tổng, nghiệm thu vượt số lượng, ngày nghiệm thu trước ngày ký, thanh toán vượt quyết toán, thao tác từ phiên bản cũ và sửa chứng từ đã khóa.
- Test worker với MongoDB replica set cô lập, renderer Excel thật và phản hồi OpenRouter/Cloudinary giả lập: tạo XLSX chứa đúng hạng mục, số lượng 1,5, đơn giá 100, thành tiền 150; upload dạng `authenticated`; lưu metadata theo doanh nghiệp/chi nhánh; job hoàn tất và xóa cờ chờ tạo file; ledger ghi dùng 1 lượt và giữ chỗ 0. Chứng từ bị sửa sau khi xếp hàng bị chặn trước khi gọi AI/upload. Không sử dụng dịch vụ trả phí thật.
- Kiểm tra ESLint trực tiếp các file sửa trong đợt kiểm tra sâu: không còn lỗi.

## Sửa lỗi sau UAT ngân sách

- Tái hiện đúng lỗi Chrome `Failed to execute 'set' on 'Headers': String contains non ISO-8859-1 code point.` với mã doanh nghiệp tiếng Việt. Sửa fetch và XHR truyền mã qua query được URL-encode; kiểm tra scope phía server vẫn chặn truy cập công ty khác. Upload giữ tên file tiếng Việt và thông báo lỗi/requestId theo envelope ERP.
- Đã bỏ nhánh frontend xóa dự toán sau lỗi xuất file. Luồng tạo mới thông báo chứng từ đã được lưu và mở chi tiết ngay cả khi file lỗi; có nút tạo lại file dự toán/hợp đồng/nghiệm thu. Kết quả file được kiểm tra lại khi nội dung chứng từ thay đổi; tác vụ đang chạy được poll để cập nhật kết quả.
- Client nhớ phiên bản từ danh sách bảng giá/ngân sách và payload dùng `id` hoặc `_id`. Phương án ngân sách có `updatedAt`; phương án cũ đối chiếu `createdAt` + điều kiện chưa có `updatedAt` trong lần ghi đầu, sau đó nâng phiên bản. Test hai tab xác minh sửa cũ trả 409 và giữ lần sửa mới.
- Test quyền ngân sách xác minh người chỉ có quyền sửa báo giá không tạo được sản phẩm trong bảng giá. Tạo báo giá khách thiếu quyền AI bị từ chối trước khi ghi DB. Menu, đường dẫn trực tiếp, nút phân tích/tính lại và tạo file được kiểm tra theo quyền tương ứng; danh sách nghiệm thu không gọi API danh sách hợp đồng khi thiếu quyền đọc hợp đồng. Picker khách hàng chỉ mở khi cả module nguồn và quyền đọc được bật.
- Test worker chạy renderer thực cho cả `mapping` và `direct` với provider giả lập. Tác vụ direct còn đúng 1 lượt vẫn hoàn tất, ledger dùng 1 lượt và giữ chỗ 0; dọn sandbox ghi audit riêng. Lỗi dọn sandbox không làm hỏng job/file đã hoàn tất và có audit thất bại.
- Browser ERP thật dùng doanh nghiệp QA có mã chứa `Đ`, chỉ bật Báo giá: mở đủ 8 màn hình, nhập form và bấm Phân tích ngân sách; request tới API rồi nhận chặn gói AI như dự kiến, không gọi provider thật. Đi hết tạo/lưu/ký hợp đồng và tạo/lưu/hoàn tất nghiệm thu. Tài khoản hạn chế chỉ thấy 4 mục được phép, nút AI bị khóa và URL bảng giá bị chặn ngay ở giao diện.
- Render form ngân sách và chi tiết thương mại ở 390/768/1440 px không tràn ngang. Sửa chữ chồng icon trong mô tả ngân sách, nối nhãn ngân sách với input và sửa tương phản chế độ tối. Axe trên form ngân sách sáng/tối không có lỗi WCAG A/AA. Browser không có lỗi JavaScript hoặc API ngoài trường hợp chặn AI dự kiến; doanh nghiệp/tài khoản/job QA được dọn sạch.
- `npm run lint`: không có lỗi; còn cảnh báo Fast Refresh cũ tại Sidebar. Kiểm tra ESLint trực tiếp các file adapter, quyền, transport, workflow và test sửa trong đợt này cũng qua.

## Quản lý sản phẩm Báo giá

- Thêm thủ công, sửa, nhân bản bằng SKU mới, ngừng/bật áp dụng, xóa mềm, xem đã xóa và khôi phục. Các trường metadata được giữ theo phạm vi công ty/chi nhánh; SKU đã xóa không thể tạo/import lại cho đến khi khôi phục. Khôi phục ở trạng thái ngừng áp dụng.
- Test service/HTTP xác minh tạo/nhân bản và lệnh xóa/khôi phục/bulk gửi lặp, key đổi nội dung, phiên bản cũ, sửa thiếu phiên bản, preview bị thay tham số, giá âm, số lượng chọn quá 200 và điều chỉnh số tiền khác tiền tệ. Test chèn lỗi ở lần ghi thứ hai xác minh lần ghi đầu và audit được rollback.
- Import theo bulkWrite trong một transaction, không ghi một phần khi có SKU đã xóa. Import thành công giữ trạng thái ngừng, ngày hiệu lực và thuộc tính nhập tay; không tự kích hoạt lại. Test snapshot chứng từ và bản ghi ERP productprices giữ nguyên sau sửa giá/xóa sản phẩm.
- Test dialog xác minh dữ liệu form/request key giữ lại sau lỗi mạng, bản sao có SKU mới và source revision, xác nhận bị khóa trước preview và preview mất hiệu lực khi đổi mức giá; xóa phải qua xác nhận rõ ràng.
- Browser ERP thật bằng doanh nghiệp QA mã có dấu: thêm sản phẩm, nhân bản mặc định ngừng áp dụng, chọn 2 sản phẩm tăng 10% từ 100.000 lên 110.000, xóa/khôi phục/bật lại. Xuất Excel thật qua Chrome và mở lại bằng XLSX xác minh đúng 2 SKU được chọn, không có sản phẩm ngoài lựa chọn.
- Tài khoản chỉ xem bảng giá đọc được danh sách nhưng không có checkbox/nút sửa, nút thêm bị khóa. Dialog thêm và preview hàng loạt render ở 390/768/1440 px, sáng/tối; Axe WCAG A/AA không có vi phạm trong 4 tổ hợp dialog/theme cuối. Dữ liệu công ty, người dùng, idempotency/job QA được dọn sạch.
- Đã khôi phục Docker/Redis local bị ngừng giữa đợt kiểm tra; không thay đổi cấu hình hay dữ liệu công ty thật để chạy kiểm thử.

## Giới hạn xác minh hiện tại

Chưa triển khai production hoặc chạy migration dữ liệu. Đã kiểm tra cả browser fixture và ERP thật bằng dữ liệu kiểm thử riêng. Chưa nghiệm thu nội dung tài liệu doanh nghiệp thật qua OpenRouter/Cloudinary với gói AI có lượt. Cần bật module/quyền, cấu hình bên bán, bảng giá/mẫu và worker theo README trước khi UAT. Không có dữ liệu Kho/POS/HR production bị thay đổi trong quá trình kiểm tra.
