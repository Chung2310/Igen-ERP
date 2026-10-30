import type { Finding } from "./reconciliation.service";
export const csvColumns = ["severity", "code", "companyCode", "branchId", "warehouseId", "productId", "variantId", "sku", "documentId", "message", "details"] as const;
export function csvCell(value: unknown) {
  let text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  // Quoting alone does not stop spreadsheet formula execution.
  if (typeof value === "string" && (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export const csvFinding = (finding: Finding) => csvColumns.map((key) => csvCell(finding[key])).join(",") + "\r\n";
