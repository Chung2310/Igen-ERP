# Luồng search và tổng hợp dùng chung — 27/11/2026

## Phạm vi

Thay đổi bộ máy truy vấn đọc dùng chung, không nhận diện/vá từng câu hỏi và không thêm action riêng cho điểm danh. Action hiện tại hoặc tương lai có `analysis` dùng cùng schema, chuẩn hóa, kiểm tra ý nghĩa và thực thi. Giữ API và phân quyền theo tài khoản/công ty/chi nhánh, form chọn, xác nhận thao tác ghi và đường dispatch/completion hiện có.

## Luồng mới

```text
Yêu cầu + ngữ cảnh hội thoại
  → AI chọn nguồn đọc được cấp và biểu diễn điều kiện/chỉ tiêu
  → chuẩn hóa tên cột, nhãn, kiểu dữ liệu theo hợp đồng công khai
  → kiểm tra từng ý nghĩa và quan hệ VÀ/HOẶC/phủ định
  → dispatch đọc đủ nguồn trong giới hạn hiện tại
  → khôi phục nhóm trước nếu là câu hỏi tiếp, đối chiếu thành viên
  → where/filters: lọc dòng nguồn
  → groupBy + count/sum/avg: tính theo nhóm
  → having: lọc kết quả tổng hợp
  → extreme/sort/limit: cực trị, xếp hạng, giới hạn
  → bảng kết quả dùng chung hoặc xuất Excel
```

Không thêm lượt gọi model để thực hiện các phép tính này. Server tính trên dữ liệu đọc có phân quyền, không chạy mã/SQL do model sinh.

## Những thay đổi đã thực hiện

| Trước | Sau |
| --- | --- |
| Tổng hợp đi cùng xếp hạng/limit bị từ chối | Tính nhóm trước, rồi mới xếp hạng/limit trên kết quả nhóm |
| Không có bộ lọc sau tổng hợp | `having` hỗ trợ cây điều kiện VÀ/HOẶC/phủ định trên nhóm/chỉ tiêu đã chọn |
| Tên chỉ tiêu tính ra không có địa chỉ thống nhất | Server định nghĩa `count`, `count_<field>`, `sum_<field>`, `avg_<field>`; nhãn tương đương duy nhất được chuẩn hóa |
| Hỏi tiếp trên top/cực trị thường buộc nhập lại tên/mã | Giữ kế hoạch nhóm trước trong session riêng tư, đọc lại cùng nguồn rồi lọc tiếp |
| Có thể đổi thành viên nhóm top giữa hai lượt | Đối chiếu digest thành viên; thay đổi nhóm thì báo cần xem lại, không âm thầm dùng nhóm khác |
| Giới hạn hiển thị tổng hợp kiểm tra dòng gốc | Kiểm tra dòng kết quả sau tổng hợp: 600 dòng gốc có thể trở thành 2 dòng tổng hợp |
| Coverage của một nguồn và nhiều nguồn kiểm tra khác nhau | Dùng chung kiểm tra địa chỉ điều kiện, phép tính và xếp hạng |
| Gom nhóm theo nhãn đã dịch có thể gộp nhầm hai giá trị | Gom theo giá trị gốc kèm kiểu, sau đó mới định dạng |

Ví dụ các dạng được bộ máy chung hỗ trợ, với điều kiện nguồn có đủ cột công khai:

- Đếm hồ sơ theo trạng thái, chỉ giữ nhóm có từ 3 hồ sơ.
- Cộng tồn kho theo sản phẩm, lấy 5 sản phẩm có tổng tồn cao nhất.
- Tính tổng/trung bình theo nhóm, lọc nhóm vượt ngưỡng rồi sắp xếp.
- Sau khi xem nhóm có số lượng lớn nhất: “Trong nhóm đó, chỉ lấy những người còn nợ”.
- Xuất chính kết quả đã lọc/tổng hợp ra Excel.

## Ngữ cảnh và giới hạn

- `within` là trạng thái server tự gắn từ hội thoại, không nằm trong schema đầu vào của model. Trạng thái phải khớp nguồn, phiên bản workflow, phạm vi và truy vấn trước; kiểm tra lại trước đọc/xuất file.
- Digest chỉ nằm trong session. Khi nguồn có ID, liên kết ID với dòng bằng WeakMap riêng tư; không thêm ID vào JSON/bảng/Excel. Nguồn không có ID dùng dấu vân tay của dòng công khai và dừng thận trọng nếu dòng đổi.
- Không dùng lại bản ghi cũ để thay thế việc đọc có phân quyền. Không mở rộng nhóm trước thành toàn bộ danh sách. Chuỗi lựa chọn nối tiếp có giới hạn độ sâu.
- Vẫn phải đọc đủ dữ liệu để kết luận số lượng/tổng/cực trị. Không tăng trần đọc hiện có và không coi một trang là toàn bộ.
- `having` và thứ tự xếp hạng vẫn phải khớp ý nghĩa người dùng; không tự thêm ngưỡng, đổi số hay làm mất nhánh HOẶC.
- **Chưa thêm cơ chế duyệt động từng hồ sơ qua các API con, phép nối tùy ý giữa API, hay khả năng truy cập dữ liệu lồng chưa khai báo.** Chưa thể lấy thay đổi này làm bằng chứng rằng câu hỏi điểm danh toàn bộ lớp đã chạy được. Các action bắt buộc chọn lớp/hồ sơ hoặc thiếu cột công khai vẫn có giới hạn dữ liệu riêng.

## Kiểm chứng

Chỉ fixture nhân tạo, provider/DB/network thật bị chặn bởi cấu hình test `server/assistant/testing/catalog-routing/vitest.config.mjs`. Không gọi AI thật, không ghi dữ liệu nghiệp vụ thật, không deploy.

Các nhóm kiểm tra mới:

- Dùng hợp đồng thật của `employee.list`, `student.list`, `retail.order.list`, `worker.list` để kiểm tra cùng ngữ pháp tổng hợp.
- Tổng hợp trước lấy top; giữ đồng hạng; lọc trước/sau tổng hợp; nhiều chỉ tiêu; chuẩn hóa nhãn; dữ liệu thiếu/sai kiểu/tràn số.
- Kiểm tra ý nghĩa: ngưỡng sai, điều kiện thêm ngầm, trường không công khai, chỉ tiêu chưa chọn và cohort giả đều bị chặn.
- Qua `processTurn` với API giả: bảng tổng hợp, hỏi tiếp qua session, phát hiện nhóm đổi, chặn cohort do model tự tạo, tổng hợp nguồn 600 dòng.
- Xuất Excel dùng cùng pipeline và kiểm tra nhóm trước khi tạo file.
- Hồi quy form chọn, xác nhận, cập nhật từng phần, dispatch đọc và các luồng hiện có.

Kết quả chạy cuối: **1.096/1.096 test đạt, 56 file test đạt**; `npm run typecheck` đạt. Bộ test mới `shared-read-pipeline.test.ts` có 31 ca; ngoài ra có 4 ca mới qua `processTurn` và 1 ca mới kiểm tra Excel. Hai assertion thông báo lỗi cũ của test Excel đã được cập nhật theo thông báo hiện tại của luồng đọc chung, vẫn giữ điều kiện chặn thiếu tổng/trùng trang và không tạo file.

Kết quả offline không phải tỷ lệ hiểu đúng của AI thật trên staging. Không kiểm thử giao diện trực tiếp trong lượt này vì không thay UI và phạm vi yêu cầu là offline.
