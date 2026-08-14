# Chỉnh sửa thủ công các thành phần dòng lương

## Mục tiêu

Cho phép người quản lý sửa trực tiếp các thành phần kết quả trên từng dòng của bảng lương nháp. Các giá trị sửa tay được lưu riêng với kết quả hệ thống để giữ nguyên nguồn gốc tính toán, hỗ trợ kiểm toán và cho phép hoàn tác về giá trị hệ thống.

Sáu cột nhập liệu theo kỳ hiện tại không còn xuất hiện trong bảng lương chính:

- Lương thỏa thuận.
- Ngày đối soát.
- Giờ đối soát.
- Phụ cấp.
- Thưởng thuộc nhóm period input.
- Khấu trừ thuộc nhóm period input.

Việc ẩn các cột này chỉ thay đổi giao diện bảng lương. Dữ liệu period input đã lưu và API hiện có không bị xóa để không làm hỏng lịch sử hoặc các luồng khác đang sử dụng chúng.

## Phạm vi cột

Các cột thành phần sau được giữ lại và có thể sửa trực tiếp:

- Các biến tùy chỉnh đang hoạt động.
- Lương cơ bản.
- Lương điều chỉnh.
- Tăng ca.
- Thưởng trong kết quả dòng lương.
- Phạt.
- BHXH.
- BHYT.
- BHTN.
- Thuế TNCN.
- Khấu trừ khác.
- Tạm ứng.

Hai cột dẫn xuất luôn chỉ đọc:

- Tổng khấu trừ.
- Thực nhận.

Không bổ sung cột Tổng thu nhập mới. Giao diện tiếp tục dùng các cột đang tồn tại.

## Điều kiện chỉnh sửa

- Chỉ người có quyền `payroll:manage` được sửa.
- Chỉ kỳ lương ở trạng thái `draft` được sửa.
- Kỳ chưa có payroll run chưa có dòng kết quả để ghi đè; người dùng cần tính lương để tạo bản nháp trước khi sửa các thành phần kết quả.
- Từ trạng thái `review` trở đi, mọi cột đều chỉ đọc.
- Các quy tắc mở lại kỳ lương hiện có không thay đổi.

## Mô hình ghi đè

Tạo dữ liệu ghi đè dòng lương riêng, định danh theo công ty, chi nhánh, kỳ lương và nhân viên. Bản ghi chứa:

- Các trường thành phần được ghi đè, trong đó `0` là một giá trị hợp lệ.
- Giá trị biến tùy chỉnh được ghi đè theo mã biến.
- Version dùng cho optimistic concurrency.
- Người sửa, thời điểm sửa và lý do đối soát.
- Audit trước/sau cho từng trường được sửa hoặc hoàn tác.

Trường không có trong bản ghi ghi đè tiếp tục dùng giá trị do lần tính lương gần nhất tạo ra. Hoàn tác một trường dùng thao tác clear rõ ràng, không dùng giá trị rỗng hoặc `0` để biểu diễn hoàn tác.

Ghi đè không sửa trực tiếp calculation snapshot hoặc revision gốc. Khi người dùng chủ động tính lại bảng lương, kết quả hệ thống mới được tạo và các ghi đè thủ công vẫn được áp dụng cho đến khi được hoàn tác. Nhờ đó thao tác tính lại không âm thầm xóa số liệu đã đối soát.

## Tính toán dẫn xuất

Frontend hiển thị bản xem trước ngay khi người dùng sửa một thành phần. Backend là nguồn sự thật và tính lại khi lưu. Mỗi trường sửa tay thay thế đúng thành phần tương ứng trong kết quả hệ thống; các khoản hệ thống không có cột chỉnh sửa riêng, như phụ cấp hoặc khoản cộng khác, vẫn được giữ nguyên:

```text
Tổng thu nhập hiệu lực = Lương điều chỉnh
                         + Tăng ca
                         + Thưởng
                         + Phụ cấp và khoản cộng khác từ kết quả hệ thống

Tổng khấu trừ = Phạt
              + BHXH
              + BHYT
              + BHTN
              + Thuế TNCN
              + Khấu trừ khác
              + Tạm ứng

Thực nhận = Tổng thu nhập hiệu lực - Tổng khấu trừ
```

