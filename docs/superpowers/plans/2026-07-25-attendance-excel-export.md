# Attendance Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung menu Tiện ích trong bảng chấm công tháng để xuất riêng file Excel số công hoặc số giờ theo tháng, năm và kết quả tìm kiếm nhân viên hiện tại.

**Architecture:** Tách việc dựng ma trận dữ liệu và workbook sang `src/utils/attendanceExcel.ts`, giữ `CalendarTab.tsx` chỉ quản lý menu, validation và toast. Utility nhận dữ liệu ngày đã được CalendarTab tính theo cùng quy tắc hiển thị, trả về mô hình thuần để unit test trước khi gọi `xlsx.writeFile`.

**Tech Stack:** React 19, TypeScript 5.8, Vitest 4, SheetJS `xlsx` 0.18.5, Tailwind CSS.

## Global Constraints

- Có đúng hai hành động: `Xuất bảng số công` và `Xuất bảng số giờ`.
- Mỗi hành động tạo một workbook riêng có một worksheet.
- File dùng tháng/năm và toàn bộ danh sách nhân viên sau bộ lọc tìm kiếm, không bị giới hạn bởi phân trang.
- Ô dữ liệu và tổng phải là số để Excel có thể tính toán; ô không có dữ liệu hợp lệ phải để trống.
- Không thay đổi API, model server hoặc công thức tính số công/số giờ hiện có.
- Menu đóng sau khi chọn hành động hoặc bấm ra ngoài.

## File Structure

- Create: `src/utils/attendanceExcel.ts` - kiểu dữ liệu xuất, tạo hàng/worksheet/workbook và tải file.
- Create: `src/utils/attendanceExcel.test.ts` - unit test ma trận, tên file, worksheet và kiểu dữ liệu.
- Create: `src/components/hr/AttendanceUtilityMenu.tsx` - nút/menu Tiện ích độc lập, hỗ trợ click-outside.
- Create: `src/components/hr/AttendanceUtilityMenu.test.tsx` - kiểm tra mở, đóng và chọn hành động.
- Modify: `src/components/hr/CalendarTab.tsx` - ánh xạ dữ liệu bảng tháng sang exporter, validation và toast.
- Modify: `src/components/hr/CalendarTab.test.tsx` - kiểm tra wiring exporter ở mức tích hợp nguồn.

---

### Task 1: Pure attendance export model

**Files:**
- Create: `src/utils/attendanceExcel.test.ts`
- Create: `src/utils/attendanceExcel.ts`

**Interfaces:**
- Consumes: Không phụ thuộc UI.
- Produces:

```ts
export type AttendanceExportKind = "coeff" | "hours";

export type AttendanceExportEmployee = {
  uid: string;
  displayName: string;
  login: string;
};

export type AttendanceExportCell = {
  coeff?: number | null;
  hours?: number | null;
  hasRecord: boolean;
  isAbsent: boolean;
  isWeekend: boolean;
  isFuture: boolean;
};

export type AttendanceExportInput = {
  kind: AttendanceExportKind;
  month: number;
  year: number;
  employees: AttendanceExportEmployee[];
  getCell: (employee: AttendanceExportEmployee, day: number) => AttendanceExportCell;
};

export function buildAttendanceExport(input: AttendanceExportInput): {
  sheetName: "Số công" | "Số giờ";
  fileName: string;
  headers: string[];
  rows: Array<Record<string, string | number>>;
};
```

- [ ] **Step 1: Write failing tests for headers and filenames**

