# Biểu đồ Tổng quan Bán lẻ gọn và mềm hơn

Written against: f53207e6 (working tree có thay đổi chưa commit; kiểm tra lại trước khi triển khai).

## Design language

- Audited surface: `/tong-quan?sub=ban-le`, bộ lọc 30 ngày, card “Doanh thu theo kỳ” và “Cơ cấu thanh toán”.
- Design sources: ảnh iGen và năm ảnh MISA người dùng gửi; `DESIGN.md`; `src/index.css`.
- Documented decisions: dùng token ngữ nghĩa, giữ tiếng Việt, không bịa dữ liệu, card biểu đồ không thêm helper lặp lại tiêu đề, tooltip có style chung.
- Governing owners and consumers: `DashboardTab` → `RetailOverviewSection` → `RetailReportsPage` → `RetailOverviewDashboard`; `retailOverviewAnalytics.ts` nhóm dữ liệu theo ngày/tuần/tháng/quý/năm; `finance-overview.css` đặt kiểu card và màu biểu đồ.
- Explicit exceptions: None documented.

## Findings

| # | Problem | Evidence | Proposed change | Scope | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Biểu đồ 30 ngày có quá nhiều nhãn trục X và một đỉnh rất nhọn; người xem khó thấy ngày nào có giao dịch. | Ảnh iGen cho thấy một ngày có cột doanh thu, các ngày khác bằng 0; `RetailOverviewDashboard.tsx` mặc định `period="day"` và vẽ 30 mốc cùng hai đường nối các điểm 0. Ảnh MISA có trục thưa và chuỗi nhiều mốc. | Khi phạm vi từ 28 ngày trở lên, chọn “Tuần” làm độ hạt ban đầu nhưng vẫn cho chọn “Ngày”; giảm mật độ tick, ẩn tick line và axis line, bo đỉnh cột. | Chart “Doanh thu theo kỳ” của Tổng quan Bán lẻ. | High |
| 2 | Vòng thanh toán một màu có nhãn `100%` ở ngoài và chú giải lặp lại, tạo cảm giác trống và dễ bị cắt. | Ảnh iGen cho thấy một vòng xanh duy nhất, chữ ở mép trái bị cắt; `DonutCard` dùng `Pie` có nhãn ngoài cho mọi trường hợp và danh sách chú giải bên phải. | Khi chỉ có một phương thức, đặt `100%` vào tâm vòng và bỏ nhãn ngoài; với nhiều phương thức, dùng chú giải bên cạnh làm nguồn nhãn chính. | `DonutCard` trong Tổng quan Bán lẻ. | High |
| 3 | Cảm giác thô còn đến từ nhiều nét trục và ba chuỗi mạnh ngang nhau. | Ảnh iGen có các trục đậm, vạch và ba chuỗi đè nhau; ảnh MISA dùng ít nét phụ, đường và chấm nhỏ. `finance-overview.css` và các chart con chưa có quy tắc nét chung. | Dùng màu chart hiện có, giảm độ nổi của grid/axis, để doanh thu là chuỗi chính, hai đường còn lại mảnh hơn và có điểm active rõ khi rê; giữ số thật trong tooltip. | Các chart Recharts của Tổng quan Bán lẻ. | Medium |

## Improve first

Finding 1: độ hạt ngày trên phạm vi 30 ngày là nguyên nhân trực tiếp của đỉnh nhọn và trục chật trong ảnh. Gộp theo tuần từ số liệu thật cải thiện khả năng đọc mà không tạo dữ liệu giả.

## Evidence chain

- Surface: `/tong-quan?sub=ban-le&reportPreset=30d` trong ảnh iGen.
- Problem: biểu đồ doanh thu có một đỉnh tại 30/10 trên 30 ngày; donut chỉ có “Tiền mặt”.
- Design evidence: ảnh MISA do người dùng gửi thể hiện trục thưa, cột/đường mảnh, nhãn có khoảng thở; `DESIGN.md` yêu cầu giữ token và số liệu thật.
- Owner: `src/modules/retail/components/reports/RetailOverviewDashboard.tsx` và `src/modules/retail/components/reports/retail-overview.css`.
- Scope and affected surfaces: Tổng quan Bán lẻ ở các độ hạt ngày/tuần/tháng/quý/năm; card donut dùng chung trong cùng dashboard.
- Uncertainty: hình dạng chuỗi khi dữ liệu thực dày hơn ảnh; cần xác nhận với kỳ 7 và 30 ngày, đa phương thức và một phương thức.

