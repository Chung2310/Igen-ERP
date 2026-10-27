# Kho dùng chung: nhập/xuất, điều chuyển và đối soát

Phạm vi được chọn: nâng cấp kho ERP từ các cải tiến Bán lẻ, dùng cho nhiều ngành. ERP `5bd5a23f`, nguồn tham khảo Bán lẻ `6e5bd2e3`.

## Quyết định triển khai

- Giữ danh mục, SKU, đơn vị tính và API hiện có của ERP. Không seed danh mục điện thoại hoặc thay hệ thống barcode.
- Hàng theo số lượng nhận số lượng dương, gồm số lẻ. Chỉ hàng `serial`/`unit_barcode` bắt buộc định danh từng đơn vị và số lượng nguyên. Hàng theo lô hiện chỉ có số tồn tổng; báo cáo không tuyên bố đã kiểm tra từng lô/hạn dùng.
- Nhập qua phiếu nhập hiện có; xuất thủ công giữ lịch sử, không sửa/xóa phiếu đã ghi sổ. Bổ sung trạng thái sử dụng nội bộ và đảo nguyên phiếu xuất khi chứng từ/ledger còn khớp.
- Điều chuyển mới ghi cả xuất kho gửi và nhập vị trí vận chuyển trong một transaction. Nhận/hủy chuyển ghi hai chặng tiếp theo và cùng cập nhật định danh. Phiếu cũ không có vị trí vận chuyển tiếp tục dùng đường tương thích, không tự backfill.
- Thêm tab đối soát chỉ đọc theo doanh nghiệp/chi nhánh/kho, dùng snapshot. Không coi tồn đầu kỳ bằng 0 nếu chưa có baseline xác nhận. Thể hiện riêng lỗi và mục cần rà soát; không có nút tự sửa tồn.
- Giữ ràng buộc công ty/chi nhánh, quyền inventory, nguồn giá vốn và các tích hợp POS/Finance. Không thay model đối tác, điểm thưởng, payroll hoặc Marketing.

## Giao diện

Dùng `DESIGN.md`, token ngữ nghĩa, ConfirmDialog và native dialog có sẵn. Nhãn dùng hàng hóa/sản phẩm/đơn vị; Serial/IMEI chỉ là trường tùy tracking mode. Tồn vận chuyển không được chọn làm kho xuất/nhập thông thường. Báo cáo hiển thị phạm vi, thời điểm, trạng thái hoàn tất và giới hạn dữ liệu.

## Kiểm chứng

Kiểm tra hàng số lượng lẻ và hàng theo từng đơn vị; nhiều SKU; giữ lượng/giá trị khi chuyển/nhận/hủy; gửi lặp; sai kho/công ty; rollback; đảo chứng từ; phiếu cũ. Đối soát phải không ghi DB, không kết luận sạch khi thiếu baseline hoặc báo cáo chưa hoàn tất. Chạy test liên quan, lint, typecheck và build. Render các phần UI thay đổi ở 390/768/1440 px khi có công cụ.

## Kết quả thực hiện

- Nhánh `feat/inventory-operations-reconciliation`. Chưa commit/push trong đợt này.
- Bộ Vitest kho và stock movement: 17 file / 95 ca qua. Sau đó bổ sung hai ca nhập hàng thực tế; suite nghiệp vụ mới đạt 15/15, gồm xác nhận lặp và rollback đồng thời tồn, định danh, công nợ khi ghi sự kiện thất bại.
- Bộ Node test catalog/serial/barcode: 28 ca qua. Model phiếu nhập: 6 ca qua. Adapter Finance: 4 ca qua.
- `npm run lint`, ESLint riêng các file mới và phần UI chính, `npm run typecheck`, `npm run build` đều qua. Build còn cảnh báo kích thước bundle hiện hữu; test backend có cảnh báo Redis fail-open của môi trường test. Lỗi dialog trong tbody đã sửa ở lượt rà soát tiếp theo.
- Chrome headless với API giả lập: kiểm tra 390/768/1440 px, sáng/tối, báo cáo có dữ liệu/rỗng/lỗi/đang chạy; không tràn chiều ngang trang. Form điều chuyển phân biệt số lẻ với số nguyên và mã từng đơn vị, đóng bằng Escape. Điều chỉnh tương phản chữ phụ tại các component mới. Đã đóng preview và xóa hồ sơ/ảnh tạm.

## Giới hạn triển khai

- Chưa chạy trên cơ sở dữ liệu thật hoặc chuyển dữ liệu cũ. Test dùng MongoDB replica set tạm và binary đã có sẵn; không cài thêm dependency.
- Nhập/xuất/điều chuyển cần MongoDB hỗ trợ transaction; báo cáo cần snapshot read. Không dùng cách ghi từng phần khi transaction không khả dụng.
- Đối soát chi tiết lô/hạn dùng chưa thuộc khả năng dữ liệu hiện tại; báo cáo đánh dấu cần kiểm tra. Phiếu điều chuyển lịch sử không có vị trí vận chuyển được giữ tương thích và đánh dấu cần rà soát.
- Báo cáo giới hạn 5.000 bản ghi/lần, lưu tối đa 500 phát hiện để trả về web và giới hạn thời gian. Khi không thể quét hết, trả lỗi chưa hoàn tất; chia phạm vi theo kho để chạy lại.

## Rà soát và sửa lỗi tiếp theo

- Đã tái hiện và sửa trường hợp xuất/chuyển 0,1 rồi 0,2 từ tồn 0,3 bị báo thiếu do sai số IEEE-754. Dung sai chỉ hấp thụ nhiễu số học, được chặn tối đa 0,000000001, nhỏ hơn lượng di chuyển tối thiểu; áp dụng cùng kiểm tra nguyên tử tại DB, giữ đúng tồn giữ chỗ và không để tồn cũ âm cực nhỏ.
- Kiểm tra định dạng từng dòng và danh sách định danh trước khi truy cập; dữ liệu sai trả 400. Chuẩn hóa ObjectId để không lặp cùng SKU bằng chữ hoa/thường.
- Đổi kho gửi đặt lại dòng hàng và bỏ kho nhận nếu trùng kho gửi. Khi hủy/đảo thất bại, đóng hộp xác nhận để lỗi hiển thị rõ. Không hiện nút đảo trên log có refId từ chứng từ khác dù refType bị thiếu.
- Không cho chạy đối soát khi đang đọc tệp tồn đầu kỳ; chỉ tệp được chọn sau cùng được cập nhật kết quả, bỏ tệp cho phép chọn lại cùng tệp.
- Đưa native dialog chi tiết đơn vị ra document.body bằng portal; đặt lại trạng thái theo kho/SKU và chỉnh độ tương phản tối. Test xác nhận dialog không còn là con của tbody.
- Bộ Vitest kho/stock movement chạy tuần tự: 19 file, 108/108 ca qua. Sau sửa dialog chạy lại UI liên quan; riêng suite dùng chung 4/4 ca qua và không còn cảnh báo DOM. Fixture được chờ bằng async act trước khi kiểm tra.
- Browser với API giả lập: 9 tổ hợp đối soát/điều chuyển/chi tiết ở 390/768/1440 px, gồm sáng/tối; các kiểm tra chờ tệp, xóa dòng cũ, portal, Escape và chống tràn ngang đều qua. Preview và hồ sơ tạm đã được đóng/xóa.
