import { validateStructuredField } from "./structured-data";
import type { AssistantField, AssistantValue, AssistantWorkflow, AssistantWorkflowUpdate } from "../../src/shared/assistant-workflow";
import { defaultWorkflow, type AssistantOperation } from "./catalog";
export class AssistantError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function isBlank(value: unknown) { return value === undefined || value === null || (typeof value === "string" && !value.trim()); }
function containsRelationship(shape: AssistantField["structure"]): boolean {
  if (!shape) return false;
  if (shape.reference) return true;
  return Object.values(shape.keys || {}).some(containsRelationship) || containsRelationship(shape.items);
}
export function validateField(field: AssistantField, value: unknown): AssistantValue {
  if (!["string", "number", "boolean"].includes(typeof value)) throw new AssistantError(`${field.label}: giá trị không hợp lệ.`);
  if (field.type === "json") { try { return validateStructuredField(field, value); } catch (error) { throw new AssistantError((error as Error).message); } }
  const normalized = typeof value === "string" ? value.trim() : value as AssistantValue;
  if (typeof normalized === "string" && normalized.length > 4000) throw new AssistantError(`${field.label}: tối đa 4.000 ký tự.`);
  if (typeof normalized === "string" && field.max !== undefined && normalized.length > field.max) throw new AssistantError(`${field.label}: tối đa ${field.max} ký tự.`);
  if (field.type === "number" && (typeof normalized !== "number" || !Number.isFinite(normalized) || normalized < (field.min ?? -Infinity))) throw new AssistantError(`${field.label}: cần một số hợp lệ, không nhỏ hơn ${field.min ?? 0}.`);
  if (field.type === "number" && field.max !== undefined && Number(normalized) > field.max) throw new AssistantError(`${field.label}: vượt quá ${field.max}.`);
  if (field.type === "number" && field.integer && (typeof normalized !== "number" || !Number.isSafeInteger(normalized))) throw new AssistantError(`${field.label}: cần một số nguyên hợp lệ.`);
  if (field.type === "boolean" && typeof normalized !== "boolean") throw new AssistantError(`${field.label}: cần giá trị bật hoặc tắt.`);
  if (!["number", "boolean"].includes(field.type) && typeof normalized !== "string") throw new AssistantError(`${field.label}: cần nội dung văn bản.`);
  const str = String(normalized);
  if (field.type === "number" && field.exclusiveMin && typeof normalized === "number" && normalized <= (field.min ?? -Infinity)) throw new AssistantError(`${field.label}: must be greater than ${field.min ?? 0}.`);
  if (field.pattern && (typeof normalized !== "string" || !new RegExp(field.pattern).test(str))) throw new AssistantError(`${field.label}: định dạng không hợp lệ.`);
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) throw new AssistantError(`${field.label}: email không hợp lệ.`);
  if (field.type === "phone" && !/^(?:0|\+84|84)[0-9]{9}$/.test(str)) throw new AssistantError(`${field.label}: dùng số điện thoại Việt Nam, ví dụ 0987654321.`);
  if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(str) || !Number.isFinite(Date.parse(str)) || new Date(str).toISOString().slice(0, 10) !== str)) throw new AssistantError(`${field.label}: dùng ngày có thực theo định dạng YYYY-MM-DD.`);
  if (field.type === "datetime" && (!/^\d{4}-\d{2}-\d{2}T/.test(str) || !Number.isFinite(Date.parse(str)))) throw new AssistantError(`${field.label}: cần ngày giờ hợp lệ.`);
  if (["birthDate", "dateOfBirth"].includes(field.key) && str > new Date().toISOString().slice(0, 10)) throw new AssistantError(`${field.label}: không được ở tương lai.`);
  if (field.options && !field.options.includes(str)) throw new AssistantError(`${field.label}: chọn ${field.options.join(", ")}.`);
  return normalized as AssistantValue;
}
export function validateWorkflow(op: AssistantOperation, input: AssistantWorkflowUpdate): AssistantWorkflow {
  if (!input || !Number.isInteger(input.version) || typeof input.enabled !== "boolean" || typeof input.requireConfirmation !== "boolean" || typeof input.instructions !== "string" || input.instructions.length > 2000) throw new AssistantError("Cấu hình workflow không hợp lệ.");
  if (input.sourceText !== undefined && (typeof input.sourceText !== "string" || !input.sourceText.trim() || input.sourceText.length > 12000)) throw new AssistantError("Mô tả workflow cần từ 1 đến 12.000 ký tự.");
  if (op.confirmation && !input.requireConfirmation) throw new AssistantError("Thao tác này luôn cần xác nhận, không thể tắt.");
  if (!Array.isArray(input.fields) || input.fields.length !== op.fields.length || new Set(input.fields.map(f => f.key)).size !== op.fields.length) throw new AssistantError("Workflow phải giữ đủ các trường của thao tác.");
  const fields = input.fields.map(rule => {
    const field = op.fields.find(f => f.key === rule.key);
    if (!field || typeof rule.required !== "boolean") throw new AssistantError("Trường workflow không được hỗ trợ.");
    if (field.systemRequired && !rule.required) throw new AssistantError(`${field.label} là trường bắt buộc của hệ thống.`);
    if ((field.reference || containsRelationship(field.structure)) && rule.defaultValue !== undefined) throw new AssistantError(`${field.label}: trường liên kết phải được người dùng chọn theo tên hoặc mã, không thể đặt mặc định.`);
    const { defaultValue: _default, ...base } = field;
    return { ...base, required: rule.required, ...(rule.defaultValue === undefined ? {} : { defaultValue: validateField(field, rule.defaultValue) }) };
  });
  return { ...defaultWorkflow(op), ...(input.sourceText === undefined ? {} : { sourceText: input.sourceText.trim() }), fields, enabled: input.enabled, instructions: input.instructions.trim(), requireConfirmation: input.requireConfirmation, version: input.version + 1 };
}
export function collectValues(workflow: AssistantWorkflow, provided: Record<string, unknown>) {
  const values: Record<string, AssistantValue> = {};
  const missing: string[] = [];
  const errors: string[] = [];
  const defaulted: string[] = [];
  const relationshipFields = new Set(workflow.fields.filter(field => field.reference || containsRelationship(field.structure)).map(field => field.key));
  const conditionValues = Object.fromEntries(workflow.fields.map(field => [field.key, isBlank(provided[field.key]) ? (relationshipFields.has(field.key) ? undefined : field.defaultValue) : provided[field.key]]));
  const conditionApplies = (field: AssistantField) => {
    const condition = field.requiredWhen;
    if (!condition) return false;
    const candidate = conditionValues[condition.field];
    if (condition.present) return !isBlank(candidate);
    if (condition.equals === undefined) return false;
    return (Array.isArray(condition.equals) ? condition.equals : [condition.equals]).some(value => value === candidate);
  };
  for (const field of workflow.fields) {
    let value = provided[field.key];
    if (isBlank(value) && field.defaultValue !== undefined && !relationshipFields.has(field.key)) { value = field.defaultValue; defaulted.push(field.key); }
    if (isBlank(value)) { if (field.systemRequired || field.required || conditionApplies(field)) missing.push(field.label); continue; }
    try { values[field.key] = validateField(field, value); } catch (error) { errors.push((error as Error).message); }
  }
  for (const key of Object.keys(provided)) if (!workflow.fields.some(f => f.key === key)) errors.push(`Trường không được hỗ trợ: ${key}.`);
  return { values, missing, errors, defaulted };
}
