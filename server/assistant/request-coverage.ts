import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";
import { reconcileRequestedRanking, validateListAnalysis, analysisMappingIsRepresented } from "./list-analysis";
import { assistantModuleContext, isKnownModuleContextClause, isModuleContextClause, mentionsCompatibleModule, matchesModuleContextEvidence, containsModuleContextEvidence } from "./module-context";
import { scopeAssistantWorkflows } from "./module-scope";
import { publicAssistantResultFields, publicAssistantResultTarget } from "./result-field-policy";
import { assistantRequestReason, canonicalActionEvidence, isFieldClearEvidence, stripRequestFraming, isCompletionQuestionParticle } from './request-framing';

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
const currentScopePhrases=new Set(['trung tam','cong ty','doanh nghiep','don vi','chi nhanh hien tai','chi nhanh dang chon']);
export function normalizeAssistantCoverageTarget(target: string, operation: AssistantOperation) {
  if (target === 'actionId') return 'action';
  if (operation.analysis && target.startsWith('values.analysis.')) target = target.slice('values.'.length);
  if (operation.analysis) target = target.replace(/^analysis\.aggregates(?=\.|$)/,'analysis.aggregate');
  if (operation.analysis) target = target.replace(/^analysis\.aggregate\.(?:field|operation)$/,'analysis.aggregate');
  if (operation.method === 'GET' || operation.readOnly) {
    const local = target.startsWith(`query:${operation.id}:`) ? target.slice(`query:${operation.id}:`.length)
      : target.startsWith(`${operation.id}:`) ? target.slice(`${operation.id}:`.length) : target;
    if (local === 'source') return 'action';
    if (local.startsWith('result.') && publicAssistantResultTarget(operation, local.slice(7))) return 'action';
    if (local !== target && (local.startsWith('values.') || local.startsWith('analysis.'))) return local;
  }
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

function stripCoveredValueQuestion(text: string, coverage: unknown, operation?: AssistantOperation, values: Record<string, unknown> = {}) {
  if (!operation || !(operation.method === 'GET' || operation.readOnly) || !Array.isArray(coverage)) return text;
  const numericOutputs = publicAssistantResultFields(operation).filter(key => /(?:Price|Amount|Count|Quantity)$/.test(key)
    || ['count', 'total', 'balance', 'fee', 'salary', 'amount', 'quantity'].includes(key));
  const asksValue = coverage.some(item => plain(item) && Array.isArray(item.mappedTo)
    && item.mappedTo.some(target => typeof target === 'string' && numericOutputs.some(key => target === `result.${key}` || target === `query:${operation.id}:result.${key}`)));
  const declaredOutput = coverage.some(item => plain(item) && typeof item.evidence === 'string' && readOutputCapturesEvidence(item.evidence,text,operation,values));
  const plan=operation.analysis && parsedAnalysis(values.analysis);
  const aggregatedValue=Boolean(plan && (plan.aggregate || plan.aggregates));
  return asksValue || declaredOutput || aggregatedValue ? text.replace(/\s+(?:hiện\s+)?(?:là\s+)?bao\s+nhiêu[?!.]*\s*$/iu, '') : text;
}

/** Find meaningful request words that were omitted from the model's quoted evidence. */
export function findUncoveredRequestTerms(text: string, rawCoverage: unknown, workflow?: AssistantWorkflow, values: Record<string, unknown> = {}, operation?: AssistantOperation) {
  const evidence = Array.isArray(rawCoverage)
    ? rawCoverage.flatMap(item => plain(item) && typeof item.evidence === "string" ? [item.evidence] : [])
    : [];
  const coveredWords = new Set(evidence.flatMap(item => normalize(item).split(" ").filter(Boolean)));
  const referenceWords = new Set<string>();
  const valueWords = new Set<string>();
  let content = stripRequestFraming(stripCoveredValueQuestion(text, rawCoverage, operation, values));
  if (operation?.analysis && reconciledRankingMappingTargets(text,operation,values).length) {
    // Present-tense connectors before an already verified metric are grammar,
    // unlike a state predicate such as “đang hoạt động”.
    content = content.replace(/\bmang\s+về\s+(?=(?:tổng\s+)?doanh\s+số|(?:tổng\s+)?học\s+phí)/giu,'')
      .replace(/đang\s+có\s+(?=(?:số\s+)?tiền\s+hoa\s+hồng)/giu,'');
  }
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
    const rowLabels=operation?.analysis ? Object.entries(operation.analysis.fields).filter(([key])=>key==='name'||key.endsWith('Name')).map(([,field])=>field.label) : [];
    for (const name of [context.label, ...context.aliases,...rowLabels].map(normalize)) {
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
      if (word === 'co' && /(?:nào\s+không|hay\s+không)[?!.]*\s*$/iu.test(text)) return false;
      // A connector can be omitted only when the following predicate is
      // evidenced and mapped to an actual supplied filter. Do not globally
      // discard “có”: it distinguishes existence from missing-record reports.
      const nextPhrase = words.slice(index + 1, index + 3).map(item => item.word).join(' ');
      const objectOfLookup = nextPhrase && workflow && ` ${normalize(workflow.title)} `.includes(` ${nextPhrase} `);
      const analyzedProperty = operation?.analysis && Object.entries(operation.analysis.fields).some(([key,definition]) => {
        if (!normalize(definition.label).startsWith(words[index+1]?.word || '!')) return false;
        const plan=parsedAnalysis(values.analysis);
        return plan?.filters?.some((filter:any)=>filter.field===key) && Array.isArray(rawCoverage) && rawCoverage.some(item=>plain(item)
          && typeof item.evidence==='string' && normalize(item.evidence).includes(words[index+1]?.word || '!') && Array.isArray(item.mappedTo)
          && item.mappedTo.some(target=>typeof target==='string' && normalizeAssistantCoverageTarget(target,operation)===`analysis.filters.${key}`));
      });
      if (word==='co' && analyzedProperty && !['khong','chua'].includes(words[index-1]?.word)) return false;
      const aggregatePlan=operation?.analysis && parsedAnalysis(values.analysis);
      if(aggregatePlan && (aggregatePlan.aggregate || aggregatePlan.aggregates)){
        if(word==='mang' && words[index+1]?.word==='ve')return false;
        if(word==='do' && words[index+1]?.word==='tat' && words[index+2]?.word==='ca')return false;
      }
      if ((word === 'theo' || word === 'co' && objectOfLookup) && valueWords.has(words[index + 1]?.word)
        && !['khong', 'chua'].includes(words[index - 1]?.word)) return false;
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
  return /chưa (?:được gắn với|được áp dụng vào|ánh xạ được|chuyển được|lấy trường|xác định được bạn muốn làm việc trong phân hệ|đối chiếu được các ý AI trích ra)/iu.test(clarification);
}

function missingCoverageReply(text: string, rawCoverage: unknown, workflow: AssistantWorkflow, values: Record<string, unknown>, operation: AssistantOperation) {
  const missing = findUncoveredRequestTerms(text, rawCoverage, workflow, values, operation);
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
  const temporalPhrase=phrase.replace(/\b(?:thang|tuan|quy|nam)\s+(?:gan nhat|moi nhat)\b/g,'');
  const temporalRanking=/\b(?:gan nhat|moi nhat|cuoi cung|lan cuoi|dau tien|som nhat|cu nhat)\b/.test(temporalPhrase);
  if (maximum || minimum || ordering || temporalRanking) kinds.push("ranking");
  let numericEvidence = singularCreate ? evidence.replace(/(^|\s)(?:tạo|tao|thêm|them|lập|lap|mở|mo)\s+1(?=\s)/giu, "$1") : evidence;
  numericEvidence = numericEvidence.replace(/\btop\s+\d+\b/giu,'');
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
    || mapping.startsWith("analysis.filters.") || mapping.startsWith("analysis.having."))) return "filter";
  return undefined;
}

