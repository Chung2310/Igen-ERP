import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";
import { ASSISTANT_OPERATIONS, type AssistantOperation } from "./catalog";
import { isKnownModuleContextClause, mentionsCompatibleModule, matchesModuleContextEvidence } from "./module-context";
import { AssistantError } from "./policy";
import { privateAssistantResultField as privateField, publicAssistantResultFields,publicAssistantResultTarget } from "./result-field-policy";
import { relationEvidenceSupported, validateReadRelations, normalizeReadRelationAnnotations, selectedRelationForQuery } from "./read-relations";
import { combinedModuleContextIsValid, findUncoveredRequestTerms, reconciledRankingMappingTargets, requiredCompositeMappingIsMissing } from "./request-coverage";
import {normalizeAssistantInputValues} from './input-contract';
import {validateListAnalysis,analysisMappingIsRepresented} from './list-analysis';
import {aggregateOutputContract,readAggregates} from './read-aggregation';

export interface AssistantCompositeQuery {
  actionId: string;
  purpose: string;
  values: Record<string, unknown>;
  resultFields: string[];
  relation?: string;
}

export interface AssistantCompositeCoverage {
  evidence: string;
  requirement: string;
  mappedTo: string[];
  unresolved?: boolean;
  clarification?: string;
}

const plain = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const populated = (value: unknown) => value !== undefined && value !== null && value !== "";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
  .toLocaleLowerCase("vi").replace(/[^a-z0-9]+/g, " ").trim();
export function publicCompositeResultFields(operation: AssistantOperation) {
  return publicAssistantResultFields(operation);
}

/** A declared summary has no record ID and is not a page of records. Keep its
 * envelope locally until the normal public child allow-list projects it. */
export function compositeReportEnvelope(operation:AssistantOperation,response:any,paths:readonly string[]):Record<string,unknown>[]|undefined{
 if(!operation.precomputedMeasures)return;
 if(!paths.length||paths.some(path=>!publicAssistantResultTarget(operation,path)))throw new AssistantError('Chỉ tiêu tổng hợp chưa được xác minh.');
 const candidates=[response,response?.data,response?.data?.data].filter((value,index,all)=>plain(value)&&all.indexOf(value)===index);
 const has=(row:any,path:string)=>path.split('.').every(part=>{if(!plain(row)||!Object.hasOwn(row,part))return false;row=row[part];return true;});
 const matching=candidates.filter(row=>paths.every(path=>has(row,path)));
 if(matching.length!==1)throw new AssistantError('Nguồn báo cáo chưa trả đủ chỉ tiêu đã yêu cầu. Mình chưa kết luận là không có dữ liệu.');
 return matching;
}

function normalizeQueryValues(workflow: AssistantWorkflow, raw: Record<string, unknown>) {
  const normalized=normalizeAssistantInputValues(workflow,raw);
  if(normalized.conflicts.length)return;
  const values=normalized.values;
  for (const field of workflow.fields) {
    // Analysis is an executable read AST, not an API JSON-body string. Keep
    // one representation across interpretation, review and service replay.
    if(field.key==='analysis'&&field.type==='json'){
      if(typeof values[field.key]==='string')try{values[field.key]=JSON.parse(values[field.key] as string);}catch{return;}
      continue;
    }
    if (field.type === "json" && values[field.key] !== undefined && typeof values[field.key] === "object") {
      values[field.key] = JSON.stringify(values[field.key]);
    }
  }
  return values;
}

