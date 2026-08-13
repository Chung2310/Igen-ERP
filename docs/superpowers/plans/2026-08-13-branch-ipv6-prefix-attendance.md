# Branch IPv6 Prefix Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép các thiết bị cùng mạng IPv6 `/64` chấm công, giữ IPv4 đối chiếu chính xác và tương thích dữ liệu IPv6 cũ.

**Architecture:** Mở rộng utility IP phía server để chuẩn hóa IPv6 bằng `node:net` và tạo khóa mạng `/64`; service gate dùng khóa này thay cho so sánh chuỗi đầy đủ. Controller chuẩn hóa dữ liệu lưu, Joi cho phép CIDR, còn frontend chuyển IPv6 vừa lấy thành prefix `/64` để quản trị viên thấy đúng phạm vi mạng.

**Tech Stack:** TypeScript, Node.js `net.isIP`, Express, Joi, React, Vitest.

## Global Constraints

- IPv4 phải tiếp tục so khớp toàn bộ địa chỉ.
- IPv6 đầy đủ và IPv6 CIDR phải so khớp theo đúng prefix `/64`.
- Dữ liệu IPv6 đầy đủ cũ phải hoạt động không cần migration.
- GPS và bán kính chi nhánh không thay đổi.
- CIDR khác `/64` và địa chỉ sai phải bị từ chối khi lưu.

---

### Task 1: Chuẩn hóa khóa mạng IPv6

**Files:**
- Modify: `server/utils/request-ip.ts`
- Modify: `server/utils/request-ip.test.ts`

**Interfaces:**
- Produces: `normalizeAllowedNetwork(value: unknown): string` trả IPv4 nguyên dạng hoặc IPv6 canonical `/64`.
- Produces: `isRequestIpAllowed(requestIp: unknown, allowed: unknown): boolean`.

- [ ] **Step 1:** Thêm test đỏ cho IPv6 đầy đủ, rút gọn, CIDR `/64`, cùng prefix và khác prefix.
- [ ] **Step 2:** Chạy `npx vitest run server/utils/request-ip.test.ts`; kỳ vọng FAIL vì chưa có API mới.
- [ ] **Step 3:** Implement parser mở rộng 8 hextet, xử lý `::`, bỏ suffix `/64`, canonical hóa bốn hextet đầu và giữ IPv4 chính xác.
- [ ] **Step 4:** Chạy lại test; kỳ vọng PASS.

### Task 2: Áp dụng cho gate và validation chi nhánh

**Files:**
- Modify: `server/service/branch-attendance-gate.service.ts`
- Modify: `server/service/branch-attendance-gate.service.test.ts`
- Modify: `server/controller/branch.controller.ts`
- Modify: `server/router/auth.router.ts`
- Create: `server/router/branch-location-validation.test.ts`

**Interfaces:**
- Consumes: `normalizeAllowedNetwork`, `isRequestIpAllowed`.
- Gate cho phép hai IPv6 cùng `/64`; controller lưu IPv6 dạng `/64`; Joi chỉ cho CIDR `/64` hoặc IP không CIDR.

- [ ] **Step 1:** Thêm test đỏ cho gate cùng/khác `/64` và schema CIDR.
- [ ] **Step 2:** Chạy test mục tiêu; kỳ vọng FAIL.
- [ ] **Step 3:** Thay so sánh `includes` bằng `some(isRequestIpAllowed)`, chuẩn hóa controller và dùng Joi custom kiểm tra CIDR `/64`.
- [ ] **Step 4:** Chạy lại test; kỳ vọng PASS.

### Task 3: Hiển thị prefix IPv6 trên form chi nhánh

**Files:**
- Modify: `src/components/settings/BranchManagementTab.tsx`
- Modify: `src/components/settings/BranchManagementTab.test.tsx`
- Create: `src/utils/attendanceNetwork.ts`
- Create: `src/utils/attendanceNetwork.test.ts`

**Interfaces:**
- Produces: `toAttendanceNetwork(value: string): string`, đổi IPv6 thành `/64`, giữ IPv4.
- Nút lấy IP lưu giá trị đã chuyển đổi; input thủ công vẫn do backend validation bảo vệ.

- [ ] **Step 1:** Viết test đỏ cho helper và nút lấy IP IPv6.
- [ ] **Step 2:** Chạy test mục tiêu; kỳ vọng FAIL.
- [ ] **Step 3:** Implement helper phía browser và gọi khi nhận `currentIp()`.
- [ ] **Step 4:** Chạy lại test; kỳ vọng PASS.

### Task 4: Xác minh và phát hành

- [ ] **Step 1:** Chạy toàn bộ test IP, gate, validation và form chi nhánh.
- [ ] **Step 2:** Chạy `npm run typecheck` và `npm run build`; yêu cầu exit code 0.
- [ ] **Step 3:** Chạy `git diff --check`, stage đúng file kế hoạch và triển khai.
- [ ] **Step 4:** Commit `fix: match attendance IPv6 networks by prefix` và push nhánh hiện tại.
