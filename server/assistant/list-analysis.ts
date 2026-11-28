import { AssistantError } from "./policy";
import { formatAssistantResultTable } from "../../src/shared/assistant-result-table";

export interface AnalysisContract {
  scopeLabel?: string;
  replaces?: string[];
  pagination?: { pageField: string; sizeField: string };
  fields: Record<string, {
    label: string;
    type: "number" | "text";
    display?: boolean;
    displayByDefault?: boolean;
    values?: Record<string, string>;
    aliases?: string[];
    valueAliases?: Record<string, string[]>;
    predicates?: Array<{ aliases: string[]; operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"; value: number | string }>;
  }>;
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
  filters?: Array<{ field: string; operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains"; value: string | number }>;
  extreme?: { field: string; direction: "min" | "max" };
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  groupBy?: string;
  aggregate?: { operation: "count" | "sum" | "avg"; field?: string };
  aggregates?: Array<{ operation: "count" | "sum" | "avg"; field?: string }>;
  select?: string[];
}
const normalizeAnalysisText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();

/** Bind explicit reviewed state aliases to supported enum values. */
export function reconcileRequestedValueFilters(text: string, contract: AnalysisContract, raw: unknown):
  | { kind: "none" }
  | { kind: "resolved"; analysis: ListAnalysis }
  | { kind: "clarify"; question: string } {
  const phrase = ` ${normalizeAnalysisText(text).replace(/[^a-z0-9]+/g, " ").trim()} `;
  const literal = (value: string) => ` ${value.normalize("NFC").toLocaleLowerCase("vi").replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  const requested: NonNullable<ListAnalysis["filters"]> = [];
  for (const [field, definition] of Object.entries(contract.fields)) {
    for (const predicate of definition.predicates || []) {
      const matched = predicate.aliases.filter(alias => literal(text).includes(literal(alias)));
      if (matched.some(alias => ["không", "không phải", "không còn", "không hề", "chưa"].some(prefix => literal(text).includes(literal(`${prefix} ${alias}`))))) {
        return { kind: "clarify", question: `Bạn muốn lọc ${definition.label.toLocaleLowerCase("vi")} theo điều kiện nào?` };
      }
      for (const _alias of matched) requested.push({ field, operator: predicate.operator, value: predicate.value });
    }
    const options = Object.entries(definition.valueAliases || {}).filter(([value]) => definition.values && Object.hasOwn(definition.values, value));
    const exact = options.filter(([, aliases]) => aliases.some(alias => literal(text).includes(literal(alias))));
    const matches = exact.length ? exact : options.filter(([, aliases]) => aliases.some(alias => phrase.includes(` ${normalizeAnalysisText(alias)} `)));
    if (!matches.length) continue;
    if (matches.length > 1) {
      const plan = validateListAnalysis(raw, contract);
      const grouped = plan.groupBy === field && Boolean(plan.aggregate || plan.aggregates);
      const valueQuestion = plan.select?.includes(field) && /\\bhay\\b/.test(phrase) && !/\\b(?:chi|loc)\\b/.test(phrase);
      if (grouped || valueQuestion) continue;
    }
    const negated = matches.some(([, aliases]) => aliases.some(alias =>
      ["khong", "khong phai", "khong con", "khong he"].some(prefix => phrase.includes(` ${prefix} ${normalizeAnalysisText(alias)} `))));
    if (matches.length !== 1 || negated) {
      return { kind: "clarify", question: `Bạn muốn lọc ${definition.label.toLocaleLowerCase("vi")} theo trạng thái nào?` };
    }
    requested.push({ field, operator: "eq", value: matches[0][0] });
  }
  if (!requested.length) return { kind: "none" };
  const plan = validateListAnalysis(raw, contract);
  return { kind: "resolved", analysis: { ...plan, filters: [...(plan.filters || []).filter(filter => !requested.some(item => item.field === filter.field)), ...requested] } };
}

/** Recover an explicitly requested ranking when the model omitted or mismapped
 * its analysis plan. Ambiguous ranking metrics are returned as a question so no
 * unranked or differently ranked report is dispatched. */
export function reconcileRequestedRanking(text: string, contract: AnalysisContract, raw: unknown):
  | { kind: "none" }
  | { kind: "resolved"; analysis: ListAnalysis }
  | { kind: "clarify"; question: string } {
  const request = normalizeAnalysisText(text);
  const topCountMatch = request.match(/\btop\s+(\d+)\b/);
  const hasTopCue = /\btop\b/.test(request);
  const topCount = topCountMatch ? Number(topCountMatch[1]) : undefined;
  const maximum = /\b(?:nhieu(?:\s+[a-z]+){0,4}\s+nhat|cao(?:\s+[a-z]+){0,4}\s+nhat|lon(?:\s+[a-z]+){0,4}\s+nhat|dung dau)\b/.test(request);
  const minimum = /\b(?:it\s+(?:[a-z]+\s+){1,3}nhat|thap nhat|nho nhat)\b/.test(request);
  const sorting = /\b(?:sap xep|xep theo|xep hang)\b/.test(request) && /\b(?:giam dan|tang dan|cao xuong thap|thap len cao)\b/.test(request);
  const invalidTopCount = hasTopCue && (!topCount || topCount < 1 || topCount > 1000);
  if (!maximum && !minimum && !sorting && !hasTopCue) return { kind: "none" };

  const numericFields = Object.entries(contract.fields).filter(([, definition]) => definition.type === "number");
  const requestTerms = new Set(request.split(/[^a-z0-9]+/).filter(Boolean));
  const stopWords = new Set(["con", "thieu", "gioi", "da", "tong", "tien", "so", "ty", "le", "dat", "nhan", "su"]);
  const scoredMatches = numericFields.flatMap(([key, definition]) => {
    const phrases = [...(definition.aliases || []), definition.label, key]
      .map(normalizeAnalysisText).filter(term => term.length >= 4);
    const labelWords = normalizeAnalysisText(definition.label).split(/[^a-z0-9]+/)
      .filter(term => term.length >= 4 && !stopWords.has(term));
    const phraseMatches = phrases.filter(term => request.includes(term));
    const wordMatches = labelWords.filter(term => requestTerms.has(term));
    const score = Math.max(0, ...phraseMatches.map(term => term.split(/\s+/).length), ...wordMatches.map(() => 1));
    return score ? [{ key, definition, score }] : [];
  });
  const bestScore = Math.max(0, ...scoredMatches.map(match => match.score));
  const matches = scoredMatches.filter(match => match.score === bestScore).map(({ key, definition }) => [key, definition] as const);
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
  if (!plain(plan) || Object.keys(plan).some(key => !["filters", "extreme", "sort", "limit", "groupBy", "aggregate", "aggregates", "select"].includes(key))) fail("Phép phân tích này chưa được hỗ trợ.");
  const field = (key: unknown, numeric = false) => {
    if (typeof key !== "string" || !Object.hasOwn(contract.fields, key) || (numeric && contract.fields[key].type !== "number")) fail("Trường phân tích không có trong dữ liệu được phép xem.");
  };
  if (plan.filters !== undefined) {
    if (!Array.isArray(plan.filters) || plan.filters.length > 20) fail("Điều kiện lọc chưa hợp lệ.");
    for (const filter of plan.filters) {
      if (!plain(filter) || Object.keys(filter).some(key => !["field", "operator", "value"].includes(key))) fail("Điều kiện lọc chưa hợp lệ.");
      field(filter.field);
      if (!["eq", "ne", "gt", "gte", "lt", "lte", "contains"].includes(filter.operator)) fail("Phép so sánh chưa được hỗ trợ.");
      const definition = contract.fields[filter.field];
      if (definition.type === "number" ? typeof filter.value !== "number" || !Number.isFinite(filter.value) : typeof filter.value !== "string") fail("Giá trị lọc không đúng kiểu dữ liệu.");
      if (filter.operator === "contains" && definition.type !== "text") fail("Tìm cụm từ chỉ áp dụng cho trường văn bản.");
      if (definition.type !== "number" && !["eq", "ne", "contains"].includes(filter.operator)) fail("Chỉ so sánh lớn hơn hoặc nhỏ hơn trên trường số.");
      if (definition.values && !Object.hasOwn(definition.values, String(filter.value))) fail("Giá trị lọc không thuộc các lựa chọn của trường dữ liệu.");
    }
  }
  for (const key of ["extreme", "sort"] as const) if (plan[key] !== undefined) {
    if (!plain(plan[key]) || Object.keys(plan[key]).some(k => !["field", "direction"].includes(k))) fail("Điều kiện xếp hạng chưa hợp lệ.");
    field(plan[key].field, key === "extreme");
    if (!(key === "extreme" ? ["min", "max"] : ["asc", "desc"]).includes(plan[key].direction)) fail("Chiều xếp hạng chưa hợp lệ.");
  }
  if (plan.limit !== undefined && (!Number.isInteger(plan.limit) || plan.limit < 1 || plan.limit > 1000)) fail("Số kết quả cần nằm trong khoảng 1–1.000.");
  if (plan.groupBy !== undefined) field(plan.groupBy);
  const aggregates = plan.aggregates === undefined ? (plan.aggregate === undefined ? [] : [plan.aggregate]) : plan.aggregates;
  if (plan.aggregate !== undefined && plan.aggregates !== undefined) fail("Chỉ dùng aggregate hoặc aggregates trong cùng một yêu cầu.");
  if (plan.aggregates !== undefined && (!Array.isArray(plan.aggregates) || plan.aggregates.length < 1 || plan.aggregates.length > 10)) fail("Cần có từ 1 đến 10 phép tổng hợp.");
  for (const aggregate of aggregates) {
    if (!plain(aggregate) || Object.keys(aggregate).some(k => !["operation", "field"].includes(k)) || !["count", "sum", "avg"].includes(aggregate.operation)) fail("Phép tổng hợp chưa được hỗ trợ.");
    if (aggregate.operation !== "count" || aggregate.field !== undefined) field(aggregate.field, true);
    if (aggregate.operation !== "count" && aggregate.field === undefined) fail("Phép tính tổng hoặc trung bình cần chọn một trường số.");
  }
  if (plan.select !== undefined && (!Array.isArray(plan.select) || plan.select.length < 1 || plan.select.length > 20 || plan.select.some((key: unknown) => typeof key !== "string" || !Object.hasOwn(contract.fields, key)))) fail("Các cột hiển thị chưa hợp lệ.");
  if (aggregates.length) {
    if (plan.extreme || plan.sort || plan.limit) fail("Chưa hỗ trợ xếp hạng sau tổng hợp trong cùng một bước.");
  } else if (plan.groupBy) fail("Cần chọn cách tổng hợp cho từng nhóm.");
  return plan;
}

/** Deterministic operations on complete, authorized API data. No model-generated code. */
export function analyzeList(contract: AnalysisContract, rows: Record<string, unknown>[], raw: unknown, complete: boolean) {
  const plan = validateListAnalysis(raw, contract);
  if (!complete) fail("Chưa lấy đủ dữ liệu để kết luận cho toàn bộ danh sách. Mình chưa tính xếp hạng hoặc tổng hợp từ một phần dữ liệu.");
  let selected = rows.filter(row => (plan.filters || []).every(f => {
    const value = row[f.field];
    if (value == null) return false;
    switch (f.operator) {
      case "eq": return value === f.value;
      case "ne": return value !== f.value;
      case "gt": return typeof value === "number" && value > Number(f.value);
      case "gte": return typeof value === "number" && value >= Number(f.value);
      case "lt": return typeof value === "number" && value < Number(f.value);
      case "lte": return typeof value === "number" && value <= Number(f.value);
      case "contains": return typeof value === "string" && value.toLocaleLowerCase("vi").includes(String(f.value).toLocaleLowerCase("vi"));
    }
  }));
  if (plan.extreme) {
    const { field, direction } = plan.extreme;
    const numbers = selected.map(row => row[field]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const extreme = numbers.reduce((best, value) => direction === "max" ? Math.max(best, value) : Math.min(best, value), direction === "max" ? -Infinity : Infinity);
    selected = selected.filter(row => row[field] === extreme);
  }
  if (plan.sort) {
    const { field, direction } = plan.sort;
    selected = [...selected].sort((a, b) => {
      if (a[field] == null) return b[field] == null ? 0 : 1;
      if (b[field] == null) return -1;
      const order = typeof a[field] === "number" ? Number(a[field]) - Number(b[field]) : String(a[field]).localeCompare(String(b[field]), "vi");
      return direction === "desc" ? -order : order;
    });
  }
  const matched = selected.length;
  const format = (value: unknown, key: string) => {
    if (key === "bankAccountNo") {
      const digits = String(value || "").replace(/\D/g, "");
      return digits ? `•••• ${digits.slice(-4)}` : "Chưa cập nhật";
    }
    return value == null ? "Chưa thiết lập" : contract.fields[key]?.values?.[String(value)] || (typeof value === "number" ? value.toLocaleString("vi-VN") : String(value));
  };
  const aggregates = plan.aggregates || (plan.aggregate ? [plan.aggregate] : undefined);
  if (aggregates) {
    const groups = new Map<string, Record<string, unknown>[]>();
    if (!plan.groupBy) groups.set("Tất cả", selected);
    else for (const row of selected) { const key = format(row[plan.groupBy], plan.groupBy); if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(row); }
    return { matched: groups.size, records: [...groups].map(([group, members]) => {
      const record: Record<string, string> = { [plan.groupBy ? contract.fields[plan.groupBy].label : "Phạm vi"]: group };
      for (const { operation, field } of aggregates) {
        const numbers = field ? members.map(row => row[field]).filter((v): v is number => typeof v === "number" && Number.isFinite(v)) : [];
        const total = numbers.reduce((sum, n) => sum + n, 0);
        const value = operation === "count" ? members.length : numbers.length ? (operation === "sum" ? total : total / numbers.length) : null;
        const label = operation === "count" ? (field ? "Số lượng " + contract.fields[field].label.toLowerCase() : "Số lượng") : (operation === "sum" ? "Tổng " : "Trung bình ") + contract.fields[field!].label.toLowerCase();
        record[label] = value == null ? "Không có dữ liệu" : value.toLocaleString("vi-VN");
      }
      return record;
    }) };
  }
  // An extremum includes every tie, even if the model also supplied limit=1.
  if (plan.limit && !plan.extreme) selected = selected.slice(0, plan.limit);
  const selectedFields = (plan.select
    ? plan.select.filter(key => contract.fields[key].display !== false)
    : Object.keys(contract.fields).filter(key => contract.fields[key].display !== false && contract.fields[key].displayByDefault !== false));
  return { matched, records: selected.map(row => Object.fromEntries(selectedFields.map(key => [contract.fields[key].label, format(row[key], key)]))) };
}
export function renderListAnalysis(contract: AnalysisContract, rows: Record<string, unknown>[], raw: unknown, complete: boolean, summary: string) {
  const result = analyzeList(contract, rows, raw, complete);
  return formatAssistantResultTable(summary, result.records, result.records.length < result.matched ? [`Hiển thị ${result.records.length} trong ${result.matched} kết quả phù hợp.`] : []);
}
