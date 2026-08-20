# Chuẩn hóa giao diện tạo nhiều SKU

## Mục tiêu

Thay popup tạo nhanh nhiều SKU bằng danh sách biểu mẫu SKU có cùng trường, nhãn và quy tắc với biểu mẫu tạo một SKU.

## Phạm vi

- Áp dụng cho popup **Tạo nhanh SKU** của một sản phẩm đã có.
- Không thay đổi API `POST /inventory/catalog/products/:id/variants/bulk` hoặc dữ liệu SKU.
- Không thay đổi luồng ma trận biến thể khi tạo sản phẩm mới.

## Giao diện và thao tác

- Popup mở với hai biểu mẫu SKU độc lập.
- Mỗi biểu mẫu dùng các trường chuẩn của form một SKU: giá bán, ảnh, SKU, mã vạch, tên biến thể, theo dõi kho, trạng thái và bảo hành nhà cung cấp.
- Có nút **Thêm SKU** để thêm biểu mẫu rỗng và nút xóa trên từng biểu mẫu; luôn giữ tối thiểu một biểu mẫu.
- Với sản phẩm dịch vụ, theo dõi kho luôn là `none` và bị vô hiệu hóa như form một SKU.
- Người dùng lưu một lần; các biểu mẫu được chuyển thành mảng payload và gửi qua API bulk hiện có.

## Validation và lỗi

- SKU trống sẽ tự sinh theo quy tắc hiện hữu của form một SKU.
- Kiểm tra SKU trùng trong danh sách trước khi gửi.
- Mọi trường SKU được chuẩn hóa giống form một SKU; lỗi từ API hiển thị bằng cơ chế lỗi hiện hữu.
- Nếu tạo thất bại, popup giữ nguyên dữ liệu người dùng đã nhập.

## Kiểm thử

- Kiểm tra render hai SKU khởi tạo, thêm/xóa biểu mẫu và không cho xóa biểu mẫu cuối cùng.
- Kiểm tra payload bulk gồm các giá trị riêng của từng SKU và quy tắc dịch vụ không theo dõi kho.
- Chạy test liên quan, typecheck và kiểm tra diff trước khi hoàn tất.
