import { AssistantError } from "./policy";
import { formatAssistantResultTable } from "../../src/shared/assistant-result-table";
import { formatAssistantTemporalValue } from '../../src/shared/assistant-date';
import { maskAssistantBankAccount } from './result-field-policy';
import { assistantEmptyReadResult } from './reply-presentation';
import { FILTER_EXPRESSION_SCHEMA, filterDate, filterLeaves, matchesFilter, validateFilterExpression, type FilterExpression,type ReadPredicate } from './filter-expression';
import {normalizeAnalysisPlan} from './analysis-normalization';

export interface AnalysisContract {
  /** Uses the existing approved public projection; completeness is verified at runtime. */
  publicRead?: true;
  publicRowsField?: string;
  /** Reviewed source returns exactly one scoped summary, not a paginated list. */
  singleton?: true;
  /** Reviewed summaries omit zero-valued groups; restore their declared domain
   * only after the complete scoped source has been verified. */
  completeGroups?:{dimension:string;values:readonly string[];zeroMeasures:readonly string[]};
  scopeLabel?: string;
  /** Public dimensions of the source row; these do not collapse equal display names. */
  rowDimensions?: string[];
  /** Equivalent basic read views retained for references/old pending actions. */
  replaces?: string[];
  displayFields?: string[];
  /** Additive count measures have disjoint underlying members across source rows. */
  additiveCountFields?: string[];
  /** Reviewed formal conversions of a numeric business measure to predicates. */
  numericPredicateEquivalences?:Array<{operator:'eq'|'ne'|'gt'|'gte'|'lt'|'lte';value:number;predicates:ReadPredicate[];description:string}>;
  pagination?: { pageField: string; sizeField: string };
  fields: Record<string, { label: string; type: "number" | "text" | "boolean" | "scalar"; computedMeaning?:string; outputCoercion?:'unsigned-integer-string'|'vietnamese-money'; format?: 'date' | 'bank-account'; measureOperation?: 'count' | 'sum' | 'avg'; contains?: boolean; values?: Record<string, string>; aliases?: string[]; answerAliases?: string[]; valueAliases?: Record<string,string[]>;
    predicates?: Array<{ aliases: string[]; operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'; value: number | string }> }>;
}
export async function collectAnalysisPages(contract: AnalysisContract, values: Record<string, any>, dispatch: (values: Record<string, any>) => Promise<any>) {
  if (!contract.pagination) return dispatch(values);
  const { pageField, sizeField } = contract.pagination;
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let expectedTotal: number | undefined;
  for (let page = 1; page <= 20; page++) {
    const result = await dispatch({ ...values, [pageField]: page, [sizeField]: 500 });
    const meta = result.analysisPage;
    if (!meta || meta.page !== page || !Number.isSafeInteger(meta.total) || meta.total < 0 || meta.total > 10000
      || !Array.isArray(result.data) || !Array.isArray(meta.keys) || meta.keys.length !== result.data.length
      || (expectedTotal !== undefined && expectedTotal !== meta.total)) throw new AssistantError("Chưa lấy được danh sách đầy đủ và nhất quán. Hãy thu hẹp phạm vi hoặc thử lại.");
    expectedTotal = meta.total;
    for (const key of meta.keys) {
      if (typeof key !== "string" || !key || seen.has(key)) throw new AssistantError("Danh sách thay đổi trong khi đọc hoặc có trang trùng lặp. Mình chưa tính kết quả.");
      seen.add(key);
    }
    rows.push(...result.data);
    if (rows.length === expectedTotal) return { data: rows, analysisComplete: true };
    if (!result.data.length || rows.length > expectedTotal) break;
  }
  throw new AssistantError("Chưa lấy đủ dữ liệu để phân tích toàn bộ đối tác. Bạn thu hẹp phạm vi giúp mình nhé.");
}
export interface ListAnalysis {
  where?: FilterExpression;
  filters?: Array<{ field: string; operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains"; value: string | number | boolean }>;
  extreme?: { field: string; direction: "min" | "max" };
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  groupBy?: string;
  aggregate?: { operation: "count" | "sum" | "avg"; field?: string };
  aggregates?: Array<{ operation: "count" | "sum" | "avg"; field?: string }>;
  select?: string[];
  /** Return explicitly requested detail columns together with scoped totals. */
  includeRows?: boolean;
}
export function analysisPredicates(plan: ListAnalysis) { return [...(plan.filters || []), ...(plan.where ? filterLeaves(plan.where) : [])]; }
/** Executable plan grammar for every analysis-enabled tool, derived from its
 * public contract rather than natural-language aliases or module-specific rules. */
export function listAnalysisPlanSchema(contract: AnalysisContract) {
  const field={$ref:'#/$defs/analysisField'};
  const numeric=Object.keys(contract.fields).filter(key=>['number','scalar'].includes(contract.fields[key].type));
  const aggregate={anyOf:[
    {type:'object',additionalProperties:false,required:['operation'],properties:{operation:{const:'count'},field}},
    ...(numeric.length?[{type:'object',additionalProperties:false,required:['operation','field'],properties:{operation:{enum:['sum','avg']},field:{enum:numeric}}}]:[]),
  ]};
  const ordered=(direction:string[])=>({type:'object',additionalProperties:false,required:['field','direction'],properties:{field,direction:{enum:direction}}});
  return {type:'object',additionalProperties:false,$defs:{analysisField:{enum:Object.keys(contract.fields)},filterExpression:FILTER_EXPRESSION_SCHEMA,readPredicate:{type:'object',additionalProperties:false,required:['field','operator'],properties:{field,operator:{enum:['eq','ne','gt','gte','lt','lte','contains','startsWith','endsWith','in','nin','between','is_empty','not_empty']},value:{anyOf:[{type:['string','number','boolean']},{type:'array',minItems:1,maxItems:40,items:{type:['string','number','boolean']}}]}}}},properties:{
    where:{$ref:'#/$defs/filterExpression'},
    filters:{type:'array',maxItems:20,items:{$ref:'#/$defs/readPredicate'}},
    extreme:ordered(['min','max']),sort:ordered(['asc','desc']),limit:{type:'integer',minimum:1,maximum:1000},groupBy:{enum:Object.keys(contract.fields)},
    aggregate,aggregates:{type:'array',minItems:1,maxItems:8,items:aggregate},select:{type:'array',minItems:1,maxItems:20,uniqueItems:true,items:field},includeRows:{type:'boolean'},
  }};
}
const normalizeAnalysisText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();

/** Bind explicit state phrases to reviewed enum values; never infer arbitrary filters. */
export function reconcileRequestedValueFilters(text: string, contract: AnalysisContract, raw: unknown):
  | {kind:'none'} | {kind:'resolved';analysis:ListAnalysis} | {kind:'clarify';question:string} {
  const phrase = ` ${normalizeAnalysisText(text).replace(/[^a-z0-9]+/g,' ').trim()} `;
  const literal = (value:string) => ` ${value.normalize('NFC').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu,' ').trim()} `;
  const requested: NonNullable<ListAnalysis['filters']> = [];
  for (const [field, definition] of Object.entries(contract.fields)) {
    for (const predicate of definition.predicates || []) {
      const matched=predicate.aliases.filter(alias=>literal(text).includes(literal(alias)));
      if(matched.some(alias=>['không','không phải','không còn','không hề','chưa'].some(prefix=>literal(text).includes(literal(`${prefix} ${alias}`))))) return {kind:'clarify',question:`Bạn muốn lọc ${definition.label.toLocaleLowerCase('vi')} theo điều kiện nào?`};
      if (matched.length) requested.push({field,operator:predicate.operator,value:predicate.value});
    }
    const options = Object.entries(definition.valueAliases || {}).filter(([value])=>definition.values && Object.hasOwn(definition.values,value));
    const exact = options.filter(([,aliases])=>aliases.some(alias=>literal(text).includes(literal(alias))));
    const matches = exact.length ? exact : options.filter(([,aliases])=>aliases.some(alias => phrase.includes(` ${normalizeAnalysisText(alias)} `)));
    if (!matches.length) continue;
    if (matches.length > 1) {
      const plan = validateListAnalysis(raw,contract);
      const grouped = plan.groupBy === field && Boolean(plan.aggregate || plan.aggregates);
      const valueQuestion = plan.select?.includes(field) && /\bhay\b/.test(phrase) && !/\b(?:chi|loc)\b/.test(phrase);
      if (grouped || valueQuestion) continue;
    }
    const negated = matches.some(([,aliases]) => aliases.some(alias => ['khong','khong phai','khong con','khong he'].some(prefix => phrase.includes(` ${prefix} ${normalizeAnalysisText(alias)} `))));
    if (matches.length!==1 || negated) return {kind:'clarify',question:`Bạn muốn lọc ${definition.label.toLocaleLowerCase('vi')} theo trạng thái nào?`};
    requested.push({field,operator:'eq',value:matches[0][0]});
  }
  if (!requested.length) return {kind:'none'};
  const plan = validateListAnalysis(raw, contract);
  return {kind:'resolved',analysis:{...plan,filters:[...(plan.filters || []).filter(filter=>!requested.some(item=>item.field===filter.field)),...requested]}};
}

/** Recover an explicitly requested ranking when the model omitted or mismapped
 * its analysis plan. Ambiguous ranking metrics are returned as a question so no
 * unranked or differently ranked report is dispatched. */
export function reconcileRequestedRanking(text: string, contract: AnalysisContract, raw: unknown):
  | { kind: "none" }
  | { kind: "resolved"; analysis: ListAnalysis }
  | { kind: "clarify"; question: string } {
  const request = normalizeAnalysisText(text);
  const temporalRequest = request.replace(/\b(?:thang|tuan|quy|nam)\s+(?:gan nhat|moi nhat)\b/g, '');
  const latest = /\b(?:gan nhat|moi nhat|cuoi cung|lan cuoi)\b/.test(temporalRequest);
  const earliest = /\b(?:dau tien|som nhat|cu nhat)\b/.test(temporalRequest);
  if (latest || earliest) {
    const dates = Object.entries(contract.fields).filter(([, field]) => field.format === 'date');
    const named = dates.filter(([key, field]) => [key, field.label, ...(field.aliases || [])].some(alias => temporalRequest.includes(normalizeAnalysisText(alias))));
    const candidates = named.length ? named : dates;
    if (latest && earliest || candidates.length !== 1 || /\b(?:cao nhat|lon nhat|nhieu nhat|it nhat|top)\b/.test(request)) return {kind:'clarify',question:'Bạn muốn so sánh theo ngày nào và lấy lần sớm nhất hay gần nhất?'};
    const existing = validateListAnalysis(raw, contract);
    if (existing.aggregate || existing.aggregates) return {kind:'clarify',question:'Bạn muốn xem các giao dịch gần nhất hay tổng hợp các giao dịch trong một khoảng thời gian?'};
    const {sort: _sort, ...rest} = existing;
    return {kind:'resolved',analysis:{...rest,extreme:{field:candidates[0][0],direction:latest?'max':'min'}}};
  }
  const topCountMatch = request.match(/\btop\s+(\d+)\b/);
  const hasTopCue = /\btop\b/.test(request);
  const topCount = topCountMatch ? Number(topCountMatch[1]) : undefined;
  const maximum = /\b(?:nhieu(?:\s+[a-z]+){0,4}\s+nhat|cao\s+nhat|lon\s+nhat|dung dau)\b/.test(request);
  const minimum = /\b(?:it\s+(?:[a-z]+\s+){1,3}nhat|thap nhat|nho nhat)\b/.test(request);
  const sorting = /\b(?:sap xep|xep theo|xep hang)\b/.test(request) && /\b(?:giam dan|tang dan|cao xuong thap|thap len cao)\b/.test(request);
  const invalidTopCount = hasTopCue && (!topCount || topCount < 1 || topCount > 1000);
  if (!maximum && !minimum && !sorting && !hasTopCue) return { kind: "none" };

  const numericFields = Object.entries(contract.fields).filter(([, definition]) => definition.type === "number");
  const requestTerms = new Set(request.split(/[^a-z0-9]+/).filter(Boolean));
  const stopWords = new Set(["con", "thieu", "gioi", "da", "tong", "tien", "so", "ty", "le", "dat", "nhan", "su"]);
  const scored = numericFields.map(([key, definition]) => {
    const phrases = [...(definition.aliases || []), definition.label, key]
      .map(term => normalizeAnalysisText(term).replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()).filter(term => term.length >= 4);
    const labelWords = normalizeAnalysisText(definition.label).split(/[^a-z0-9]+/)
      .filter(term => term.length >= 4 && !stopWords.has(term));
    const exact = phrases.filter(term => ` ${request.replace(/[^a-z0-9]+/g, ' ')} `.includes(` ${term} `));
    return {entry:[key,definition] as typeof numericFields[number], score:exact.length ? Math.max(...exact.map(term => term.length)) : labelWords.some(term => requestTerms.has(term)) ? 1 : 0};
  });
  const best = Math.max(0, ...scored.map(item => item.score));
  const matches = scored.filter(item => item.score > 0 && item.score === best).map(item => item.entry);
  const candidates = matches.length ? matches : numericFields.length === 1 ? numericFields : [];
  if (candidates.length !== 1) {
    const labels = numericFields.map(([, definition]) => `“${definition.label}”`).join(", ");
    return { kind: "clarify", question: `Báo cáo có thể xếp hạng theo ${labels}. Bạn muốn so sánh theo chỉ tiêu nào${invalidTopCount ? " và lấy bao nhiêu kết quả (từ 1 đến 1.000)" : ""}?` };
  }
  if (invalidTopCount) {
    return { kind: "clarify", question: "Bạn muốn lấy bao nhiêu kết quả trong danh sách top (từ 1 đến 1.000)?" };
  }

  let existing: ListAnalysis = {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) existing = parsed as ListAnalysis;
  } catch { /* The regular analysis validator reports malformed model output. */ }
  const [field] = candidates[0];
  if (hasTopCue && topCount) {
    const { extreme: _ignored, sort: _oldSort, ...rest } = existing;
    const direction = minimum && !maximum ? "asc" : "desc";
    return { kind: "resolved", analysis: { ...rest, sort: { field, direction }, limit: topCount } };
  }
  if (sorting) {
    const direction = /\b(?:giam dan|cao xuong thap)\b/.test(request) ? "desc" : "asc";
    const { extreme: _ignored, ...rest } = existing;
    return { kind: "resolved", analysis: { ...rest, sort: { field, direction } } };
  }
  const { sort: _ignored, ...rest } = existing;
  const analysis: ListAnalysis = { ...rest, extreme: { field, direction: maximum ? "max" : "min" } };
  return { kind: "resolved", analysis };
}

const fail = (message: string): never => { throw new AssistantError(message); };
const plain = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === "object" && !Array.isArray(value));
export function validateListAnalysis(raw: unknown, contract: AnalysisContract): ListAnalysis {
  let plan: any = raw;
  if (typeof raw === "string") { try { plan = JSON.parse(raw); } catch { fail("Điều kiện phân tích chưa hợp lệ. Chưa thực hiện tra cứu."); } }
  if (plan == null) return {};
  plan=normalizeAnalysisPlan(plan,contract);
  if (!plain(plan) || Object.keys(plan).some(key => !["where", "filters", "extreme", "sort", "limit", "groupBy", "aggregate", "aggregates", "select", "includeRows"].includes(key))) fail("Phép phân tích này chưa được hỗ trợ.");
  const field = (key: unknown, numeric = false) => {
    if (typeof key !== "string" || !Object.hasOwn(contract.fields, key) || (numeric && !['number','scalar'].includes(contract.fields[key].type))) fail("Trường phân tích không có trong dữ liệu được phép xem.");
  };
  if (plan.where !== undefined) validateFilterExpression(plan.where, contract.fields);
  if (plan.where !== undefined && plan.filters !== undefined) fail('Chỉ dùng một biểu thức lọc để giữ đúng quan hệ và/hoặc.');
  if (plan.filters !== undefined) {
    if (!Array.isArray(plan.filters) || plan.filters.length > 20) fail("Điều kiện lọc chưa hợp lệ.");
    for (const filter of plan.filters) {
      if (!plain(filter) || Object.keys(filter).some(key => !["field", "operator", "value"].includes(key))) fail("Điều kiện lọc chưa hợp lệ.");
      field(filter.field);
      if (!["eq", "ne", "gt", "gte", "lt", "lte", "contains"].includes(filter.operator)) fail("Phép so sánh chưa được hỗ trợ.");
      const definition = contract.fields[filter.field];
      if (definition.type === 'scalar' ? !['string','number','boolean'].includes(typeof filter.value) || typeof filter.value==='number'&&!Number.isFinite(filter.value) : definition.type==='boolean' ? typeof filter.value!=='boolean' : definition.type === "number" ? typeof filter.value !== "number" || !Number.isFinite(filter.value) : typeof filter.value !== "string") fail("Giá trị lọc không đúng kiểu dữ liệu.");
      if (filter.operator === 'contains' && (!['text','scalar'].includes(definition.type) || !definition.contains || !String(filter.value).trim())) fail('Trường này chưa hỗ trợ tìm nội dung.');
      if (!['number','scalar'].includes(definition.type) && definition.format!=='date' && !["eq", "ne", "contains"].includes(filter.operator)) fail("Chỉ so sánh lớn hơn hoặc nhỏ hơn trên trường số.");
      if (definition.values && !Object.hasOwn(definition.values, String(filter.value))) fail("Giá trị lọc không thuộc các lựa chọn của trường dữ liệu.");
      validateFilterExpression(filter,contract.fields);
    }
  }
  for (const key of ["extreme", "sort"] as const) if (plan[key] !== undefined) {
    if (!plain(plan[key]) || Object.keys(plan[key]).some(k => !["field", "direction"].includes(k))) fail("Điều kiện xếp hạng chưa hợp lệ.");
    field(plan[key].field);
    if (key === 'extreme' && !['number','scalar'].includes(contract.fields[plan[key].field].type) && contract.fields[plan[key].field].format !== 'date') fail('Chỉ tìm cực trị trên trường số hoặc ngày đã khai báo.');
    if (!(key === "extreme" ? ["min", "max"] : ["asc", "desc"]).includes(plan[key].direction)) fail("Chiều xếp hạng chưa hợp lệ.");
  }
  if (plan.limit !== undefined && (!Number.isInteger(plan.limit) || plan.limit < 1 || plan.limit > 1000)) fail("Số kết quả cần nằm trong khoảng 1–1.000.");
  if (plan.groupBy !== undefined) field(plan.groupBy);
  if (plan.select !== undefined && (!Array.isArray(plan.select) || !plan.select.length || plan.select.length > 20 || new Set(plan.select).size !== plan.select.length)) fail('Danh sách cột chưa hợp lệ.');
  for (const key of plan.select || []) field(key);
  if (plan.aggregate !== undefined && plan.aggregates !== undefined) fail('Chỉ dùng một dạng tổng hợp.');
  if (plan.aggregates !== undefined && (!Array.isArray(plan.aggregates) || !plan.aggregates.length || plan.aggregates.length > 8)) fail('Danh sách tổng hợp chưa hợp lệ.');
  const aggregates = plan.aggregates || (plan.aggregate !== undefined ? [plan.aggregate] : []);
  for (const aggregate of aggregates) {
    if (!plain(aggregate) || Object.keys(aggregate).some(k => !["operation", "field"].includes(k)) || !["count", "sum", "avg"].includes(aggregate.operation)) fail("Phép tổng hợp chưa được hỗ trợ.");
    if (aggregate.operation !== "count" || aggregate.field !== undefined) field(aggregate.field, aggregate.operation !== 'count');
    if (plan.extreme || plan.sort || plan.limit) fail("Chưa hỗ trợ xếp hạng sau tổng hợp trong cùng một bước.");
  }
  if (new Set(aggregates.map((a:any) => `${a.operation}:${a.field || ''}`)).size !== aggregates.length) fail('Chỉ tiêu tổng hợp bị lặp.');
  if (!aggregates.length && plan.groupBy) fail("Cần chọn cách tổng hợp cho từng nhóm.");
  if(plan.includeRows!==undefined&&(typeof plan.includeRows!=='boolean'||plan.includeRows&&(!aggregates.length||plan.groupBy||!plan.select?.length)))fail('Danh sách kèm tổng hợp cần cột chi tiết và phép tổng hợp trên cùng phạm vi.');
  return plan;
}

/** Deterministic operations on complete, authorized API data. No model-generated code. */
export function selectAnalysisRows(contract: AnalysisContract, rows: Record<string, unknown>[], raw: unknown, complete: boolean) {
  const plan = validateListAnalysis(raw, contract);
  if (!complete) fail("Chưa lấy đủ dữ liệu để kết luận cho toàn bộ danh sách. Mình chưa tính xếp hạng hoặc tổng hợp từ một phần dữ liệu.");
  let selected = rows.filter(row => (plan.filters || []).every(f => matchesFilter(row,f,contract.fields) === true));
  if (plan.where) selected = selected.filter(row => matchesFilter(row,plan.where!,contract.fields) === true);
  if (plan.extreme) {
    const { field, direction } = plan.extreme;
    const temporal = contract.fields[field].format === 'date';
    const comparable = (value: unknown) => {
      if (!temporal) {if(value!=null&&(typeof value!=='number'||!Number.isFinite(value)))fail('Cột cần so sánh có giá trị không phải số. Mình chưa xác định cực trị.');return typeof value === 'number' ? value : null;}
      if(value==null||value==='')return null;
      const timestamp=filterDate(value);
      if(timestamp===undefined)fail('Có ngày không hợp lệ; chưa thể xác định kết quả theo thời gian.');
      return timestamp;
    };
    const numbers = selected.map(row => comparable(row[field])).filter((v): v is number => v !== null);
    const extreme = numbers.reduce((best, value) => direction === "max" ? Math.max(best, value) : Math.min(best, value), direction === "max" ? -Infinity : Infinity);
    selected = selected.filter(row => comparable(row[field]) === extreme);
  }
  if (plan.sort) {
    const { field, direction } = plan.sort;
    const cells=selected.map(r=>r[field]).filter(v=>v!=null);
    if(new Set(cells.map(v=>typeof v)).size>1||cells.some(v=>!['string','number','boolean'].includes(typeof v)))fail('Dữ liệu cần sắp xếp chưa cùng kiểu. Mình chưa xác định thứ tự.');
    const temporal=contract.fields[field].format==='date';
    if(temporal&&cells.some(v=>filterDate(v)===undefined))fail('Có ngày không hợp lệ trong dữ liệu cần sắp xếp.');
    selected = [...selected].sort((a, b) => {
      if (a[field] == null) return b[field] == null ? 0 : 1;
      if (b[field] == null) return -1;
      const order = temporal ? filterDate(a[field])!-filterDate(b[field])! : typeof a[field] === "number" ? Number(a[field]) - Number(b[field]) : String(a[field]).localeCompare(String(b[field]), "vi");
      return direction === "desc" ? -order : order;
    });
  }
  const matched = selected.length;
  if (plan.limit && !plan.extreme) selected = selected.slice(0, plan.limit);
  return {rows:selected,matched};
}
export function analyzeList(contract: AnalysisContract, rows: Record<string, unknown>[], raw: unknown, complete: boolean):{matched:number;records:Record<string,string>[];detailRecords?:Record<string,string>[];summaryRecords?:Record<string,string>[]} {
  const plan=validateListAnalysis(raw,contract);
  const {rows:selected,matched}=selectAnalysisRows(contract,rows,plan,complete);
  const format = (value: unknown, key: string) => value == null ? "Chưa thiết lập" : contract.fields[key]?.values?.[String(value)] || (contract.fields[key]?.format === 'bank-account' ? value ? maskAssistantBankAccount(String(value)) : 'Chưa cập nhật' : contract.fields[key]?.format === 'date' ? formatAssistantTemporalValue(String(value)) || String(value) : typeof value === 'boolean' ? value ? 'Có' : 'Không' : typeof value === "number" ? value.toLocaleString("vi-VN") : String(value));
  if (plan.aggregate || plan.aggregates) {
    const groups = new Map<string, Record<string, unknown>[]>();
    if (!plan.groupBy) groups.set("Tất cả", selected);
    else for (const row of selected) { const key = format(row[plan.groupBy], plan.groupBy); if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(row); }
    const summaryRecords=[...groups].map(([group, members]) => {
      const record: Record<string,string> = { [plan.groupBy ? contract.fields[plan.groupBy].label : "Phạm vi"]: group };
      const measures=plan.aggregates || [plan.aggregate!];
      const usedLabels=new Set(Object.keys(record));
      for (const { operation, field } of measures) {
      if (operation !== 'count' && members.some(row=>row[field!] != null && (typeof row[field!] !== 'number' || !Number.isFinite(row[field!] as number)))) fail('Cột cần tính có giá trị không phải số. Mình chưa tính tổng hoặc trung bình.');
      const numbers = members.map(row => row[field!]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      const total = numbers.reduce((sum, n) => sum + n, 0);
      const value = operation === "count" ? field ? members.filter(row => row[field] != null && row[field] !== '').length : members.length : numbers.length ? (operation === "sum" ? total : total / numbers.length) : null;
      const base = operation === "count" ? `Số lượng${field&&measures.length>1?` ${contract.fields[field].label.toLowerCase()}`:''}` : `${operation === "sum" ? "Tổng" : "Trung bình"} ${contract.fields[field!].label.toLowerCase()}`;
      let label=base;
      if(usedLabels.has(label))label=`${base} (${operation}:${field||'count'})`;
      let suffix=2;
      while(usedLabels.has(label))label=`${base} (${operation}:${field||'count'} ${suffix++})`;
      usedLabels.add(label);
      record[label] = value == null ? "Không có dữ liệu" : value.toLocaleString("vi-VN");
      }
      return record;
    });
    if(plan.includeRows){
      const {aggregate:_aggregate,aggregates:_aggregates,includeRows:_includeRows,...detailPlan}=plan;
      const details=analyzeList(contract,rows,detailPlan,complete);
      return {matched:details.matched,detailRecords:details.records,summaryRecords,
        records:[...details.records.map(row=>({'Loại dòng':'Chi tiết',...row})),...summaryRecords.map(row=>({'Loại dòng':'Tổng hợp',...row}))]};
    }
    return {matched:groups.size,records:summaryRecords};
  }
  const keys=plan.select || contract.displayFields || Object.keys(contract.fields),usedLabels=new Set<string>();
  const labels=keys.map(key=>{
    const base=contract.fields[key].label;let label=base;
    if(usedLabels.has(label))label=`${base} (${key})`;
    let suffix=2;
    while(usedLabels.has(label))label=`${base} (${key} ${suffix++})`;
    usedLabels.add(label);return label;
  });
  return { matched, records: selected.map(row => Object.fromEntries(keys.map((key,i) => [labels[i], format(row[key], key)]))) };
}
export function renderListAnalysis(contract: AnalysisContract, rows: Record<string, unknown>[], raw: unknown, complete: boolean, summary: string, requestText?: string) {
  const result = analyzeList(contract, rows, raw, complete);
  if(result.detailRecords&&result.summaryRecords){
    const totals=result.summaryRecords.map(row=>'Tổng hợp: '+Object.entries(row).filter(([key])=>key!=='Phạm vi').map(([key,value])=>`${key}: ${value}`).join(' · '));
    return result.detailRecords.length?formatAssistantResultTable(summary,result.detailRecords,totals):[assistantEmptyReadResult(requestText),...totals].join('\n');
  }
  if(!result.records.length)return assistantEmptyReadResult(requestText);
  return formatAssistantResultTable(summary, result.records, result.records.length < result.matched ? [`Hiển thị ${result.records.length} trong ${result.matched} kết quả phù hợp.`] : []);
}
export function canPresentPartialList(plan:ListAnalysis):boolean {
  return !plan.aggregate&&!plan.aggregates&&!plan.groupBy&&!plan.extreme&&!plan.sort&&!plan.limit;
}
/** Exact predicate matches within known rows, with no claim about unseen rows. */
export function renderPartialListAnalysis(contract:AnalysisContract,rows:Record<string,unknown>[],raw:unknown,summary:string) {
  const plan=validateListAnalysis(raw,contract);
  if(!canPresentPartialList(plan))fail('Chưa đọc đủ dữ liệu để kết luận phép tính hoặc xếp hạng này. Bạn thu hẹp phạm vi giúp mình nhé.');
  const result=analyzeList(contract,rows,plan,true);
  const note='Kết quả mới dựa trên phần danh sách đã đọc, chưa bao gồm toàn bộ dữ liệu. Bạn có thể thu hẹp phạm vi để mình tìm đầy đủ hơn.';
  return result.records.length?formatAssistantResultTable(summary,result.records,[note]):`Trong phần danh sách vừa đọc, mình chưa thấy dòng nào khớp điều kiện. Mình chưa thể kết luận cho toàn bộ danh sách. Bạn thu hẹp phạm vi giúp mình nhé.`;
}
