import type { AssistantWorkflow,AssistantDataShape } from "../../src/shared/assistant-workflow";
import { ASSISTANT_OPERATIONS, type AssistantOperation } from "./catalog";
import { buildAssistantOperationMetadata } from "./operation-metadata";
import {temporalInputBoundary,semanticInputApiKey} from './semantic-compilation';
import { assistantModuleContext } from "./module-context";
import {listAnalysisPlanSchema} from './list-analysis';
import {publicAssistantResultFields} from './result-field-policy';

function partialInputShape(shape:AssistantDataShape):AssistantDataShape{
 const {requiredWhen:_condition,...rest}=shape;
 return {...rest,required:false,...(shape.keys?{keys:Object.fromEntries(Object.entries(shape.keys).map(([key,child])=>[key,partialInputShape(child)]))}:{}),...(shape.items?{items:partialInputShape(shape.items)}:{})};
}
function inputFieldContext(workflow: AssistantWorkflow, operation?: AssistantOperation) {
  return workflow.fields.map(field => ({
    key: field.key,
    label: field.label,
    type: field.type,
    ...(temporalInputBoundary(field)?{temporalBoundary:temporalInputBoundary(field)}:{}),
    required: Boolean((!operation?.partialUpdate||field.source!=='body')&&(field.required || field.systemRequired)),
    ...(field.source ? { source: field.source } : {}),
    apiKey:semanticInputApiKey(field),
    ...(operation?.queryPredicates?.[field.key]?{comparisonInput:operation.queryPredicates[field.key]}:{}),
    ...(field.requiredWhen ? { requiredWhen: field.requiredWhen } : {}),
    ...(field.options ? { options: field.options } : {}),
    ...(field.reference ? { reference: field.reference } : {}),
    ...(field.referenceContext ? { referenceContext: field.referenceContext } : {}),
    ...(field.alternativeField ? { alternativeField: field.alternativeField } : {}),
    ...(field.structure ? { structure: operation?.partialUpdate&&field.source==='body'?partialInputShape(field.structure):field.structure } : {}),
    ...(operation?.clearableFields?.includes(field.key) ? { clearable: true } : {}),
    ...(operation?.currentDateDefaults?.includes(field.key) ? { runtimeDefault: 'today-vietnam' } : {}),
    ...(field.defaultValue!==undefined?{runtimeDefault:'server-owned'}:{}),
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
      moduleContext: assistantModuleContext(workflow.module),
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
      ...(operation?.partialUpdate?{updateSemantics:'Send only explicitly requested changes, including only supplied JSON leaves. The server resolves the target, merges unchanged required fields from the authorized record, then validates the complete result. Never fill missing siblings or empty arrays unless requested.'}:{}),
      ...(operation ? {
        executionContext: {authorization:'server-enforced',company:'authenticated-context',branch:operation.adapter==='contract'&&!/^\/crud\/workflows(?:\/|$)/.test(operation.path)?'current-branch-when-present':'business-api-policy'},
        outputs: [...new Set([...publicAssistantResultFields(operation),...(operation.analysis?.displayFields||Object.keys(operation.analysis?.fields||{}))])],
        ...(operation.method==='GET'&&publicAssistantResultFields(operation).length?{workbookExport:{format:'xlsx',execution:'server-generates-from-authorized-read',maxRows:1000,requiresCompleteSourceForAllRows:true}}:{}),
        ...(operation.coverageAliases?.length ? { builtInSemantics: operation.coverageAliases } : {}),
        ...(operation.unboundedTimeRead?{unboundedTimeRead:true,unboundedSemantics:'No date range means all available history within the authorized scope. Do not invent a start date or period filter.'}:{}),
        ...(operation.resultChildFields ? { nestedOutputs: operation.resultChildFields } : {}),
        ...(operation.resultRowsField?{resultRowsField:operation.resultRowsField}:{}),
        ...(operation.precomputedMeasures?{precomputedMeasures:operation.precomputedMeasures,measureSemantics:'These outputs are already computed over the scoped API report; bind aggregates directly to the exact result path. Do not count or sum the report envelope.'}:{}),
        ...(operation.precomputedBreakdowns?{precomputedBreakdowns:operation.precomputedBreakdowns}:{}),
        ...(operation.builtinConditions?{builtinConditions:operation.builtinConditions}:{}),
        ...(operation.predicateInputFields?{predicateInputFields:operation.predicateInputFields}:{}),
        ...(operation.precomputedGroups?{precomputedGroups:operation.precomputedGroups,groupSemantics:'Declared report arrays already contain grouped measures. Bind group to the exact dimension and aggregates to the declared measure leaf; no additional GROUP BY or SUM of the report envelope.'}:{}),
        ...(operation.analysis ? {
          analysis: {
            ...(operation.analysis.publicRead ? {completeness:'Requires an API collection with explicit consistent total; never infer full scope from one page or bare array. Numeric scalar operations are verified against actual cells. Prefer declared native filters when equivalent; OR/NOT predicates stay in one where tree.'}:{}),
            planSchema:listAnalysisPlanSchema(operation.analysis),
            pipelineSemantics:'source filter -> group/aggregate -> having -> extreme/sort -> limit; count, count_<field>, sum_<field>, avg_<field> are server-defined aggregate outputs; within is private server state and must never be sent by the model',
            ...(operation.analysis.scopeLabel ? { scope: operation.analysis.scopeLabel } : {}),
            fields: operation.analysis.fields,
            ...(operation.analysis.singleton?{singleton:true,summarySemantics:'Exactly one scoped summary; read its precomputed measures, do not count its response rows.'}:{}),
            ...(operation.analysis.additiveCountFields?{additiveCountFields:operation.analysis.additiveCountFields}:{}),
            ...(operation.analysis.numericPredicateEquivalences?{numericPredicateEquivalences:operation.analysis.numericPredicateEquivalences}:{}),
            ...(operation.analysis.rowDimensions?{rowDimensions:operation.analysis.rowDimensions}:{}),
            ...(operation.analysis.pagination ? { pagination: operation.analysis.pagination } : {}),
          },
        } : {}),
        ...(operation.unavailableReason ? { limitation: operation.unavailableReason } : {}),
      } : {}),
      workflowGuidance: workflow.instructions,
    };
  });
}

