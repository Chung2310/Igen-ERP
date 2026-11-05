import type { AssistantDataShape, AssistantField } from "../../src/shared/assistant-workflow";
// Shared with request validation and result redaction. Scope and credentials are never model-owned.
const protectedKey = /^(?:__proto__|prototype|constructor|companyCode|companyId|branchId|tenantId|createdBy|creatorUid|updatedBy|role|permissions)$|password|secret|token|credential|authorization|api.?key|private.?key|signature|faceDescriptor|embedding|base64|ciphertext|encrypted|salt|hash|totp|recoveryCodes/i;
export const isProtectedAssistantKey = (key: string) => protectedKey.test(key);
const isInternalIdentifierKey = (key: string) => {
  const normalized = key.toLowerCase();
  if (normalized === "appid") return false;
  return ["id", "_id", "uid", "_uid", "ids", "_ids", "uids", "_uids"].includes(normalized)
    || /(?:Id|Uid|Ids|Uids)$/.test(key)
    || /(?:_id|_uid|_ids|_uids)$/i.test(key)
    || /[a-z](?:ID|UID|IDs|UIDs)$/.test(key);
};
export function validateStructuredField(
  field: AssistantField,
  value: unknown,
  options: { allowMissingRequired?: boolean; missingRequired?: string[] } = {},
): string {
  const maxLength = field.structure?.type === "array" ? 1_000_000 : 4_000;
  if (typeof value !== "string" || value.length > maxLength) throw new Error(`${field.label}: cần dữ liệu JSON tối đa ${maxLength.toLocaleString("vi-VN")} ký tự.`);
  let data: unknown;
  try { data = JSON.parse(value); } catch { throw new Error(`${field.label}: dữ liệu JSON không hợp lệ.`); }
  const displayLabel = (key: string, shape?: AssistantDataShape) => shape?.label || ({
    sku: "Mã SKU",
    unitCode: "Đơn vị tính",
    barcode: "Mã vạch",
    displayName: "Tên hiển thị SKU",
  } as Record<string, string>)[key] || key;
  function check(item: unknown, shape: AssistantDataShape | undefined, depth: number, path: string[] = []) {
    if (depth > 8) throw new Error(`${field.label}: cấu trúc quá nhiều cấp.`);
    if (item === null) {
      if (shape?.nullable) return;
      throw new Error(`${field.label}: không dùng giá trị null; bỏ thông tin không cần thiết.`);
    }
    if (Array.isArray(item)) {
      if (shape && shape.type !== "array" || item.length > 100) throw new Error(`${field.label}: danh sách không hợp lệ hoặc vượt 100 mục.`);
      if (shape?.minItems !== undefined && item.length < shape.minItems) throw new Error(`${field.label}: cần ít nhất ${shape.minItems} mục.`);
      if (shape?.maxItems !== undefined && item.length > shape.maxItems) throw new Error(`${field.label}: chỉ hỗ trợ tối đa ${shape.maxItems} mục mỗi lượt.`);
      item.forEach((child, index) => check(child, shape?.items, depth + 1, [...path, `Mục ${index + 1}`])); return;
    }
    if (typeof item === "object") {
      if (shape && shape.type !== "object") throw new Error(`${field.label}: sai kiểu dữ liệu.`);
      for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
        if (isProtectedAssistantKey(key)) throw new Error(`${field.label}: không được gửi trường ${key}.`);
        if (shape?.keys && !shape.open && !shape.keys[key]) throw new Error(`${field.label}: trường ${key} chưa được hỗ trợ.`);
        check(child, shape?.keys?.[key], depth + 1, [...path, displayLabel(key, shape?.keys?.[key])]);
      }
      for (const [key, rule] of Object.entries(shape?.keys || {})) {
        const childValue = (item as Record<string, unknown>)[key];
        const hasValue = key in (item as object) && !(typeof childValue === "string" && !childValue.trim());
        const condition = rule.requiredWhen;
        const conditionValue = condition ? (item as Record<string, unknown>)[condition.field] : undefined;
        const conditionApplies = condition?.present
          ? conditionValue !== undefined && conditionValue !== null && !(typeof conditionValue === "string" && !conditionValue.trim())
          : condition?.equals !== undefined && (Array.isArray(condition.equals) ? condition.equals : [condition.equals]).some(value => value === conditionValue);
        if ((!rule.required && !conditionApplies) || hasValue) continue;
        if (options.allowMissingRequired) {
          if (!rule.reference) options.missingRequired?.push([...path, displayLabel(key, rule)].join(" · "));
        } else throw new Error(`${field.label}: cần bổ sung ${key}.`);
      }
      if (shape?.minProperties !== undefined && Object.keys(item as object).length < shape.minProperties) throw new Error(`${field.label}: cần nhập ít nhất ${shape.minProperties} trường.`);
      return;
    }
    if (!["string", "number", "boolean"].includes(typeof item)) throw new Error(`${field.label}: giá trị không hợp lệ.`);
    if (shape && (shape.type === "date" ? typeof item !== "string" : typeof item !== shape.type)) throw new Error(`${field.label}: sai kiểu dữ liệu.`);
    if (shape?.options && !shape.options.includes(item as any)) throw new Error(`${field.label}: giá trị ngoài danh sách cho phép.`);
    if (shape?.pattern && (typeof item !== "string" || !new RegExp(shape.pattern).test(item))) throw new Error(`${field.label}: định dạng không hợp lệ.`);
    if (shape?.integer && (typeof item !== "number" || !Number.isSafeInteger(item))) throw new Error(`${field.label}: cần số nguyên.`);
    if (typeof item === "number" && (!Number.isFinite(item) || item < (shape?.min ?? -Infinity) || item > (shape?.max ?? Infinity))) throw new Error(`${field.label}: số không hợp lệ.`);
  }
  check(data, field.structure, 0);
  return JSON.stringify(data);
}
export function redactAssistantResult(value: unknown, depth = 0): unknown {
  if (depth > 6) return "…";
  if (Array.isArray(value)) return value.slice(0, 15).map(item => redactAssistantResult(item, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !isProtectedAssistantKey(key) && !isInternalIdentifierKey(key)).slice(0, 60).map(([key, item]) => [key, redactAssistantResult(item, depth + 1)]));
  if (typeof value === "string") return value.slice(0, 1500);
  return value;
}
