# Báo giá trong ERP

Port nghiệp vụ và giao diện từ `Quote-assistance`, đồng bộ đến commit `106539f` (11/11/2026). `source-manifest.json` lưu commit và hash của source gốc để đối chiếu. Các test `node:test` gốc dùng hậu tố `.node-test.ts` để không bị Vitest thu thập nhầm.

## Phạm vi

- Module `quotation`, tab **Báo giá**, URL `/bao-gia`, API `/api/v1/quotation`.
- Danh mục/bảng giá riêng cho việc báo giá, nhập đa sheet, sửa giá/thuộc tính, mẫu tài liệu, báo giá đơn giá, dự toán, AI yêu cầu/file và tư vấn ngân sách.
- Luồng duyệt, hợp đồng thương mại, ghi nhận ký, nghiệm thu và hồ sơ quyết toán; lưu/xem/tải file đã xuất và thử lại tác vụ lỗi.
- Dùng JWT, công ty/chi nhánh, bộ quyền, gói AI và kho file riêng tư của ERP. Có thể chọn khách hàng ERP khi có quyền và module Khách hàng được bật; thông tin được chụp vào chứng từ.

**Danh mục Báo giá độc lập hoàn toàn với Kho & Sản phẩm/POS.** Không nhập, đồng bộ, tham chiếu hay ghi vào sản phẩm/giá/tồn Kho ERP. Không phát sinh phiếu kho, thu/chi hoặc hóa đơn khi duyệt báo giá, ký hợp đồng hay hoàn tất nghiệm thu.

Collections dùng namespace `quotation_*`. Mọi truy vấn nghiệp vụ đều bị ràng buộc `companyCode` và `branchId` tại repository. ID công ty tương thích QUOS là hash của công ty/chi nhánh, không phải ID tenant ERP. Không sao chép users, sessions, SaaS billing hay đăng nhập độc lập của QUOS.

## Sản phẩm và bảng giá

Màn Bảng giá hỗ trợ thêm thủ công, sửa, nhân bản bằng SKU mới, ngừng/bật áp dụng, xóa mềm và khôi phục. Nhân bản mặc định ngừng áp dụng và chọn lại thời gian hiệu lực. Xóa giữ nguyên bản ghi/SKU để bảo toàn tham chiếu; khôi phục luôn ở trạng thái ngừng áp dụng. Không có thao tác xóa vĩnh viễn. Giá đã chụp trên chứng từ đã lưu không bị cập nhật theo catalog.

Chọn từng dòng hoặc trang hiện tại để bật/ngừng, xóa, khôi phục, điều chỉnh giá và xuất các dòng đã chọn. Tối đa 200 sản phẩm mỗi lệnh. Điều chỉnh giá có xem trước và hash xác nhận; bản sửa cũ trả 409. Giá VND làm tròn theo đồng, tiền tệ khác theo 2 chữ số thập phân. Điều chỉnh số tiền chỉ áp dụng cho cùng tiền tệ; phần trăm hỗ trợ nhiều tiền tệ.

API `/api/v1/quotation`: `POST /catalog`, `PATCH /catalog/:id`, `POST /catalog/:id/duplicate`, `DELETE /catalog/:id`, `POST /catalog/:id/restore`, `POST /catalog/bulk/preview`, `POST /catalog/bulk`. Gửi `Idempotency-Key` cho tạo/nhân bản/xóa/khôi phục/bulk; sửa/xóa/khôi phục đơn lẻ gửi phiên bản ISO trong `If-Unmodified-Since`. Nhân bản gửi `sourceUpdatedAt`. Bulk gửi `selection: [{ id, updatedAt }]`, `action`, `adjustment` nếu điều chỉnh giá, rồi gửi kèm `previewHash` từ bước xem trước. Gửi lại cùng key/nội dung trả kết quả đã lưu, không tăng giá hoặc tạo bản ghi lần hai; key đổi nội dung bị chặn 409.

`GET /catalog` mặc định không trả sản phẩm đã xóa, giữ giao diện API cũ tối đa 5000 dòng và có cờ `truncated`. Có thể gửi `page`, `pageSize` (tối đa 1000), `q`, `sort`, `status` và `includeDeleted=all`. Màn quản lý tải lần lượt các trang để tìm/lọc/xuất toàn bộ danh mục, không cắt mất dữ liệu ở dòng 5000.

Nghiệp vụ lưu bằng transaction trên replica set MongoDB của ERP; audit có giá trị trước/sau và người thực hiện. `quotation_catalogOperations` lưu kết quả chống lặp theo công ty/chi nhánh và key, có index duy nhất được khởi tạo cùng module. Các trường xóa mềm là tùy chọn, không cần sửa hàng loạt dữ liệu cũ. Quyền xem/xuất là `quotation-price-book:read`; các thay đổi cần `quotation-price-book:manage` và không sử dụng lượt AI.