/** Validate a model-selected, read-only plan against the exact authorized workflows. */
export function validateCompositeQueryPlan(
  raw: unknown,
  workflows: AssistantWorkflow[],
  operations = ASSISTANT_OPERATIONS,
): { ok: true; queries: AssistantCompositeQuery[] } | { ok: false; clarification: string } {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8) {
    return { ok: false, clarification: "Mình chưa xác định được các nguồn dữ liệu cần kết hợp. Bạn nói rõ muốn tổng hợp những thông tin nào nhé." };
  }
  const operationById = new Map(operations.map(operation => [operation.id, operation]));
  const seen = new Set<string>();
  const queries: AssistantCompositeQuery[] = [];
  for (const item of normalizeReadRelationAnnotations(raw)) {
    if (!plain(item) || typeof item.actionId !== "string" || typeof item.purpose !== "string"
      || !plain(item.values) || !Array.isArray(item.resultFields)
      || !item.purpose.trim() || item.purpose.length > 300 || item.resultFields.length < 1 || item.resultFields.length > 16
      || item.resultFields.some((field: unknown) => typeof field !== "string")) {
      return { ok: false, clarification: "Kế hoạch tổng hợp chưa chỉ rõ từng nguồn dữ liệu và trường cần lấy. Mình chưa gọi API nào." };
    }
    if (seen.has(item.actionId)) return { ok: false, clarification: "Kế hoạch tổng hợp đang lặp một nguồn dữ liệu. Mình chưa gọi API nào." };
    seen.add(item.actionId);
    const workflow = workflows.find(candidate => candidate.enabled && candidate.actionId === item.actionId);
    const operation = operationById.get(item.actionId);
    if (!workflow || !operation) return { ok: false, clarification: "Kế hoạch có nguồn dữ liệu ngoài danh mục được cấp quyền. Mình chưa gọi API nào." };
    const metadata = operation.assistantMetadata;
    if (!(operation.method === "GET" || operation.readOnly) || operation.unavailableReason
      || !metadata || !["lookup", "report"].includes(metadata.intent)) {
      return { ok: false, clarification: "Kế hoạch tổng hợp chỉ được gọi các API đọc dữ liệu. Mình chưa thực hiện thao tác nào." };
    }
    const values = normalizeQueryValues(workflow, item.values);
    if(!values)return {ok:false,clarification:'Kế hoạch tra cứu có các tham số trùng nhưng khác giá trị. Chưa thực hiện tra cứu.'};
    const allowedInputs = new Set(workflow.fields.map(field => field.key));
    if (Object.keys(values).some(key => !allowedInputs.has(key) || key.startsWith("__assistant"))
      || JSON.stringify(values).length > 24_000) {
      return { ok: false, clarification: `Tham số truy vấn cho “${workflow.title}” chưa khớp với các trường được hỗ trợ. Mình chưa gọi API nào.` };
    }
    const publicFields = new Set(publicCompositeResultFields(operation));
    let resultFields = [...new Set(item.resultFields as string[])];
    // Selected aggregate outputs are server-produced measures, not additional
    // API columns. Validate their AST before removing redundant projection tokens.
    if(operation.analysis){
      try{
        const analysis=validateListAnalysis(values.analysis,operation.analysis);
        if(readAggregates(analysis).length){
          const outputs=aggregateOutputContract(operation.analysis,analysis).fields;
          resultFields=resultFields.filter(field=>publicFields.has(field)||!Object.hasOwn(outputs,field));
        }
      }catch{/* Normal validation still rejects the unknown projection. */}
    }
    if (resultFields.some(field => !publicFields.has(field))) {
      return { ok: false, clarification: `Kế hoạch yêu cầu trường kết quả chưa được phép gửi cho AI trong “${workflow.title}”. Mình chưa gọi API nào.` };
    }
    if (item.relation !== undefined && typeof item.relation !== 'string') return { ok: false, clarification: 'Phép đối chiếu chưa hợp lệ.' };
    queries.push({ actionId: item.actionId, purpose: item.purpose.trim(), values, resultFields, ...(item.relation ? { relation: item.relation as string } : {}) });
  }
  if (!validateReadRelations(queries, workflows)) return { ok: false, clarification: 'Phép đối chiếu cần đủ hai nguồn cùng phạm vi và không được lọc thiếu dữ liệu. Bạn kiểm tra lại phạm vi nhé.' };
  return { ok: true, queries };
}

function queryByActionId(queries: AssistantCompositeQuery[], actionId: string) {
  return queries.find(query => query.actionId === actionId);
}

export function compositeQueryRequestText(rawCoverage: unknown, query: AssistantCompositeQuery, fallback: string) {
  if (!Array.isArray(rawCoverage)) return fallback;
  const evidence = rawCoverage.flatMap(item => {
    if (!plain(item) || typeof item.evidence !== "string" || !Array.isArray(item.mappedTo)) return [];
    return item.mappedTo.some(target => typeof target === "string" && target.startsWith(`query:${query.actionId}:`)) ? [item.evidence] : [];
  });
  return evidence.length ? evidence.join("; ") : query.purpose;
}

function analysisTargetIsRepresented(target: string, query: AssistantCompositeQuery, operation: AssistantOperation) {
  return Boolean(operation.analysis&&analysisMappingIsRepresented(target,operation.analysis,query.values.analysis));
}

