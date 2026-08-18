function compactToken(value: string) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function normalizeInternalBarcode(value: string) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) throw new Error("Mã vạch nội bộ không được để trống.");
  return normalized;
}

export function validateUniqueUnitBarcodes(values: string[]) {
  const normalized = values.map(normalizeInternalBarcode);
  if (new Set(normalized).size !== normalized.length) throw new Error("Mã vạch nội bộ bị trùng.");
  return normalized;
}

export function generateInternalBarcode(productName: string, date: string, sequence: number) {
  const productToken = compactToken(productName) || "ITEM";
  const dateToken = compactToken(date) || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `IG-${productToken}-${dateToken}-${String(sequence).padStart(6, "0")}`;
}
