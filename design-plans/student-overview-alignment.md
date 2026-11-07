# Đồng bộ Tổng quan Học viên và mở rộng thống kê

Written against: `ccba7c63`

## Evidence chain

- Surface: `DashboardTab` → `StudentOverviewSection` → `DashboardPage` → `StatsGrid` / `WorkerOverviewDashboard`.
- Problem: màn Học viên dùng nền `#F8FBFF`, tiêu đề 20 px, card bo 22 px và bảng dài; các màn Tổng quan khác dùng tiêu đề 18 px, card nền surface bo 6 px, KPI nhiều màu và biểu đồ trong card đồng bộ.
- Design evidence: `DESIGN.md` mục Typography, KPI, Empty states; `src/components/dashboard/HrOverviewSection.tsx`, `src/modules/finance/components/FinanceOverviewDashboard.tsx`, `src/components/dashboard/overview-dashboard.css`.
- Owner: `src/components/dashboard/StudentOverviewSection.tsx` cho màn Tổng quan chung; dữ liệu học viên từ `useStudents`, `useCourses`, `useBatches`.
- Scope and affected surfaces: chỉ tab Học viên trong `DashboardTab`; không đổi trang nghiệp vụ quản lý học viên riêng.
- Uncertainty: dữ liệu lịch sử thanh toán có thể không đầy đủ ở hồ sơ cũ; hiển thị rõ chỉ số theo kỳ dựa trên các giao dịch có ngày hợp lệ.

## Design decision

Dựng Tổng quan Học viên theo bố cục chung: tiêu đề, KPI gradient, card biểu đồ bo 6 px và khoảng cách 12 px. Chỉ tính chỉ số từ bản ghi đang tải và phạm vi kỳ chung; phân biệt số dư học phí hiện tại với số thu trong kỳ. Dùng nhiều biểu đồ cho các câu hỏi khác nhau: xu hướng đăng ký, cơ cấu trạng thái, khóa học, nguồn, học phí và tải lớp.

## Reuse

- `overview-kpi`, `finance-chart-card`, `finance-detail-value`, `OverviewKpiDelta`, `OverviewChartSummary`, `HrEmptyIllustration`, `useOverviewPeriod`.
- Exemplar: `src/modules/finance/components/FinanceOverviewDashboard.tsx`.

## Changes

1. `src/components/dashboard/StudentOverviewSection.tsx`: dùng hook dữ liệu hiện có, bố cục Tổng quan mới và trạng thái tải/lỗi/rỗng.
2. `src/components/dashboard/studentOverviewMetrics.ts`: tính KPI và nhóm biểu đồ từ học viên, khóa học, lớp, lịch sử thanh toán; không suy diễn dữ liệu thiếu.
3. `src/components/dashboard/student-overview.css`: chỉ bổ sung style đặc thù nếu pattern chung không đủ.

## Scope

- Inherit: tab Học viên của trang Tổng quan.
- Verify: kỳ chung, branch scope, dữ liệu trống, số tiền thiếu và dark mode.
- Exclude: trang quản lý học viên, API ghi dữ liệu, schema backend.

## Validation

- Product: KPI học phí và các biểu đồ dùng số liệu thật, không đếm trùng sinh viên.
- Interface: 390, 768, 1440 px nếu có trình duyệt; empty, loading, error, dark mode.
- Repository: `npm run typecheck`, Vitest cho metrics, `npm run build`.

## Stop conditions

- Không hiển thị “thu trong kỳ” bằng `paidAmount` tích lũy; chỉ dùng `paymentHistory` có ngày hợp lệ.

## Design documentation

- None; tái sử dụng quyết định hiện có trong `DESIGN.md`.