Lương cơ bản và các biến tùy chỉnh được lưu để hiển thị, đối soát và phục vụ lần tính toán theo luồng hiện có, nhưng không được cộng thêm lần nữa vào công thức Thực nhận nêu trên. Backend phải dùng cấu trúc calculation hiện có để xác định phần thu nhập hệ thống còn lại, thay vì suy đoán từ dữ liệu do client gửi. Mọi kết quả tiền được làm tròn theo quy tắc tiền tệ hiện có và Thực nhận không thấp hơn `0`.

## API và lưu hàng loạt

API mới hoặc phần mở rộng API payroll run cung cấp:

- Tải giá trị hệ thống, giá trị ghi đè, giá trị hiệu lực và version cho từng dòng.
- Lưu hàng loạt chỉ các nhân viên/trường đã thay đổi.
- `clearFields` để hoàn tác trường về giá trị hệ thống.
- Một lý do đối soát không rỗng cho toàn bộ thao tác lưu.
- Kết quả độc lập theo từng nhân viên để hỗ trợ thành công một phần.

Mỗi row sử dụng expected version. Xung đột version không ghi đè dữ liệu mới hơn và trả về mã lỗi ổn định. Backend kiểm tra quyền, phạm vi tenant/branch và trạng thái `draft` trên mọi lần ghi.

## Trải nghiệm giao diện

- Bảng không render sáu cột period input cố định.
- Ô thành phần hiển thị giá trị hiệu lực; giá trị hệ thống có thể xem để so sánh khi có ghi đè.
- Ô đã lưu ghi đè và ô chưa lưu có trạng thái trực quan khác nhau.
- Nhập `0` tạo ghi đè bằng `0`; xóa nội dung chưa tự động hoàn tác.
- Thao tác Hoàn tác đưa trường vào `clearFields` cho lần lưu tiếp theo.
- Bản nháp được lưu theo nhân viên và trường nên không mất khi tìm kiếm hoặc sắp xếp.
- Một nút **Lưu thay đổi** mở hộp thoại yêu cầu lý do chung.
- Dòng lưu thành công xóa draft; dòng lỗi giữ nguyên giá trị nhập và hiển thị lỗi tại dòng.
- Tổng khấu trừ và Thực nhận cập nhật tức thời trên giao diện nhưng không có input.

## Xử lý lỗi và tính nhất quán

- Chỉ nhận số hữu hạn và không âm cho các thành phần tiền.
- Mã biến tùy chỉnh phải tồn tại trong catalog hợp lệ của công ty.
- Request thiếu lý do bị từ chối.
- Request cho kỳ không còn ở `draft` bị từ chối bằng conflict ổn định.
- Thành công một phần không rollback các dòng hợp lệ.
- Lỗi toàn bộ request giữ nguyên toàn bộ draft trên giao diện.
- Backend bỏ qua mọi giá trị Tổng khấu trừ hoặc Thực nhận do client gửi lên và luôn tự tính lại.

## Kiểm thử chấp nhận

- Sáu cột period input cố định không còn được render ở bảng có run và bảng chưa có run.
- Các cột thành phần còn lại render input có thể sửa cho người có quyền ở trạng thái `draft`.
- Người không có quyền và kỳ từ `review` trở đi chỉ thấy giá trị chỉ đọc.
- Tổng khấu trừ và Thực nhận không có input và cập nhật đúng khi sửa thành phần.
- Backend tự tính lại hai giá trị dẫn xuất, không tin dữ liệu dẫn xuất từ client.
- Giá trị `0` khác với hoàn tác về hệ thống.
- Lưu nhiều dòng tạo một request với một lý do.
- Version conflict và thành công một phần giữ đúng draft bị lỗi.
- Ghi đè không sửa revision/snapshot gốc và vẫn được áp dụng sau khi tính lại payroll.
- Tenant, branch và quyền quản lý được kiểm tra ở API.

## Ngoài phạm vi

- Cho phép nhập trực tiếp Tổng khấu trừ hoặc Thực nhận.
- Thay đổi công thức lương, chính sách lương hoặc lifecycle kỳ lương.
- Xóa dữ liệu period input cũ khỏi cơ sở dữ liệu.
- Cho phép chỉnh sửa trước khi payroll run nháp được tạo.
- Tự động lưu khi blur hoặc nhấn Enter.