/** Every stated filter or metric must map to the query that actually applies it. */
export function validateCompositeRequestCoverage(
  text: string,
  raw: unknown,
  queries: AssistantCompositeQuery[],
  workflows: AssistantWorkflow[],
  operations = ASSISTANT_OPERATIONS,
): { ok: true } | { ok: false; clarification: string } {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) {
    return { ok: false, clarification: "Mình chưa đối chiếu được đầy đủ yêu cầu với các nguồn dữ liệu. Bạn nói rõ chỉ số và phạm vi cần tổng hợp nhé." };
  }
  const operationById = new Map(operations.map(operation => [operation.id, operation]));
  const workflowById = new Map(workflows.map(workflow => [workflow.actionId, workflow]));
  const request = normalize(text);
  for (const item of raw) {
    if (!plain(item) || typeof item.evidence !== "string" || !item.evidence.trim()
      || typeof item.requirement !== "string" || !item.requirement.trim()
      || !Array.isArray(item.mappedTo) || item.mappedTo.some((target: unknown) => typeof target !== "string")) {
      return { ok: false, clarification: "Mình chưa xác định chắc các ý cần giữ trong yêu cầu tổng hợp. Bạn diễn đạt lại mục tiêu và điều kiện nhé." };
    }
    const evidence = normalize(item.evidence);
    if (!evidence || !request.includes(evidence)) {
      return { ok: false, clarification: "Mình chưa đối chiếu được các ý trích ra với câu bạn vừa gửi. Bạn nói lại mục tiêu và điều kiện cần áp dụng nhé." };
    }
    const evidenceText = item.evidence as string;
    const requirementText = item.requirement as string;
    if (isKnownModuleContextClause(evidenceText)) {
      if (!queries.some(query => {
        const workflow = workflowById.get(query.actionId);
        return workflow && mentionsCompatibleModule(evidenceText, workflow.module);
      })) return { ok: false, clarification: `Cụm “${evidenceText.trim().slice(0, 120)}” chưa khớp với các phân hệ trong kế hoạch tổng hợp.` };
      continue;
    }
    if (item.unresolved === true || item.mappedTo.length === 0) {
      return { ok: false, clarification: typeof item.clarification === "string" && item.clarification.trim()
        ? item.clarification.trim().slice(0, 500)
        : `Mình chưa rõ cách áp dụng yêu cầu “${requirementText.trim().slice(0, 160)}”. Bạn làm rõ ý này giúp mình nhé.` };
    }
    const reconciledMappings = queries.flatMap(query => {
      const operation = operationById.get(query.actionId);
      return operation
        ? reconciledRankingMappingTargets(evidenceText, operation, query.values).map(target => `query:${query.actionId}:${target}`)
        : [];
    });
    const mappedTargets = [...new Set([...(item.mappedTo as string[]), ...reconciledMappings])];
    const relationCoversEvidence = queries.some(query=>{
      const selected=selectedRelationForQuery(queries,query.actionId);
      return selected && mappedTargets.includes(`query:${query.actionId}:relation`) && relationEvidenceSupported(evidenceText,selected.id);
    });
    const missingKind = relationCoversEvidence ? undefined : requiredCompositeMappingIsMissing(evidenceText, mappedTargets);
    if (missingKind) return { ok: false, clarification: missingKind === "ranking"
      ? `Tiêu chí xếp hạng “${evidenceText.trim().slice(0, 120)}” chưa được gắn với phép xếp hạng cụ thể. Mình chưa gọi API.`
      : `Điều kiện “${evidenceText.trim().slice(0, 120)}” chưa được gắn với bộ lọc của nguồn dữ liệu. Mình chưa gọi API.` };
    for (const target of mappedTargets) {
      if (target === "action") continue;
      if (target === "context.module") {
        if (queries.some(query => {
          const workflow = workflowById.get(query.actionId);
          return workflow && (matchesModuleContextEvidence(evidenceText, workflow.module, text)
            || combinedModuleContextIsValid(evidenceText, workflow.module, mappedTargets));
        })) continue;
        return { ok: false, clarification: "Mình chưa xác định được phân hệ phù hợp cho yêu cầu tổng hợp." };
      }
      if (!target.startsWith("query:")) return { ok: false, clarification: `Yêu cầu “${item.requirement.trim().slice(0, 160)}” chưa được ánh xạ vào nguồn dữ liệu cụ thể.` };
      const separator = target.indexOf(":", "query:".length);
      if (separator < 0) return { ok: false, clarification: "Kế hoạch chưa chỉ rõ nguồn dữ liệu cho một điều kiện." };
      const actionId = target.slice("query:".length, separator);
      const query = queryByActionId(queries, actionId);
      const workflow = workflowById.get(actionId);
      const operation = operationById.get(actionId);
      if (!query || !workflow || !operation) return { ok: false, clarification: "Kế hoạch tham chiếu một nguồn dữ liệu chưa được chọn." };
      const mapping = target.slice(separator + 1);
      if (mapping === 'relation') {
        const selected=selectedRelationForQuery(queries,query.actionId);
        if (!selected || !relationEvidenceSupported(evidenceText, selected.id)) return { ok: false, clarification: 'Điều kiện đối chiếu chưa khớp với phép lọc được hỗ trợ. Mình chưa gọi API.' };
      } else if (mapping.startsWith("values.")) {
        const fieldKey = mapping.slice("values.".length);
        const field = workflow.fields.find(candidate => candidate.key === fieldKey);
        if (!field || !populated(query.values[fieldKey])) return { ok: false, clarification: `Điều kiện “${requirementText.trim().slice(0, 120)}” chưa được áp dụng vào truy vấn “${workflow.title}”.` };
      } else if (mapping.startsWith("result.")) {
        const fieldKey = mapping.slice("result.".length);
        if (!query.resultFields.includes(fieldKey)) return { ok: false, clarification: `Chưa lấy trường cần tổng hợp từ “${workflow.title}”.` };
      } else if (mapping.startsWith("analysis.")) {
        if (!analysisTargetIsRepresented(mapping, query, operation)) return { ok: false, clarification: `Điều kiện “${requirementText.trim().slice(0, 120)}” chưa được áp dụng vào phép phân tích của “${workflow.title}”.` };
      } else if (mapping !== "source") return { ok: false, clarification: "Kế hoạch tổng hợp có vị trí ánh xạ không hợp lệ." };
    }
  }
  const missing = findUncoveredRequestTerms(text, raw);
  if (missing.length) {
    return { ok: false, clarification: `Mình chưa đưa đủ chi tiết “${missing.join(" ").slice(0, 160)}” vào kế hoạch tổng hợp. Mình chưa gọi API để tránh bỏ sót điều kiện; bạn xác nhận lại giúp mình nhé.` };
  }
  return { ok: true };
}

