import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";
import { reconcileRequestedRanking } from "./list-analysis";
import { assistantModuleContext, isKnownModuleContextClause, isModuleContextClause, mentionsCompatibleModule, matchesModuleContextEvidence, containsModuleContextEvidence } from "./module-context";
import { scopeAssistantWorkflows } from "./module-scope";
import { publicAssistantResultFields } from "./result-field-policy";

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
export function normalizeAssistantCoverageTarget(target: string, operation: AssistantOperation) {
  if (target === 'actionId') return 'action';
  if (operation.analysis && target.startsWith('values.analysis.')) return target.slice('values.'.length);
  return target;
}
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
// Keep Vietnamese tone distinctions: discourse "hả" must not erase "Hà"
// from an omitted location such as Hà Nội.
const DISCOURSE_MARKERS = new Set(['vậy','thế','rồi','hả','à','ạ']);

/** Find meaningful request words that were omitted from the model's quoted evidence. */
export function findUncoveredRequestTerms(text: string, rawCoverage: unknown, workflow?: AssistantWorkflow, values: Record<string, unknown> = {}) {
  const evidence = Array.isArray(rawCoverage)
    ? rawCoverage.flatMap(item => plain(item) && typeof item.evidence === "string" ? [item.evidence] : [])
    : [];
  const coveredWords = new Set(evidence.flatMap(item => normalize(item).split(" ").filter(Boolean)));
  const referenceWords = new Set<string>();
  const valueWords = new Set<string>();
  let content = text;
  if (workflow) {
    for (const field of workflow.fields) {
      if (!populated(values[field.key]) || !Array.isArray(rawCoverage) || !rawCoverage.some(item => plain(item) && Array.isArray(item.mappedTo)
        && item.mappedTo.some(target => [field.key, field.apiKey, `values.${field.key}`, field.apiKey && `values.${field.apiKey}`].includes(target)))) continue;
      // A server-declared form label before ':'/'·' is presentation, not data.
      const label = field.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      content = content.replace(new RegExp(`${label}\\s*(?=[:·])`, 'giu'), ' ');
    }
    const context = assistantModuleContext(workflow.module);
    // Quoted names are record data, never automatic context evidence.
    const request = ` ${normalize(text.replace(/["“][^"”]+["”]/gu, ' '))} `;
    const explicit = scopeAssistantWorkflows(text, [workflow]);
    for (const name of [context.label, ...context.aliases].map(normalize)) {
      if (explicit.modules.length && explicit.workflows.length) {
        const framing = new RegExp(`(?:^| )(?:(?:trong|vao|o|tai|thuoc|phan he|module|muc) ){1,3}${name}(?= |$)`, 'g');
        for (const match of request.matchAll(framing)) for (const word of match[0].trim().split(' ')) coveredWords.add(word);
      }
      const entity = name.replace(/^(?:quan l[yi]|ho so)\s+/, '');
      for (const match of request.matchAll(new RegExp(`(?:^| )${entity} nao(?= |$)`, 'g'))) {
        if (/\b(?:ten|ma)\s*$/.test(request.slice(0, match.index))) continue;
        for (const word of match[0].trim().split(' ')) coveredWords.add(word);
      }
    }
    for (const item of Array.isArray(rawCoverage) ? rawCoverage : []) {
      if (!plain(item) || typeof item.evidence !== 'string' || !Array.isArray(item.mappedTo)) continue;
      if (item.mappedTo.some(target => typeof target === 'string' && workflow.fields.some(field => populated(values[field.key])
        && [field.key, field.apiKey, `values.${field.key}`, field.apiKey && `values.${field.apiKey}`].includes(target)))) {
        for (const word of normalize(item.evidence).split(' ')) valueWords.add(word);
      }
      if (item.mappedTo.some(target => typeof target === 'string' && workflow.fields.some(field => field.reference
        && [field.key, field.apiKey, `values.${field.key}`, field.apiKey && `values.${field.apiKey}`].includes(target)))) {
        for (const word of normalize(item.evidence).split(' ')) referenceWords.add(word);
      }
    }
  }
  return content.split(/\s+/)
    .flatMap(original => normalize(original).split(" ").filter(Boolean).map(word => ({ original: original.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""), word })))
    .filter(({ original, word }, index, words) => {
      if (!original || DISCOURSE_MARKERS.has(original.normalize('NFC').toLocaleLowerCase('vi')) || COVERAGE_STOP_WORDS.has(word) || coveredWords.has(word)) return false;
      // Labels/grammar are dispensable only when their content is still quoted.
      if (word === "ten" && coveredWords.has(words[index + 1]?.word)) return false;
      if (word === 'phan' && coveredWords.has(words[index+1]?.word) && workflow?.fields.some(field => field.type==='json' && populated(values[field.key]) && Array.isArray(rawCoverage) && rawCoverage.some(item=>plain(item) && Array.isArray(item.mappedTo) && item.mappedTo.includes(`values.${field.key}`)))) return false;
      if (word === "chon" && (coveredWords.has(words[index + 1]?.word)
        || words[index + 1]?.word === "ten" && coveredWords.has(words[index + 2]?.word))) return false;
      if (word === "co" && words.slice(index + 1, index + 7).some(item => item.word === "ai" || item.word === "nao")) return false;
      if (word === "trong" && referenceWords.has(words[index + 1]?.word)) return false;
      if (word === "thanh" && words[index - 1]?.word !== 'hoan' && valueWords.has(words[index + 1]?.word)) return false;
      if ((word === "nao" || word === "ai") && coveredWords.has(words[index - 1]?.word)
        && (!words[index + 1] || coveredWords.has(words[index + 1].word))) return false;
      return true;
    })
    .map(({ original }) => original)
    .filter((word, index, words) => words.indexOf(word) === index)
    .slice(0, 12);
}

