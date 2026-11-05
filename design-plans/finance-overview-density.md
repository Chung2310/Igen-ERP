# Tổng quan Tài chính nhiều biểu đồ

Written against: e8ea5d8d

## Evidence chain

- Surface: `/tong-quan?sub=tai-chinh`, `FinanceOverviewSection` → `FinancialManagementPage`.
- Problem: ảnh người dùng cho thấy KPI đứng riêng, các card cách xa nhau, biểu đồ ít và hai bảng lớn chiếm phần dưới.
- Bổ sung từ phản hồi trực tiếp: sidebar Tổng quan chiếm diện tích biểu đồ; 12 KPI màu xếp nhiều hàng không giống bố cục tham chiếu.
- Bổ sung tiếp: bỏ gạch dưới tab và card, dùng gradient KPI sáng theo ảnh tham chiếu; biểu đồ nhiều chuỗi cần rộng hai cột.
- Bổ sung tiếp: giữ tab Tổng quan đứng yên khi cuộn nội dung; biểu đồ doanh thu dạng cột cần chọn Tuần, Tháng, Quý, Năm và cập nhật cùng bộ lọc báo cáo.
- Design evidence: ảnh tham chiếu MISA do người dùng cung cấp có nhóm KPI nằm trong card chung và lưới biểu đồ dày; `DESIGN.md` yêu cầu giữ token ngữ nghĩa, tiếng Việt và sidebar hiện hành.
- Owner: `src/modules/finance/pages/FinancialManagementPage.tsx` và component tổng quan mới.
- Scope and affected surfaces: chỉ `view="overview"` của trang Tài chính trong Tổng quan.
- Uncertainty: dữ liệu thực có thể rỗng; biểu đồ phải thể hiện trạng thái trống trung thực.

## Design decision

Giữ bộ lọc ngày, phạm vi chi nhánh và API hiện hành. Chuyển điều hướng riêng trang Tổng quan thành hàng ngang, giữ tối đa sáu KPI màu trên một hàng desktop và đặt số liệu phụ vào card trắng. Dùng lưới biểu đồ dày với nhiều dạng biểu đồ cho dữ liệu thực của báo cáo.

## Reuse

- Token `surface-container-lowest`, `outline-variant`, `on-surface`, `primary` từ `src/index.css`.
- `money`, `DataTable` trong `ManagementUI.tsx` nếu cần bảng chi tiết.
- Exemplar: card báo cáo và bố cục của `FinanceOverviewCharts.tsx`.

## Changes

1. `src/modules/finance/pages/FinancialManagementPage.tsx`
   - Change: chuyển riêng nhánh overview sang component dashboard mới.
   - Preserve: bộ lọc, dữ liệu API, cảnh báo thiếu giá vốn và các view khác.
   - Verify: các view thu chi, lãi lỗ, VAT và hòa vốn không đổi.
2. `src/modules/finance/components/FinanceOverviewDashboard.tsx`
   - Change: tối đa sáu KPI màu trong một hàng desktop, các số liệu khác trong card trắng; biểu đồ doanh thu, chi phí, dòng tiền, công nợ, tồn kho, VAT và bảng ưu tiên theo dữ liệu báo cáo.
   - Preserve: giá trị null là chưa xác định, không đổi thành 0.
   - Verify: trạng thái có dữ liệu, rỗng, màn hình hẹp và tối.
3. `src/pages/DashboardTab.tsx`
   - Change: dùng biến thể `horizontal` của `ModuleNavigation` và cho nội dung Tổng quan dùng trọn chiều ngang.
   - Preserve: điều hướng và quyền truy cập của các phân hệ khác.
   - Verify: sidebar của các module khác không đổi.

## Scope

- Inherit: chỉ Tổng quan Tài chính.
- Verify: route `?sub=tai-chinh` và các view tài chính khác.
- Exclude: mô phỏng số liệu và thay đổi backend.

## Validation

- Product: xem một kỳ có dữ liệu và một kỳ trống; chỉ số và biểu đồ cùng bộ lọc.
- Interface: 390 px, 768 px, 1440 px; loading, error, dark mode.
- System: không tạo kiểu button hay form mới.
- Repository: `npm run typecheck`, Vitest Tài chính, `npm run build`.

## Stop conditions

- Dừng biểu đồ nào thiếu trường dữ liệu đáng tin cậy từ API hiện hành.

## Design documentation

- None.