```ts
import { describe, expect, it } from "vitest";
import { buildAttendanceExport } from "./attendanceExcel";

const employee = { uid: "u1", displayName: "Nguyễn Văn A", login: "a@igen.vn" };

describe("buildAttendanceExport", () => {
  it("builds a leap-February coefficient export with the expected filename", () => {
    const result = buildAttendanceExport({
      kind: "coeff",
      month: 2,
      year: 2028,
      employees: [employee],
      getCell: () => ({
        coeff: null,
        hours: null,
        hasRecord: false,
        isAbsent: false,
        isWeekend: false,
        isFuture: false,
      }),
    });

    expect(result.sheetName).toBe("Số công");
    expect(result.fileName).toBe("bang-so-cong-thang-02-2028.xlsx");
    expect(result.headers).toHaveLength(33);
    expect(result.headers.at(-1)).toBe("29");
  });

  it("builds a 31-day hours export with the expected filename", () => {
    const result = buildAttendanceExport({
      kind: "hours",
      month: 7,
      year: 2026,
      employees: [employee],
      getCell: () => ({
        coeff: null,
        hours: null,
        hasRecord: false,
        isAbsent: false,
        isWeekend: false,
        isFuture: false,
      }),
    });

    expect(result.sheetName).toBe("Số giờ");
    expect(result.fileName).toBe("bang-so-gio-thang-07-2026.xlsx");
    expect(result.headers).toHaveLength(35);
    expect(result.headers.at(-1)).toBe("31");
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npx vitest run src/utils/attendanceExcel.test.ts
```

Expected: FAIL because `./attendanceExcel` does not exist.

- [ ] **Step 3: Implement headers and metadata**

```ts
export type AttendanceExportKind = "coeff" | "hours";

export type AttendanceExportEmployee = {
  uid: string;
  displayName: string;
  login: string;
};

export type AttendanceExportCell = {
  coeff?: number | null;
  hours?: number | null;
  hasRecord: boolean;
  isAbsent: boolean;
  isWeekend: boolean;
  isFuture: boolean;
};

export type AttendanceExportInput = {
  kind: AttendanceExportKind;
  month: number;
  year: number;
  employees: AttendanceExportEmployee[];
  getCell: (employee: AttendanceExportEmployee, day: number) => AttendanceExportCell;
};

export function buildAttendanceExport(input: AttendanceExportInput) {
  const daysInMonth = new Date(input.year, input.month, 0).getDate();
  const isCoeff = input.kind === "coeff";
  const dayHeaders = Array.from({ length: daysInMonth }, (_, index) =>
    String(index + 1).padStart(2, "0")
  );

  return {
    sheetName: (isCoeff ? "Số công" : "Số giờ") as "Số công" | "Số giờ",
    fileName: `bang-so-${isCoeff ? "cong" : "gio"}-thang-${String(input.month).padStart(2, "0")}-${input.year}.xlsx`,
    headers: ["STT", "Họ và tên", "Mã đăng nhập", isCoeff ? "Tổng công" : "Tổng giờ", ...dayHeaders],
    rows: [] as Array<Record<string, string | number>>,
  };
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
npx vitest run src/utils/attendanceExcel.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Add failing tests for numeric cells, totals and blanks**

```ts
it("keeps coefficient values numeric and leaves unknown days blank", () => {
  const result = buildAttendanceExport({
    kind: "coeff",
    month: 4,
    year: 2026,
    employees: [employee],
    getCell: (_employee, day) => ({
      coeff: day === 1 ? 1 : day === 2 ? 0.5 : day === 3 ? 0 : null,
      hours: null,
      hasRecord: day <= 2,
      isAbsent: day === 3,
      isWeekend: day === 4,
      isFuture: day >= 5,
    }),
  });

  expect(result.rows[0]["Tổng công"]).toBe(1.5);
  expect(result.rows[0]["01"]).toBe(1);
  expect(result.rows[0]["02"]).toBe(0.5);
  expect(result.rows[0]["03"]).toBe(0);
  expect(result.rows[0]["04"]).toBe("");
  expect(result.rows[0]["05"]).toBe("");
});