export function shouldRepairRequestCoverage(text: string, rawCoverage: unknown, clarification: string) {
  if (findUncoveredRequestTerms(text, rawCoverage).length) return true;
  return /chưa (?:được gắn với|được áp dụng vào|ánh xạ được|chuyển được|lấy trường)/iu.test(clarification);
}

function missingCoverageReply(text: string, rawCoverage: unknown, workflow: AssistantWorkflow, values: Record<string, unknown>) {
  const missing = findUncoveredRequestTerms(text, rawCoverage, workflow, values);
  if (!missing.length) return undefined;
  return `Mình chưa đưa đủ chi tiết “${missing.join(" ").slice(0, 160)}” vào kế hoạch tra cứu. Mình chưa gọi API để tránh bỏ sót điều kiện; bạn xác nhận lại giúp mình nhé.`;
}

function requiredMappingKinds(evidence: string, singularCreate = false) {
  const phrase = normalize(evidence);
  // Preserve Vietnamese distinctions before removing accents: chữa is not
  // chưa, and a money quỹ is not a calendar quý.
  const filterPhrase = normalize(evidence.normalize('NFC').replace(/chữa|quỹ/giu, ' '));
  const kinds: Array<"filter" | "ranking"> = [];
  const maximum = /(?:^| )(?:top|nhieu(?: [a-z]+){0,4} nhat|cao nhat|lon nhat|dung dau)(?: |$)/.test(phrase);
  const minimum = /(?:^| )(?:it(?: [a-z]+){1,3} nhat|thap nhat|nho nhat)(?: |$)/.test(phrase);
  const ordering = /(?:^| )(?:sap xep|xep theo|xep hang)(?: |$)/.test(phrase)
    || /(?:^| )(?:giam dan|tang dan)(?: |$)/.test(phrase);
  if (maximum || minimum || ordering) kinds.push("ranking");
  const numericEvidence = singularCreate ? evidence.replace(/(^|\s)(?:tạo|tao|thêm|them|lập|lap|mở|mo)\s+1(?=\s)/giu, "$1") : evidence;
  const hasNumericValue = numericEvidence.split(/\s+/).some(token => /^\d+(?:[.,]\d+)*(?:\/\d{1,4})?$/.test(token))
    || /\b\d{4}-\d{2}-\d{2}\b/.test(evidence);
  const hasLocationContext = /\b(?:o|tai)\s+(?:chi nhanh|phong ban|du an|khu vuc|dia ban|tinh|huyen|quan|phuong|thanh pho|ha noi|ho chi minh|da nang|hai phong|can tho|khu cong nghiep|kcn)\b/.test(phrase);
  if (hasNumericValue
    || /(?:^|\s)(?:tỉnh|huyện|quận|phường)(?=\s|$)/iu.test(evidence.normalize("NFC"))
    || hasLocationContext
    || /(?:^| )(?:khong|chua|da|dang|thang|quy|nam|ngay|tuan|gio|phut|hom nay|hom qua|khu vuc|dia ban|tren|duoi|vuot|bang|trang thai|hoan thanh|cham tien do|dung han|qua han)(?: |$)/.test(filterPhrase)) kinds.push("filter");
  return kinds;
}

function requiredMappingMissing(evidence: string, targets: string[], composite = false, rankingCoveredByAction = false, singularCreate = false) {
  const mappings = targets.flatMap(target => {
    if (!composite) return [target];
    if (!target.startsWith("query:")) return [];
    const separator = target.indexOf(":", "query:".length);
    return separator < 0 ? [] : [target.slice(separator + 1)];
  });
  const kinds = requiredMappingKinds(evidence, singularCreate);
  if (kinds.includes("ranking") && !rankingCoveredByAction && !mappings.some(mapping => mapping.startsWith("analysis.extreme.")
    || mapping.startsWith("analysis.sort.") || mapping.startsWith("analysis.limit"))) return "ranking";
  if (kinds.includes("filter") && !mappings.some(mapping => mapping.startsWith("values.")
    || mapping.startsWith("analysis.filters."))) return "filter";
  return undefined;
}

