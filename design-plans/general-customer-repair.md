# Khách hàng và sửa chữa/bảo hành dùng chung

Giữ thay đổi kho đang có trong worktree. Nguồn tham khảo Bán lẻ `6e5bd2e3`; không sao chép preset điện thoại, điểm thưởng hoặc hoa hồng mới.

- Hồ sơ khách hàng dùng chung công ty, phân loại cá nhân/doanh nghiệp độc lập với chế độ VAT; thêm người liên hệ doanh nghiệp. Giữ ID, lịch sử, VAT và API hiện có.
- Tiếp nhận sản phẩm, thiết bị hoặc hạng mục dịch vụ. Tách nguồn bên ngoài và serial đã bán trong hệ thống. Hàng gửi sửa không tăng tồn hàng doanh nghiệp.
- Phiếu dịch vụ không yêu cầu serial. Bảo hành dựa trên dữ liệu bán hàng đã lưu hoặc xác nhận có chứng từ/thời hạn của người quản lý; lưu người và thời điểm xác minh. Không tin trạng thái, số tiền hoặc quyền lợi bảo hành gửi từ client.
- Tiếp nhận chống gửi lặp, cập nhật phiếu và vòng đời serial cùng transaction; không tự liên kết hàng ngoài chỉ vì trùng chuỗi serial. Kết thúc/hủy phải trả đúng đơn vị đã tiếp nhận.
- Vật tư theo số lượng hỗ trợ số lẻ; ghi phiếu vật tư, tồn kho và tiền cùng transaction. Hàng cần định danh/lô chỉ được xuất qua quy trình có đủ bằng chứng, không âm thầm trừ số tồn tổng.
- Hiển thị lịch sử sửa chữa trong hồ sơ khách hàng theo quyền và chi nhánh. Giữ thanh toán an toàn hiện có, báo cáo và tích hợp Tài chính hiện hành.
- Kiểm chứng bằng replica set tạm, các test khách hàng/sửa chữa/kho liên quan, lint, typecheck, build và browser 390/768/1440 px. Không chuyển dữ liệu thật, không push trong lượt này.

## Kết quả triển khai

- Khách hàng có phân loại cá nhân/doanh nghiệp và người liên hệ; hồ sơ cũ chưa phân loại được giữ nguyên. VAT là thuộc tính riêng. Hồ sơ có tab Dịch vụ & bảo hành theo quyền và chi nhánh.
- Tiếp nhận dùng chung cho sản phẩm, thiết bị và dịch vụ; serial tùy chọn với hàng ngoài. Bảo hành hàng ngoài lưu chứng từ, thời hạn, người xác minh; hàng đã bán lấy quyền lợi từ dữ liệu hệ thống.
- Phiếu mới có khóa chống gửi lặp. Tiếp nhận, vòng đời hàng đã bán, xuất/trả vật tư và cập nhật số tiền chạy trong transaction. Vật tư số lượng hỗ trợ đơn vị lẻ, lấy giá vốn từ kho và trả về đúng kho gốc.
- Giao diện giữ khóa yêu cầu khi mất phản hồi để có thể thử lại an toàn; tổng tiền trên phiếu được làm mới sau khi cập nhật chi tiết. Đổi doanh nghiệp/chi nhánh xóa hồ sơ và form đang mở; phản hồi danh sách cũ không ghi đè bộ lọc mới.
- Giữ báo giá và lịch sử thu tiền. Hủy/trả phiếu đã thu tiền bị chặn đến khi xử lý hoàn tiền. Không xóa số tiền để che công nợ; chỉ chuẩn hóa sai số dấu phẩy động quanh số VND nguyên.

## Kiểm chứng hoàn tất

- 28 file Vitest của Khách hàng/Sửa chữa: 123 test qua, gồm integration với Mongo replica set tạm, rollback, gửi lặp, phân quyền/phạm vi và vật tư số lẻ.
- 26 Node test Khách hàng qua: hợp đồng API, chuẩn hóa, VAT, lịch sử mua hàng và optimistic concurrency.
- `npm run typecheck`, `npm run build`, `npm run lint` qua; ESLint trực tiếp các file cốt lõi mới cũng qua. Lệnh lint mặc định của ERP chỉ bao phủ một số trang gốc, không phải toàn repo.
- Đã render preview dùng dữ liệu giả ở 390/768/1440 px; kiểm tra tiếp nhận, vật tư và hồ sơ khách hàng, dark mode, tải/lỗi, Escape và trả focus. Không thấy tràn ngang trang hoặc lỗi runtime trong các trường hợp đã thử. Không kiểm thử browser với tài khoản và dữ liệu vận hành thật.
- `git diff --check` qua. Không thêm ký tự thay thế hoặc BOM mới; các BOM có sẵn được giữ nguyên. Preview tạm đã dừng và dọn; nguồn Marketing và Bán lẻ sạch.

## Giới hạn khi triển khai

- Chưa chuyển dữ liệu hoặc chạy migration/index trên cơ sở dữ liệu thật. Phiếu cũ chưa có metadata tiếp nhận giữ nhánh tương thích hiện có; các đảm bảo transaction mới áp dụng cho phiếu tiếp nhận chung mới.
- MongoDB cần replica set để chạy transaction. Cần bảo đảm các index khai báo trong model, đặc biệt khóa tiếp nhận duy nhất, được tạo theo quy trình triển khai của hệ thống.
- Vật tư theo serial/barcode đơn chiếc/lô bị chặn ở form xuất số lượng chung cho đến khi có luồng chọn định danh/lô tương ứng; không tự trừ tồn tổng.
- Build còn cảnh báo chunk lớn của ứng dụng. Không thay cấu hình build, dependency, `.env`, dữ liệu thật hoặc đẩy Git trong lượt này.
