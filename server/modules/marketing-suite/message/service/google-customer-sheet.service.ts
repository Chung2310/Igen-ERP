import { a1SheetName, ensureTabs, safeCell, safeSheetName, sheetsFetch } from "./google-order-sheet.service";

export const CUSTOMER_SHEET_HEADERS = [
  "Mã đồng bộ", "Mã khách ERP", "Họ tên", "Số điện thoại", "Email", "Địa chỉ", "Nhu cầu / Ghi chú", "Fanpage", "Cập nhật lúc",
];
export type CustomerSheetRow = {
  key: string; customerCode?: string; name?: string; phone?: string; email?: string;
  address?: string; notes?: string; pageName?: string;
};
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
};
