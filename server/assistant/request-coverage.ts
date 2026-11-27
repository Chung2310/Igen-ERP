import type { AssistantDataShape, AssistantWorkflow } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";
import { isKnownModuleContextClause, isModuleContextClause, mentionsCompatibleModule } from "./module-context";

export interface RequestCoverageItem {
  evidence: string;
  requirement: string;
  mappedTo: string[];
  unresolved?: boolean;
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const plain = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const populated = (value: unknown) => value !== undefined && value !== null && value !== "";

function isExplicitWorkerDataRequest(text: string) {
  const request = normalize(text);
  const identifiesWorker = /\b(?:lao dong|nguoi lao dong|cong nhan|nhan cong|worker)\b/.test(request);
  const identifiesWorkerData = /\b(?:cham cong|di muon|vang|du an|thieu lao dong|chi tieu|dinh bien|vi tri|con trong|giay phep|visa|hop dong lao dong)\b/.test(request);
  return identifiesWorker && identifiesWorkerData && !isModuleContextClause(text, "hr");
}

function structuredPath(target: string) {
  const valuePath = target.startsWith("values.") ? target.slice("values.".length) : target;
  const match = /^([a-zA-Z_$][\w$]*)((?:\[\d+\]|\.[a-zA-Z_$][\w$]*)*)$/.exec(valuePath);
  if (!match) return undefined;
  const segments = match[2].replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  return { root: match[1], segments };
}

function supportsStructuredPath(shape: AssistantDataShape, segments: string[]): boolean {
  let current: AssistantDataShape | undefined = shape;
  let index = 0;
  while (index < segments.length && current) {
    if (current.type === "array") {
      if (/^\d+$/.test(segments[index])) index += 1;
      current = current.items;
      continue;
    }
    if (current.type !== "object") return false;
    current = current.keys?.[segments[index]];
    index += 1;
  }
  return Boolean(current) && index === segments.length;
}

function structuredPathIsPopulated(value: unknown, shape: AssistantDataShape, segments: string[]): boolean {
  if (typeof value === "string" && (shape.type === "array" || shape.type === "object")) {
    try { value = JSON.parse(value); } catch { return false; }
  }
  if (!segments.length) return populated(value);
  if (shape.type === "array") {
    if (!Array.isArray(value) || value.length === 0 || !shape.items) return false;
    if (/^\d+$/.test(segments[0])) {
      const index = Number(segments[0]);
      return index < value.length && structuredPathIsPopulated(value[index], shape.items, segments.slice(1));
    }
    return value.every(item => structuredPathIsPopulated(item, shape.items!, segments));
  }
  if (shape.type !== "object" || !plain(value)) return false;
  const [key, ...rest] = segments;
  const child = shape.keys?.[key];
  return Boolean(child) && structuredPathIsPopulated(value[key], child!, rest);
}

function hasDeclaredResultPath(operation: AssistantOperation, path: string) {
  if (operation.method !== "GET" && !operation.readOnly) return false;
  const [root, ...segments] = path.split(".");
  if (!root || !operation.resultFields.includes(root)) return false;

  let tree = operation.resultChildFields?.[root];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (Array.isArray(tree)) return index === segments.length - 1 && tree.includes(segment);
    if (!tree || typeof tree !== "object" || !Object.hasOwn(tree, segment)) return false;
    tree = tree[segment];
  }
  return true;
}

function parsedAnalysis(value: unknown): Record<string, any> | undefined {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return plain(parsed) ? parsed as Record<string, any> : undefined;
  } catch { return undefined; }
}

function analysisTargetIsRepresented(target: string, operation: AssistantOperation, values: Record<string, unknown>) {
  if (!operation.analysis || !target.startsWith("analysis.")) return false;
  const [, kind, field] = target.split(".");
  const plan = parsedAnalysis(values.analysis);
  if (!plan) return false;
  if (kind === "limit") return Number.isInteger(plan.limit) && plan.limit > 0;
  if (kind === "aggregate" && field === "count") return plan.aggregate?.operation === "count";
  if (!field || !Object.hasOwn(operation.analysis.fields, field)) return false;
  switch (kind) {
    case "extreme": return plan.extreme?.field === field;
    case "sort": return plan.sort?.field === field;
    case "filters": return Array.isArray(plan.filters) && plan.filters.some((filter: any) => filter?.field === field);
    case "aggregate": return plan.aggregate?.field === field;
    case "groupBy": return plan.groupBy === field;
    default: return false;
  }
}

/** Return meaningful words omitted from the model's quoted evidence. */
export function findUncoveredRequestTerms(
  text: string,
  rawCoverage: unknown,
  _workflow?: AssistantWorkflow,
  _values: Record<string, unknown> = {},
  _operation?: AssistantOperation,
) {
  const evidence = Array.isArray(rawCoverage)
    ? rawCoverage.flatMap(item => plain(item) && typeof item.evidence === "string" ? [item.evidence] : [])
    : [];
  const covered = new Set(evidence.flatMap(item => normalize(item).split(" ").filter(Boolean)));
  const filler = new Set(normalize("mình tôi bạn anh chị vui lòng xin nhờ giúp dùm với nhé nha vậy thế rồi hả à ạ là").split(" "));
  return (text.match(/[\p{L}\p{N}]+/gu) || []).filter(word => {
    const key = normalize(word);
    return key && !covered.has(key) && !filler.has(key);
  });
}

export function shouldRepairRequestCoverage(text: string, rawCoverage: unknown, clarification: string) {
  if (findUncoveredRequestTerms(text, rawCoverage).length) return true;
  return /chưa (?:được gắn với|được áp dụng vào|ánh xạ được|chuyển được|lấy trường|xác định được bạn muốn làm việc trong phân hệ|đối chiếu được các ý AI trích ra)/iu.test(clarification);
}

