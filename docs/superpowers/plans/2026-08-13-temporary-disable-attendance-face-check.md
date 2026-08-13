# Temporary Attendance Face Check Disable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bỏ tạm bước camera/xác minh khuôn mặt khỏi Check-In và Check-Out nhân viên trong khi vẫn giữ GPS, chi nhánh và IP mạng.

**Architecture:** Một hằng số dùng chung trong `src/config` điều khiển cả client và middleware server. Khi tắt, client gửi FormData chỉ có tọa độ và thiết bị ngay sau khi lấy GPS; middleware khuôn mặt gọi `next()` mà không yêu cầu ảnh. Nhánh bật giữ nguyên luồng camera hiện có.

**Tech Stack:** React 19, TypeScript, Express, Multer, Vitest, Testing Library.

## Global Constraints

- `ATTENDANCE_FACE_CHECK_ENABLED` mặc định phải là `false`.
- Chỉ thay đổi Check-In/Check-Out nhân viên; không đổi QR công nhân, học viên hoặc quản lý khuôn mặt.
- Vẫn chạy `attendanceBranchGate` cho kiểm tra GPS, chi nhánh và IP.
- Không xóa mã camera/xác minh để có thể bật lại bằng một thay đổi cấu hình.

---

### Task 1: Cờ cấu hình và bypass backend

**Files:**
- Create: `src/config/attendanceFaceCheck.ts`
- Modify: `server/middleware/attendance-face-gate.ts`
- Create: `server/middleware/attendance-face-gate.disabled.test.ts`

**Interfaces:**
- Produces: `ATTENDANCE_FACE_CHECK_ENABLED: boolean`.
- Middleware `attendanceFaceGate(req, res, next)` phải gọi `next()` ngay khi cờ tắt.

- [ ] **Step 1: Viết test thất bại** xác nhận cờ là `false`, request không có file vẫn gọi `next`, không ghi attempt và không trả HTTP 400.
- [ ] **Step 2: Chạy test** bằng `npx vitest run server/middleware/attendance-face-gate.disabled.test.ts`; kỳ vọng FAIL vì chưa có cờ/bypass.
- [ ] **Step 3: Tạo cấu hình và bypass tối thiểu**:

```ts
export const ATTENDANCE_FACE_CHECK_ENABLED = false;

export async function attendanceFaceGate(req, res, next) {
  if (!ATTENDANCE_FACE_CHECK_ENABLED) return next();
  // luồng xác minh hiện tại giữ nguyên
}
```

- [ ] **Step 4: Chạy lại test**; kỳ vọng PASS.

### Task 2: Gửi chấm công trực tiếp từ Dashboard

**Files:**
- Modify: `src/components/dashboard/TimekeepingWidget.tsx`
- Create: `src/components/dashboard/TimekeepingWidget.face-disabled.test.tsx`

**Interfaces:**
- Consumes: `ATTENDANCE_FACE_CHECK_ENABLED`.
- Khi cờ tắt, gửi `FormData` gồm `latitude`, `longitude`, `deviceInfo`, không có `file`.

- [ ] **Step 1: Viết test thất bại** mock geolocation/fetch, bấm Check-In và xác nhận fetch được gọi ngay, FormData không có `file`, camera modal không xuất hiện.
- [ ] **Step 2: Chạy test riêng**; kỳ vọng FAIL vì code hiện mở camera.
- [ ] **Step 3: Tách hàm gửi request hiện có để nhận ảnh tùy chọn** và gọi trực tiếp sau GPS khi cờ tắt; khi cờ bật tiếp tục `setCameraAction(type)`.
- [ ] **Step 4: Chạy lại test**; kỳ vọng PASS.

### Task 3: Gửi chấm công trực tiếp từ Header

**Files:**
- Modify: `src/pages/Header.tsx`
- Create: `src/pages/Header.attendance-face-disabled.test.tsx`

**Interfaces:**
- Consumes: `ATTENDANCE_FACE_CHECK_ENABLED`.
- Cùng payload và hành vi với Dashboard; desktop/mobile dùng chung handler.

- [ ] **Step 1: Viết test thất bại** xác nhận sau GPS Header gọi API không có file và không mở camera.
- [ ] **Step 2: Chạy test riêng**; kỳ vọng FAIL với luồng camera hiện tại.
- [ ] **Step 3: Cho hàm gửi request nhận ảnh tùy chọn**, gọi trực tiếp khi cờ tắt và giữ nhánh camera khi bật.
- [ ] **Step 4: Chạy lại test**; kỳ vọng PASS.

### Task 4: Xác minh tích hợp và commit

**Files:**
- Verify only all files above.

- [ ] **Step 1: Chạy test liên quan**:

```powershell
npx vitest run server/middleware/attendance-face-gate.disabled.test.ts server/router/timekeeping.multipart.test.ts src/components/dashboard/TimekeepingWidget.face-disabled.test.tsx src/pages/Header.attendance-face-disabled.test.tsx server/service/branch-attendance-gate.service.test.ts
```

- [ ] **Step 2: Chạy `npm run typecheck` và `npm run build`**, yêu cầu exit code 0.
- [ ] **Step 3: Kiểm tra `git diff --check` và chỉ stage các file của kế hoạch.**
- [ ] **Step 4: Commit với message `feat: temporarily bypass attendance face check` và push nhánh hiện tại.
