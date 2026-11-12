import { a1SheetName, ensureTabs, safeCell, safeSheetName, sheetsFetch } from "./google-order-sheet.service";

export const CUSTOMER_SHEET_HEADERS = [
  "Mã đồng bộ", "Mã khách ERP", "Họ tên", "Số điện thoại", "Email", "Địa chỉ", "Nhu cầu / Ghi chú", "Fanpage", "Cập nhật lúc",
];
export type CustomerSheetRow = {
  key: string; customerCode?: string; name?: string; phone?: string; email?: string;
  address?: string; notes?: string; pageName?: string;
};
export type LeadSheetRow = {
  key: string; customerName: string; phone?: string; email?: string; company?: string; productOfChoice?: string;
  value?: number; status: string; collectionStatus?: string; sourcePlatform?: string; sourceAccountId?: string;
  createdAt?: string | Date; updatedAt?: string | Date; answers?: Record<string, string>;
  intakeFields?: Array<{ key: string; label: string }>;
};
export const LEAD_SHEET_BASE_HEADERS = [
  "Mã Lead", "Họ tên", "Số điện thoại", "Email", "Doanh nghiệp", "Nhu cầu", "Ngân sách dự kiến",
  "Trạng thái xử lý", "Trạng thái thu thập", "Kênh", "Tài khoản nguồn", "Ngày tạo", "Cập nhật lúc",
];
const LEAD_SHEET_MAX_COLUMNS = LEAD_SHEET_BASE_HEADERS.length + 50;
function sheetColumn(number: number) {
  let result = "";
  for (let value = number; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  return result;
}
function leadFieldHeaders(fields: Array<{ key: string; label: string }>) {
  const labelCounts = new Map<string, number>();
  fields.forEach(field => labelCounts.set(field.label, (labelCounts.get(field.label) || 0) + 1));
  return fields.map(field => ({ ...field, header: (labelCounts.get(field.label) || 0) > 1 ? `${field.label} (${field.key})` : field.label }));
}
const leadSheetHeaderCache = new Map<string, { headers: string[]; expiresAt: number }>();
export function resetLeadSheetHeaderCache() { leadSheetHeaderCache.clear(); }
async function leadSheetHeaders(spreadsheetId: string, configuredName: string) {
  const name = safeSheetName(configuredName, "Leads");
  const cacheKey = `${spreadsheetId}/${name}`;
  const cached = leadSheetHeaderCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { name, headers: [...cached.headers] };
  await ensureTabs(spreadsheetId, [name], LEAD_SHEET_MAX_COLUMNS);
  const range = `${a1SheetName(name)}!A1:${sheetColumn(LEAD_SHEET_MAX_COLUMNS)}1`;
  const path = `${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  const result = await request(path) as { values?: unknown[][] };
  let headers = (result.values?.[0] || []).map(value => String(value || ""));
  if (headers.length && headers[0] !== LEAD_SHEET_BASE_HEADERS[0]) {
    throw new Error("Tab đang có cấu trúc khác. Hãy dùng một tab riêng cho dữ liệu Lead.");
  }
  if (!headers.length) {
    headers = [...LEAD_SHEET_BASE_HEADERS];
    await request(`${path}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [headers] }) });
  }
  leadSheetHeaderCache.set(cacheKey, { headers: [...headers], expiresAt: Date.now() + 60_000 });
  return { name, headers };
}
const request = (path: string, options: RequestInit = {}) =>
  sheetsFetch(path, { ...options, signal: AbortSignal.timeout(20_000) });

