import { AssistantError } from "./policy";
import { formatAssistantResultTable } from "../../src/shared/assistant-result-table";

export interface AnalysisContract {
  scopeLabel?: string;
  pagination?: { pageField: string; sizeField: string };
  fields: Record<string, { label: string; type: "number" | "text"; values?: Record<string, string> }>;
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
  filters?: Array<{ field: string; operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"; value: string | number }>;
  extreme?: { field: string; direction: "min" | "max" };
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  groupBy?: string;
  aggregate?: { operation: "count" | "sum" | "avg"; field?: string };
}
const fail = (message: string): never => { throw new AssistantError(message); };
const plain = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === "object" && !Array.isArray(value));
export function validateListAnalysis(raw: unknown, contract: AnalysisContract): ListAnalysis {
  let plan: any = raw;
  if (typeof raw === "string") { try { plan = JSON.parse(raw); } catch { fail("Điều kiện phân tích chưa hợp lệ. Chưa thực hiện tra cứu."); } }
  if (plan == null) return {};
  if (!plain(plan) || Object.keys(plan).some(key => !["filters", "extreme", "sort", "limit", "groupBy", "aggregate"].includes(key))) fail("Phép phân tích này chưa được hỗ trợ.");
  const field = (key: unknown, numeric = false) => {
    if (typeof key !== "string" || !Object.hasOwn(contract.fields, key) || (numeric && contract.fields[key].type !== "number")) fail("Trường phân tích không có trong dữ liệu được phép xem.");
  };
  if (plan.filters !== undefined) {
    if (!Array.isArray(plan.filters) || plan.filters.length > 20) fail("Điều kiện lọc chưa hợp lệ.");
    for (const filter of plan.filters) {
      if (!plain(filter) || Object.keys(filter).some(key => !["field", "operator", "value"].includes(key))) fail("Điều kiện lọc chưa hợp lệ.");
      field(filter.field);
      if (!["eq", "ne", "gt", "gte", "lt", "lte"].includes(filter.operator)) fail("Phép so sánh chưa được hỗ trợ.");
      const definition = contract.fields[filter.field];
      if (definition.type === "number" ? typeof filter.value !== "number" || !Number.isFinite(filter.value) : typeof filter.value !== "string") fail("Giá trị lọc không đúng kiểu dữ liệu.");
      if (definition.type !== "number" && !["eq", "ne"].includes(filter.operator)) fail("Chỉ so sánh lớn hơn hoặc nhỏ hơn trên trường số.");
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
  if (plan.aggregate !== undefined) {
    if (!plain(plan.aggregate) || Object.keys(plan.aggregate).some(k => !["operation", "field"].includes(k)) || !["count", "sum", "avg"].includes(plan.aggregate.operation)) fail("Phép tổng hợp chưa được hỗ trợ.");
    if (plan.aggregate.operation !== "count" || plan.aggregate.field !== undefined) field(plan.aggregate.field, true);
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
  const format = (value: unknown, key: string) => value == null ? "Chưa thiết lập" : contract.fields[key]?.values?.[String(value)] || (typeof value === "number" ? value.toLocaleString("vi-VN") : String(value));
  if (plan.aggregate) {
    const groups = new Map<string, Record<string, unknown>[]>();
    if (!plan.groupBy) groups.set("Tất cả", selected);
    else for (const row of selected) { const key = format(row[plan.groupBy], plan.groupBy); if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(row); }
    const { operation, field } = plan.aggregate;
    return { matched: groups.size, records: [...groups].map(([group, members]) => {
      const numbers = members.map(row => row[field!]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      const total = numbers.reduce((sum, n) => sum + n, 0);
      const value = operation === "count" ? members.length : numbers.length ? (operation === "sum" ? total : total / numbers.length) : null;
      const label = operation === "count" ? "Số lượng" : `${operation === "sum" ? "Tổng" : "Trung bình"} ${contract.fields[field!].label.toLowerCase()}`;
      return { [plan.groupBy ? contract.fields[plan.groupBy].label : "Phạm vi"]: group, [label]: value == null ? "Không có dữ liệu" : value.toLocaleString("vi-VN") };
    }) };
  }
  // An extremum includes every tie, even if the model also supplied limit=1.
  if (plan.limit && !plan.extreme) selected = selected.slice(0, plan.limit);
  return { matched, records: selected.map(row => Object.fromEntries(Object.keys(contract.fields).map(key => [contract.fields[key].label, format(row[key], key)]))) };
}
export function renderListAnalysis(contract: AnalysisContract, rows: Record<string, unknown>[], raw: unknown, complete: boolean, summary: string) {
  const result = analyzeList(contract, rows, raw, complete);
  return formatAssistantResultTable(summary, result.records, result.records.length < result.matched ? [`Hiển thị ${result.records.length} trong ${result.matched} kết quả phù hợp.`] : []);
}
