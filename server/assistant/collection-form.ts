import { randomUUID } from "node:crypto";
import type { AssistantInputField, AssistantValue, AssistantWorkflow, AssistantWorkflowSelection } from "../../src/shared/assistant-workflow";
import { AssistantError } from "./policy";
import { assistantModuleLabel, scopeAssistantWorkflows } from "./module-scope";

export interface PendingWorkflowChoice {
  id: string;
  intent: string;
  pendingId: string | null;
  newRequest: boolean;
  expiresAt: number;
  options: { value: string; actionId: string; version: number }[];
}
export function createWorkflowChoice(workflows: AssistantWorkflow[], ids: string[], intent: string, pendingId: string | null, newRequest = false): { state: PendingWorkflowChoice; selection: AssistantWorkflowSelection } | undefined {
  const scoped = scopeAssistantWorkflows(intent, workflows).workflows;
  const candidates = [...new Set(ids)].slice(0, 5).flatMap(id => scoped.filter(w => w.actionId === id));
  if (!candidates.length) return;
  const id = randomUUID();
  const options = candidates.map(workflow => ({ value: randomUUID(), actionId: workflow.actionId, version: workflow.version }));
  return { state: { id, intent, pendingId, newRequest, expiresAt: Date.now() + 15 * 60_000, options },
    selection: { id, options: options.map((option, i) => ({ value: option.value, label: `${candidates[i].title} — ${assistantModuleLabel(candidates[i].module)}` })) } };
}
export function resolveWorkflowChoice(state: PendingWorkflowChoice | null | undefined, selection: { id: string; value: string }, pendingId: string | null) {
  const option = state?.options.find(option => option.value === selection.value);
  if (!state || state.id !== selection.id || state.expiresAt <= Date.now() || state.pendingId !== pendingId || !option) {
    throw new AssistantError("Lựa chọn thao tác đã hết hiệu lực. Bạn gửi lại yêu cầu để chọn thao tác mới nhé.", 409);
  }
  return { ...option, intent: state.intent, newRequest: state.newRequest };
}

/** Show missing/invalid scalar fields only. References/enums use the existing choice metadata. */
export function missingInputFields(workflow: AssistantWorkflow, missing: string[], errors: string[], provided: Record<string, unknown>, choiceKeys: string[]): AssistantInputField[] {
  return workflow.fields.flatMap(field => {
    if (field.reference || field.options?.length || choiceKeys.includes(field.key) || field.type === "json" || field.type === "reference"
      || /password|credential|secret|token/i.test(field.key)) return [];
    const error = errors.filter(error => error.startsWith(`${field.label}:`)).join("\n");
    if (!missing.includes(field.label) && !error) return [];
    const value = provided[field.key];
    return [{ key: field.key, label: field.label, type: field.type, required: missing.includes(field.label) || Boolean(field.required || field.systemRequired),
      ...(typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? { value } : {}),
      ...(error ? { error } : {}), ...(field.min !== undefined ? { min: field.min } : {}), ...(field.max !== undefined ? { max: field.max } : {}),
      ...(field.integer ? { integer: true } : {}), ...(field.pattern ? { pattern: field.pattern } : {}) }];
  });
}
export function validateFormValues(fields: AssistantInputField[], values: Record<string, AssistantValue>) {
  if (Object.keys(values).some(key => !fields.some(field => field.key === key))) {
    throw new AssistantError("Biểu mẫu chứa trường không còn được yêu cầu. Bạn dùng biểu mẫu mới nhất nhé.", 409);
  }
  return values;
}