/** Fail closed when the model cannot account for each stated requirement using
 * the selected operation's declared fields or analysis contract. */
export function validateRequestCoverage(
  text: string,
  raw: unknown,
  workflow: AssistantWorkflow,
  operation: AssistantOperation,
  values: Record<string, unknown>,
  evidenceSources: string[] = [text],
): { ok: true } | { ok: false; clarification: string } {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) {
    return { ok: false, clarification: "Mình chưa đối chiếu được đầy đủ yêu cầu với các trường của thao tác. Bạn nói rõ hơn mục tiêu và điều kiện cần áp dụng nhé." };
  }
  const requests = evidenceSources.map(normalize);
  const workerDataRequest = workflow.module === "worker" && isExplicitWorkerDataRequest(text);
  const knownFields = new Set(workflow.fields.flatMap(field => [field.key, field.apiKey, field.source && field.apiKey ? `${field.source}_${field.apiKey}` : undefined].filter((value): value is string => Boolean(value))));
  for (const rawItem of raw) {
    if (!plain(rawItem) || typeof rawItem.evidence !== "string" || !rawItem.evidence.trim()
      || typeof rawItem.requirement !== "string" || !rawItem.requirement.trim()
      || !Array.isArray(rawItem.mappedTo) || rawItem.mappedTo.some(target => typeof target !== "string")) {
      return { ok: false, clarification: "Mình chưa xác định chắc các ý cần giữ trong yêu cầu. Bạn diễn đạt lại mục tiêu và điều kiện cần áp dụng nhé." };
    }
    const evidence = normalize(rawItem.evidence);
    if (!evidence || !requests.some(request => request.includes(evidence))) {
      return { ok: false, clarification: "Mình chưa đối chiếu được các ý AI trích ra với câu bạn vừa gửi. Bạn nói lại mục tiêu và điều kiện cần áp dụng nhé." };
    }
    // Module names describe routing context. Resolve them from the user's words
    // even when the model omitted a mapping or attached the phrase to a field.
    if (isKnownModuleContextClause(rawItem.evidence)) {
      if (mentionsCompatibleModule(rawItem.evidence, workflow.module)) continue;
      return { ok: false, clarification: `Cụm “${rawItem.evidence.trim().slice(0, 120)}” đang chỉ một phân hệ khác với thao tác “${workflow.title}”. Bạn muốn tra cứu ở phân hệ này hay phân hệ được nêu trong câu?` };
    }
    if (rawItem.unresolved === true || rawItem.mappedTo.length === 0) {
      return { ok: false, clarification: typeof rawItem.clarification === "string" && rawItem.clarification.trim()
        ? rawItem.clarification.trim().slice(0, 500)
        : `Mình chưa rõ cách áp dụng yêu cầu “${rawItem.requirement.trim().slice(0, 160)}”. Bạn làm rõ ý này giúp mình nhé.` };
    }
    for (const target of rawItem.mappedTo as string[]) {
      if (target === "context.module") {
        // “Lao động” can name the records being reported about, rather than the
        // ERP module. The request's worker subject + domain data action resolve
        // the scope even when the planner incorrectly maps that noun as context.
        if (mentionsCompatibleModule(rawItem.evidence, workflow.module) || workerDataRequest) continue;
        return { ok: false, clarification: `Mình chưa xác định được bạn muốn làm việc trong phân hệ nào. Thao tác phù hợp hiện nằm ở ${workflow.title.toLocaleLowerCase("vi")}. Bạn muốn tra cứu ở phân hệ này hay phân hệ khác?` };
      }
      if (/^(?:values\.)?(?:module|moduleName|moduleKey|workspace|area)$/i.test(target)
        && isModuleContextClause(rawItem.evidence, workflow.module)) continue;
      if (target === "action") continue;
      if (target.startsWith("result.")) {
        if (!hasDeclaredResultPath(operation, target.slice("result.".length))) {
          return { ok: false, clarification: `Mình chưa ánh xạ được yêu cầu “${rawItem.requirement.trim().slice(0, 160)}” vào trường kết quả được hỗ trợ.` };
        }
        continue;
      }
      if (target.startsWith("analysis.")) {
        if (!analysisTargetIsRepresented(target, operation, values)) {
          return { ok: false, clarification: `Mình chưa chuyển được yêu cầu “${rawItem.requirement.trim().slice(0, 160)}” thành phép phân tích mà báo cáo hỗ trợ. Bạn làm rõ chỉ tiêu hoặc điều kiện cần dùng nhé.` };
        }
        continue;
      }
      const fieldKey = target.startsWith("values.") ? target.slice("values.".length) : target;
      const parsedPath = structuredPath(target);
      const field = workflow.fields.find(candidate => candidate.key === fieldKey || candidate.apiKey === fieldKey
        || Boolean(candidate.source && candidate.apiKey && `${candidate.source}_${candidate.apiKey}` === fieldKey)
        || Boolean(parsedPath && (candidate.key === parsedPath.root || candidate.apiKey === parsedPath.root)));
      const nestedTarget = Boolean(parsedPath?.segments.length);
      const represented = nestedTarget
        ? Boolean(field?.structure && supportsStructuredPath(field.structure, parsedPath!.segments)
          && structuredPathIsPopulated(values[field.key], field.structure, parsedPath!.segments))
        : Boolean(field && populated(values[field.key]));
      if ((!knownFields.has(target) && !knownFields.has(fieldKey) && !field) || !field || !represented) {
        return { ok: false, clarification: `Mình chưa ánh xạ được yêu cầu “${rawItem.requirement.trim().slice(0, 160)}” vào thông tin cần dùng. Bạn làm rõ ý này giúp mình nhé.` };
      }
    }
  }
  return { ok: true };
}