/** Redundant context in a combined span must not invalidate otherwise valid
 * action/reference mappings. Conditional spans still need separate evidence. */
export function combinedModuleContextIsValid(evidence: string, module: string, targets: string[], singularCreate = false) {
  return targets.some(target => target !== "context.module" && target !== "action")
    && requiredMappingKinds(evidence, singularCreate).length === 0
    && containsModuleContextEvidence(evidence, module);
}

function actionEncodesEvidence(evidence: string, workflow: Pick<AssistantWorkflow,'title'|'description'>, operation: AssistantOperation) {
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
  const descriptions = [operation.title, workflow.title, ...positiveDescriptions, ...(operation.coverageAliases || [])];
  const contains = (capability: string, phrase: string) => {
    const index = ` ${capability} `.indexOf(` ${phrase} `);
    if (index < 0) return false;
    // A positive predicate isn't supplied by the matching words inside a
    // negative capability, e.g. "có hợp đồng" in "chưa có hợp đồng".
    return !/(?:^| )(?:khong|chua)(?: co|duoc|ghi nhan)? $/.test(` ${capability} `.slice(0, index + 1));
  };
  if (descriptions.some(description => contains(normalize(description), phrase))) return true;
  const meaning = canonicalActionEvidence(evidence, operation);
  return Boolean(meaning) && descriptions.some(description => {
    const capability = canonicalActionEvidence(description, operation);
    return contains(capability, meaning);
  });
}