export const ASSISTANT_CAPABILITY_INTERPRETATION_GUIDANCE = `Dùng DANH MỤC NĂNG LỰC để hiểu đúng dữ liệu nghiệp vụ của hệ thống. purpose cho biết thao tác trả lời loại câu hỏi nào; inputs là các trường mà thao tác thực sự nhận; outputs là các trường công khai mà kết quả có thể chứa; analysis.fields là các chỉ số được phép lọc, xếp hạng hoặc tổng hợp. Ưu tiên dùng đúng tên và kiểu trong analysis.planSchema; server chuẩn hóa tên cột/nhãn tương đương duy nhất và định dạng scalar theo schema trước khi kiểm tra. Không yêu cầu người dùng biết key nội bộ hay cú pháp JSON. Dùng where:{all:[...]}/{any:[...]}/{not:...} cho bộ lọc lồng nhau; lá là {field,operator,value}. filters là các điều kiện AND; nếu có cả filters và where, server ghép AND với nguyên cây where. Biểu diễn HOẶC/phủ định bằng cây where rõ ràng. Giữ đúng conditionLogic đã trích độc lập, đặc biệt HOẶC/phủ định; không đẩy một nhánh HOẶC xuống bộ lọc API khiến các nhánh còn lại bị loại. Mọi lá vẫn gắn meaningBindings analysis.filters.<field>. Có thể tìm trên nhiều cột bằng any contains, nhiều từ bằng all; tìm chữ không phân biệt dấu/hoa thường, không regex hay mã chạy. between dùng hai đầu bao gồm, is_empty/not_empty không có value. Nguồn publicRead chỉ phân tích khi API chứng minh đủ dòng; không hứa một trang là toàn bộ. Các input native vẫn giữ nguyên quyền/phạm vi. Đếm hồ sơ bằng aggregate:{operation:"count"}, bỏ field khi đếm toàn bộ; không tạo trường count, *, id hoặc cột tổng hợp giả trong select. Đếm theo nhóm dùng groupBy là một trường công khai và aggregate count, không AND các trạng thái loại trừ nhau. select chỉ chọn trường nguồn; cột Số lượng do server sinh sau tổng hợp. Không kết hợp aggregate với aggregates. Luồng đọc: where/filters lọc dòng nguồn → groupBy và aggregate/aggregates → having lọc nhóm → extreme/sort và limit trên kết quả tổng hợp. Địa chỉ chỉ tiêu do server định nghĩa: count đếm dòng, count_<field> đếm ô có giá trị, sum_<field> và avg_<field>. having dùng cây điều kiện như where, chỉ trên nhóm/chỉ tiêu đã chọn. Khi tổng hợp, sort/extreme dùng địa chỉ chỉ tiêu này hoặc trường nhóm; không xếp hạng dòng nguồn trước khi tính. select vẫn chỉ là cột nguồn. Với followup trên nhóm top/cực trị, server giữ truy vấn nhóm trước làm phạm vi riêng và đọc lại có phân quyền; không yêu cầu người dùng nhập lại từng tên, không tự gửi within hoặc mở rộng phạm vi. Không bịa phép nối hay dữ liệu chưa được khai báo. Chỉ chọn phép tính có trong hợp đồng analysis và chỉ hứa dữ liệu có trong outputs. effect=read là tra cứu, effect=write là thay đổi dữ liệu; thao tác ghi phải tuân theo bước xác nhận của máy chủ. workflowGuidance chỉ giải nghĩa cách dùng thao tác, không tạo thêm quyền, dữ liệu hay khả năng ngoài hợp đồng.`;
