# Kho pháp lý dùng chung — đợt 1 và đợt 2

## Sử dụng

1. Đăng bài trong Blog. Chọn **Thêm file pháp lý vào kho tri thức** trên bài đăng, hoặc mở **Pháp lý** ở đầu kênh và chọn bài đăng.
2. Tải file PDF có lớp văn bản, DOCX, TXT hoặc Markdown (tối đa 10 MB). Nhập số hiệu, cơ quan, ngày ban hành/hiệu lực, nguồn HTTPS chính thức, mô tả phạm vi và mã doanh nghiệp. Để trống danh sách mã nghĩa là áp dụng toàn hệ thống; người duyệt phải xác nhận lựa chọn này.
3. Worker đọc file và lập chỉ mục. File scan không trích xuất được văn bản sẽ báo lỗi, không được duyệt. Bản chờ duyệt có thể sửa metadata; nếu xử lý lỗi, dùng **Thử xử lý lại**.
4. Biên tập viên mở **Xem nội dung / duyệt**, đối chiếu file gốc, kiểm tra phạm vi và quan hệ thay thế, đánh dấu xác nhận và duyệt.
5. AI tự dùng bản đã duyệt khi đến ngày hiệu lực. File pháp lý hiện trên bài blog liên quan; doanh nghiệp chỉ xem được tài liệu đã duyệt trong phạm vi của mình.

Quyền: `blog_author` được tiếp nhận tài liệu và sửa bản nháp của mình; `blog_editor` và `superadmin` được quản lý, duyệt, thu hồi. Quyền đăng blog thông thường không tự cấp quyền công bố pháp lý toàn hệ thống. Người đọc blog có thể xem nguồn pháp lý đã công bố đúng phạm vi; truy xuất qua AI vẫn yêu cầu quyền đọc kho tri thức như trước.

## Quy tắc hiệu lực

- Ngày nhập tính từ 00:00 giờ Việt Nam. `effectiveTo` là mốc kết thúc không bao gồm ngày đó.
- Bản đã duyệt giữ cố định nội dung, revision và file nguồn. Không cho sửa metadata sau duyệt.
- Thay thế **toàn văn** trỏ đến một văn bản gốc tiền nhiệm, cùng danh sách doanh nghiệp và ngày hiệu lực mới phải muộn hơn. Người duyệt chịu trách nhiệm xác nhận phạm vi pháp lý thực sự tương ứng. Sửa đổi từng phần dùng luồng đối chiếu bên dưới.
- Thời điểm công bố ghi revision và quan hệ thay thế trong một cập nhật có điều kiện. Unique index trên `replacementClaim` ngăn hai người duyệt hai bản thay thế cùng tiền nhiệm.
- Kiểm tra hiệu lực và chuỗi thay thế khi truy xuất; không cần cron kích hoạt và không có cache pháp lý riêng.
- Bản chờ duyệt không thay thế bản đang dùng. Nếu bản cũ có ngày hết hiệu lực, bản cũ bị loại đúng ngày đó dù bản mới chưa xử lý xong.
- Thu hồi/hết hiệu lực bản mới không khôi phục bản cũ đã bị thay thế. Giữ metadata duyệt và quan hệ thay thế để lưu lịch sử.
- Xóa bài blog không thu hồi văn bản. Thu hồi cần thao tác riêng có lý do, người thực hiện và thời gian.
- Tra cứu AI mặc định dùng nguồn hiện hành. Có thể ghi rõ `tại ngày YYYY-MM-DD` hoặc `tại ngày DD/MM/YYYY` để dùng hiệu lực pháp lý tại ngày đó. Đây là lịch sử hiệu lực theo những nguồn đã được duyệt trong hệ thống, không phải bản sao dữ liệu hệ thống từng biết ở quá khứ.

## Đợt 2: sửa đổi, bổ sung và bãi bỏ từng phần

