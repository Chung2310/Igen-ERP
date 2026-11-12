export { parseAssistantResultTable, type AssistantResultTable, type AssistantResultTableRow } from "../../shared/assistant-result-table";

export interface AssistantSuccessCard {
  title: string;
  fields: { label: string; value: string }[];
  notes: string[];
}

export interface AssistantPreviewProductRow {
  number: number;
  sku?: string;
  name: string;
  quantity?: string;
}

export interface AssistantPreviewProductTable {
  hasSku: boolean;
  hasQuantity: boolean;
  rows: AssistantPreviewProductRow[];
}

export function parseActionPreviewProductTable(
  label: string,
  rawValue: unknown,
): AssistantPreviewProductTable | null {
  if (typeof rawValue !== "string") return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const segments = trimmed
    .split(/;\s*/)
    .map(segment => segment.trim())
    .filter(Boolean);
  if (!segments.length) return null;

  const isProductFieldLabel = /(?:sản phẩm|hàng hóa|danh sách.*sku|bảng giá)/i.test(label);
  const skuMatches = segments.map(segment => /^([^\s—][^—]*?)\s+—\s+(.+)$/.exec(segment));
  if (skuMatches.every(Boolean) && (isProductFieldLabel || segments.length >= 2)) {
    const rows: AssistantPreviewProductRow[] = skuMatches.map((match, index) => {
      const sku = match![1].trim();
      const rest = match![2].trim();
      const quantityMatch = /^(.+?)\s+×\s+([^\r\n]+)$/.exec(rest);
      return {
        number: index + 1,
        sku,
        name: quantityMatch ? quantityMatch[1].trim() : rest,
        ...(quantityMatch ? { quantity: quantityMatch[2].trim() } : {}),
      };
    });
    return {
      hasSku: true,
      hasQuantity: rows.some(row => Boolean(row.quantity)),
      rows,
    };
  }

  if (/^chưa có trong bảng giá$/i.test(label.trim()) && segments.length >= 2) {
    return {
      hasSku: false,
      hasQuantity: false,
      rows: segments.map((name, index) => ({ number: index + 1, name })),
    };
  }

  return null;
}

export function formatActionPreviewValues<
  T extends { label: string; value: string | number | boolean; defaulted?: boolean },
>(values: readonly T[]) {
  const visible = values
    .filter(item => !item.defaulted)
    .map(item => ({
      ...item,
      productTable: parseActionPreviewProductTable(item.label, item.value),
      fullWidth: false,
    }));

  let pendingSingleIndex: number | null = null;
  for (let index = 0; index < visible.length; index += 1) {
    if (visible[index].productTable) {
      if (pendingSingleIndex !== null) {
        visible[pendingSingleIndex].fullWidth = true;
        pendingSingleIndex = null;
      }
      visible[index].fullWidth = true;
    } else if (pendingSingleIndex === null) {
      pendingSingleIndex = index;
    } else {
      pendingSingleIndex = null;
    }
  }
  if (pendingSingleIndex !== null) {
    visible[pendingSingleIndex].fullWidth = true;
  }
  return visible;
}

/** Keep successful write results readable without changing the saved message. */
export function parseAssistantSuccessCard(content: string): AssistantSuccessCard | null {
  const [firstLine, ...remaining] = content.split(/\r?\n/);
  const match = firstLine?.trim().match(/^Xong rồi bạn nhé, mình đã (.+?)\.?$/i);
  if (!match) return null;

  const fields: AssistantSuccessCard["fields"] = [];
  const notes: string[] = [];
  for (const line of remaining) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const field = trimmed.match(/^([^:]{1,80}):\s*(.+)$/);
    if (field) fields.push({ label: field[1].trim(), value: field[2].trim() });
    else notes.push(trimmed);
  }
  if (!fields.length) return null;
  const action = match[1].trim();
  return { title: action.charAt(0).toLocaleUpperCase("vi") + action.slice(1), fields, notes };
}