/** Project only explicitly selected public fields, including declared nested fields. */
export function projectCompositeSourceData(
  records: Record<string, unknown>[],
  selectedFields: string[],
  operation: AssistantOperation,
) {
  const childFields = operation.resultChildFields || {};
  const projectNested = (value: unknown, tree: unknown, depth = 0): unknown => {
    if (depth > 4) return undefined;
    if(value===null)return null;
    if (Array.isArray(value)) {
      if (value.length > 500) throw new AssistantError("Một nguồn có quá nhiều dòng để gửi đầy đủ cho AI tổng hợp. Hãy thu hẹp kỳ hoặc bộ lọc.", 413);
      return value.map(item => projectNested(item, tree, depth + 1)).filter(item => item !== undefined);
    }
    if (!plain(value)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
      if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString();
      return undefined;
    }
    const keys = Array.isArray(tree) ? tree : plain(tree) ? Object.keys(tree) : [];
    return Object.fromEntries(keys.filter(key => !privateField(key) && Object.hasOwn(value, key)).flatMap(key => {
      const projected = projectNested(value[key], plain(tree) ? tree[key] : undefined, depth + 1);
      return projected === undefined ? [] : [[key, projected]];
    }));
  };
  if (records.length > 500) throw new AssistantError("Một nguồn có quá nhiều dòng để gửi đầy đủ cho AI tổng hợp. Hãy thu hẹp kỳ hoặc bộ lọc.", 413);
  return records.map(record => Object.fromEntries(selectedFields.flatMap(field => {
    if (privateField(field) || !Object.hasOwn(record, field)) return [];
    const value = record[field];
    const projected = Array.isArray(value) || plain(value)
      ? projectNested(value, (childFields as Record<string, unknown>)[field])
      : projectNested(value, undefined);
    return projected === undefined ? [] : [[field, projected]];
  })));
}
