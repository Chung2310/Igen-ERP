import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { hospitalReportColumns } from "../../../shared/healthcare";
import { inspectHospitalWorkbook } from "./excelImport";

function workbookBytes(sheets: Array<{ name: string; rows: unknown[][] }>) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("inspectHospitalWorkbook", () => {
  it("recognizes report headers below the title and recognizes every monthly sheet", () => {
    const headers = Object.values(hospitalReportColumns);
    const inspection = inspectHospitalWorkbook(workbookBytes([
      { name: "Tháng 9", rows: [["BÁO CÁO"], [], headers, [1, 1, 46_295, "PK-1", "Tên", "KH-1"]] },
      { name: "Tháng 10", rows: [["BÁO CÁO"], [], headers, [1, 1, 46_325, "PK-2", "Tên", "KH-2"]] },
    ]));

    expect(inspection).toEqual({ reportSheets: ["Tháng 9", "Tháng 10"], otherDataSheets: [] });
  });

  it("reports populated non-report sheets so a workbook is not silently partially imported", () => {
    const headers = Object.values(hospitalReportColumns);
    const inspection = inspectHospitalWorkbook(workbookBytes([
      { name: "Tháng 9", rows: [headers, [1, 1, 46_295, "PK-1", "Tên", "KH-1"]] },
      { name: "Ghi chú", rows: [["Ghi chú"], ["Dữ liệu khác"]] },
    ]));

    expect(inspection).toEqual({ reportSheets: ["Tháng 9"], otherDataSheets: ["Ghi chú"] });
  });
});
