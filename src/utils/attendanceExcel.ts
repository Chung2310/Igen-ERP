import * as XLSX from "xlsx";

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
  getCell: (
    employee: AttendanceExportEmployee,
    day: number
  ) => AttendanceExportCell;
};

export type AttendanceExportModel = {
  sheetName: "Số công" | "Số giờ";
  fileName: string;
  headers: string[];
  rows: Array<Record<string, string | number>>;
};

export function buildAttendanceExport(
  input: AttendanceExportInput
): AttendanceExportModel {
  const daysInMonth = new Date(input.year, input.month, 0).getDate();
  const isCoeff = input.kind === "coeff";
  const dayHeaders = Array.from({ length: daysInMonth }, (_, index) =>
    String(index + 1).padStart(2, "0")
  );
  const totalHeader = isCoeff ? "Tổng công" : "Tổng giờ";

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
        cell.isWeekend ||
        cell.isFuture ||
        (!cell.hasRecord && !cell.isAbsent);
      const normalized =
        shouldBeBlank || value == null || !Number.isFinite(value) ? "" : value;

      row[header] = normalized;
      if (typeof normalized === "number") total += normalized;
    });

    row[totalHeader] = Math.round(total * 10) / 10;
    return row;
  });

  return {
    sheetName: isCoeff ? "Số công" : "Số giờ",
    fileName: `bang-so-${isCoeff ? "cong" : "gio"}-thang-${String(
      input.month
    ).padStart(2, "0")}-${input.year}.xlsx`,
    headers: [
      "STT",
      "Họ và tên",
      "Mã đăng nhập",
      totalHeader,
      ...dayHeaders,
    ],
    rows,
  };
}

export function createAttendanceWorkbook(input: AttendanceExportInput): {
  workbook: XLSX.WorkBook;
  fileName: string;
} {
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

export function exportAttendanceExcel(input: AttendanceExportInput): void {
  const { workbook, fileName } = createAttendanceWorkbook(input);
  XLSX.writeFile(workbook, fileName);
}
