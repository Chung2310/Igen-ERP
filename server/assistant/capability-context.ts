import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";
import { ASSISTANT_OPERATIONS, type AssistantOperation } from "./catalog";
import { buildAssistantOperationMetadata } from "./operation-metadata";
import { assistantModuleContext } from "./module-context";

function inputFieldContext(workflow: AssistantWorkflow, operation?: AssistantOperation) {
  return workflow.fields.map(field => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: Boolean(field.required || field.systemRequired),
    ...(field.source ? { source: field.source } : {}),
    ...(field.apiKey ? { apiKey: field.apiKey } : {}),
    ...(field.requiredWhen ? { requiredWhen: field.requiredWhen } : {}),
    ...(field.options ? { options: field.options } : {}),
    ...(field.reference ? { reference: field.reference } : {}),
    ...(field.referenceContext ? { referenceContext: field.referenceContext } : {}),
    ...(field.alternativeField ? { alternativeField: field.alternativeField } : {}),
    ...(field.structure ? { structure: field.structure } : {}),
    ...(operation?.clearableFields?.includes(field.key) ? { clearable: true } : {}),
    ...(operation?.currentDateDefaults?.includes(field.key) ? { runtimeDefault: 'today-vietnam' } : {}),
  }));
}

/**
 * Give intent interpretation the executable business contract behind each
 * authorized workflow without exposing API paths or handler implementation.
 */
export function buildAssistantCapabilityContext(
  workflows: AssistantWorkflow[],
  operations = ASSISTANT_OPERATIONS,
) {
  const operationById = new Map(operations.map(operation => [operation.id, operation]));
  return workflows.map(workflow => {
    const operation = operationById.get(workflow.actionId);
    const metadata = operation ? operation.assistantMetadata || buildAssistantOperationMetadata(operation) : undefined;
    return {
      actionId: workflow.actionId,
      module: workflow.module,
      moduleContext: (({ key, label }) => ({ key, label }))(assistantModuleContext(workflow.module)),
      title: workflow.title,
      purpose: workflow.description,
      effect: metadata?.effect || (!operation || operation.readOnly || operation.method === "GET" ? "read" : "write"),
      ...(metadata ? { classification: {
        action: metadata.action,
        intent: metadata.intent,
        featureKey: metadata.featureKey,
        featureLabel: metadata.featureLabel,
        ...(metadata.entityKey ? { entityKey: metadata.entityKey } : {}),
        capabilities: metadata.capabilities,
      } } : {}),
      confirmationRequired: Boolean(workflow.requireConfirmation || operation?.confirmation),
      inputs: inputFieldContext(workflow, operation),
      ...(operation ? {
        outputs: operation.resultFields,
        ...(operation.coverageAliases?.length ? { builtInSemantics: operation.coverageAliases } : {}),
        ...(operation.resultChildFields ? { nestedOutputs: operation.resultChildFields } : {}),
        ...(operation.analysis ? {
          analysis: {
            ...(operation.analysis.scopeLabel ? { scope: operation.analysis.scopeLabel } : {}),
            fields: operation.analysis.fields,
            ...(operation.analysis.pagination ? { pagination: operation.analysis.pagination } : {}),
          },
        } : {}),
        ...(operation.unavailableReason ? { limitation: operation.unavailableReason } : {}),
      } : {}),
      workflowGuidance: workflow.instructions,
    };
  });
}

export const ASSISTANT_CAPABILITY_INTERPRETATION_GUIDANCE = `Dùng DANH MỤC NĂNG LỰC để hiểu đúng dữ liệu nghiệp vụ của hệ thống. purpose cho biết thao tác trả lời loại câu hỏi nào; inputs là các trường mà thao tác thực sự nhận; outputs là các trường công khai mà kết quả có thể chứa; analysis.fields là các chỉ số được phép lọc, xếp hạng hoặc tổng hợp. Chỉ chọn phép tính có trong hợp đồng analysis và chỉ hứa dữ liệu có trong outputs. effect=read là tra cứu, effect=write là thay đổi dữ liệu; thao tác ghi phải tuân theo bước xác nhận của máy chủ. workflowGuidance chỉ giải nghĩa cách dùng thao tác, không tạo thêm quyền, dữ liệu hay khả năng ngoài hợp đồng.`;
