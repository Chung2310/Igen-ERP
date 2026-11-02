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

## Typography

Dùng `font-sans` của ứng dụng cho nội dung tiếng Việt. Các trang nghiệp vụ giữ tiêu đề và nhãn đủ rõ để phân biệt thao tác, trạng thái và số liệu.

## Layout

Các phân hệ dùng sidebar chung và phần nội dung có khả năng cuộn. Trên màn hình hẹp, điều hướng và vùng thao tác phải giữ khả năng truy cập bằng bàn phím và cảm ứng.
