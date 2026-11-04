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
| on-surface-variant | `#94a3b8` |
| surface-container-lowest | `#101217` |
| outline | `#475569` |
| outline-variant | `#242834` |

## Search fields

Thanh tìm kiếm trong các màn hình nghiệp vụ dùng viền 1 px màu `outline-variant` (`#d8e2f0` ở giao diện sáng), theo ô tìm kiếm của trang Phòng ban. Khi focus, viền dùng `primary`. Giữ kích thước và bố cục riêng của từng màn hình. Ô “Tìm kiếm trong ERP...” trên header giữ kiểu hiện tại.

## Empty states

Các vùng nội dung rỗng trong phân hệ Nhân sự dùng `HrEmptyIllustration`: SVG nét xám, kích thước 160 × 96, họa tiết nền mờ và hình theo từng nghiệp vụ. Kết quả tìm kiếm không khớp dùng biến thể `search`. Giữ nguyên câu thông báo và chỉ đặt minh họa ở vùng đủ rộng, tránh các dòng gợi ý nhỏ.

## Typography

Dùng `font-sans` của ứng dụng cho nội dung tiếng Việt. Hệ chữ màn hình dùng mẫu Nhân sự trong `src/typography.css`.

| Vai trò | Cỡ / chiều cao dòng | Độ đậm |
|---|---|---|
| Tiêu đề màn hình | 20 / 28 px | 600 |
| Tiêu đề mục | 18 / 28 px | 600 |
| Tiêu đề nhỏ | 14 / 20 px | 600 |
| Tiêu đề hộp thoại | 14 / 20 px | 500 |
| Nội dung thường | 14 / 20 px | 400 |
| Nhãn nhỏ và chú thích | 12 / 16 px | 400 |
| Bảng thường / bảng gọn | 14 / 20 px hoặc 12 / 16 px | 500 cho nhãn cột, 400 cho dữ liệu thường |

Dùng `data-typography="page-title"` khi tiêu đề màn hình là `h2` hoặc `h3`, và `data-typography="section-title"` khi tiêu đề mục là `h3`. Tiêu đề giới thiệu ở đầu landing page dùng cấp hiển thị co giãn từ 30 đến 48 px.

Dùng `text-on-surface` cho chữ chính, `text-on-surface-variant` cho chữ phụ và `text-primary` cho trạng thái đang chọn. Giao diện sáng trong khung ERP hiển thị chữ chính và chữ phụ bằng màu đen. Nhãn cột giữ kiểu viết theo câu. Dữ liệu số trong bảng dùng chữ số có độ rộng bằng nhau.

## Layout

Các phân hệ dùng sidebar chung và phần nội dung có khả năng cuộn. Trên màn hình hẹp, điều hướng và vùng thao tác phải giữ khả năng truy cập bằng bàn phím và cảm ứng.