1. Mở **Cấu trúc điều/khoản** của văn bản gốc. Hệ thống gợi ý ranh giới từ tiêu đề Điều và số khoản. Người biên tập kiểm tra từng phần; có thể đặt con trỏ để tách, gộp với phần tiếp, sửa mã và tên phần. Nội dung lấy nguyên văn file, không được viết lại hay bỏ sót ký tự. Với văn bản đã công bố từ đợt 1, chỉ biên tập viên/superadmin được xác nhận cấu trúc một lần.
2. Tải văn bản sửa đổi dưới dạng bản chờ duyệt và kiểm tra cấu trúc của file mới. Các phần nguồn phải được tách đủ nhỏ để không trộn nội dung cũ được trích dẫn với nội dung mới cần áp dụng.
3. Mở **Đối chiếu sửa đổi**, chọn văn bản gốc. Với mỗi phần bị tác động, chọn sửa đổi/bãi bỏ/bổ sung, mã và tên phần đích, phần nguồn trong file mới. Nếu phần này đã được sửa trước đó, chọn đúng văn bản sửa đổi trước trong **Phiên bản trước**. Văn bản sửa đổi và văn bản gốc phải cùng danh sách doanh nghiệp.
4. Có thể bấm **AI gợi ý đối chiếu**. Tính năng sử dụng OpenRouter đang được cấu hình cho chatbot, chỉ chạy khi bấm nút. Gợi ý phải có trích dẫn đúng nguyên văn nguồn, mã nguồn/đích hợp lệ; người dùng thêm từng gợi ý vào đối chiếu, kiểm tra và lưu. AI không tự duyệt, không sửa nội dung file. Giới hạn đầu vào đối chiếu là 80.000 ký tự; quá giới hạn thì dùng đối chiếu thủ công, không âm thầm cắt dữ liệu.
5. Người duyệt kiểm tra nội dung trước và sau, các căn cứ bãi bỏ và ngày hiệu lực, rồi duyệt. Khi chỉ thay một khoản, những phần khác vẫn được sử dụng. Khi thay cả một điều đã được tách thành nhiều phần, phải đối chiếu tất cả phần liên quan.
6. Mở **Nội dung áp dụng theo ngày** để xem các phần còn hiệu lực và nguồn tương ứng tại ngày được chọn. Đây là bản đối chiếu phục vụ tra cứu, không phải văn bản hợp nhất chính thức.

Cấu trúc được lập chỉ mục theo từng phần, không dùng lại các đoạn chồng lặp giữa phần cũ và phần mới. Chỉ chuyển con trỏ cấu trúc sau khi tất cả đoạn đã được lưu; bản đã duyệt khóa cấu trúc và revision. Nếu xử lý lại file của bản nháp, cần kiểm tra lại cấu trúc theo revision mới.

Mỗi đối chiếu có một claim duy nhất cho `(văn bản gốc, mã phần, phiên bản trước)`. Unique multikey index ngăn hai bản đồng thời chiếm cùng phiên bản. Các thay đổi trong một văn bản được công bố cùng lúc trong một cập nhật có điều kiện. Thay toàn văn hoặc hết hiệu lực văn bản gốc cũng loại các phần sửa đổi phụ thuộc. Bản mới lỗi, hết hiệu lực hoặc bị thu hồi không làm phục hồi câu chữ cũ; bãi bỏ có nguồn riêng để AI trả lời đúng trạng thái bãi bỏ.

## Đợt 3: rà soát kho riêng của doanh nghiệp

Mở **Kho tri thức trợ lý → Rà soát pháp lý**. Danh sách và nội dung chỉ hiển thị trong quyền kho tri thức, doanh nghiệp, chi nhánh, phòng ban và quyền tài nguyên hiện có. Biên tập viên Blog không được cấp thêm quyền xem tài liệu riêng.

1. Worker nền quét một tài liệu trong mỗi lượt rảnh của worker lập chỉ mục. **Quét tiếp** xử lý tối đa 20 tài liệu đang cần quét trong phạm vi người quản lý. Quét tạo gợi ý khi trùng hash nội dung đã duyệt hoặc nhắc đúng số hiệu văn bản; không tự xác nhận hay xóa nội dung. Có thể **Thêm đối chiếu thủ công** nếu tài liệu không nhắc số hiệu.
2. Với **bản sao văn bản pháp lý**, người quản lý kiểm tra và xác nhận dùng nguồn chung. AI ngừng truy xuất toàn bộ bản sao trong kho riêng; file gốc vẫn còn. Cơ chế này tiếp tục bảo vệ khi file nội bộ đổi hoặc văn bản chung bị thay thế/thu hồi. Chỉ chọn khi file không chứa hướng dẫn nội bộ cần giữ làm nguồn trả lời.
3. Với **quy trình nội bộ**, chọn toàn tài liệu hoặc các đoạn phụ thuộc và, nếu đã có cấu trúc, điều/khoản làm căn cứ. Hệ thống lưu dấu hiệu phiên bản nội bộ và nội dung pháp lý đang có hiệu lực. Khi phần pháp lý được theo dõi thay đổi, AI tạm ngừng phần phụ thuộc, giữ phần còn lại. Phạm vi đoạn bao gồm đoạn liền kề để bảo vệ nội dung giao nhau.
4. Khi file nội bộ đổi revision, vị trí đoạn cũ không còn đáng tin: toàn tài liệu tham chiếu tạm ngừng cho đến khi người quản lý đối chiếu lại. Mở đối chiếu, cập nhật tài liệu nếu cần và xác nhận kết quả. Nếu căn cứ đã hết hiệu lực, thêm liên kết căn cứ mới; chỉ bỏ liên kết cũ sau khi kiểm tra việc sử dụng lại nội dung.
5. **Bỏ liên kết** ngừng kiểm soát theo liên kết đó, có thể cho phép AI dùng lại nội dung nếu không còn liên kết khác chặn. Tất cả xác nhận yêu cầu tích kiểm tra, được ghi người thực hiện/thời gian/ghi chú, và từ chối nếu tài liệu, pháp lý hoặc quyết định đã thay đổi từ lúc mở màn hình.

