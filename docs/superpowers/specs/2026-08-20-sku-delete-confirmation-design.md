# Xác nhận xóa SKU và thông báo tiếng Việt

## Mục tiêu

Thay xác nhận trình duyệt khi xóa SKU bằng popup chung của hệ thống và bảo đảm mọi lỗi từ API xóa SKU hiển thị tiếng Việt đúng UTF-8.

## Thiết kế

- Nút xóa SKU đã chọn mở `ConfirmDialog` thay cho `window.confirm`.
- Popup nêu số SKU sẽ xóa, cảnh báo chỉ xóa được SKU chưa có tồn kho hoặc lịch sử giao dịch, và có nút `Hủy` / `Xóa SKU`.
- Chỉ gọi `deleteVariants` sau khi người dùng xác nhận; popup khóa thao tác trong lúc yêu cầu đang chạy.
- Sửa các thông báo validate và chặn xóa của `ProductCatalogService.deleteVariants` thành chuỗi tiếng Việt UTF-8 chuẩn.
- Khi API trả lỗi, toast giữ nguyên thông báo tiếng Việt chuẩn thay vì ký tự mã hóa sai.

## Kiểm thử

- Kiểm tra click Xóa mở `ConfirmDialog`; click Hủy không gọi API; click Xóa SKU gọi API.
- Kiểm tra thông báo lỗi xóa SKU được chuẩn hóa bằng tiếng Việt.
