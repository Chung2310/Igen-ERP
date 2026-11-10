import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { isValidImportDate, normalizeExcelDate } from "./excelDate";

const toExcelSerial = (year: number, month: number, day: number, date1904 = false) => {
  const dateDays = Date.UTC(year, month - 1, day) / 86400000;
  const epochDays = date1904 ? Date.UTC(1904, 0, 1) / 86400000 : Date.UTC(1899, 11, 30) / 86400000;
  return dateDays - epochDays;
};

describe("Excel date import", () => {
  it("normalizes numeric date cells and serials whose number format was changed to General", () => {
    const serial = toExcelSerial(2026, 6, 15);
    expect(normalizeExcelDate(serial)).toBe("15/06/2026");
    expect(normalizeExcelDate(String(serial))).toBe("15/06/2026");
    expect(normalizeExcelDate(new Date("2026-06-15T00:00:00.000Z"))).toBe("15/06/2026");
  });

  it("reads an Excel date cell and the same serial after its format changes to General", () => {
    const serial = toExcelSerial(2026, 6, 15);
    const sheet = XLSX.utils.aoa_to_sheet([["Ngày có format", "Ngày General"], [serial, serial]]);
    sheet.A2.z = "dd/mm/yyyy";
    sheet.B2.z = "General";
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Data");

    const buffer = XLSX.write(workbook, { type: "array" });
    const importedWorkbook = XLSX.read(buffer, { type: "array", cellDates: false });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(importedWorkbook.Sheets.Data, { header: 1, raw: true });
    expect(rows[1][0]).toBe(serial);
    expect(rows[1][1]).toBe(serial);
    expect(normalizeExcelDate(rows[1][0])).toBe("15/06/2026");
    expect(normalizeExcelDate(rows[1][1])).toBe("15/06/2026");
  });

  it("respects the workbook's 1904 date system and keeps year-only values intact", () => {
    expect(normalizeExcelDate(toExcelSerial(2026, 6, 15, true), true)).toBe("15/06/2026");
    expect(normalizeExcelDate(1995)).toBe("1995");
    expect(normalizeExcelDate(123)).toBe("123");
    expect(normalizeExcelDate("2026-06-15T00:00:00.000Z")).toBe("15/06/2026");
    expect(normalizeExcelDate("15.06.2026")).toBe("15/06/2026");
  });

  it("accepts real dates only and allows a year-only birth year", () => {
    expect(isValidImportDate("29/02/2024")).toBe(true);
    expect(isValidImportDate("31/02/2026")).toBe(false);
    expect(isValidImportDate("1995", true)).toBe(true);
    expect(isValidImportDate("1995")).toBe(false);
    expect(isValidImportDate("15/06/2026")).toBe(true);
  });
});
