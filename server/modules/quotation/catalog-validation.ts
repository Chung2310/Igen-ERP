export interface CatalogImportRow {
  sku: string;
  name: string;
  description: string;
  attributes?: Record<string, string>;
  unit: string;
  price: number;
  currency: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}


export type CatalogRowResult = { ok: true; value: CatalogImportRow } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

export function mapCatalogRow(value: unknown, rowNumber: number, currency: string): CatalogRowResult {
  if (!isRecord(value)) return { ok: false, error: `Dòng ${rowNumber}: dữ liệu không hợp lệ.` };
  const sku = String(value.sku ?? "").trim().normalize("NFC").toLocaleUpperCase("vi");
  const name = String(value.name ?? "").trim();
  const unit = String(value.unit ?? "").trim();
  const rawPrice = typeof value.price === "number" ? value.price : Number(String(value.price ?? "").replace(/,/g, ""));
  const rowCurrency = String(value.currency ?? currency).trim().toUpperCase();
  const description = String(value.description ?? "").trim();
  const attributes: Record<string, string> = {};
  const normalizedAttributeKeys = new Set<string>();
  const effectiveFrom = String(value.effectiveFrom ?? "").trim();
  const effectiveTo = String(value.effectiveTo ?? "").trim();
  const isDate = (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  };
  const problems: string[] = [];
  for (const field of ["sku", "name", "unit", "description", "currency", "effectiveFrom", "effectiveTo"]) {
    if (value[field] !== undefined && value[field] !== null && typeof value[field] !== "string") problems.push(`${field} phải là chuỗi ký tự`);
  }
  if (typeof value.price !== "number" && (typeof value.price !== "string" || !value.price.trim())) problems.push("đơn giá bắt buộc");
  if (description.length > 2000) problems.push("mô tả tối đa 2000 ký tự");
  if ([sku, name, unit].some(text => [...text].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))) problems.push("thông tin không được chứa ký tự điều khiển");
  if (!sku || sku.length > 100) problems.push("mã hàng bắt buộc, tối đa 100 ký tự");
  if (!name || name.length > 250) problems.push("tên hàng bắt buộc, tối đa 250 ký tự");
  if (!unit || unit.length > 50) problems.push("đơn vị bắt buộc, tối đa 50 ký tự");
  if (!Number.isFinite(rawPrice) || rawPrice < 0 || rawPrice > 1_000_000_000_000) problems.push("đơn giá phải là số không âm hợp lệ");
  if (!/^[A-Z]{3}$/.test(rowCurrency)) problems.push("tiền tệ cần theo mã ISO 3 ký tự, ví dụ VND");
  if (effectiveFrom && !isDate(effectiveFrom)) problems.push("ngày hiệu lực từ cần là ngày hợp lệ theo định dạng YYYY-MM-DD");
  if (effectiveTo && !isDate(effectiveTo)) problems.push("ngày hiệu lực đến cần là ngày hợp lệ theo định dạng YYYY-MM-DD");
  if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) problems.push("ngày hiệu lực đến phải sau ngày bắt đầu");
  if (value.attributes !== undefined) {
    if (!isRecord(value.attributes) || Object.keys(value.attributes).length > 50) problems.push("thuộc tính bổ sung không hợp lệ (tối đa 50 trường)");
    else for (const [rawKey, rawValue] of Object.entries(value.attributes)) {
      const key = rawKey.trim();
      if (["__proto__", "constructor", "prototype"].includes(key) || !key || key.length > 100 || typeof rawValue !== "string" || rawValue.length > 500) problems.push("tên thuộc tính tối đa 100 ký tự, giá trị tối đa 500 ký tự");
      else {
        const normalizedKey = key.toLocaleLowerCase("vi");
        if (normalizedAttributeKeys.has(normalizedKey)) problems.push("tên thuộc tính không được trùng nhau");
        normalizedAttributeKeys.add(normalizedKey);
        attributes[key] = rawValue.trim();
      }
    }
  }
  if (problems.length) return { ok: false, error: `Dòng ${rowNumber}: ${problems.join("; ")}.` };
  return {
    ok: true,
    value: {
      sku,
      name,
      description: description.slice(0, 2000),
      ...(value.attributes !== undefined ? { attributes } : {}),
      unit,
      price: rawPrice,
      currency: rowCurrency,
      effectiveFrom: effectiveFrom || undefined,
      effectiveTo: effectiveTo || undefined,
    },
  };
}
