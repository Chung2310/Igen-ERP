import type { AssistantOperation } from "./catalog";
import type { AssistantValue } from "../../src/shared/assistant-workflow";
import { AssistantError } from "./policy";
import { formatAssistantTemporalValue } from "../../src/shared/assistant-date";

const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v));
const atPath=(value:unknown,path:string):unknown=>path.split('.').reduce((current:unknown,key)=>object(current)&&Object.hasOwn(current,key)?current[key]:undefined,value);
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
    let current = omitAbsentProperties(existing[field.apiKey || field.key]);
    // Worker APIs persist numeric weekdays but their editable contract uses
    // Vietnamese choices. Restore that declared input representation before
    // validating an unrelated partial update; never replace the stored dates.
    const weekdayChoices=['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
    if(['daysOfWeek','workingDays'].includes(field.apiKey||field.key)&&field.structure?.items?.type==='string'
      &&JSON.stringify(field.structure.items.options)===JSON.stringify(weekdayChoices)&&Array.isArray(current)){
      current=current.map(day=>typeof day==='number'&&Number.isInteger(day)&&day>=0&&day<=6?weekdayChoices[day]:day);
    }
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
      // Apply declared bounds to inherited entries even when the same request
      // also edits the array. Preserve explicit out-of-range entries so normal
      // validation asks for correction rather than silently dropping user input.
      for(const [arrayPath,bound] of Object.entries(op.partialUpdateArrayBounds||{})){
        const prefix=field.key+'.';
        if(!arrayPath.startsWith(prefix)||!bound.upperBound.startsWith(prefix))continue;
        const relative=arrayPath.slice(prefix.length),limit=atPath(requested,bound.upperBound.slice(prefix.length));
        const rows=atPath(merged,relative),explicit=atPath(requested,relative);
        if(typeof limit!=='number'||!Number.isFinite(limit)||!Array.isArray(rows))continue;
        const parts=relative.split('.'),parent=parts.length===1?merged:atPath(merged,parts.slice(0,-1).join('.'));
        if(!object(parent))continue;
        parent[parts.at(-1)!]=rows.filter(row=>{
          if(!object(row))return true;
          const identity=row[bound.itemField];
          return typeof identity!=='number'||identity<=limit
            ||Array.isArray(explicit)&&explicit.some(item=>object(item)&&item[bound.itemField]===identity);
        });
      }
      values[field.key] = JSON.stringify(merged);
    }
  }
  return { values, inherited };
}
