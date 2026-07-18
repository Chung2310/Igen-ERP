# Thiết kế: Bật/tắt module theo doanh nghiệp (tenant)

Ngày: 2026-07-18

## Mục tiêu

Khi đăng ký tài khoản doanh nghiệp, chủ doanh nghiệp chọn các module nghiệp vụ sẽ sử dụng. Các tài khoản trong doanh nghiệp chỉ thấy các module đã bật trên giao diện (sidebar, điều hướng, Tổng quan). Module tắt bị chặn cả ở API. Sau khi đăng ký, chỉ super-admin mới thay đổi được danh sách module.

## Phạm vi module

5 module nghiệp vụ có thể bật/tắt, với key chuẩn hóa:

| Key | Tab |
|---|---|
| `hr` | NHÂN SỰ |
| `inventory` | KHO & SẢN PHẨM |
| `resource` | QUẢN LÝ TÀI NGUYÊN |
| `chat` | TRÒ CHUYỆN |
| `student` | QUẢN LÝ HỌC VIÊN |

TỔNG QUAN, Ví, Cài đặt, User Admin luôn hiển thị, không thuộc phạm vi bật/tắt.

## 1. Dữ liệu

- `server/model/company.model.ts` + `server/interface/company.interface.ts`: thêm `enabledModules: string[]`, default là đủ 5 key.
- Company cũ không có trường này (hoặc trường rỗng do dữ liệu lỗi): xử lý như bật tất cả (backward compatible, không cần migration).
- Danh sách key hợp lệ khai báo một nơi duy nhất (hằng `MODULE_KEYS`) dùng chung cho model, validation, middleware; phía client có bản tương ứng trong `src/types`/config kèm mapping key → TabType.

## 2. Đăng ký doanh nghiệp

- `AuthPage.tsx` (form đăng ký doanh nghiệp): thêm nhóm checkbox "Chọn module sử dụng", mặc định tick tất cả, bắt buộc chọn tối thiểu 1.
- `registerCompanyAndAdmin` (`server/service/auth.service.ts`): nhận `enabledModules`, lọc theo `MODULE_KEYS`, nếu rỗng/không gửi thì mặc định bật tất cả.
- Validation phía server (theo pattern validation hiện có của auth router).

## 3. Frontend theo tenant

- Response login / me trả thêm `enabledModules` của company.
- `AuthContext` lưu và expose `enabledModules` (kèm helper `isModuleEnabled(key)`); thiếu dữ liệu → coi là bật tất cả.
- `Sidebar.tsx`: lọc `baseMenuItems` theo module bật.
- Router/App: truy cập trực tiếp URL của tab bị tắt → redirect về TỔNG QUAN.

## 4. Tổng quan (DashboardTab)

Ẩn các thành phần thuộc module đã tắt:

- ModuleCard nhân sự, kho & sản phẩm, kanban/lịch/đào tạo (hr), học viên/học phí (student).
- Widget "Doanh thu xuất kho", "Cảnh báo tồn kho", đề xuất AI nhập kho (inventory).
- Layout grid tự dồn khi thiếu card.
- Các API tổng hợp phục vụ Dashboard: phần dữ liệu thuộc module tắt trả rỗng hoặc bị bỏ qua, client không gọi fetch của module tắt.

## 5. Backend enforcement

- Middleware `requireModule(key)` (file mới trong `server/middleware/`): lấy `companyCode` từ user đã xác thực, đọc company (cache in-memory TTL ngắn ~60s để tránh query mỗi request), trả 403 `{ message: "Module chưa được kích hoạt cho doanh nghiệp" }` nếu tắt.
- Gắn vào router: HR (timekeeping, kanban, calendar, leave, training, workflow...), inventory (product, category, stock, transaction), resource, chat (kèm chặn socket join room chat nếu khả thi ở tầng socket), student-management.
- Super-admin và các route auth/user/wallet/settings không bị ảnh hưởng.

## 6. Super-admin

- `tenant-management.service.ts`: action mới cập nhật `enabledModules` cho tenant, ghi audit theo pattern action hiện có (action-registry).
- `TenantDetailPage.tsx`: section "Modules" với toggle từng module, lưu qua action trên. Đây là nơi duy nhất chỉnh sửa sau đăng ký.
- Khi super-admin tắt module, user đang online sẽ thấy hiệu lực ở lần load/refresh tiếp theo (không cần realtime push).

## 7. Kiểm thử

- Unit test middleware `requireModule`: bật, tắt, company không có trường, cache.
- Unit test `registerCompanyAndAdmin` với enabledModules (hợp lệ, rỗng, key rác).
- Unit test action super-admin cập nhật modules (theo pattern `tenant-management.service.test.ts`).
- Kiểm tra thủ công: đăng ký DN mới chỉ bật 2 module → sidebar/tổng quan chỉ hiện tương ứng, gọi API module tắt trả 403; super-admin bật lại → xuất hiện sau refresh.

## Ngoài phạm vi

- Phân quyền module theo từng user/role trong doanh nghiệp.
- Billing/gói dịch vụ gắn với module.
- Realtime cập nhật khi super-admin đổi module.
