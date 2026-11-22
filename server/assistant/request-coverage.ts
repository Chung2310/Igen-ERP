import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";
import { reconcileRequestedRanking } from "./list-analysis";
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
function hasDeclaredCurrentMonthDefault(workflow: AssistantWorkflow, fieldKey: string, evidence: string) {
  const field = workflow.fields.find(candidate => candidate.key === fieldKey);
  return field?.apiKey === "periodAnchor"
    && /khong neu thang dung thang hien tai/.test(normalize(workflow.description))
    && /(?:^| )thang(?: |$)/.test(normalize(evidence))
    && !/\d/.test(evidence);
}
const COVERAGE_STOP_WORDS = new Set(normalize(`
  bạn chúng tôi mình ta anh chị em quý vui lòng xin nhờ giúp dùm với nhé nha đi
  cho biết là của và hoặc hay thì mà về các những
`).split(" "));

/** Find meaningful request words that were omitted from the model's quoted evidence. */
export function findUncoveredRequestTerms(text: string, rawCoverage: unknown) {
  const evidence = Array.isArray(rawCoverage)
    ? rawCoverage.flatMap(item => plain(item) && typeof item.evidence === "string" ? [item.evidence] : [])
    : [];
  const coveredWords = new Set(evidence.flatMap(item => normalize(item).split(" ").filter(Boolean)));
  return text.split(/\s+/)
    .flatMap(original => normalize(original).split(" ").filter(Boolean).map(word => ({ original: original.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""), word })))
    .filter(({ original, word }) => original && !COVERAGE_STOP_WORDS.has(word) && !coveredWords.has(word))
    .map(({ original }) => original)
    .filter((word, index, words) => words.indexOf(word) === index)
    .slice(0, 12);
}

export function shouldRepairRequestCoverage(text: string, rawCoverage: unknown, clarification: string) {
  if (findUncoveredRequestTerms(text, rawCoverage).length) return true;
  return /chưa (?:được gắn với|được áp dụng vào|ánh xạ được|chuyển được|lấy trường)/iu.test(clarification);
}

function missingCoverageReply(text: string, rawCoverage: unknown) {
  const missing = findUncoveredRequestTerms(text, rawCoverage);
  if (!missing.length) return undefined;
  return `Mình chưa đưa đủ chi tiết “${missing.join(" ").slice(0, 160)}” vào kế hoạch tra cứu. Mình chưa gọi API để tránh bỏ sót điều kiện; bạn xác nhận lại giúp mình nhé.`;
}

function requiredMappingKinds(evidence: string) {
  const phrase = normalize(evidence);
  const kinds: Array<"filter" | "ranking"> = [];
  const maximum = /(?:^| )(?:top|nhieu(?: [a-z]+){0,4} nhat|cao nhat|lon nhat|dung dau)(?: |$)/.test(phrase);
  const minimum = /(?:^| )(?:it(?: [a-z]+){1,3} nhat|thap nhat|nho nhat)(?: |$)/.test(phrase);
  const ordering = /(?:^| )(?:sap xep|xep theo|xep hang)(?: |$)/.test(phrase)
    || /(?:^| )(?:giam dan|tang dan)(?: |$)/.test(phrase);
  if (maximum || minimum || ordering) kinds.push("ranking");
  const hasNumericValue = evidence.split(/\s+/).some(token => /^\d+(?:[.,]\d+)*(?:\/\d{1,4})?$/.test(token))
    || /\b\d{4}-\d{2}-\d{2}\b/.test(evidence);
  const hasLocationContext = /\b(?:o|tai)\s+(?:chi nhanh|phong ban|du an|khu vuc|dia ban|tinh|huyen|quan|phuong|thanh pho|ha noi|ho chi minh|da nang|hai phong|can tho|khu cong nghiep|kcn)\b/.test(phrase);
  if (hasNumericValue
    || /phường/iu.test(evidence)
    || hasLocationContext
    || /(?:^| )(?:khong|chua|da|dang|thang|quy|nam|ngay|tuan|gio|phut|hom nay|hom qua|khu vuc|dia ban|tinh|huyen|quan|tren|duoi|vuot|bang|trang thai|hoan thanh|cham tien do|dung han|qua han)(?: |$)/.test(phrase)) kinds.push("filter");
  return kinds;
}

