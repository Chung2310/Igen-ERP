import type { AssistantOperation } from "./catalog";
import type { AssistantField } from "../../src/shared/assistant-workflow";
import { formatAssistantTemporalValue } from "../../src/shared/assistant-date";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
const populated = (value: unknown) => value !== undefined && value !== null && value !== "";

/** Independent of the model's extracted values. Fail closed for recognizable
 * report constraints that cannot be accounted for by the selected contract.
 * This is a conservative check, not a claim to parse every natural-language condition. */
export function missingReportConstraint(text: string, operation: Pick<AssistantOperation, "method" | "readOnly" | "fields" | "analysis">, values: Record<string, unknown>): string | undefined {
  if (operation.method !== "GET" && !operation.readOnly) return;
  const request = normalize(text);
  const fieldValue = (field: AssistantField) => values[field.key];
  const numeric = /\b(luong|hoc phi|doanh thu|cong no|tong tien|so luong|so buoi|diem)\s+(?:con\s+)?(tren|hon|duoi|it hon|it nhat|toi thieu|toi da|khong qua|lon hon|nho hon)\s+(\d+(?:[.,]\d+)?)\s*(trieu|ty|nghin|ngan)?\b/g;
  const units: Record<string, number> = { trieu: 1e6, ty: 1e9, nghin: 1000, ngan: 1000 };
  const operators: Record<string, string> = { tren: "gt", hon: "gt", "lon hon": "gt", duoi: "lt", "it hon": "lt", "nho hon": "lt", "it nhat": "gte", "toi thieu": "gte", "toi da": "lte", "khong qua": "lte" };
  const aliases: Record<string, RegExp> = { luong: /luong|salary|pay/, "hoc phi": /hoc phi|tuition|fee/, "doanh thu": /doanh thu|revenue|sales/, "cong no": /cong no|debt|balance/, "tong tien": /tong tien|total|amount/, "so luong": /so luong|quantity|count/, "so buoi": /so buoi|days|sessions/, diem: /diem|score/ };
  for (const match of request.matchAll(numeric)) {
    const amount = Number(match[3].replace(",", ".")) * (units[match[4]] || 1);
    let filters: any[] = [];
    try { const analysis = typeof values.analysis === "string" ? JSON.parse(values.analysis) : values.analysis; filters = (analysis as any)?.filters || []; } catch { /* Invalid analysis is handled by its validator. */ }
    const covered = Array.isArray(filters) && filters.some(filter => {
      const schema = operation.analysis?.fields?.[filter.field];
      return schema && aliases[match[1]].test(normalize(`${filter.field} ${schema.label}`)) && filter.operator === operators[match[2]] && filter.value === amount;
    });
    if (!covered) return "Mình chưa có bộ lọc đã kiểm chứng cho điều kiện số liệu bạn nêu. Mình chưa chạy báo cáo để tránh trả kết quả không đúng phạm vi. Bạn có thể chọn một báo cáo hỗ trợ điều kiện này hoặc xác nhận xem không giới hạn điều kiện đó.";
  }
  const range = request.match(/\btu\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+(?:den|toi)\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (range) {
    const expectedFrom = `${range[3] || range[6]}-${range[2].padStart(2, "0")}-${range[1].padStart(2, "0")}`;
    const expectedTo = `${range[6]}-${range[5].padStart(2, "0")}-${range[4].padStart(2, "0")}`;
    const calendarDate = (value: unknown) => {
      if (typeof value !== "string") return undefined;
      const formatted = formatAssistantTemporalValue(value);
      const parts = formatted?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      return parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : undefined;
    };
    const dateFields = operation.fields.filter(field => ["date", "datetime"].includes(field.type));
    const from = dateFields.some(field => /from|start|begin/i.test(field.apiKey || field.key) && calendarDate(fieldValue(field)) === expectedFrom);
    const to = dateFields.some(field => /to|end/i.test(field.apiKey || field.key) && calendarDate(fieldValue(field)) === expectedTo);
    if (!from || !to) return "Khoảng ngày trong báo cáo chưa khớp với yêu cầu của bạn. Mình chưa chạy để tránh lấy dữ liệu ngoài kỳ. Bạn xác nhận lại ngày bắt đầu và kết thúc nhé.";
  }
  const month = request.match(/\bthang\s+(\d{1,2})(?:\s*\/\s*|\s+(?:nam\s+)?)(\d{4})\b/);
  if (month && Number(month[1]) >= 1 && Number(month[1]) <= 12) {
    const expected = `${month[2]}-${month[1].padStart(2, "0")}`;
    const fields = operation.fields.filter(field => populated(fieldValue(field)));
    const monthField = fields.find(field => /^(?:query_)?month$/i.test(field.key));
    const yearField = fields.find(field => /^(?:query_)?year$/i.test(field.key));
    const explicitMonth = Number(monthField && fieldValue(monthField)) === Number(month[1]) && Number(yearField && fieldValue(yearField)) === Number(month[2]);
    const dates = fields.filter(field => ["date", "datetime"].includes(field.type) || /period|anchor/i.test(field.apiKey || field.key));
    const rangeFields = operation.fields.filter(field => ["date", "datetime"].includes(field.type) && /(?:from|to|startDate|endDate|createdFrom|createdTo)$/i.test(field.apiKey || field.key));
    const completeRange = rangeFields.filter(field => populated(fieldValue(field))).every(field => {
      const key=(field.apiKey || field.key).toLowerCase();
      const counterpart=key.endsWith('from') ? key.slice(0,-4)+'to' : key.endsWith('to') ? key.slice(0,-2)+'from'
        : key.endsWith('startdate') ? key.slice(0,-9)+'enddate' : key.endsWith('enddate') ? key.slice(0,-7)+'startdate' : '';
      const paired=rangeFields.find(other=>(other.apiKey || other.key).toLowerCase()===counterpart);
      return !paired || populated(fieldValue(paired));
    });
    const explicitDates = dates.length > 0 && completeRange && dates.every(field => String(fieldValue(field)).startsWith(expected));
    if (!explicitMonth && !explicitDates) return `${operation.analysis?.scopeLabel ? `Nguồn này chỉ hỗ trợ ${operation.analysis.scopeLabel}. ` : ""}Báo cáo chưa được giới hạn đúng tháng ${Number(month[1])}/${month[2]} bạn yêu cầu. Mình chưa chạy để tránh lấy dữ liệu ngoài kỳ. Bạn xác nhận lại khoảng ngày hoặc chọn báo cáo có hỗ trợ lọc theo kỳ nhé.`;
  }
}
