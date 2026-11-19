export type AssistantDocumentAlignment = "left" | "center" | "right";
export type AssistantDocumentAlignmentValue = AssistantDocumentAlignment | null;
export type AssistantDocumentSectionRole = "body" | "masthead" | "subtitle" | "date" | "signature";

const normalizedLine = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

/** Explicit formatting wins. Only standalone structural lines get automatic alignment. */
export function assistantDocumentParagraphAlignment(
  title: string, text: string, explicit?: AssistantDocumentAlignmentValue, isTitle = false, role?: AssistantDocumentSectionRole,
): AssistantDocumentAlignment | undefined {
  if (explicit !== undefined) return explicit || undefined;
  if (isTitle) return "center";
  if (role) return role === "date" ? "right" : role === "body" ? "left" : "center";
  const normalizedTitle = normalizedLine(title);
  if (!/^(?:mau\s+)?(?:hop dong|don|bien ban|quyet dinh|thong bao|cong van|to trinh|giay|bao cao|ke hoach|de an|phuong an)\b/.test(normalizedTitle)) return undefined;
  const line = normalizedLine(text).replace(/[:.]$/, "");
  if (line === normalizedTitle
    || line === "cong hoa xa hoi chu nghia viet nam"
    || /^doc lap\s*-\s*tu do\s*-\s*hanh phuc$/.test(line)
    || /^(?:nguoi lap (?:don|bien ban|bao cao|ke hoach)|nguoi lam don|nguoi de nghi|nguoi duyet|chu toa|thu ky|dai dien (?:ben a|ben b|hai ben))$/.test(line)
    || (/^(?:mau\s+)?hop dong\b/.test(normalizedTitle) && /^(?:nguoi lao dong|nguoi su dung lao dong|dai dien nguoi su dung lao dong|ben a|ben b)$/.test(line))
    || /^\(ky,?\s*(?:ghi ro ho ten|ho va ten)(?:,?\s*(?:va\s+)?dong dau)?\)$/.test(line)) return "center";
  if (/^[^,\n]{1,80},\s*ngay\s+(?:\d{1,2}|[…_.]+)\s+thang\s+(?:\d{1,2}|[…_.]+)\s+nam\s+(?:\d{4}|[…_.]+)$/.test(line)) return "right";
  return undefined;
}

/** A cell alignment overrides the column default; null means no cell-specific override. */
export function assistantDocumentCellAlignment(
  columnAlignments: readonly AssistantDocumentAlignmentValue[] | undefined,
  cellAlignments: readonly (readonly AssistantDocumentAlignmentValue[])[] | undefined,
  row: number,
  column: number,
  value?: unknown,
): AssistantDocumentAlignment | undefined {
  const cellAlignment = cellAlignments?.[row]?.[column];
  if (cellAlignment) return cellAlignment;
  if (columnAlignments?.[column] !== undefined) return columnAlignments[column] || undefined;
  return typeof value === "number" && Number.isFinite(value) ? "right" : typeof value === "boolean" ? "center" : undefined;
}
