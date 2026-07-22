# Super Admin Tenant Module Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở popup quản lý module khi Super Admin nhấn vào thẻ doanh nghiệp, hiển thị thông tin doanh nghiệp chỉ đọc và cho phép cập nhật các module bằng checkbox.

**Architecture:** Tạo `TenantModuleDialog` chịu trách nhiệm tải chi tiết, quản lý form module và gọi API cập nhật hiện có. `TenantListPage` chỉ quản lý doanh nghiệp đang chọn, vòng đời popup và tải lại danh sách sau khi lưu thành công.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, lucide-react, Node test runner, Testing Library/JSDOM.

## Global Constraints

- Không tạo endpoint hoặc mô hình dữ liệu mới.
- Thông tin doanh nghiệp trong popup chỉ đọc; chỉ checkbox module được chỉnh sửa.
- Không cho lưu khi không còn module nào được chọn.
- Giữ nguyên cơ chế lý do, mật khẩu và TOTP của hành động đặc quyền hiện có.
- Không tạo commit, worktree hoặc subagent nếu người dùng chưa yêu cầu.

---

### Task 1: Popup chi tiết và quản lý module

**Files:**
- Create: `src/pages/super-admin/tenants/TenantModuleDialog.tsx`
- Create: `src/pages/super-admin/tenants/TenantModuleDialog.test.tsx`

**Interfaces:**
- Consumes: `superAdminTenantService.detail(code)`, `superAdminTenantService.updateModules(code, input)`, `MODULE_KEYS`, `MODULE_LABELS`.
- Produces: `TenantModuleDialog({ code, onClose, onSaved }: { code: string; onClose: () => void; onSaved: () => void })`.

- [ ] **Step 1: Viết test thất bại cho trạng thái tải, dữ liệu chỉ đọc và checkbox**

Mock service để `detail("ACME")` trả về tenant ACME, summary có 3 người dùng và `enabledModules: ["hr", "chat"]`. Render dialog và kiểm tra tiêu đề, tên/mã/email/trạng thái/số người dùng xuất hiện dưới dạng văn bản; checkbox HR và Chat được tích, các checkbox còn lại không tích; không có input chỉnh sửa tên, mã hoặc email.

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx vitest run src/pages/super-admin/tenants/TenantModuleDialog.test.tsx`

Expected: FAIL vì `TenantModuleDialog.tsx` chưa tồn tại.

- [ ] **Step 3: Cài đặt phần tải và hiển thị tối thiểu**

Tạo component dialog với `role="dialog"`, `aria-modal="true"`, `aria-labelledby="tenant-module-dialog-title"`; gọi `detail(code)` trong effect; hiển thị loading/error; sau khi tải xong hiển thị dữ liệu bằng `<dl>` và module bằng checkbox. Khởi tạo module bằng `tenant.enabledModules` nếu là mảng, nếu thiếu thì dùng toàn bộ `MODULE_KEYS`.

- [ ] **Step 4: Chạy test hiển thị để xác nhận pass**

Run: `npx vitest run src/pages/super-admin/tenants/TenantModuleDialog.test.tsx`

Expected: PASS cho luồng tải và hiển thị.

- [ ] **Step 5: Viết test thất bại cho cập nhật và điều kiện lưu**

Kiểm tra nút lưu bị vô hiệu hóa khi lý do trống hoặc bỏ chọn toàn bộ module. Nhập lý do, mật khẩu, TOTP; thay đổi checkbox; nhấn lưu; xác nhận `updateModules("ACME", { enabledModules, reason, password, token, step: 0 })` nhận đúng dữ liệu, sau đó `onSaved` được gọi. Mock lỗi API và xác nhận thông báo cùng correlation ID hiển thị, dialog không đóng.

- [ ] **Step 6: Cài đặt lưu, lỗi và hành vi đóng**

Thêm state `reason`, `password`, `token`, `saving`; chỉ cho lưu khi có ít nhất một module và lý do không rỗng. Thêm nút đóng, nút hủy, xử lý Escape và backdrop; không cho đóng qua backdrop/Escape khi đang lưu. Sau thành công gọi `onSaved`; sau lỗi giữ dialog mở và hiển thị message/correlation ID.

- [ ] **Step 7: Chạy test popup đầy đủ**

Run: `npx vitest run src/pages/super-admin/tenants/TenantModuleDialog.test.tsx`

Expected: PASS toàn bộ test popup.

### Task 2: Mở popup từ danh sách doanh nghiệp

**Files:**
- Modify: `src/pages/super-admin/tenants/TenantListPage.tsx`
- Modify: `src/pages/super-admin/management-layout.test.ts`

**Interfaces:**
- Consumes: `TenantModuleDialog` từ Task 1.
- Produces: Mỗi thẻ tenant mở popup bằng `selectedTenantCode`; lưu thành công đóng popup và gọi lại `load()`.

- [ ] **Step 1: Viết test cấu trúc thất bại cho tích hợp popup**

Mở rộng `management-layout.test.ts` để kiểm tra `TenantListPage.tsx` import `TenantModuleDialog`, có state `selectedTenantCode`, nút thẻ gọi `setSelectedTenantCode(t.code)`, và render dialog với callback `onSaved` đóng popup rồi tải lại danh sách.

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx tsx --test src/pages/super-admin/management-layout.test.ts`

Expected: FAIL vì danh sách chưa tích hợp `TenantModuleDialog`.

- [ ] **Step 3: Tích hợp popup vào danh sách**

Đổi prop thành tùy chọn để không phá vỡ nơi gọi hiện tại: `onSelect?: (code: string) => void`. Thêm `selectedTenantCode`, mở popup khi nhấn thẻ, đồng thời chỉ gọi `onSelect?.(code)` nếu callback được truyền. Render `TenantModuleDialog` ở cuối trang; `onClose` đặt code về `null`; `onSaved` đóng popup và gọi `load()`.

- [ ] **Step 4: Chạy các test liên quan**

Run: `npx tsx --test src/pages/super-admin/management-layout.test.ts`

Expected: PASS.

Run: `npx vitest run src/pages/super-admin/tenants/TenantModuleDialog.test.tsx`

Expected: PASS.

### Task 3: Xác minh hồi quy

**Files:**
- Verify only.

**Interfaces:**
- Consumes: Kết quả Task 1 và Task 2.
- Produces: Bằng chứng typecheck, test và build không hồi quy.

- [ ] **Step 1: Chạy typecheck**

Run: `npm run typecheck`

Expected: exit code 0; nếu dự án có lỗi nền, ghi rõ lỗi nào không liên quan và xác minh không có lỗi trong hai file mới/sửa.

- [ ] **Step 2: Chạy build sản phẩm**

Run: `npm run build`

Expected: exit code 0 và tạo bundle client/server thành công.

- [ ] **Step 3: Rà soát diff theo phạm vi**

Run: `git diff --check`

Expected: không có whitespace error.

Run: `git status --short`

Expected: chỉ có đặc tả, kế hoạch, popup/test mới và các file danh sách/test đã sửa thuộc phạm vi tính năng.