it("keeps hour values and the total numeric", () => {
  const result = buildAttendanceExport({
    kind: "hours",
    month: 4,
    year: 2026,
    employees: [employee],
    getCell: (_employee, day) => ({
      coeff: null,
      hours: day === 1 ? 8 : day === 2 ? 7.5 : null,
      hasRecord: day <= 2,
      isAbsent: false,
      isWeekend: false,
      isFuture: false,
    }),
  });

  expect(result.rows[0]["Tổng giờ"]).toBe(15.5);
  expect(result.rows[0]["01"]).toBe(8);
  expect(result.rows[0]["02"]).toBe(7.5);
});
```

- [ ] **Step 6: Run tests and verify RED**

Run the same Vitest command. Expected: FAIL because `rows` is empty.

- [ ] **Step 7: Implement row creation**

Add inside `buildAttendanceExport` before `return`:

```ts
const rows = input.employees.map((employee, index) => {
  const row: Record<string, string | number> = {
    STT: index + 1,
    "Họ và tên": employee.displayName || "",
    "Mã đăng nhập": employee.login || "",
  };
  let total = 0;

  dayHeaders.forEach((header, dayIndex) => {
    const cell = input.getCell(employee, dayIndex + 1);
    const value = isCoeff ? cell.coeff : cell.hours;
    const shouldBeBlank =
      cell.isWeekend || cell.isFuture || (!cell.hasRecord && !cell.isAbsent);
    const normalized =
      shouldBeBlank || value == null || !Number.isFinite(value) ? "" : value;
    row[header] = normalized;
    if (typeof normalized === "number") total += normalized;
  });

  row[isCoeff ? "Tổng công" : "Tổng giờ"] = total;
  return row;
});
```

Return `rows` instead of the empty array.

- [ ] **Step 8: Run tests and verify GREEN**

Expected: all Task 1 tests PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add -- src/utils/attendanceExcel.ts src/utils/attendanceExcel.test.ts
git commit -m "feat: build attendance Excel export data"
```

---

### Task 2: Workbook creation and download

**Files:**
- Modify: `src/utils/attendanceExcel.test.ts`
- Modify: `src/utils/attendanceExcel.ts`

**Interfaces:**
- Consumes: `buildAttendanceExport(input)`.
- Produces:

```ts
export function createAttendanceWorkbook(input: AttendanceExportInput): {
  workbook: XLSX.WorkBook;
  fileName: string;
};

export function exportAttendanceExcel(input: AttendanceExportInput): void;
```

- [ ] **Step 1: Write failing workbook test**

```ts
import * as XLSX from "xlsx";
import { createAttendanceWorkbook } from "./attendanceExcel";

it("creates one worksheet with numeric totals and configured widths", () => {
  const { workbook, fileName } = createAttendanceWorkbook({
    kind: "hours",
    month: 4,
    year: 2026,
    employees: [employee],
    getCell: (_employee, day) => ({
      hours: day === 1 ? 8 : null,
      coeff: null,
      hasRecord: day === 1,
      isAbsent: false,
      isWeekend: false,
      isFuture: false,
    }),
  });

  expect(fileName).toBe("bang-so-gio-thang-04-2026.xlsx");
  expect(workbook.SheetNames).toEqual(["Số giờ"]);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets["Số giờ"]
  );
  expect(rows[0]["Tổng giờ"]).toBe(8);
  expect(rows[0]["01"]).toBe(8);
  expect(workbook.Sheets["Số giờ"]["!cols"]).toBeDefined();
});
```

- [ ] **Step 2: Run test and verify RED**

Expected: FAIL because `createAttendanceWorkbook` is not exported.

- [ ] **Step 3: Implement workbook and downloader**

```ts
import * as XLSX from "xlsx";

export function createAttendanceWorkbook(input: AttendanceExportInput) {
  const model = buildAttendanceExport(input);
  const worksheet = XLSX.utils.json_to_sheet(model.rows, {
    header: model.headers,
  });
  worksheet["!cols"] = [
    { wch: 7 },
    { wch: 28 },
    { wch: 28 },
    { wch: 12 },
    ...model.headers.slice(4).map(() => ({ wch: 6 })),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, model.sheetName);
  return { workbook, fileName: model.fileName };
}

export function exportAttendanceExcel(input: AttendanceExportInput) {
  const { workbook, fileName } = createAttendanceWorkbook(input);
  XLSX.writeFile(workbook, fileName);
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Expected: all utility tests PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add -- src/utils/attendanceExcel.ts src/utils/attendanceExcel.test.ts
git commit -m "feat: create attendance Excel workbooks"
```

---

### Task 3: Accessible utility dropdown

**Files:**
- Create: `src/components/hr/AttendanceUtilityMenu.test.tsx`
- Create: `src/components/hr/AttendanceUtilityMenu.tsx`

**Interfaces:**
- Consumes:

