import type { AssistantOperation } from "./catalog";
import type { AssistantValue } from "../../src/shared/assistant-workflow";
import { AssistantError } from "./policy";
import { formatAssistantTemporalValue } from "../../src/shared/assistant-date";

const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v));
function omitAbsentProperties(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitAbsentProperties);
  if (!object(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v != null).map(([key, v]) => [key, omitAbsentProperties(v)]));
}
/** Merge objects recursively. Arrays use declared identity keys or explicit replacement, never position. */
export function mergePartialRecord(current: unknown, changes: unknown, arrayKeys: Record<string, string> = {}, path = ""): unknown {
  const itemKey = arrayKeys[path];
  if (Array.isArray(changes) && itemKey && changes.length) {
    const result: unknown[] = Array.isArray(current) ? structuredClone(current) : [];
    const seen = new Set<unknown>();
    for (const change of changes) {
      if (!object(change) || !["string", "number"].includes(typeof change[itemKey]) || seen.has(change[itemKey])) throw new AssistantError("Cần khóa xác định duy nhất cho từng mục cấu hình muốn sửa.");
      seen.add(change[itemKey]);
      const indices = result.flatMap((row, index) => object(row) && row[itemKey] === change[itemKey] ? [index] : []);
      if (indices.length > 1) throw new AssistantError("Cấu hình hiện tại có nhiều mục trùng khóa. Chưa cập nhật.");
      if (indices.length) result[indices[0]] = mergePartialRecord(result[indices[0]], change, arrayKeys, path);
      else result.push(mergePartialRecord({}, change, arrayKeys, path));
    }
    return result;
  }
  if (!object(changes)) return structuredClone(changes);
  const result: Record<string, unknown> = object(current) ? structuredClone(current) : {};
  for (const [key, value] of Object.entries(changes)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw new AssistantError("Thuộc tính cập nhật không hợp lệ.");
    result[key] = mergePartialRecord(result[key], value, arrayKeys, path ? `${path}.${key}` : key);
  }
  return result;
}
export function hydratePartialUpdate(op: AssistantOperation, existing: Record<string, unknown>, changes: Record<string, AssistantValue>) {
  const values = { ...changes };
  const inherited: string[] = [];
  for (const field of op.fields) {
    if (field.source === "path" || field.source === "query" || op.assistantOnlyFields?.includes(field.key)) continue;
    const current = omitAbsentProperties(existing[field.apiKey || field.key]);
    if (changes[field.key] === undefined) {
      if (current != null) {
        if (field.type === "date" && !field.required && !field.systemRequired) continue;
        values[field.key] = field.type === "json" ? JSON.stringify(current) : current as AssistantValue;
        if (field.type === "date" && typeof current === "string") {
          const calendar = formatAssistantTemporalValue(current)?.match(/(\d{2})\/(\d{2})\/(\d{4})$/);
          if (calendar) values[field.key] = `${calendar[3]}-${calendar[2]}-${calendar[1]}`;
        }
        inherited.push(field.key);
      }
    } else if (field.type === "json") {
      let requested: unknown;
      try { requested = typeof changes[field.key] === "string" ? JSON.parse(String(changes[field.key])) : changes[field.key]; }
      catch { throw new AssistantError(`${field.label}: nội dung cập nhật chưa hợp lệ.`); }
      const merged = mergePartialRecord(current, requested, op.partialUpdateArrayKeys, field.key);
      // Domain invariant: reducing the configured month count removes later milestones.
      // Increasing it leaves missing amounts/conditions for collection, never invents them.
      if (op.path === "/worker-management/partners/policies/:policyId" && field.key === "official"
        && object(requested) && typeof requested.maxMonths === "number" && requested.milestones === undefined
        && object(merged) && Array.isArray(merged.milestones)) {
        merged.milestones = merged.milestones.filter((row: any) => row.month <= Number(requested.maxMonths));
      }
      values[field.key] = JSON.stringify(merged);
    }
  }
  return { values, inherited };
}