Import giá dùng chung validation và transaction; SKU đã xóa bị chặn trước khi áp dụng toàn bộ file. Với sản phẩm đang có, import không tự bật lại sản phẩm ngừng áp dụng, giữ ngày hiệu lực khi file không có ngày, hợp nhất thuộc tính để giữ thông tin nhập tay. Muốn xóa ngày/thuộc tính, dùng form sửa sản phẩm. Các luồng AI tạo mới dùng catalog hiện hành thay vì lấy đơn giá trong file nguồn cũ; sản phẩm đã xóa/ngừng/hết hiệu lực không được chọn mới. File nguồn vẫn được giữ để đối chiếu.

## Bật module

1. Bật `quotation` trong cấu hình module doanh nghiệp. Module không tự bật cho doanh nghiệp hiện có.
2. Cấp quyền `quotation:read`/`quotation:manage` cùng các quyền chuyên biệt cần dùng: `quotation-approval`, `quotation-price-book`, `quotation-template`, `quotation-ai`, `quotation-contract`, `quotation-acceptance` (mỗi nhóm có `read`/`manage`). Quyền quản lý báo giá không tự cấp quyền duyệt hoặc AI.
3. Chọn chi nhánh hoạt động. Nhập thông tin bên bán tại **Cài đặt** trong module; tải bảng giá và mẫu tài liệu phù hợp.
4. Cấu hình OpenRouter, Cloudinary và worker như dưới đây. Không cần bật Inventory, POS hoặc Marketing.

## Worker và xuất tài liệu

API và worker dùng cùng MongoDB, Redis, Cloudinary, OpenRouter và `QUOTATION_QUEUE_PREFIX`. Prefix phải riêng cho từng môi trường. MongoDB cần hỗ trợ transaction cho ledger AI ERP hiện có (replica set khi chạy cục bộ).

```sh
npm run dev
# Terminal riêng, QUOTATION_WORKERS_ENABLED=true:
npm run dev:quotation-worker
```

Production: `npm run build` tạo `dist-server/quotation-worker.cjs`; chạy `npm run start:quotation-worker`. Docker: `docker compose --profile quotation up -d igen-erp quotation-worker`. Worker yêu cầu `QUOTATION_WORKERS_ENABLED=true` và prefix tường minh. Các biến còn lại được mô tả trong `.env.example`.

`QUOTATION_DOCUMENT_EDIT_MODE=direct` giữ cơ chế OpenRouter sửa file trực tiếp của QUOS mới. `mapping` giữ đường dựng file cục bộ của ERP khi cần kiểm thử hoặc vận hành. Toàn bộ luồng AI Báo giá dùng cố định `openai/gpt-6-luna`, giống bản nguồn; các biến model cũ không ghi đè lựa chọn này.

Popup dùng chung hiển thị phần trăm cho phân tích, gợi ý, tính lại dự toán, nhập file và tạo file báo giá/dự toán/ngân sách/hợp đồng/nghiệm thu/quyết toán. Phần trăm khi AI xử lý là ước tính, tối đa 94%; chỉ lên 100% sau khi tác vụ thành công và có file đã lưu. Lỗi giữ lại thông báo để đóng chủ động. Chuyển tài khoản, công ty, chi nhánh hoặc rời module sẽ hủy theo dõi ở client và dọn tiến độ cũ; tác vụ nền đã xếp hàng vẫn giữ trên máy chủ.

Tất cả nhóm mẫu hỗ trợ Word, Excel và PDF hợp lệ, giữ định dạng đã chọn. Bộ xử lý mới mở rộng hoặc thu gọn bảng sản phẩm Word, dọn dòng Excel thừa, cập nhật ô gộp và giá trị công thức, điền thông tin các bên và bảo toàn số trang PDF. Mẫu Word có trường tường minh được điền cục bộ khi xác định được chắc chắn, không thay bằng mẫu khác.

Lượt AI người dùng được ghi nhận cho các lần gọi model nghiệp vụ thành công; fallback/thử sửa phản hồi có thể dùng nhiều hơn một lượt. Bước dọn sandbox của chế độ `direct` là chi phí vận hành riêng, không trừ thêm lượt người dùng; được ghi trong `quotation_auditLogs` với action `ai_sandbox_cleanup`. Nhà cung cấp vẫn có thể tính phí cho bước này. Lỗi dọn sandbox được ghi nhận nhưng không làm mất kết quả tài liệu đã tạo.

Client truyền `companyCode` qua query được URL-encode, hỗ trợ mã doanh nghiệp có dấu cho cả fetch/upload/download; server luôn đối chiếu với phiên ERP và chi nhánh. Phương án ngân sách cũ dùng `createdAt` làm phiên bản ban đầu và được nâng sang `updatedAt` khi sửa lần đầu, không cần sửa dữ liệu hàng loạt. Giao diện nhớ phiên bản từ danh sách/chi tiết để chặn hai tab ghi đè nhau.