Các liên kết đã xác nhận được kiểm tra lại ngay khi truy xuất, không phải đợi worker: ngày hiệu lực tương lai, thay thế, sửa từng phần, bãi bỏ và thu hồi đều tác động qua bản đối chiếu hiện hành. Nội dung bị chặn không được gửi tới dịch vụ xếp hạng hay mô hình trả lời; hệ thống chỉ đưa thông báo `legal_review` khi phù hợp câu hỏi. Tra cứu thử trong kho tri thức cũng kết hợp nguồn chung và nguồn nội bộ như chatbot.

Quét là gợi ý có giới hạn, không phải kiểm toán toàn bộ quy trình: chưa phát hiện được mọi diễn đạt gián tiếp, ảnh scan hay đoạn không ghi số hiệu. Bản pháp lý đã duyệt trước khi có `approvedContentHash` vẫn được gợi ý bằng số hiệu hoặc liên kết thủ công. Gợi ý bị bỏ qua chỉ xuất hiện lại khi nội dung nội bộ đổi; quyết định đã xác nhận không bị worker ghi đè. Rà soát thông báo hiện nằm trong màn hình kho tri thức, chưa gửi email/push.

## Kỹ thuật và vận hành

- `LegalDocument` lưu metadata, liên kết `postId`, phạm vi, lifecycle, nguồn và revision đã duyệt.
- Tái sử dụng `enqueueKnowledge` / knowledge worker và GridFS, lưu dưới namespace riêng `__LEGAL_SHARED__`. Tenant APIs bị chặn truy cập namespace này; không tạo doanh nghiệp với mã này.
- Một file được xử lý một lần cho tất cả doanh nghiệp liên quan. Các bản nháp cùng nội dung vẫn có danh tính độc lập; số hiệu văn bản có unique index để ngăn tiếp nhận trùng.
- Chatbot hợp nhất truy xuất kho nội bộ hiện tại với truy xuất pháp lý riêng. Truy xuất pháp lý đợt 1 dùng từ khóa có xếp hạng trên revision đã duyệt; kho nội bộ giữ nguyên cơ chế hybrid đang có.
- Không tải file từ URL do người dùng nhập; file gốc nhận qua multipart có giới hạn dung lượng. URL chính thức chỉ dùng làm nguồn trích dẫn.
- API nguồn file xác thực và kiểm tra phạm vi, trả download và `Cache-Control: private, no-store`.
- MongoDB tạo collection/index qua model; trước tiếp nhận/duyệt hệ thống chờ `LegalDocumentModel.init()`. Cần giữ worker hoạt động theo cấu hình hiện tại: worker nhúng hoặc `npm run rag:worker`.
- Không cần dịch vụ hoặc biến môi trường mới. Build/restart ứng dụng theo quy trình hiện có; thay đổi này không tự triển khai máy chủ production.
- `KnowledgeLegalReview` có unique index theo doanh nghiệp/tài liệu/văn bản pháp lý; lưu liên kết, dấu hiệu phiên bản và lịch sử. Scanner dùng lease 120 giây, thử lại lỗi sau 60 giây, cache danh mục tối đa 30 giây; đánh dấu hoàn thành có điều kiện để không bỏ qua thay đổi trong lúc quét. Có thể tắt riêng bằng `KNOWLEDGE_LEGAL_REVIEW_WORKER_ENABLED=false`; kiểm soát truy xuất các liên kết đã xác nhận vẫn hoạt động.

## Kiểm tra trước khi đưa lên môi trường dùng thật

Đã bổ sung kiểm thử policy, service, API multipart/phân quyền, truy xuất và giao diện. Kiểm thử service dùng mock database; vẫn cần thử trên staging với MongoDB và file PDF/DOCX thực tế của doanh nghiệp, bao gồm hai lần duyệt cạnh tranh, worker lỗi rồi thử lại và tài khoản thuộc hai doanh nghiệp khác nhau.

## Phần còn lại

- AI tự điền metadata, OCR file scan, đối chiếu tự động nhiều văn bản gốc trong một lần và văn bản hợp nhất chính thức.
- Tự suy ra doanh nghiệp áp dụng từ loại hình/địa bàn; đợt 1 dùng lựa chọn mã doanh nghiệp có kiểm tra tồn tại.
- Mở rộng nhận diện ngữ nghĩa cho các tham chiếu pháp lý không ghi số hiệu, tối ưu phân trang/quét cho kho rất lớn và bổ sung thông báo chủ động.
- Gửi thông báo theo doanh nghiệp, chỉnh sửa/cải chính văn bản đã công bố và công cụ xử lý các bản ghi lưu trữ.

Không dùng luồng thay thế toàn văn để xử lý văn bản chỉ sửa một phần.
