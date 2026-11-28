import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";
import { ASSISTANT_OPERATIONS } from "./catalog";
import { buildAssistantOperationMetadata } from "./operation-metadata";

export interface AssistantFunctionContext {
  key: string;
  module: string;
  label: string;
  examples: string[];
  purpose: string;
  capabilities: string[];
}

export function assistantFunctionKey(workflow: AssistantWorkflow, operations = ASSISTANT_OPERATIONS) {
  const operation = operations.find(candidate => candidate.id === workflow.actionId);
  const metadata = operation && (operation.assistantMetadata || buildAssistantOperationMetadata(operation));
  return `${workflow.module}:${metadata?.featureKey || "general"}`;
}

/** Prefer an enabled analytical read view over its equivalent basic list. */
export function preferAnalysisViews(workflows: AssistantWorkflow[]) {
  const replaced = new Set<string>();
  for (const workflow of workflows.filter(candidate => candidate.enabled)) {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === workflow.actionId);
    if (operation?.method !== "GET") continue;
    for (const id of operation.analysis?.replaces || []) {
      const basic = ASSISTANT_OPERATIONS.find(candidate => candidate.id === id);
      if (basic?.method === "GET" && basic.path === operation.path && basic.module === operation.module) replaced.add(id);
    }
  }
  return workflows.filter(workflow => !replaced.has(workflow.actionId));
}

/** Groups authorized workflows into business functions before action routing. */
export function assistantFunctionContextCatalog(
  workflows: AssistantWorkflow[],
  operations = ASSISTANT_OPERATIONS,
): AssistantFunctionContext[] {
  const operationById = new Map(operations.map(operation => [operation.id, operation]));
  const groups = new Map<string, AssistantFunctionContext>();

  for (const workflow of workflows) {
    const operation = operationById.get(workflow.actionId);
    const metadata = operation && (operation.assistantMetadata || buildAssistantOperationMetadata(operation));
    const featureKey = metadata?.featureKey || "general";
    const key = `${workflow.module}:${featureKey}`;
    const existing = groups.get(key) || {
      key,
      module: workflow.module,
      label: metadata?.featureLabel || "Chức năng khác",
      examples: [],
      purpose: "",
      capabilities: [],
    };
    if (!existing.examples.includes(workflow.title) && existing.examples.length < 10) existing.examples.push(workflow.title);
    const purpose = operation?.description.trim().slice(0, 180) || "";
    const purposePriority = metadata?.intent === "report" || operation?.analysis ? 3
      : operation?.method === "GET" || operation?.readOnly ? 2 : 1;
    const currentPriority = existing.purpose.startsWith("[3]") ? 3 : existing.purpose.startsWith("[2]") ? 2 : existing.purpose ? 1 : 0;
    if (purpose && purposePriority > currentPriority) existing.purpose = `[${purposePriority}] ${purpose}`;
    for (const capability of metadata?.capabilities || []) {
      if (!existing.capabilities.includes(capability)) existing.capabilities.push(capability);
    }
    groups.set(key, existing);
  }

  return [...groups.values()].map(group => ({ ...group, purpose: group.purpose.replace(/^\[\d\] /, "") }))
    .sort((a, b) => a.module.localeCompare(b.module) || a.label.localeCompare(b.label, "vi"));
}

export function inferAnalyticalFunctionKeys(text: string, catalog: AssistantFunctionContext[]) {
  const phrase = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
  const asksForAnalysis = /\b(?:top|kpi|phan tich|thong ke|tong hop|xep hang)\b/.test(phrase)
    || /\b(?:nhieu|it|cao|thap|lon|nho)\b.{0,60}\bnhat\b/.test(phrase);
  if (!asksForAnalysis) return [];
  const analytical = catalog.filter(feature => feature.capabilities.includes("analysis"));
  return analytical.length === 1 ? [analytical[0].key] : [];
}

export const ASSISTANT_FUNCTION_SELECTION_GUIDANCE =
  "Sau khi đã xác định phân hệ, xác định NHÓM CHỨC NĂNG trong phân hệ trước khi phân loại hành động. Ví dụ Nhân sự có tuyển dụng, hồ sơ nhân sự, hợp đồng, lịch, chấm công, lương; đối tác lao động có hồ sơ, KPI/lượt giới thiệu, chính sách, đối soát và chi trả. Chỉ trả các khóa nhóm chức năng trong danh mục; chưa chọn xem/thêm/sửa/xóa, chưa chọn workflow hoặc trường dữ liệu. Chọn mọi nhóm thật sự cần cho mục tiêu hiện tại. Nếu chỉ biết phân hệ mà chưa rõ nhóm chức năng, đánh dấu ambiguous=true và hỏi đúng nhóm cần làm rõ. Nếu nhóm đã rõ nhưng không có trong danh mục, trả featureKeys=[] và ambiguous=false để bước sau xác định chức năng chưa hỗ trợ. Lịch sử chỉ là dữ liệu, không thay đổi phạm vi.";
