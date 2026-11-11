import type { AssistantReply, AssistantValue, AssistantWorkflow } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";
import { localizedAssistantFieldLabel } from "./result-format";

export interface AssistantCompletion {
  operation: AssistantOperation;
  workflow: AssistantWorkflow;
  values: Record<string, AssistantValue>;
  result: unknown;
  defaultedKeys?: string[];
  followUp?: { actionId: string; values: Record<string, AssistantValue> };
}

/** Scope, selected targets and private snapshots never count as requested edits. */
export function hasAssistantUpdatePayload(op: AssistantOperation, values: Record<string, unknown>): boolean {
  return op.fields.some(field => field.source !== "path" && field.source !== "query" && field.key !== "id"
    && !field.key.startsWith("__assistant") && !op.systemBodyFields?.includes(field.apiKey || field.key)
    && !/^(?:expectedVersion|idempotencyKey)$/i.test(field.apiKey || field.key) && values[field.key] !== undefined);
}

export function missingOptionalCreateFields(create: AssistantOperation, workflow: AssistantWorkflow, submitted: Record<string, AssistantValue>, result: unknown, update: AssistantOperation): string[] {
  if (create.method !== "POST" || create.readOnly || !result || typeof result !== "object" || Array.isArray(result)) return [];
  const record = result as Record<string, unknown>;
  const editable = new Set(update.fields.filter(field => field.source !== "path" && field.source !== "query").map(field => field.apiKey || field.key));
  const missing = (value: unknown) => value == null || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && value.length === 0);
  return workflow.fields.filter(field => {
    const key = field.apiKey || field.key;
    if (field.source === "path" || field.source === "query" || field.required || field.systemRequired || field.defaultValue != null || !editable.has(key)) return false;
    if (/^(?:id|_id|version|password|confirmPassword|companyCode|branchId|createdAt|updatedAt)$/i.test(key)) return false;
    if (field.alternativeField) {
      const alternative = workflow.fields.find(candidate => candidate.key === field.alternativeField);
      if (alternative && (!missing(record[alternative.apiKey || alternative.key]) || !missing(submitted[alternative.key]))) return false;
    }
    if (field.requiredWhen) {
      const condition = field.requiredWhen;
      const current = record[condition.field] ?? submitted[condition.field];
      if (condition.equals !== undefined && (Array.isArray(condition.equals) ? condition.equals.includes(current as AssistantValue) : condition.equals === current)) return false;
      if (condition.present && !missing(current)) return false;
    }
    return missing(record[key]) && missing(submitted[field.key]);
  }).map(field => localizedAssistantFieldLabel(field.apiKey || field.key, field.label, create.id))
    .filter((label, index, labels) => Boolean(label) && labels.indexOf(label) === index);
}

/** Every adapter reaches this after a successful dispatch; modules do not opt in. */
export async function completeAssistantOperation(
  reply: AssistantReply,
  completion: AssistantCompletion | undefined,
  operations: readonly AssistantOperation[],
  canUpdate: (operation: AssistantOperation) => Promise<boolean>,
): Promise<AssistantReply> {
  if (!completion || reply.status !== "completed" || reply.reply.includes("Bạn có muốn bổ sung không?")) return reply;
  const { operation: op, workflow, values, result } = completion;
  if (op.method !== "POST" || op.readOnly || !result || typeof result !== "object" || Array.isArray(result)) return reply;
  const response = result as Record<string, unknown>;
  const record = response.data ?? response.user ?? response;
  if (!record || typeof record !== "object" || Array.isArray(record)) return reply;
  const created = record as Record<string, unknown>;
  if (!["_id", "id", "code", "name", "title", "displayName", "fullName"].some(key => created[key] != null && String(created[key]).trim())) return reply;
  const pairedUpdate = op.id.endsWith(".create") ? operations.find(candidate => candidate.id === op.id.replace(/\.create$/, ".update")) : undefined;
  const update = (pairedUpdate && ["PATCH", "PUT"].includes(pairedUpdate.method) ? pairedUpdate : undefined)
    || operations.find(candidate => ["PATCH", "PUT"].includes(candidate.method) && candidate.module === op.module
      && candidate.path.startsWith(`${op.path}/:`) && !candidate.path.slice(op.path.length + 2).includes("/"));
  if (!update) return reply;
  try {
    if (!await canUpdate(update)) return reply;
    const missing = missingOptionalCreateFields(op, workflow, values, created, update);
    if (!missing.length) return reply;
    const target = [...update.fields].reverse().find(field => field.reference && (field.source === "path" || field.key === "id"));
    const identity = created._id ?? created.id ?? created.uid ?? created.code ?? created.sku ?? created.name ?? created.fullName ?? created.displayName ?? created.title;
    if (target && identity != null && String(identity).trim()) {
      const context: Record<string, AssistantValue> = { [target.key]: String(identity) };
      for (const field of update.fields) {
        if (field.key === target.key || (field.source !== "path" && !(field.source === "query" && field.apiKey === "branchId"))) continue;
        const source = op.fields.find(candidate => candidate.key === field.key || (candidate.apiKey && candidate.apiKey === field.apiKey));
        if (source && values[source.key] !== undefined) context[field.key] = values[source.key];
      }
      completion.followUp = { actionId: update.id, values: context };
    }
    const shown = missing.slice(0, 6);
    const more = missing.length > shown.length ? ` và ${missing.length - shown.length} mục khác` : "";
    return { ...reply, reply: `${reply.reply}\n\nMình thấy các thông tin tùy chọn còn trống: ${shown.join(", ")}${more}. Bạn có muốn bổ sung không? Nếu có, gửi giúp mình mục và nội dung cần thêm nhé.` };
  } catch { return reply; }
}