export const googleCustomerSheetService = {
  async prepare(spreadsheetId: string, configuredName: string) {
    const name = safeSheetName(configuredName, "Leads");
    await ensureTabs(spreadsheetId, [name]);
    const range = `${a1SheetName(name)}!A1:I1`;
    const path = `${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
    const result = await request(path) as { values?: unknown[][] };
    const header = result.values?.[0] || [];
    if (header.length && !CUSTOMER_SHEET_HEADERS.every((value, index) => header[index] === value)) {
      throw new Error("Tab đã có dữ liệu với mẫu cột khác. Hãy chọn một tab riêng cho khách tiềm năng.");
    }
    if (!header.length) await request(`${path}?valueInputOption=RAW`, {
      method: "PUT", body: JSON.stringify({ values: [CUSTOMER_SHEET_HEADERS] }),
    });
    return name;
  },

  async upsert(spreadsheetId: string, configuredName: string, customer: CustomerSheetRow) {
    const name = await this.prepare(spreadsheetId, configuredName);
    const lookup = `${a1SheetName(name)}!A2:A`;
    const result = await request(`${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(lookup)}`) as { values?: unknown[][] };
    const index = (result.values || []).findIndex(row => String(row[0] || "") === customer.key);
    const row = [customer.key, customer.customerCode, customer.name, customer.phone, customer.email,
      customer.address, customer.notes, customer.pageName, new Date().toISOString()].map(safeCell);
    const range = index >= 0 ? `${a1SheetName(name)}!A${index + 2}:I${index + 2}` : `${a1SheetName(name)}!A:I`;
    await request(`${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}${index >= 0
      ? "?valueInputOption=RAW" : ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS"}`, {
      method: index >= 0 ? "PUT" : "POST", body: JSON.stringify({ values: [row] }),
    });
  },

  async prepareLead(spreadsheetId: string, configuredName: string) {
    return (await leadSheetHeaders(spreadsheetId, configuredName)).name;
  },

  async upsertLead(spreadsheetId: string, configuredName: string, lead: LeadSheetRow, knownRowNumber?: number, searchBeforeAppend = false): Promise<number> {
    const { name, headers } = await leadSheetHeaders(spreadsheetId, configuredName);
    const quoted = a1SheetName(name);
    const fields = leadFieldHeaders(lead.intakeFields || []);
    const newHeaders = [...headers];
    for (const field of fields) if (!newHeaders.includes(field.header)) newHeaders.push(field.header);
    if (newHeaders.length > LEAD_SHEET_MAX_COLUMNS) throw new Error("Sheet Lead đã đạt giới hạn 50 trường tùy chỉnh. Hãy tạo tab riêng cho nhóm dữ liệu mới.");
    if (newHeaders.length > headers.length) {
      const range = `${quoted}!A1:${sheetColumn(newHeaders.length)}1`;
      await request(`${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
        method: "PUT", body: JSON.stringify({ values: [newHeaders] }),
      });
      leadSheetHeaderCache.set(`${spreadsheetId}/${name}`, { headers: [...newHeaders], expiresAt: Date.now() + 60_000 });
    }

    let rowNumber = knownRowNumber;
    if ((!rowNumber || rowNumber < 2) && searchBeforeAppend) {
      const keysRange = `${quoted}!A2:A`;
      const keysResult = await request(`${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(keysRange)}`) as { values?: unknown[][] };
      const index = (keysResult.values || []).findIndex(row => String(row[0] || "") === lead.key);
      if (index >= 0) rowNumber = index + 2;
    }

    const standardValues: Record<string, unknown> = {
      "Mã Lead": lead.key, "Họ tên": lead.customerName, "Số điện thoại": lead.phone || "", "Email": lead.email || "",
      "Doanh nghiệp": lead.company || "", "Nhu cầu": lead.productOfChoice || "", "Ngân sách dự kiến": lead.value ?? "",
      "Trạng thái xử lý": lead.status, "Trạng thái thu thập": lead.collectionStatus || "",
      "Kênh": lead.sourcePlatform || "", "Tài khoản nguồn": lead.sourceAccountId || "",
      "Ngày tạo": lead.createdAt ? new Date(lead.createdAt).toISOString() : "",
      "Cập nhật lúc": lead.updatedAt ? new Date(lead.updatedAt).toISOString() : new Date().toISOString(),
    };
    const valuesByHeader: Record<string, unknown> = { ...standardValues };
    for (const field of fields) valuesByHeader[field.header] = lead.answers?.[field.key] || "";

    const updatedRow = newHeaders.map(header => safeCell(valuesByHeader[header]));
    if (rowNumber) {
      const range = `${quoted}!A${rowNumber}:${sheetColumn(updatedRow.length)}${rowNumber}`;
      await request(`${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
        method: "PUT", body: JSON.stringify({ values: [updatedRow] }),
      });
      return rowNumber;
    }
    const appendRange = `${quoted}!A:${sheetColumn(updatedRow.length)}`;
    const response = await request(`${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST", body: JSON.stringify({ values: [updatedRow] }),
    }) as { updates?: { updatedRange?: string } };
    const match = /!A(\d+):/i.exec(response.updates?.updatedRange || "");
    if (!match) throw new Error("Google Sheets không trả về vị trí dòng Lead vừa ghi.");
    return Number(match[1]);
  },
};
