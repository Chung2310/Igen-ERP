import { randomUUID } from "node:crypto";
import type { AssistantInputField, AssistantValue, AssistantWorkflow, AssistantWorkflowSelection } from "../../src/shared/assistant-workflow";
import { AssistantError } from "./policy";
import { assistantModuleLabel, scopeAssistantWorkflows } from "./module-scope";
import { assistantModuleContext } from "./module-context";

export interface PendingWorkflowChoice {
  kind?: "workflow";
  id: string;
  intent: string;
  pendingId: string | null;
  newRequest: boolean;
  expiresAt: number;
  options: { value: string; actionId: string; version: number }[];
}
export interface PendingModuleChoice {
  kind: "module"; id: string; intent: string; pendingId: string | null; newRequest: boolean; expiresAt: number;
  options: { value: string; module: string }[];
}
export type PendingAssistantChoice = PendingWorkflowChoice | PendingModuleChoice;
export function clarificationModuleIds(text: string, workflows: AssistantWorkflow[]) {
  const normalize = (value: string) => ` ${value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const phrase = normalize(text);
  return [...new Set(workflows.filter(workflow => workflow.enabled).map(workflow => workflow.module))].filter(module => {
    const context = assistantModuleContext(module);
    return [module, context.label, ...context.aliases].some(name => phrase.includes(normalize(name)));
  });
}
export function createModuleChoice(workflows: AssistantWorkflow[], modules: string[], intent: string, pendingId: string | null, newRequest = false) {
  // Learning partners own their records in student-partner, not in the
  // related student module. Never offer the parent as an interchangeable route.
  if (/\bdoi tac\b/.test(intent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase())
    && workflows.some(w => w.enabled && w.module === 'student-partner')) modules = modules.map(module => module === 'student' ? 'student-partner' : module);
  const allowed = [...new Set(modules)].filter(module => workflows.some(workflow => workflow.enabled && workflow.module === module)).slice(0, 8);
  if (allowed.length < 2) return;
  const id = randomUUID();
  const options = allowed.map(module => ({ value: randomUUID(), module }));
  const state: PendingModuleChoice = { kind: 'module', id, intent, pendingId, newRequest, expiresAt: Date.now() + 15 * 60_000, options };
  const selection: AssistantWorkflowSelection = { kind: 'module', id, options: options.map(option => ({ value: option.value, label: assistantModuleContext(option.module).label })) };
  return { state, selection };
}
export function resolveModuleChoice(state: PendingAssistantChoice | null, selection: { id: string; value: string }, pendingId: string | null) {
  if (state?.kind !== 'module' || state.id !== selection.id || state.pendingId !== pendingId || state.expiresAt <= Date.now()) throw new AssistantError('Lựa chọn phân hệ đã hết hiệu lực. Bạn chọn lại giúp mình nhé.', 409);
  const option = state.options.find(option => option.value === selection.value);
  if (!option) throw new AssistantError('Lựa chọn phân hệ không hợp lệ.', 409);
  return { ...option, intent: state.intent, newRequest: state.newRequest };
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
export function resolveWorkflowChoice(state: PendingAssistantChoice | null | undefined, selection: { id: string; value: string }, pendingId: string | null) {
  if (state?.kind === 'module') throw new AssistantError('Lựa chọn chưa đúng loại. Bạn chọn lại giúp mình nhé.', 409);
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