/** Redundant context in a combined span must not invalidate otherwise valid
 * action/reference mappings. Conditional spans still need separate evidence. */
export function combinedModuleContextIsValid(evidence: string, module: string, targets: string[], singularCreate = false) {
  return targets.some(target => target !== "context.module" && target !== "action")
    && requiredMappingKinds(evidence, singularCreate).length === 0
    && containsModuleContextEvidence(evidence, module);
}

function actionEncodesEvidence(evidence: string, workflow: AssistantWorkflow, operation: AssistantOperation) {
  const phrase = normalize(evidence);
  if (!phrase) return false;
  const positiveDescriptions = [operation.description, workflow.description]
    .flatMap(description => description.split(/[.!?;]+/))
    .filter(clause => {
      const phrase = normalize(clause);
      // A terminal polar-question marker in a read capability describes what
      // its report answers; it is not a negative filter such as "chưa có".
      const meaning = operation.method==='GET' || operation.readOnly ? phrase.replace(/ khong$/, '') : phrase;
      return !/(?:^| )(?:khong|chua|not|except|unless)(?: |$)/.test(meaning);
    });
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
  if(operation.id==='student.list' && normalize(String(values.status||''))==='no hoc phi' && !/\b(?:trang thai|nhan ho so)\b/.test(request)) {
    return {ok:false,clarification:'Nhãn trạng thái hồ sơ không xác định số tiền còn nợ học phí. Cần đối chiếu học phí và phiếu thu đầy đủ; nếu muốn giới hạn kỳ hoặc phạm vi, bạn làm rõ giúp mình. Chưa thể kết luận không có học viên nợ tiền.'};
  }
  const explicit = scopeAssistantWorkflows(text, [workflow]);
  if (explicit.modules.length && !explicit.workflows.length) {
    return { ok: false, clarification: "Thao tác đang chọn thuộc phân hệ khác với phân hệ bạn nêu. Bạn xác nhận lại phân hệ cần xử lý nhé." };
  }
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
    const normalizeTarget = (target: string) => {
      target = normalizeAssistantCoverageTarget(target, operation);
      const prefix = `query:${operation.id}:`;
      if (operation.method !== 'GET' || !target.startsWith(prefix)) return target;
      const mapping = normalizeAssistantCoverageTarget(target.slice(prefix.length), operation);
      if (mapping === 'source') return 'action';
      if (mapping.startsWith('result.') && operation.resultFields.includes(mapping.slice(7))
        && publicAssistantResultFields(operation).includes(mapping.slice(7))) return 'action';
      if (mapping.startsWith('values.') || mapping.startsWith('analysis.')) return mapping;
      return target;
    };
    const mappedTargets = [...new Set([
      ...(rawItem.mappedTo as string[]).map(normalizeTarget),
      ...reconciledRankingMappingTargets(rawItem.evidence, operation, values),
    ])];
    const actionCapturesEvidence = mappedTargets.includes("action") && actionEncodesEvidence(rawItem.evidence, workflow, operation);
    const actionCapturesRanking = mappedTargets.includes("action") && actionEncodesRanking(rawItem.evidence, operation);
    const singularCreate = operation.assistantMetadata?.intent === "create" && mappedTargets.includes("action");
    const missingKind = requiredMappingMissing(rawItem.evidence, mappedTargets, false, actionCapturesRanking, singularCreate);
    if (missingKind && !actionCapturesEvidence) return { ok: false, clarification: missingKind === "ranking"
      ? `Tiêu chí xếp hạng “${rawItem.evidence.trim().slice(0, 120)}” chưa được gắn với phép xếp hạng cụ thể. Mình chưa gọi API.`
      : `Điều kiện “${rawItem.evidence.trim().slice(0, 120)}” chưa được gắn với trường lọc. Mình chưa gọi API.` };
    for (const target of mappedTargets) {
      if (target === "context.module") {
        // The model may map a short evidence span (for example "dự án") to
        // the module while the module name appears elsewhere in the same user
        // request (for example "...dự án cho nhân sự"). Validate against the
        // complete request so a clipped evidence span does not lose context.
        if (matchesModuleContextEvidence(rawItem.evidence, workflow.module, text)
          || combinedModuleContextIsValid(rawItem.evidence, workflow.module, mappedTargets, singularCreate)
          || mappedTargets.includes('action') && requiredMappingKinds(rawItem.evidence, singularCreate).length === 0
            && (explicit.modules.length > 0 || rawItem.evidence.split(/[,;:\n]/).some(clause => isModuleContextClause(clause, workflow.module)))) continue;
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
  const missingCoverage = missingCoverageReply(text, raw, workflow, values);
  if (missingCoverage) return { ok: false, clarification: missingCoverage };
  return { ok: true };
}

export function requiredCompositeMappingIsMissing(evidence: string, targets: string[]) {
  return requiredMappingMissing(evidence, targets, true);
}
