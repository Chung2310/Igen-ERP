# Payroll Table Column Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make both payroll table layouts visually self-explanatory while showing only employee names in employee cells.

**Architecture:** Keep payroll data and sorting unchanged. Add presentational grouped header rows and shared cell classes in `PayrollTab.tsx`; remove employee publication badges and IDs from both employee-cell render paths. Extend `PayrollTab.test.tsx` with assertions for group labels and hidden metadata.

**Tech Stack:** React, TypeScript, Tailwind utility classes, Vitest, Testing Library.

## Global Constraints

- Do not change payroll calculations, API requests, permissions, or persisted data.
- Keep fixed period-input columns hidden.
- Keep editable result fields editable and deduction total/net read-only.
- Show only the employee name in employee cells; do not render employee ID or “Chưa phát hành”.

---

### Task 1: Add failing presentation tests

**Files:**
- Modify: `src/components/hr/PayrollTab.test.tsx`

- [ ] Add assertions to the existing editable payroll table test for the four group labels: `Thông tin nhân viên`, `Các khoản có thể chỉnh sửa`, `Khoản khấu trừ`, and `Thực nhận`.
- [ ] Add assertions that `screen.queryByText("Chưa phát hành")` is null and `screen.queryByText("e1")` is null while `Nguyễn Văn A` remains visible.
- [ ] Run `npx vitest run src/components/hr/PayrollTab.test.tsx` and confirm the new assertions fail because grouped headers and metadata hiding are not implemented.

### Task 2: Implement grouped headers and clean employee cells

**Files:**
- Modify: `src/components/hr/PayrollTab.tsx:535-610`

- [ ] Add a two-row `<thead>` to the run table using `rowSpan={2}` for the employee column, `colSpan={PAYROLL_RESULT_FIELDS.length + customVariables.length}` for editable components, and `colSpan={1}` for deduction and net groups.
- [ ] Use `border-l-2` separators and subtle slate/cyan/rose backgrounds to distinguish group boundaries; keep the existing `SortHeader` row as the second header row.
- [ ] Add `sticky left-0 z-20 bg-white` to employee header and employee cells so the name remains visible during horizontal scrolling.
- [ ] Replace the run employee cell contents with only `<span>{line.employeeName || "Chưa có tên"}</span>` plus validation errors; remove publication badges and employee ID.
- [ ] Remove employee ID rendering from the draft/no-run employee cell as well.
- [ ] Preserve existing inputs, read-only totals, sort keys, and empty-state colspans.

### Task 3: Verify and finish

**Files:**
- Modify: `src/components/hr/PayrollTab.test.tsx` only if assertions need accessible-label adjustments.

- [ ] Run `npx vitest run src/components/hr/PayrollTab.test.tsx` and confirm all tests pass.
- [ ] Run `npm run typecheck`.
- [ ] Run `git diff --check` and inspect `git status` for unintended files.
- [ ] Commit with `feat(payroll): group payroll table columns clearly`.
