---
version: alpha
name: Igen ERP
description: Hệ thống quản trị doanh nghiệp nhiều phân hệ bằng tiếng Việt.
colors:
  primary: "#00ADFC"
  on-primary: "#ffffff"
  background: "#f6f8fd"
  on-background: "#071629"
  surface: "#f6f8fd"
  on-surface: "#071629"
  surface-container-lowest: "#ffffff"
  on-surface-variant: "#475569"
  outline: "#7c8ca3"
  outline-variant: "#d8e2f0"
typography:
  sans:
    fontFamily: Inter, Be Vietnam Pro, Segoe UI Variable, Segoe UI, system-ui, sans-serif
---

## Overview

Igen ERP trình bày nghiệp vụ bằng tiếng Việt trên các phân hệ dùng chung điều hướng, trạng thái màu và hệ chữ. Giao diện dùng token ngữ nghĩa trong `src/index.css` để giữ nhất quán giữa chế độ sáng và tối.

## Colors

Dùng vai trò màu theo ngữ cảnh: `primary` cho hành động chính, `surface` và các mức `surface-container` cho nền, `on-surface` cho nội dung, `outline` cho đường viền. Giao diện mới dùng tên token ngữ nghĩa thay vì tự chọn màu từ bảng màu.

## Themes

| Token | Chế độ tối |
|---|---|
| primary | `#22d3ee` |
| background | `#0d0f14` |
| on-background | `#f1f5f9` |
| surface | `#0d0f14` |
| on-surface | `#f1f5f9` |
| surface-container-lowest | `#101217` |
| outline | `#475569` |
| outline-variant | `#242834` |

## Search fields

Khi ô nhập liệu, ô tìm kiếm hoặc dropdown nhận focus, chỉ dùng viền 1 px màu thương hiệu `primary`. Không thêm vòng sáng hoặc outline dày bên ngoài. Giữ sự thay đổi màu viền đủ nhận biết khi dùng bàn phím.

Thanh tìm kiếm trong các màn hình nghiệp vụ dùng viền 1 px màu `outline-variant` (`#d8e2f0` ở giao diện sáng), theo ô tìm kiếm của trang Phòng ban. Khi focus, viền dùng `primary`. Giữ kích thước và bố cục riêng của từng màn hình. Tìm kiếm toàn ERP mở từ biểu tượng kính lúp ở hàng đầu sidebar phân hệ; header không có ô tìm kiếm.

## Dropdowns

Dùng dropdown chọn phòng ban trong Sơ đồ tổ chức Nhân sự làm mẫu cho toàn ERP. Ô chọn có nền `surface-container-lowest`, viền 1 px `outline-variant`, bo góc nhẹ và chữ thường, không in đậm. Menu có cùng nền và viền, bóng nhẹ; mục đang chọn dùng nền pha khoảng 10% `primary` và chữ xanh đủ tương phản. Mục chưa chọn dùng màu `on-surface`, khi rê chuột chỉ đổi sang nền xanh rất nhạt. Giữ kiểu dáng này cho dropdown tự vẽ và `select` gốc; không thay đổi kích thước hay nghiệp vụ riêng của từng màn hình.

## Empty states

Các vùng nội dung rỗng trong phân hệ Nhân sự dùng `HrEmptyIllustration`: SVG nét xám, kích thước 160 × 96, họa tiết nền mờ và hình theo từng nghiệp vụ. Kết quả tìm kiếm không khớp dùng biến thể `search`. Giữ nguyên câu thông báo và chỉ đặt minh họa ở vùng đủ rộng, tránh các dòng gợi ý nhỏ.

## Typography

Dùng `font-sans` của ứng dụng cho nội dung tiếng Việt. Các trang nghiệp vụ giữ tiêu đề và nhãn đủ rõ để phân biệt thao tác, trạng thái và số liệu.

Tiêu đề chính trong khung nội dung nghiệp vụ theo mẫu `HrPageTitle`: `text-lg font-semibold` (18 px, weight 600), màu `on-surface`, có vạch nhấn `primary` mảnh. Không tăng lên `font-bold` hoặc 20 px chỉ vì chuyển sang phân hệ khác. Xem thêm [HR_STYLE.md](HR_STYLE.md) về khoảng cách và bo góc panel.

Card biểu đồ trong các trang Tổng quan chỉ cần tiêu đề khi tên biểu đồ đã đủ rõ. Không thêm dòng helper text lặp lại ý nghĩa tiêu đề; vẫn giữ chú giải dữ liệu, kỳ so sánh và thông báo trạng thái khi chúng giúp hiểu số liệu.

Biến động số liệu trong Tổng quan dùng `▲` xanh lá khi tăng, `▼` đỏ khi giảm và dấu `–` xanh hải quân khi không đổi. Thiếu kỳ đối chiếu hiển thị `—` trung tính. Card và chữ giữ tĩnh; chỉ biểu đồ được animate, còn số KPI đếm từ 0 đến giá trị thật. Tôn trọng thiết lập giảm chuyển động của hệ điều hành.

Nút tạo mới dùng chung `primaryCreateButtonClass`; nút Làm mới dùng `ErpRefreshButton`. Giữ cùng chiều cao và thứ tự khi hai nút đứng cạnh nhau. Không thêm helper text lặp lại nội dung của nút, bộ lọc hoặc trạng thái rỗng.

## Layout

Các phân hệ dùng sidebar chung và phần nội dung có khả năng cuộn. Trên màn hình hẹp, điều hướng và vùng thao tác phải giữ khả năng truy cập bằng bàn phím và cảm ứng.
