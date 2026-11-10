import * as XLSX from "xlsx";

function formatDateParts(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function normalizeSerialDate(serial: number, date1904: boolean): string {
  const parsed = XLSX.SSF.parse_date_code(serial, { date1904 });
  // Numbers such as 123 are usually unrelated data, not plausible student
  // dates. Also keep small serials from becoming silent dates in 1900–1926.
  if (!parsed || parsed.y < 1927 || parsed.y > 9999) return String(serial);
  return formatDateParts(parsed.y, parsed.m, parsed.d) || String(serial);
}

/**
 * Normalize date cells regardless of whether Excel exposes them as Date objects,
 * numeric serials, general-format serials, or date strings.
 */
export function normalizeExcelDate(value: unknown, date1904 = false): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return String(value);
    return formatDateParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()) || String(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    // A plain year is commonly used in the "Năm sinh" column. Do not turn 2026
    // into an unrelated date in 1905 when a copied cell has General formatting.
    if (Number.isInteger(value) && value >= 1900 && value <= 2100) return String(value);
    return normalizeSerialDate(value, date1904);
  }

  const raw = String(value).trim();
  if (!raw) return "";

  const isoDate = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[T ].*)/);
  if (isoDate) return formatDateParts(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3])) || raw;

  const vietnameseDate = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:$|[T ].*)/);
  if (vietnameseDate) return formatDateParts(Number(vietnameseDate[3]), Number(vietnameseDate[2]), Number(vietnameseDate[1])) || raw;

  if (/^\d{4}$/.test(raw)) return raw;
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (Number.isFinite(serial) && !(Number.isInteger(serial) && serial >= 1900 && serial <= 2100)) {
      return normalizeSerialDate(serial, date1904);
    }
  }
  return raw;
}

/** Validate a normalized DD/MM/YYYY date without JavaScript's rollover behavior. */
export function isValidImportDate(value: string, allowYearOnly = false): boolean {
  const raw = value.trim();
  if (!raw) return true;
  if (allowYearOnly && /^\d{4}$/.test(raw)) {
    const year = Number(raw);
    return year >= 1900 && year <= new Date().getFullYear();
  }

  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  return Boolean(formatDateParts(year, month, day));
}
