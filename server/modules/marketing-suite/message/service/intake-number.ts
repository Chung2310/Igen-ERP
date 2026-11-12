export function parseIntakeNumber(value: string | number, currency = false): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : undefined;

  const text = (currency ? value.trim().replace(/\s*(?:vn[đd]|[đ₫])$/i, "") : value.trim())
    .replace(/[\u00a0\u202f]/g, " ");
  let normalized: string;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text)) {
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text)) {
    normalized = text.replace(/,/g, "");
  } else if (/^\d{1,3}(?: \d{3})+(?:[.,]\d+)?$/.test(text)) {
    normalized = text.replace(/ /g, "").replace(",", ".");
  } else if (/^\d+(?:[.,]\d+)?$/.test(text)) {
    normalized = text.replace(",", ".");
  } else {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}