function requiredMappingMissing(evidence: string, targets: string[], composite = false, rankingCoveredByAction = false) {
  const mappings = targets.flatMap(target => {
    if (!composite) return [target];
    if (!target.startsWith("query:")) return [];
    const separator = target.indexOf(":", "query:".length);
    return separator < 0 ? [] : [target.slice(separator + 1)];
  });
  const kinds = requiredMappingKinds(evidence);
  if (kinds.includes("ranking") && !rankingCoveredByAction && !mappings.some(mapping => mapping.startsWith("analysis.extreme.")
    || mapping.startsWith("analysis.sort.") || mapping.startsWith("analysis.limit"))) return "ranking";
  if (kinds.includes("filter") && !mappings.some(mapping => mapping.startsWith("values.")
    || mapping.startsWith("analysis.filters."))) return "filter";
  return undefined;
}

function actionEncodesEvidence(evidence: string, workflow: AssistantWorkflow, operation: AssistantOperation) {
  const phrase = normalize(evidence);
  if (!phrase) return false;
  const positiveDescriptions = [operation.description, workflow.description]
    .flatMap(description => description.split(/[.!?;]+/))
    .filter(clause => !/(?:^| )(?:khong|chua|not|except|unless)(?: |$)/.test(normalize(clause)));
  const actionDescription = normalize(`${operation.id.replaceAll(".", " ")} ${operation.title} ${workflow.title} ${positiveDescriptions.join(" ")}`);
  return actionDescription.includes(phrase);
}