## Design decision

Làm rõ thứ bậc dữ liệu trước khi làm đẹp đường: độ hạt phù hợp với phạm vi, trục ít nhiễu, cột doanh thu là trọng tâm, donut không lặp nhãn. Không nội suy hoặc tạo thêm điểm bán hàng. Giữ màu iGen và khung card hiện hành, chỉ mượn sự gọn gàng và độ mềm của biểu đồ MISA.

## Reuse

- Token `surface-container-lowest`, `outline-variant`, `on-surface`, `on-surface-variant` trong `src/index.css`.
- Màu chuỗi `--finance-chart-blue`, `--finance-chart-teal`, `--finance-chart-red` và card `finance-chart-card` trong `src/modules/finance/finance-overview.css`.
- Tooltip chung trong `src/components/dashboard/overview-tooltip.css`.
- Exemplar: `src/components/dashboard/OverviewChartSummary.tsx`.

## Changes

1. `src/modules/retail/components/reports/RetailOverviewDashboard.tsx`
   - Change: khởi tạo và cập nhật độ hạt theo độ dài phạm vi báo cáo (từ 28 ngày: `week`; ngắn hơn: `day`) chỉ khi phạm vi lọc đổi; người dùng chọn độ hạt khác thì giữ lựa chọn tới lần đổi phạm vi tiếp theo. Giảm tick X bằng `minTickGap`, bỏ tick line/axis line, bo đỉnh cột doanh thu; giữ thanh chọn Ngày/Tuần/Tháng/Quý/Năm và tooltip với đúng đơn vị.
   - Change: trong `DonutCard`, bỏ nhãn ngoài khi đã có danh sách chú giải; khi chỉ còn một mục dương, hiển thị `100%` ở tâm vòng bằng token chữ hiện có.
   - Preserve: tổng doanh thu, đã thu, hoàn tiền, kỳ so sánh, khả năng chọn ngày, cách tính `aggregateSales`, dữ liệu 0/null, trạng thái rỗng.
   - Verify: kỳ 30 ngày với một ngày giao dịch không còn 30 nhãn chen chúc; kỳ 7 ngày vẫn mặc định Ngày; một phương thức không còn nhãn bị cắt; nhiều phương thức vẫn thấy tên, giá trị và tỷ lệ.
2. `src/modules/retail/components/reports/retail-overview.css`
   - Change: giới hạn style trục/grid/nét vào `.retail-overview`; nét phụ dùng token outline, đường có đầu bo, active point đủ rõ, không dùng bóng hoặc gradient mới.
   - Preserve: light/dark token và tương phản của tooltip.
   - Verify: Tài chính, Nhân sự và các trang Bán lẻ ngoài Tổng quan không đổi.

## Scope

- Inherit: card biểu đồ trong Tổng quan Bán lẻ.
- Verify: `/tong-quan?sub=ban-le` tại 390, 768, 1440 px; dữ liệu thưa, dữ liệu dày, một/nhiều phương thức, light/dark, hover/focus.
- Exclude: dữ liệu mẫu MISA, đổi API/backend, thêm gauge hoặc bản đồ không có dữ liệu tương ứng, sao chép nhận diện MISA.

## Validation

- Product: đối chiếu tổng trong KPI với chart ở cùng kỳ và cùng phạm vi chi nhánh.
- Interface: 7 và 30 ngày; không có dữ liệu, một ngày có dữ liệu, nhiều ngày có dữ liệu; một và nhiều phương thức thanh toán; 390/768/1440 px; dark mode.
- System: không tạo palette, button, card hoặc tooltip mới; dùng design token và component hiện có.
- Repository: `npm run typecheck`, `npx vitest run src/modules/retail/pages/RetailReportsPage.test.tsx`, `npm run build` → đều đạt.

## Stop conditions

- Dừng đổi độ hạt mặc định nếu bộ lọc hiện có hoặc yêu cầu nghiệp vụ quy định bắt buộc phải mặc định theo ngày.
- Dừng dùng đường cong nội suy nếu nó làm người xem hiểu rằng có giao dịch ở ngày không có dữ liệu.

## Design documentation

- Sau khi triển khai và xem ảnh chụp thật: ghi quy tắc chọn độ hạt và xử lý donut một nhóm vào `DESIGN.md` nếu ổn định qua các phân hệ.