Lưu dự toán/hợp đồng/nghiệm thu độc lập với tạo file. Khi AI hoặc kho file lỗi, chứng từ đã lưu được giữ lại và có nút tạo lại file. Tạo báo giá khách cần quyền AI ngay từ đầu vì tự xếp hàng xuất file; thiếu quyền bị chặn trước khi ghi chứng từ. Thêm sản phẩm vào bảng giá qua phương án ngân sách cũng cần `quotation-price-book:manage`.

Lệnh xuất được lưu vào MongoDB trước khi gửi BullMQ. Worker khôi phục các lệnh queued khi Redis/API bị gián đoạn; trước khi chạy sẽ kiểm tra lại tài khoản, module, chi nhánh, quyền và nội dung nguồn. Cùng nội dung/lệnh/người tạo được khử trùng. Tác vụ running quá 30 phút được đánh dấu lỗi để người dùng kiểm tra và chủ động thử lại, tránh tự gọi lại AI khi kết quả nhà cung cấp chưa rõ.

Chỉ gắn file thành công vào tác vụ khi file đã được lưu riêng tư và chứng từ nguồn chưa đổi. Bản nháp không bị xóa khi xuất lỗi; các bản đang chờ file vẫn có trong danh sách. File hợp đồng/nghiệm thu có quyền tải riêng, kể cả khi truy cập qua Tài nguyên ERP. Cập nhật bảng giá không đổi đơn giá đã chụp trên chứng từ. Header `If-Unmodified-Since` và cập nhật có điều kiện chặn ghi/duyệt trên dữ liệu đã thay đổi.

## Kiểm tra và vận hành

### Tạo báo giá và tạo lại dự toán

Các dòng chọn từ bảng giá khi gọi `POST /customer-quotes` hoặc `POST /quotes` phải gửi `catalogUpdatedAt` (ISO từ `updatedAt`, hoặc `createdAt` của dữ liệu cũ). Thiếu phiên bản trả 428; sản phẩm đã đổi giá/thông tin, ngừng áp dụng hoặc xóa trả 409 trước khi tạo chứng từ. Báo giá chỉ chứa một tiền tệ; tiền tệ và thuộc tính sản phẩm được chụp cùng đơn giá. Tạo dự toán từ báo giá khách tiếp tục dùng bản chụp này khi bảng giá đã thay đổi.

Nút **Lưu và chạy lại AI** gửi `PATCH /quotes/:id` với các trường đang sửa, `revisionRequirements` và `recalculateWithAi: true`. API yêu cầu `If-Unmodified-Since`, quyền quản lý Báo giá và quyền AI; chỉ lưu sau khi AI thành công và phiên bản/quyền truy cập vẫn hợp lệ. API cũ `POST /quotes/:id/recalculate` với `{ additionalInformation }` tiếp tục hỗ trợ client cũ.

AI điều chỉnh hạng mục/số lượng; sản phẩm không đổi quy cách giữ giá đã lưu, sản phẩm mới hoặc đổi quy cách cần bổ sung giá. Yêu cầu mới và câu trả lời mới được ưu tiên hơn yêu cầu cũ; VAT/phí vận chuyển đã chốt được giữ khi không có thay đổi rõ ràng. Câu hỏi chưa trả lời được giữ lại. Lưu thông tin mới mà chưa chạy AI đặt cờ `requiresAiRecalculation` để chặn duyệt; chạy AI thành công sẽ gỡ cờ và giao diện tạo lại file theo dữ liệu mới. Lỗi AI/xung đột giữ chứng từ đã lưu và nội dung đang nhập. Câu hỏi bổ sung chưa trả lời không tự chặn duyệt khi đơn giá, VAT và vận chuyển đã chốt; lý do chặn duyệt được hiển thị cụ thể.

```sh
npm run test:quotation
npm run typecheck
npm run build
```

Test dùng MongoDB tạm và mock nhà cung cấp/queue khi phù hợp, không dùng dữ liệu hay dịch vụ AI production. Browser QA cục bộ dùng fixture để kiểm tra màn hình ở 390/768/1440 px; không thay thế UAT với mẫu doanh nghiệp và OpenRouter/Cloudinary/Redis thật.

Theo dõi collection `quotation_generatedExportJobs` với trạng thái queued/running/failed, log `[quotation-worker]`, ledger AI ERP và dung lượng mẫu/file. Lỗi index Tài nguyên được ghi `resourceIndexPending` trên file để sửa chỉ mục; lỗi ghi metadata sau upload được ghi `quotation_storageOrphans` để đối soát/xóa file mồ côi. Không tự xóa file khi chưa xác minh.

Chưa chạy migration dữ liệu QUOS cũ hoặc triển khai production. Nếu cần chuyển lịch sử, phải mapping công ty/chi nhánh/người dùng và file, chạy dry run và đối soát trước. Rollback tính năng: tắt module và worker, giữ nguyên `quotation_*` và file để tra cứu/khôi phục; không đụng collection Kho/POS/HR hiện có.