```ts
type AttendanceUtilityMenuProps = {
  onExportCoefficients: () => void;
  onExportHours: () => void;
  disabled?: boolean;
};
```

- Produces: Nút `Tiện ích` và menu hai hành động có click-outside.

- [ ] **Step 1: Write failing interaction tests**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AttendanceUtilityMenu from "./AttendanceUtilityMenu";

describe("AttendanceUtilityMenu", () => {
  it("opens both export actions and invokes coefficient export", () => {
    const onCoefficients = vi.fn();
    render(
      <AttendanceUtilityMenu
        onExportCoefficients={onCoefficients}
        onExportHours={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Tiện ích" }));
    expect(screen.getByRole("menuitem", { name: "Xuất bảng số công" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Xuất bảng số giờ" })).toBeVisible();
    fireEvent.click(screen.getByRole("menuitem", { name: "Xuất bảng số công" }));
    expect(onCoefficients).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes when clicking outside", () => {
    render(
      <div>
        <button>Ngoài menu</button>
        <AttendanceUtilityMenu
          onExportCoefficients={vi.fn()}
          onExportHours={vi.fn()}
        />
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: "Tiện ích" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Ngoài menu" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
npx vitest run src/components/hr/AttendanceUtilityMenu.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement the dropdown**

```tsx
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet } from "lucide-react";

type Props = {
  onExportCoefficients: () => void;
  onExportHours: () => void;
  disabled?: boolean;
};

export default function AttendanceUtilityMenu({
  onExportCoefficients,
  onExportHours,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"
      >
        Tiện ích <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 min-w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <button role="menuitem" onClick={() => run(onExportCoefficients)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Xuất bảng số công
          </button>
          <button role="menuitem" onClick={() => run(onExportHours)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50">
            <FileSpreadsheet className="h-4 w-4 text-cyan-600" />
            Xuất bảng số giờ
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test and verify GREEN**

Expected: both component tests PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add -- src/components/hr/AttendanceUtilityMenu.tsx src/components/hr/AttendanceUtilityMenu.test.tsx
git commit -m "feat: add attendance utility export menu"
```

---

### Task 4: Calendar integration

**Files:**
- Modify: `src/components/hr/CalendarTab.tsx`
- Create: `src/components/hr/CalendarTab.excel.test.ts`

**Interfaces:**
- Consumes: `AttendanceUtilityMenu`, `exportAttendanceExcel`, existing `sidebarEmployees`, `getUserDetail`, `getDayCellData`, `selectedMonth`, `selectedYear`.
- Produces: Working exports from the current monthly table.

- [ ] **Step 1: Write failing wiring test**

Use a focused source wiring test, matching the repository’s existing source-level tests:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./CalendarTab.tsx", import.meta.url),
  "utf8"
);

describe("CalendarTab attendance Excel wiring", () => {
  it("wires both utility actions to attendance exports", () => {
    expect(source).toContain("AttendanceUtilityMenu");
    expect(source).toContain('kind: "coeff"');
    expect(source).toContain('kind: "hours"');
    expect(source).toContain("sidebarEmployees.map");
    expect(source).toContain("exportAttendanceExcel");
  });
});
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
npx vitest run src/components/hr/CalendarTab.excel.test.ts
```

Expected: FAIL because exporter and menu are not wired.

- [ ] **Step 3: Add imports and shared export handler**

Add imports:

```ts
import AttendanceUtilityMenu from "./AttendanceUtilityMenu";
import {
  exportAttendanceExcel,
  type AttendanceExportKind,
} from "../../utils/attendanceExcel";
```

Inside the monthly attendance renderer, after `calcMonthTotals`, add:

```ts
const handleAttendanceExcelExport = (kind: AttendanceExportKind) => {
  if (sidebarEmployees.length === 0) {
    toast.warning("Không có dữ liệu nhân viên phù hợp để xuất.");
    return;
  }

  try {
    const exportEmployees = sidebarEmployees.map((employee) => {
      const detail = getUserDetail(employee.uid);
      return {
        uid: employee.uid,
        displayName: detail.displayName || "",
        login: detail.email || "",
      };
    });

    exportAttendanceExcel({
      kind,
      month: selectedMonth,
      year: selectedYear,
      employees: exportEmployees,
      getCell: (employee, day) => {
        const gridEmployee = sidebarEmployees.find((item) => item.uid === employee.uid);
        if (!gridEmployee) {
          return {
            coeff: null,
            hours: null,
            hasRecord: false,
            isAbsent: false,
            isWeekend: false,
            isFuture: false,
          };
        }
        const cell = getDayCellData(gridEmployee, day);
        const dayOfWeek = getDayOfWeek(day);
        const hours =
          typeof cell.hours === "number" && cell.hours > 0
            ? cell.hours
            : typeof cell.coeff === "number" && cell.coeff > 0
              ? cell.coeff * 8
              : cell.status === "Absent"
                ? 0
                : null;
        return {
          coeff: cell.coeff,
          hours,
          hasRecord:
            !cell.isWeekend &&
            !cell.isFuture &&
            Boolean(cell.status),
          isAbsent: cell.status === "Absent",
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          isFuture: cell.isFuture,
        };
      },
    });

    toast.success(
      kind === "coeff"
        ? "Đã xuất bảng số công ra Excel."
        : "Đã xuất bảng số giờ ra Excel."
    );
  } catch (error) {
    console.error("Lỗi xuất Excel chấm công:", error);
    toast.error("Không thể xuất bảng chấm công ra Excel.");
  }
};
```

The `hours` fallback above intentionally matches `calcMonthTotals`: use measured
check-in/check-out hours when positive, otherwise convert a positive coefficient
to an eight-hour workday. An absent past weekday exports numeric zero.

- [ ] **Step 4: Replace the inert Tiện ích button**

Replace the existing button labeled `Tiện ích` with:

```tsx
<AttendanceUtilityMenu
  disabled={isLogsLoading}
  onExportCoefficients={() => handleAttendanceExcelExport("coeff")}
  onExportHours={() => handleAttendanceExcelExport("hours")}
/>
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run src/utils/attendanceExcel.test.ts src/components/hr/AttendanceUtilityMenu.test.tsx src/components/hr/CalendarTab.excel.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 6: Run TypeScript and build verification**

Run:

```bash
npm.cmd run typecheck
npm.cmd run build
```

Expected: both commands exit 0.

- [ ] **Step 7: Create sample workbooks for inspection**

Add a temporary test-only invocation or use the utility under Vitest to write
one coefficient and one hours workbook into `tmp/attendance-export-preview/`.
Read both files back with `XLSX.readFile` and assert:

```ts
expect(workbook.SheetNames).toEqual(["Số công"]);
expect(typeof row["Tổng công"]).toBe("number");
expect(typeof row["01"]).toBe("number");
```

Repeat for `Số giờ`, then remove temporary preview files after visual/manual
inspection. Do not commit preview files.

- [ ] **Step 8: Commit integration**

```bash
git add -- src/components/hr/CalendarTab.tsx src/components/hr/CalendarTab.excel.test.ts
git commit -m "feat: export monthly attendance to Excel"
```

---

### Task 5: Final regression and scope audit

**Files:**
- Modify only if a verification failure requires a focused fix.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: verified feature with no unrelated edits.

- [ ] **Step 1: Run all affected tests**

```bash
npx vitest run src/utils/attendanceExcel.test.ts src/components/hr/AttendanceUtilityMenu.test.tsx src/components/hr/CalendarTab.excel.test.ts src/components/hr/calendar-holiday-overlay.test.tsx
```

Expected: all tests PASS with no unhandled warnings.

- [ ] **Step 2: Run repository verification**

```bash
npm.cmd run typecheck
npm.cmd run build
```

Expected: both commands exit 0.

- [ ] **Step 3: Audit the final diff**

```bash
git status --short
git diff HEAD~3 --stat
git diff HEAD~3 -- src/utils/attendanceExcel.ts src/components/hr/AttendanceUtilityMenu.tsx src/components/hr/CalendarTab.tsx
```

Confirm:

- Exactly two export actions exist.
- Each action creates one workbook and one worksheet.
- Current search filter controls exported employees.
- Pagination does not limit the exported employees.
- Values and totals are numeric.
- No API/model changes exist.
- No unrelated user changes are overwritten.
