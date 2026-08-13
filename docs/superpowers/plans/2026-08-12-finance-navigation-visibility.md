# Finance Navigation Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị module Tài chính trong Sidebar và Header khi tenant bật `finance`, đồng thời giữ nguyên cơ chế khóa theo quyền hiện có.

**Architecture:** Bổ sung `TÀI CHÍNH` vào hai catalog điều hướng hard-code đang được lọc bởi `filterEnabledTabs`. Regression test kiểm tra catalog thật thay vì tạo một nguồn quyền song song.

**Tech Stack:** React 19, TypeScript 5.8, Vitest 4, lucide-react.

## Global Constraints

- Route `/tai-chinh` và Finance workspace không thay đổi.
- Chỉ hiển thị khi `enabledModules` chứa `finance`.
- Quyền tiếp tục lấy từ `MODULE_READ_PERMISSIONS`.
- Không thay đổi dữ liệu tenant hoặc cutover.

---

### Task 1: Finance Navigation Entries

**Files:**
- Modify: `src/pages/Sidebar.tsx`
- Modify: `src/pages/Header.tsx`
- Modify: `src/pages/Sidebar.business-modules.test.tsx`
- Create: `src/pages/finance-navigation.test.ts`

**Interfaces:**
- Consumes: `filterEnabledTabs`, `MODULE_READ_PERMISSIONS`, `TabType`.
- Produces: mục điều hướng `TÀI CHÍNH` dùng icon `Landmark` tại Sidebar và Header.

- [ ] **Step 1: Write failing regression tests**

Kiểm tra source catalog có `label: "TÀI CHÍNH"`, Header có cấu hình `"TÀI CHÍNH": { title: "Tài chính"`, và `filterEnabledTabs` chỉ giữ Finance khi module được bật.

- [ ] **Step 2: Verify RED**

Run: `npx vitest run src/pages/Sidebar.business-modules.test.tsx src/pages/finance-navigation.test.ts`

Expected: FAIL vì Sidebar/Header chưa khai báo Finance.

- [ ] **Step 3: Implement minimal navigation entries**

Import `Landmark`, thêm `TÀI CHÍNH` vào `baseMenuItems`, `tabConfig` và `allTabs`; không thay đổi logic lọc hoặc permission.

- [ ] **Step 4: Verify GREEN and regressions**

Run: `npx vitest run src/pages/Sidebar.business-modules.test.tsx src/pages/finance-navigation.test.ts src/router/business-module-routes.test.tsx`

Expected: toàn bộ test PASS.

- [ ] **Step 5: Static verification and commit**

Run: `npm run typecheck` và `git diff --check`.

Commit: `fix: show enabled finance module in navigation`.
