import type { WorkerReferral } from "../types";

export type SettlementManualValue = { officialMonths: string; seasonalHours: string };
export type SettlementInputRow = Record<string, unknown>;
export type SettlementImportResult = {
  values: Record<string, SettlementManualValue>;
  matchedCount: number;
  errors: string[];
};

const normalizeHeader = (value: unknown) => String(value ?? "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[đĐ]/g, "d")
  .replace(/[._-]+/g, " ")
  .replace(/\s+/g, " ");

const firstHeader = (headers: string[], aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.find((header) => normalizedAliases.includes(normalizeHeader(header)));
};

const readNumber = (value: unknown) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(String(value).trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const workerLabel = (workerId: string, workers: Array<{ _id: string; fullName: string }>) =>
  workers.find((worker) => worker._id === workerId)?.fullName || workerId;

/** Parse already-read spreadsheet rows. Kept pure so import validation is easy to test. */
export function parseSettlementImportRows(
  rows: SettlementInputRow[],
  referrals: WorkerReferral[],
  workers: Array<{ _id: string; fullName: string }>,
): SettlementImportResult {
  const values: Record<string, SettlementManualValue> = {};
  const errors: string[] = [];
  const referralByWorkerId = new Map(referrals.map((referral) => [String(referral.workerId), referral]));
  const headers = rows.flatMap((row) => Object.keys(row));
  const workerIdHeader = firstHeader(headers, ["mã lao động", "ma lao dong", "worker id", "workerid", "id lao động", "id lao dong", "id"]);
  const hoursHeader = firstHeader(headers, ["số giờ trong tháng", "so gio trong thang", "số giờ", "so gio", "seasonal hours", "seasonalhours", "hours"]);
  const monthsHeader = firstHeader(headers, ["số tháng đạt được", "so thang dat duoc", "số tháng", "so thang", "official months", "officialmonths", "months"]);
  if (!workerIdHeader) return { values, matchedCount: 0, errors: ["Thiếu cột Mã lao động (có thể dùng workerId hoặc ID)."] };
  if (!hoursHeader && !monthsHeader) return { values, matchedCount: 0, errors: ["Thiếu cột Số giờ trong tháng hoặc Số tháng đạt được."] };

  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const workerId = String(row[workerIdHeader] ?? "").trim();
    if (!workerId) { errors.push(`Dòng ${rowNumber}: thiếu mã lao động.`); return; }
    const referral = referralByWorkerId.get(workerId);
    if (!referral) { errors.push(`Dòng ${rowNumber}: mã ${workerId} không thuộc danh sách giới thiệu đang hiệu lực.`); return; }
    if (seen.has(workerId)) { errors.push(`Dòng ${rowNumber}: mã ${workerId} bị trùng.`); return; }
    seen.add(workerId);
    const current = { officialMonths: "", seasonalHours: "" };
    if (referral.commissionScheme === "seasonal_hourly") {
      const hours = readNumber(hoursHeader ? row[hoursHeader] : "");
      if (hours === null || hours < 0) { errors.push(`Dòng ${rowNumber} (${workerLabel(workerId, workers)}): số giờ không hợp lệ.`); return; }
      current.seasonalHours = String(hours);
    } else {
      const months = readNumber(monthsHeader ? row[monthsHeader] : "");
      if (months === null || !Number.isInteger(months) || months < 0 || months > 3) { errors.push(`Dòng ${rowNumber} (${workerLabel(workerId, workers)}): số tháng phải là số nguyên từ 0 đến 3.`); return; }
      current.officialMonths = String(months);
    }
    values[referral._id] = current;
  });
  return { values, matchedCount: Object.keys(values).length, errors };
}

export async function parseSettlementImportFile(
  file: File,
  referrals: WorkerReferral[],
  workers: Array<{ _id: string; fullName: string }>,
) {
  const XLSX = await import("xlsx");
  // Some Chromium/WebView versions do not expose File.arrayBuffer(). Keep a
  // FileReader fallback so importing a spreadsheet never fails before the
  // parser can report a useful validation message.
  const bytes = typeof file.arrayBuffer === "function"
    ? await file.arrayBuffer()
    : await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error || new Error("Không thể đọc file."));
      reader.readAsArrayBuffer(file);
    });
  const isCsv = file.type.toLowerCase().includes("csv") || /\.csv$/i.test(file.name);
  // CSV is text, so passing its bytes as an XLSX array makes Vietnamese
  // headers decode as mojibake (for example `MÃ£ lao Ä‘á»™ng`). Decode UTF-8
  // before handing it to SheetJS; real XLS/XLSX files remain binary arrays.
  const workbook = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(bytes), { type: "string" })
    : XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { values: {}, matchedCount: 0, errors: ["File không có trang tính dữ liệu."] };
  const rows = XLSX.utils.sheet_to_json<SettlementInputRow>(sheet, { defval: "" });
  if (!rows.length) return { values: {}, matchedCount: 0, errors: ["File không có dòng dữ liệu."] };
  return parseSettlementImportRows(rows, referrals, workers);
}

export async function downloadSettlementInputTemplate(
  referrals: WorkerReferral[],
  workers: Array<{ _id: string; fullName: string }>,
) {
  const XLSX = await import("xlsx");
  const rows = referrals.map((referral) => ({
    "Mã lao động": String(referral.workerId),
    "Họ tên tham chiếu": workerLabel(String(referral.workerId), workers),
    "Cơ chế": referral.commissionScheme === "seasonal_hourly" ? "Thời vụ" : "Chính thức",
    "Số giờ trong tháng": "",
    "Số tháng đạt được": "",
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Nhập số công");
  XLSX.writeFile(workbook, "mau-nhap-so-cong-doi-soat.xlsx");
}