/** Reconcile formatting/omitted action words against the actual selected
 * capability. Values and unsupported predicates are never supplied here. */
function reconcileCoverage(text: string, raw: unknown[], workflow: AssistantWorkflow, operation: AssistantOperation, values: Record<string, unknown>) {
  const reason = assistantRequestReason(text, operation, values);
  const result = raw.map(item => {
    if (!plain(item) || typeof item.evidence !== 'string' || !Array.isArray(item.mappedTo)) return item;
    const targets = item.mappedTo.map(target => typeof target === 'string' ? normalizeAssistantCoverageTarget(target, operation) : target);
    if(operation.method==='GET' && currentScopePhrases.has(normalize(item.evidence))) return {...item,mappedTo:['context.scope'],unresolved:false};
    const readOutputs = item.mappedTo.flatMap(target => {
      if (typeof target !== 'string') return [];
      const field=target.replace(new RegExp(`^query:${operation.id.replaceAll('.','\\.')}:`),'').replace(/^result\./,'');
      return target.includes('result.') && publicAssistantResultFields(operation).includes(field) ? [field] : [];
    });
    if (reason && [normalize(reason.evidence), normalize(reason.reason)].includes(normalize(item.evidence))) {
      return { ...item, mappedTo: ['context.reason'], unresolved: false };
    }
    if ((!targets.length || item.unresolved === true) && actionEncodesEvidence(item.evidence, workflow, operation)) {
      return { ...item, mappedTo: [...new Set([...targets, 'action'])], unresolved: false };
    }
    // A business function ("đào tạo nội bộ") isn't a module filter. Correct
    // this annotation only when the selected capability itself states it.
    if (targets.includes('context.module') && !isKnownModuleContextClause(item.evidence)
      && actionEncodesEvidence(item.evidence, workflow, operation)) {
      return { ...item, mappedTo: [...new Set(targets.map(target => target === 'context.module' ? 'action' : target))] };
    }
    return { ...item, mappedTo: targets, readOutputs };
  });
  if (reason) result.push({ evidence: reason.evidence, requirement: 'Lý do người dùng nêu, không phải điều kiện thực thi', mappedTo: ['context.reason'] });
  const source = stripRequestFraming(text).normalize('NFC');
  const words = [...source.matchAll(/[\p{L}\p{M}\p{N}]+/gu)].map(match => ({ word: normalize(match[0]), start: match.index!, end: match.index! + match[0].length }));
  // Restore only exact, reviewed context/output phrases. The selected columns
  // must actually answer them; additional conditions still need their mappings.
  const quoted=[...source.matchAll(/["“][^"”]*["”]/gu)].map(match=>[match.index!,match.index!+match[0].length]);
  const addPhrase=(phrase:string,target:string)=>{
    const terms=normalize(phrase).split(' ');
    for(let i=0;i<=words.length-terms.length;i++){
      if(!terms.every((term,n)=>term===words[i+n].word)||quoted.some(([start,end])=>words[i].start>=start&&words[i].start<end)||['ten','ma','chu'].includes(words[i-1]?.word))continue;
      result.push({evidence:source.slice(words[i].start,words[i+terms.length-1].end),requirement:'Ngữ cảnh hoặc cột trả lời đã được đối chiếu',mappedTo:[target]});
    }
  };
  if(operation.method==='GET') {
    for(const phrase of currentScopePhrases) {
      if(Object.values(values).some(value=>typeof value==='string'&&normalize(value).includes(phrase)))continue;
      addPhrase(phrase,'context.scope');
    }
    const context=assistantModuleContext(workflow.module);
    for(const alias of [context.label,...context.aliases]){
      if(!isKnownModuleContextClause(alias)||!mentionsCompatibleModule(alias,workflow.module)||Object.values(values).some(value=>typeof value==='string'&&normalize(value).includes(normalize(alias))))continue;
      addPhrase(alias,'context.module');
    }
    const plan=parsedAnalysis(values.analysis);
    if(operation.analysis && plan && !plan.aggregate && !plan.aggregates)for(const [key,field] of Object.entries(operation.analysis.fields)){
      if(!(plan.select||operation.analysis.displayFields||Object.keys(operation.analysis.fields)).includes(key))continue;
      for(const alias of field.answerAliases || [])addPhrase(alias,plan.select?.includes(key)?`analysis.select.${key}`:'action');
    }
  }
  const rankingTargets=reconciledRankingMappingTargets(text,operation,values);
  if(rankingTargets.length) for(const match of source.matchAll(/xếp\s+hạng/giu)) result.push({evidence:match[0],requirement:'Xếp hạng đã được đối chiếu với chỉ tiêu',mappedTo:rankingTargets});
  const createdFrom=operation.fields.find(field => (field.apiKey || field.key)==='createdFrom'),createdTo=operation.fields.find(field => (field.apiKey || field.key)==='createdTo');
  if (operation.method==='GET' && createdFrom && createdTo && populated(values[createdFrom.key]) && populated(values[createdTo.key])) {
    for(const match of source.matchAll(/có\s+thêm/giu)) result.push({evidence:match[0],requirement:'Hồ sơ tạo mới trong kỳ đã chọn',mappedTo:[`values.${createdFrom.key}`,`values.${createdTo.key}`]});
  }
  if (operation.analysis) {
    let plan;
    try { plan = validateListAnalysis(values.analysis,operation.analysis); } catch { /* Invalid plans remain rejected. */ }
    for (const [field,definition] of Object.entries(operation.analysis.fields)) for (const predicate of definition.predicates || []) {
      if (!plan?.filters?.some(filter => filter.field===field && filter.operator===predicate.operator && filter.value===predicate.value)) continue;
      for (const alias of predicate.aliases) {
        const phrase=normalize(alias).split(' ');
        for(let i=0;i<=words.length-phrase.length;i++) if(phrase.every((word,offset)=>word===words[i+offset].word)) result.push({evidence:source.slice(words[i].start,words[i+phrase.length-1].end),requirement:'Điều kiện đã được máy chủ đối chiếu',mappedTo:[`analysis.filters.${field}`]});
      }
    }
  }
  const covered = words.map(() => false);
  for (const item of result) {
    if (!plain(item) || typeof item.evidence !== 'string') continue;
    const evidence = normalize(item.evidence).split(' ');
    for (let i = 0; i <= words.length - evidence.length; i++) {
      if (evidence.every((word, offset) => word === words[i + offset].word)) evidence.forEach((_, offset) => { covered[i + offset] = true; });
    }
  }
  // Only a whole contiguous gap matching an authoritative capability phrase
  // can be restored. A missing part of a name or an extra filter cannot match.
  for (let start = 0; start < words.length; start++) {
    if (covered[start]) continue;
    let end = start;
    while (end + 1 < words.length && !covered[end + 1]) end++;
    let first=start,last=end;
    if(!quoted.some(([a,b])=>words[first].start<b&&words[last].end>a)&&!['ten','ma'].includes(words[first-1]?.word)){
      while(first<last&&COVERAGE_STOP_WORDS.has(words[first].word))first++;
      while(last>first&&COVERAGE_STOP_WORDS.has(words[last].word))last--;
    }
    const evidence = source.slice(words[first].start, words[last].end);
    if (actionEncodesEvidence(evidence, workflow, operation)) result.push({ evidence, requirement: 'Mục tiêu đã được thao tác khai báo hỗ trợ', mappedTo: ['action'] });
    start = end;
  }
  return result;
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
  return Boolean(operation.analysis && analysisMappingIsRepresented(target,operation.analysis,values.analysis));
}

/** Output labels describe the value being requested, not an extra state filter.
 * Only exact declared aliases in a single-record value question qualify. */
function readOutputCapturesEvidence(evidence: string, text: string, operation: AssistantOperation, values: Record<string, unknown>) {
  if (operation.method==='GET' && operation.resultFields.includes('isActive')
    && operation.fields.some(field=>field.reference && field.source==='path' && populated(values[field.key]))
    && /^(?:hien(?: tai)? )?(?:dang )?hoat dong hay (?:da )?tam dung$/.test(normalize(evidence))) return true;
  if (!operation.analysis || operation.method !== 'GET') return false;
  const plan=parsedAnalysis(values.analysis),aggregates=plan?.aggregates || (plan?.aggregate?[plan.aggregate]:[]);
  if(plan && !aggregates.length && Object.entries(operation.analysis.fields).some(([key,field])=>
    (plan.select||operation.analysis!.displayFields||Object.keys(operation.analysis!.fields)).includes(key)
    && field.answerAliases?.some(alias=>normalize(alias)===normalize(evidence))))return true;
  const singleValue=/\bbao nhieu\b/.test(normalize(text)) && operation.fields.some(field => (field.key === 'search' || field.reference && field.apiKey !== 'branchId') && populated(values[field.key]));
  let phrase = normalize(evidence);
  const context=assistantModuleContext(operation.module);
  for(const name of [context.label,...context.aliases].map(normalize)) phrase=phrase.replace(new RegExp(`^(?:(?:cac|nhung) )?${name} `),'');
  if (/\d|\b(?:khong|chua|tren|duoi|hon|thang|ngay|tuan|truoc|sau|chi khi)\b/.test(phrase)) return false;
  const asksAggregateValue=/\b(?:tong|trung binh|bao nhieu)\b/.test(normalize(text)) && !/^(?:loc|danh sach|nhung|doi tac nao)\b/.test(normalize(text));
  if(asksAggregateValue)for(const aggregate of aggregates){
    const field=operation.analysis.fields[aggregate.field];
    if(!field||aggregate.operation!==(/\btrung binh\b/.test(phrase)?'avg':'sum'))continue;
    for(const alias of [field.label.replace(/\([^)]*\)/g,''),...(field.aliases||[])]){
      const normalized=normalize(alias);
      if(!normalized||!` ${phrase} `.includes(` ${normalized} `))continue;
      const rest=` ${phrase} `.replace(` ${normalized} `,' ').replace(/\b(?:tong cong|tong so|bao nhieu|tong|trung binh|da)\b/g,' ').replace(/\s+/g,' ').trim();
      if(!rest||actionEncodesEvidence(rest,operation,operation))return true;
    }
  }
  return Object.entries(operation.analysis.fields).some(([key,field]) => (singleValue && (!plan?.select || plan.select.includes(key)) || asksAggregateValue && aggregates.some((a:any)=>a.field===key && a.operation!=='count'))
    && [field.label.replace(/\([^)]*\)/g,'').replace(/lũy kế/giu,''), ...(field.aliases || [])].some(alias => normalize(alias) === phrase || aggregates.some((a:any)=>a.field===key && a.operation==='sum') && normalize(alias)===phrase.replace(/^tong /,'')));
}

function groupedEnumQuestion(evidence: string, operation: AssistantOperation, values: Record<string,unknown>, targets: string[]) {
  const plan=parsedAnalysis(values.analysis),definition=operation.analysis?.fields[plan?.groupBy];
  if (!definition || !targets.some(t=>t.startsWith('analysis.groupBy.')) || !targets.some(t=>t.startsWith('analysis.aggregate.'))) return false;
  const aggregates=plan?.aggregates || (plan?.aggregate?[plan.aggregate]:[]);
  if (!aggregates.some((a:any)=>a.operation==='count')) return false;
  let phrase=` ${normalize(evidence)} `;
  const states=Object.values(definition.valueAliases || {});
  if (states.filter(aliases=>aliases.some(alias=>phrase.includes(` ${normalize(alias)} `))).length<2) return false;
  const context=assistantModuleContext(operation.module);
  const labels=[context.label,...context.aliases,...Object.entries(operation.analysis!.fields).filter(([key])=>key==='name'||key.endsWith('Name')).map(([,field])=>field.label)];
  for(const alias of [...states.flat(),...labels].sort((a,b)=>b.length-a.length)) phrase=phrase.split(` ${normalize(alias)} `).join(' ');
  const grammar=new Set('bao nhieu so luong va hay hien tai co la cac nhung doi tac dang'.split(' '));
  return phrase.trim().split(/\s+/).every(word=>grammar.has(word));
}

function expandAnalysisTargets(targets: string[], evidence: string, operation: AssistantOperation, values: Record<string, unknown>) {
  if (!operation.analysis) return targets;
  let plan;
  try { plan = validateListAnalysis(values.analysis, operation.analysis); } catch { return targets; }
  targets=targets.map(target=>{
    const indexed=/^analysis\.(filters|aggregates)\[(\d+)\](?:\.(?:field|operator|value|operation))?$/.exec(target);
    if(!indexed)return target;
    const item=indexed[1]==='filters'?plan.filters?.[Number(indexed[2])]:plan.aggregates?.[Number(indexed[2])];
    return item?`analysis.${indexed[1]==='filters'?'filters':'aggregate'}.${'operation' in item && item.operation==='count'?'count':item.field}`:target;
  });
  if (targets.includes('analysis.aggregate')) {
    const aggregates=plan.aggregates || (plan.aggregate?[plan.aggregate]:[]);
    if (aggregates.length) targets=[...targets.filter(target=>target!=='analysis.aggregate'),...aggregates.map(a=>`analysis.aggregate.${a.operation==='count'?'count':a.field}`)];
  }
  for(const kind of ['sort','extreme','groupBy'] as const) if(targets.includes(`analysis.${kind}`)) {
    const field=kind==='groupBy'?plan.groupBy:plan[kind]?.field;
    if(field) targets=[...targets.filter(target=>target!==`analysis.${kind}`),`analysis.${kind}.${field}`];
  }
  if (!targets.includes('analysis.filters')) return targets;
  const phrase = ` ${normalize(evidence)} `;
  const matched = (plan.filters || []).filter(filter => {
    const definition = operation.analysis!.fields[filter.field];
    if (filter.operator==='eq' && !/\bkhong\b/.test(phrase) && definition.valueAliases?.[String(filter.value)]?.some(alias=>phrase.includes(` ${normalize(alias)} `))) return true;
    const predicates = definition.predicates || [];
    const stated = predicates.filter(predicate => predicate.aliases.some(alias => phrase.includes(` ${normalize(alias)} `)));
    if (stated.length) return stated.some(predicate => predicate.operator === filter.operator && predicate.value === filter.value);
    return [definition.label.replace(/\([^)]*\)/g,''),...(definition.aliases || [])].some(alias => phrase.includes(` ${normalize(alias)} `));
  });
  return matched.length ? [...targets.filter(target => target !== 'analysis.filters'),...matched.map(filter => `analysis.filters.${filter.field}`)] : targets;
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
  // Preserve declared result mappings before reconciliation turns them into
  // action evidence; only the final omitted-word check uses this framing.
  const coverageText = stripCoveredValueQuestion(text, raw, operation, values);
  raw = reconcileCoverage(text, raw, workflow, operation, values);
  const request = normalize(text);
  if(operation.id==='student.list' && normalize(String(values.status||''))==='no hoc phi' && !/\b(?:trang thai|nhan ho so)\b/.test(request)) {
    return {ok:false,clarification:'Nhãn trạng thái hồ sơ không xác định số tiền còn nợ học phí. Cần đối chiếu học phí và phiếu thu đầy đủ; nếu muốn giới hạn kỳ hoặc phạm vi, bạn làm rõ giúp mình. Chưa thể kết luận không có học viên nợ tiền.'};
  }
  const explicit = scopeAssistantWorkflows(text, [workflow]);
  if (explicit.modules.length && !explicit.workflows.length) {
    return { ok: false, clarification: "Thao tác đang chọn thuộc phân hệ khác với phân hệ bạn nêu. Bạn xác nhận lại phân hệ cần xử lý nhé." };
  }
  const knownFields = new Set(workflow.fields.flatMap(field => [field.key, field.apiKey, field.source && field.apiKey ? `${field.source}_${field.apiKey}` : undefined].filter((value): value is string => Boolean(value))));
  for (const rawItem of raw as unknown[]) {
    if (!plain(rawItem) || typeof rawItem.evidence !== "string" || !rawItem.evidence.trim()
      || typeof rawItem.requirement !== "string" || !rawItem.requirement.trim()
      || !Array.isArray(rawItem.mappedTo) || rawItem.mappedTo.some(target => typeof target !== "string")) {
      return { ok: false, clarification: "Mình chưa xác định chắc các ý cần giữ trong yêu cầu. Bạn diễn đạt lại mục tiêu và điều kiện cần áp dụng nhé." };
    }
    const evidence = normalize(rawItem.evidence);
    if (!evidence || !request.includes(evidence)) {
      return { ok: false, clarification: "Mình chưa đối chiếu được các ý AI trích ra với câu bạn vừa gửi. Bạn nói lại mục tiêu và điều kiện cần áp dụng nhé." };
    }
    if(isCompletionQuestionParticle(text,rawItem.evidence))continue;
    if(operation.method==='GET'&&operation.analysis){
      const plan=parsedAnalysis(values.analysis);
      const answers=Object.entries(operation.analysis.fields).filter(([,field])=>field.answerAliases?.some(alias=>normalize(alias)===evidence));
      const visible=plan?.select||operation.analysis.displayFields||Object.keys(operation.analysis.fields);
      if(answers.length&&(!plan||plan.aggregate||plan.aggregates||!answers.some(([key])=>visible.includes(key))))return {ok:false,clarification:'Chưa chọn đủ cột dữ liệu để trả lời yêu cầu của bạn.'};
    }
    // Module names describe routing context. Resolve them from the user's words
    // even when the model omitted a mapping or attached the phrase to a field.
    if (isKnownModuleContextClause(rawItem.evidence)) {
      if (mentionsCompatibleModule(rawItem.evidence, workflow.module)) continue;
      return { ok: false, clarification: `Cụm “${rawItem.evidence.trim().slice(0, 120)}” đang chỉ một phân hệ khác với thao tác “${workflow.title}”. Bạn muốn tra cứu ở phân hệ này hay phân hệ được nêu trong câu?` };
    }
    const reason = assistantRequestReason(text, operation, values);
    if (reason && [normalize(reason.evidence), normalize(reason.reason)].includes(evidence)
      && rawItem.mappedTo.includes('context.reason')) continue;
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
    const mappedTargets = expandAnalysisTargets([...new Set([
      ...(rawItem.mappedTo as string[]).map(normalizeTarget),
      ...reconciledRankingMappingTargets(rawItem.evidence, operation, values),
    ])],rawItem.evidence,operation,values);
    const meaning = canonicalActionEvidence(rawItem.evidence, operation);
    if (mappedTargets.includes('action') && /(?:^| )co /.test(meaning) && !/(?:^| )(?:khong|chua)(?: |$)/.test(meaning)
      && [operation.title, ...(operation.coverageAliases || [])].some(description => {
        const capability = ` ${canonicalActionEvidence(description, operation)} `;
        const index = capability.indexOf(` ${meaning} `);
        return index >= 0 && /(?:^| )(?:khong|chua)(?: co|duoc|ghi nhan)? $/.test(capability.slice(0, index + 1));
      })) return { ok: false, clarification: 'Điều kiện có/không trong yêu cầu chưa khớp với báo cáo đang chọn. Chưa thực hiện tra cứu.' };
    const declaredOutput = Array.isArray(rawItem.readOutputs) && rawItem.readOutputs.length>0 && operation.method==='GET'
      && operation.fields.some(field=>field.reference && populated(values[field.key]))
      && /\b(?:hay|bao nhieu|la gi|nao)\b/.test(evidence)
      && !/\d|\b(?:thang|ngay|tuan|tai|tren|duoi|hon|neu|chi khi|truoc khi|sau khi|ngoai tru|va|nhung|duoc duyet|hop dong)\b/.test(evidence);
    const groupedStates=groupedEnumQuestion(rawItem.evidence,operation,values,mappedTargets);
    const actionCapturesEvidence = mappedTargets.includes("action") && actionEncodesEvidence(rawItem.evidence, workflow, operation)
      || Boolean(declaredOutput) || Boolean(groupedStates) || readOutputCapturesEvidence(rawItem.evidence, text, operation, values);
    const actionCapturesRanking = mappedTargets.includes("action") && actionEncodesRanking(rawItem.evidence, operation);
    const singularCreate = operation.assistantMetadata?.intent === "create" && mappedTargets.includes("action");
    const kindEvidence=reconciledRankingMappingTargets(rawItem.evidence,operation,values).length
      ? rawItem.evidence.replace(/(?:^|\s)đang\s+có\s+(?=(?:số\s+)?tiền)/iu,' ') : rawItem.evidence;
    const missingKind = requiredMappingMissing(kindEvidence, mappedTargets, false, actionCapturesRanking, singularCreate);
    if (missingKind && !actionCapturesEvidence) return { ok: false, clarification: missingKind === "ranking"
      ? `Tiêu chí xếp hạng “${rawItem.evidence.trim().slice(0, 120)}” chưa được gắn với phép xếp hạng cụ thể. Mình chưa gọi API.`
      : `Điều kiện “${rawItem.evidence.trim().slice(0, 120)}” chưa được gắn với trường lọc. Mình chưa gọi API.` };
    for (const target of mappedTargets) {
      if(target==='context.scope' && operation.method==='GET' && currentScopePhrases.has(evidence))continue;
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
      const suppliedOrDefaulted = field && (populated(values[field.key]) || isFieldClearEvidence(rawItem.evidence, operation, field.key, values[field.key]) || hasDeclaredCurrentMonthDefault(workflow, field.key, rawItem.evidence)
        || operation.currentDateDefaults?.includes(field.key) && /^(?:ngay )?hom nay$/.test(evidence));
      if ((!knownFields.has(target) && !knownFields.has(fieldKey)) || !field || !suppliedOrDefaulted) {
        return { ok: false, clarification: `Mình chưa ánh xạ được yêu cầu “${rawItem.requirement.trim().slice(0, 160)}” vào thông tin cần dùng. Bạn làm rõ ý này giúp mình nhé.` };
      }
    }
  }
  const missingCoverage = missingCoverageReply(coverageText, raw, workflow, values, operation);
  if (missingCoverage) return { ok: false, clarification: missingCoverage };
  return { ok: true };
}

export function requiredCompositeMappingIsMissing(evidence: string, targets: string[]) {
  return requiredMappingMissing(evidence, targets, true);
}
