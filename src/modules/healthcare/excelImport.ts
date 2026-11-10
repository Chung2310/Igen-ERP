import * as XLSX from "xlsx";

const requiredReportHeaders = ["ngay_gio_kham", "ma_phieu", "ten_benh_nhan", "ma_benh_nhan"];

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("vi").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export interface HospitalWorkbookInspection {
  reportSheets: string[];
  otherDataSheets: string[];
}

/** Identifies the monthly hospital report from its headers without loading all rows into the UI. */
export function inspectHospitalWorkbook(data: ArrayBuffer | Uint8Array): HospitalWorkbookInspection {
  const workbook = XLSX.read(data, { type: "array", cellDates: false, sheetRows: 20 });
  const reportSheets: string[] = [];
  const otherDataSheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet?.["!ref"]) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1, raw: true, defval: "", blankrows: false,
    });
    const hasData = rows.some(row => row.some(cell => String(cell).trim() !== ""));
    if (!hasData) continue;

    const isReportSheet = rows.some(row => {
      const headers = new Set(row.map(normalizeHeader));
      return requiredReportHeaders.every(header => headers.has(header));
    });
    (isReportSheet ? reportSheets : otherDataSheets).push(sheetName);
  }

  return { reportSheets, otherDataSheets };
}
