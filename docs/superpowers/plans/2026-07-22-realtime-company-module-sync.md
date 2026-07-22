# Realtime Company Module Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đồng bộ `enabledModules` tức thời tới các tài khoản đang online trong doanh nghiệp và chuyển khỏi module vừa bị tắt mà không tải lại trang.

**Architecture:** Router cập nhật module sẽ xóa cache và phát `company_modules_updated` qua room Socket.IO của doanh nghiệp sau khi database lưu thành công. `AuthContext` nhận event, cập nhật profile và làm mới profile khi socket reconnect; Sidebar, Dashboard và điều hướng hiện có tự phản ứng với state mới.

**Tech Stack:** Express, Socket.IO, React 19, TypeScript, Vitest, Testing Library, Node test runner.

## Global Constraints

- Tái sử dụng room `company:<companyCode>` và event `company_modules_updated`.
- Không thêm polling nền mới.
- Không phát dữ liệu nhạy cảm trong socket payload.
- Không phát event nếu cập nhật database thất bại.
- Không thay đổi mô hình dữ liệu module.
- Không sửa `yarn.lock` đang thay đổi ngoài phạm vi.

---

### Task 1: Phát sự kiện sau khi cập nhật module

**Files:**
- Modify: `server/router/super-admin-tenant.router.ts`
- Modify: `server/router/super-admin-tenant.router.test.ts`

**Interfaces:**
- Consumes: `clearModuleCache(companyCode?: string)` và `emitToCompany(companyCode, eventName, data)`.
- Produces: dependency injection tùy chọn `clearModuleCache` và `emitToCompany` trong `createTenantRouter`; event `{ companyCode, enabledModules }`.

- [ ] **Step 1: Viết test thất bại**

Mở rộng test router để PATCH `/tenants/ACME/modules` trả danh sách đã lưu, rồi xác nhận cache được xóa với `ACME` và emitter nhận `("ACME", "company_modules_updated", { companyCode: "ACME", enabledModules: ["hr"] })`. Thêm trường hợp service ném lỗi và xác nhận không phát event.

- [ ] **Step 2: Chạy test RED**

Run: `npx tsx --test server/router/super-admin-tenant.router.test.ts`

Expected: FAIL vì router chưa gọi cache clearer/emitter.

- [ ] **Step 3: Cài đặt tối thiểu**

Mở rộng `Dependencies`, mặc định dùng `clearModuleCache` và `emitToCompany`. Trong handler module, chờ `service.updateModules`, sau đó xóa cache, phát payload lấy từ kết quả đã lưu và trả kết quả.

- [ ] **Step 4: Chạy test GREEN**

Run: `npx tsx --test server/router/super-admin-tenant.router.test.ts`

Expected: PASS.

### Task 2: Cập nhật AuthContext qua socket

**Files:**
- Create: `src/context/companyModuleSync.ts`
- Create: `src/context/companyModuleSync.test.ts`
- Modify: `src/context/AuthContext.tsx`
- Modify: `src/services/socketService.ts`

**Interfaces:**
- Produces: `normalizeCompanyModulesEvent(value): { companyCode: string; enabledModules: ModuleKey[] } | null`.
- Consumes: `socketService.on("company_modules_updated", callback)` và `socketService.onStatusChange(callback)`.

- [ ] **Step 1: Viết test thất bại cho chuẩn hóa payload**

Kiểm tra company code được trim/uppercase, key rác bị loại, key lặp bị loại và payload thiếu company/array trả `null`.

- [ ] **Step 2: Chạy test RED**

Run: `npx tsx --test src/context/companyModuleSync.test.ts`

Expected: FAIL vì helper chưa tồn tại.

- [ ] **Step 3: Cài đặt helper tối thiểu**

Dùng `MODULE_KEYS` để lọc/deduplicate và trả payload đã chuẩn hóa; không coi array rỗng hoặc payload sai kiểu là event hợp lệ.

- [ ] **Step 4: Chạy test helper GREEN**

Run: `npx tsx --test src/context/companyModuleSync.test.ts`

Expected: PASS.

- [ ] **Step 5: Tích hợp listener vào AuthContext**

Đăng ký event khi profile có company. Với event hợp lệ và đúng company, merge `enabledModules` vào cả `user` và `userProfile`, rồi gọi toast. Đăng ký status listener và chỉ gọi `getMe` khi chuyển sang connected sau lần khởi tạo để đồng bộ lại; cập nhật cả hai state nếu lấy profile thành công.

- [ ] **Step 6: Xác minh frontend**

Run: `npx tsx --test src/context/companyModuleSync.test.ts src/config/modules.test.ts`

Expected: PASS, bao gồm helper điều hướng module hiện có.

### Task 3: Xác minh hồi quy

**Files:** Verify only.

- [ ] **Step 1: Chạy test liên quan**

Run: `npx tsx --test server/router/super-admin-tenant.router.test.ts src/context/companyModuleSync.test.ts src/config/modules.test.ts`

Expected: PASS.

- [ ] **Step 2: Chạy typecheck**

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 3: Chạy build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 4: Rà soát phạm vi**

Run: `git diff --check` và `git status --short`.

Expected: không có whitespace error; `yarn.lock` vẫn không được stage/chỉnh bởi tính năng này.
