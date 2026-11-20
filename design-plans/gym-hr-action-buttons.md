# Đồng bộ nút thao tác GYM với Nhân sự

Written against: `2f98b9f8`

## Evidence chain

- Surface: các trang PT và Admin trong `/chuoi-gym/`, dùng `.button` và các biến thể trong `gym-module/3s/frontend/src/index.css`.
- Problem: nút GYM cao 40 px, chữ 14 px đậm, nền gradient và hiệu ứng nhấc lên; nút thao tác Nhân sự dùng chữ 12 px, nền màu phẳng và chiều cao tối thiểu 36 px.
- Design evidence: `DESIGN.md`, `HR_STYLE.md`, `src/components/common/primaryCreateButton.ts`, `src/components/common/ErpRefreshButton.tsx`.
- Owner: `gym-module/3s/frontend/src/erp-theme.css`, được tải sau `index.css` bởi `frontend/src/main.tsx`.
- Scope and affected surfaces: nút hành động `.button`, `.button-primary`, `.button-secondary`, `.button-danger`, nút xóa bộ lọc, nút dạng chữ và nút thao tác trong bảng của GYM, kể cả trạng thái lỗi trước khi portal hiện ra.
- Uncertainty: các nút điều hướng, tab và nút chỉ có biểu tượng giữ kích thước theo ngữ cảnh riêng.

## Design decision

Dùng theme GYM để áp màu xanh ERP, nền trắng có viền cho hành động phụ, chữ 12 px và chiều cao tối thiểu 36 px theo mẫu Nhân sự. Bỏ gradient và hiệu ứng nhấc lên trên nút hành động.

## Reuse

- `--gym-erp-primary`, `--gym-erp-outline`, `--gym-erp-card`, `--gym-erp-ink`.
- Exemplar: `src/components/common/primaryCreateButton.ts` và `src/components/common/ErpRefreshButton.tsx`.

## Changes

1. `gym-module/3s/frontend/src/erp-theme.css`
   - Change: ghi đè các lớp nút hành động dùng chung khi `body` chứa `.App`, kể cả hộp thoại render qua portal.
   - Preserve: màu đỏ của hành động nguy hiểm, trạng thái vô hiệu hóa, kích thước riêng của tab và nút biểu tượng.
   - Verify: các nút chính, phụ, nguy hiểm và thao tác bảng có cùng nhịp với Nhân sự.

## Scope

- Inherit: các màn PT và Admin dùng lớp nút GYM chung.
- Verify: hover, focus, disabled, màn hình hẹp và tối.
- Exclude: giao diện landing không nằm trong ERP, nút điều hướng, tab và icon-only.

## Validation

- Product: thao tác tạo, lưu, hủy và xóa giữ rõ thứ bậc.
- Interface: kiểm tra 390 px, 768 px, 1440 px nếu có môi trường render.
- System: kiểm tra stylesheet GYM được tải sau stylesheet gốc.
- Repository: `npm run typecheck --prefix gym-module/3s` và `npm run build --prefix gym-module/3s`.

## Stop conditions

- Dừng mở rộng nếu một nhóm nút có ý nghĩa điều hướng hoặc chọn chế độ thay vì thao tác nghiệp vụ.

## Design documentation

- Không cần sửa tài liệu thiết kế; `DESIGN.md` và `HR_STYLE.md` đã nêu mẫu nút.
