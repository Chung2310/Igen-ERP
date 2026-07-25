import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  buildAttendanceExport,
  createAttendanceWorkbook,
} from "./attendanceExcel";

const employee = {
  uid: "u1",
  displayName: "Nguyễn Văn A",
  login: "a@igen.vn",
};

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
      month: 7,
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

    expect(result.fileName).toBe("bang-so-gio-thang-07-2026.xlsx");
    expect(result.headers).toHaveLength(35);
    expect(result.rows[0]["Tổng giờ"]).toBe(15.5);
    expect(result.rows[0]["01"]).toBe(8);
    expect(result.rows[0]["02"]).toBe(7.5);
  });
});

describe("createAttendanceWorkbook", () => {
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
});
