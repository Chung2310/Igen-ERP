import { MODULE_LABELS, MODULE_TAB_MAP } from "../../src/config/modules";
import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";
import { ASSISTANT_OPERATIONS, operationById } from "./catalog";
import { AssistantError } from "./policy";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase()
  .replace(/[^a-z0-9]+/g, " ").replace(/\bquan li\b/g, "quan ly").trim();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const assistantModuleLabel = (module: string) => MODULE_LABELS[module as keyof typeof MODULE_LABELS] || module;

/** Recognize explicit public module names, not an AI-selected routing hint. */
export function explicitAssistantModules(text: string): string[] {
  // A quoted record name is not a module selection. Outer quotes around the whole request remain valid.
  const input = normalize(text.replace(/(?:tên|mã|ten|ma)\s+["“][^"”]+["”]/giu, ""));
  return Object.entries(MODULE_LABELS).flatMap(([module, label]) => {
    const aliases = [...new Set([label, MODULE_TAB_MAP[module as keyof typeof MODULE_TAB_MAP]].filter((value): value is string => Boolean(value)).map(normalize))];
    for (const alias of [...aliases]) if (alias.startsWith("quan ly ")) aliases.push(alias.slice("quan ly ".length));
    if (module === "hr") aliases.push("quan ly nhan su");
    const found = aliases.some(alias => {
      const literal = escape(alias);
      const negated = new RegExp(`\\bkhong (?:phai |o |trong |thuoc |ben )?(?:(?:phan he|module|muc|trang|man hinh) )?${literal}\\b`).test(input);
      if (negated) return false;
      const scopedMatch = new RegExp(`\\b(?:phan he|module|muc|trang|man hinh|trong|thuoc|ben|tai|o) (?:quan ly )?${literal}\\b`).exec(input);
      const labelStart = scopedMatch ? scopedMatch.index + scopedMatch[0].length - alias.length : -1;
      const longerLabel = labelStart >= 0 && Object.values(MODULE_LABELS).map(normalize).some(other => other.startsWith(`${alias} `)
        && new RegExp(`^${escape(other)}(?: |$)`).test(input.slice(labelStart)));
      const scoped = Boolean(scopedMatch && !longerLabel);
      const projectSuffix = /\bdu an\b/.test(input) && alias.startsWith("quan ly ") && new RegExp(`\\b${literal}$`).test(input)
        && !new RegExp(`\\b(?:ten|ma) ${literal}$`).test(input);
      return scoped || projectSuffix;
    });
    if (found) return [module];
    if (module === "worker" && /\bdu an lao dong\b/.test(input) && !/\bkhong (?:phai )?du an lao dong\b/.test(input)) return [module];
    if (module === "hr" && /\bdu an nhan su\b/.test(input) && !/\bkhong (?:phai )?du an nhan su\b/.test(input)) return [module];
    return [];
  });
}
export function scopeAssistantWorkflows(text: string, workflows: readonly AssistantWorkflow[]) {
  const modules = explicitAssistantModules(text);
  return { modules, workflows: workflows.filter(workflow => workflow.enabled && (!modules.length || modules.some(module => operationWithinScope(operationById(workflow.actionId) || workflow, module)))) };
}
function operationWithinScope(operation: { module: string; path?: string }, module: string) {
  // Labor partner operations are part of the worker-management API namespace,
  // although licensing/catalog metadata gives them their own module code.
  return operation.module === module || module === "worker" && Boolean(operation.path?.startsWith("/worker-management/"));
}
export function assertAssistantModuleScope(operation: { module: string; path?: string }, intent: string) {
  const modules = explicitAssistantModules(intent);
  if (modules.length && !modules.some(module => operationWithinScope(operation, module))) throw new AssistantError(`Thao tác trong ${assistantModuleLabel(operation.module)} không khớp yêu cầu thuộc ${modules.map(assistantModuleLabel).join(" / ")}. Chưa thực hiện thay đổi dữ liệu.`, 409);
}

const projectRoot = (operation: { path: string; module: string }) => operation.module === "hr" && /^\/kanban\/projects(?:\/:id)?$/.test(operation.path)
  || operation.module === "worker" && /^\/worker-management\/projects(?:\/:id)?$/.test(operation.path);
/** A bare “dự án” names two different resources; retain the user's choice across follow-up turns. */
export function projectNamespaceChoices(text: string, workflows: readonly AssistantWorkflow[], actionId: string, pending: unknown): string[] {
  const operation = operationById(actionId);
  const input = normalize(text);
  const context = pending as { actionId?: string } | null;
  if (!operation || !projectRoot(operation) || explicitAssistantModules(text).length || context?.actionId === actionId
    || !/\bdu an\b/.test(input) || /\b(?:lao dong|cong nhan|nhan su|kanban)\b/.test(input)) return [];
  const candidates = workflows.filter(workflow => workflow.enabled && ASSISTANT_OPERATIONS.some(op => op.id === workflow.actionId && projectRoot(op) && op.method === operation.method));
  // One option per resource type. Prefer the exact action kind (list/detail/create/update/delete).
  const suffix = actionId.split(".").at(-1);
  return [...new Set(candidates.map(workflow => workflow.module))].flatMap(module => {
    const available = candidates.filter(workflow => workflow.module === module);
    const candidate = available.find(workflow => workflow.actionId.split(".").at(-1) === suffix) || available[0];
    return candidate ? [candidate.actionId] : [];
  });
}