function actionEncodesRanking(evidence: string, operation: AssistantOperation) {
  const request = normalize(evidence);
  const id = normalize(operation.id.replaceAll(".", " "));
  const action = normalize(`${operation.title} ${operation.description}`);
  const hasBuiltInRanking = /(?:^| )(?:most|nhieu nhat|cao nhat|sap xep)(?: |$)/.test(`${id} ${action}`);
  if (!hasBuiltInRanking) return false;
  if (id.includes("most late")) return /(?:^| )(?:tre|muon|late)(?: |$)/.test(request);
  if (id.includes("most absent")) return /(?:^| )(?:vang|nghi|absent)(?: |$)/.test(request);
  if (id.includes("most leave")) return /(?:^| )(?:nghi phep|leave)(?: |$)/.test(request);
  return false;
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

/** Add a server-verified ranking target when the request and the applied
 * analysis plan agree, even if the model's coverage map only named the action. */
export function reconciledRankingMappingTargets(evidence: string, operation: AssistantOperation, values: Record<string, unknown>) {
  if (!operation.analysis || !requiredMappingKinds(evidence).includes("ranking")) return [];
  const reconciled = reconcileRequestedRanking(evidence, operation.analysis, values.analysis);
  if (reconciled.kind !== "resolved") return [];
  const actual = parsedAnalysis(values.analysis);
  if (!actual) return [];
  const targets: string[] = [];
  for (const kind of ["extreme", "sort"] as const) {
    const expected = reconciled.analysis[kind];
    const applied = actual[kind];
    if (!expected || !plain(applied) || applied.field !== expected.field || applied.direction !== expected.direction
      || !operation.analysis.fields[expected.field]) continue;
    targets.push(`analysis.${kind}.${expected.field}`);
  }
  return targets;
}

/** Fail closed when the model cannot account for each stated requirement using
 * the selected operation's declared fields or analysis contract. */
export function validateRequestCoverage(
  text: string,
  raw: unknown,
  workflow: AssistantWorkflow,
  operation: AssistantOperation,
  values: Record<string, unknown>,
): { ok: true } | { ok: false; clarification: string } {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) {
    return { ok: false, clarification: "Mình chưa đối chiếu được đầy đủ yêu cầu với các trường của thao tác. Bạn nói rõ hơn mục tiêu và điều kiện cần áp dụng nhé." };
  }
  const request = normalize(text);
  const knownFields = new Set(workflow.fields.flatMap(field => [field.key, field.apiKey, field.source && field.apiKey ? `${field.source}_${field.apiKey}` : undefined].filter((value): value is string => Boolean(value))));
  for (const rawItem of raw) {
    if (!plain(rawItem) || typeof rawItem.evidence !== "string" || !rawItem.evidence.trim()
      || typeof rawItem.requirement !== "string" || !rawItem.requirement.trim()
      || !Array.isArray(rawItem.mappedTo) || rawItem.mappedTo.some(target => typeof target !== "string")) {
      return { ok: false, clarification: "Mình chưa xác định chắc các ý cần giữ trong yêu cầu. Bạn diễn đạt lại mục tiêu và điều kiện cần áp dụng nhé." };
    }
    const evidence = normalize(rawItem.evidence);
    if (!evidence || !request.includes(evidence)) {
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
    const mappedTargets = [...new Set([
      ...(rawItem.mappedTo as string[]),
      ...reconciledRankingMappingTargets(rawItem.evidence, operation, values),
    ])];
    const actionCapturesEvidence = mappedTargets.includes("action") && actionEncodesEvidence(rawItem.evidence, workflow, operation);
    const actionCapturesRanking = mappedTargets.includes("action") && actionEncodesRanking(rawItem.evidence, operation);
    const missingKind = requiredMappingMissing(rawItem.evidence, mappedTargets, false, actionCapturesRanking);
    if (missingKind && !actionCapturesEvidence) return { ok: false, clarification: missingKind === "ranking"
      ? `Tiêu chí xếp hạng “${rawItem.evidence.trim().slice(0, 120)}” chưa được gắn với phép xếp hạng cụ thể. Mình chưa gọi API.`
      : `Điều kiện “${rawItem.evidence.trim().slice(0, 120)}” chưa được gắn với trường lọc. Mình chưa gọi API.` };
    for (const target of mappedTargets) {
      if (target === "context.module") {
        if (mentionsCompatibleModule(rawItem.evidence, workflow.module)) continue;
        return { ok: false, clarification: `Mình chưa xác định được bạn muốn làm việc trong phân hệ nào. Thao tác phù hợp hiện nằm ở ${workflow.title.toLocaleLowerCase("vi")}. Bạn muốn tra cứu ở phân hệ này hay phân hệ khác?` };
      }
      if (/^(?:values\.)?(?:module|moduleName|moduleKey|workspace|area)$/i.test(target)
        && isModuleContextClause(rawItem.evidence, workflow.module)) continue;
      if (target === "action") continue;
      if (target.startsWith("analysis.")) {
        if (!analysisTargetIsRepresented(target, operation, values)) {
          return { ok: false, clarification: `Mình chưa chuyển được yêu cầu “${rawItem.requirement.trim().slice(0, 160)}” thành phép phân tích mà báo cáo hỗ trợ. Bạn làm rõ chỉ tiêu hoặc điều kiện cần dùng nhé.` };
        }
        continue;
      }
      const fieldKey = target.startsWith("values.") ? target.slice("values.".length) : target;
      const field = workflow.fields.find(candidate => candidate.key === fieldKey || candidate.apiKey === fieldKey
        || Boolean(candidate.source && candidate.apiKey && `${candidate.source}_${candidate.apiKey}` === fieldKey));
      const suppliedOrDefaulted = field && (populated(values[field.key]) || hasDeclaredCurrentMonthDefault(workflow, field.key, rawItem.evidence));
      if ((!knownFields.has(target) && !knownFields.has(fieldKey)) || !field || !suppliedOrDefaulted) {
        return { ok: false, clarification: `Mình chưa ánh xạ được yêu cầu “${rawItem.requirement.trim().slice(0, 160)}” vào thông tin cần dùng. Bạn làm rõ ý này giúp mình nhé.` };
      }
    }
  }
  const missingCoverage = missingCoverageReply(text, raw);
  if (missingCoverage) return { ok: false, clarification: missingCoverage };
  return { ok: true };
}

export function requiredCompositeMappingIsMissing(evidence: string, targets: string[]) {
  return requiredMappingMissing(evidence, targets, true);
}
