import * as XLSX from "xlsx";
import { normalizeLeadContractCode, normalizeLeadContractProvider, type LeadContractComparison, type LeadContractReport, type LeadReconciliationRange, type LeadReconciliationScope, type TelecomCustomerInfo, type TelecomCustomerDifference } from "../../../../../shared/marketing-suite/telecom-invoice";
import type { LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { LeadContractModel } from "../model/lead-contract.model";
import { LeadIntakeProfileModel } from "../model/lead-intake-profile.model";
import { findContractAccountFields } from "./lead-contract.service";
import { invoiceFieldName } from "./telecom-invoice-profile";
import { customerColumn, customerDate, customerText, infoValue, sameCustomerDate, periodKeys, serviceName, serviceValues, type CustomerColumn } from "./telecom-customer-data";

const maxRows = 20_000;
function inputError(message: string) { return Object.assign(new Error(message), { statusCode: 400 }); }
export function readLeadReconciliationRange(from: unknown, to: unknown) {
  const valid = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number(value.slice(0, 4)) >= 2000 && Number(value.slice(0, 4)) <= 2100
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to)) throw inputError("Chọn Từ ngày và Đến ngày hợp lệ để lọc theo ngày tạo Lead.");
  if (from > to) throw inputError("Từ ngày không được sau Đến ngày.");
  return { from, to, $gte: new Date(`${from}T00:00:00+07:00`), $lt: new Date(Date.parse(`${to}T00:00:00+07:00`) + 86_400_000) };
}
type CustomerRow = { code: string; row: number; serial: string; excelCode: string; info: TelecomCustomerInfo };
function cellText(cell?: XLSX.CellObject): string {
  if (!cell) return "";
  if (cell.v instanceof Date) return `${cell.v.getUTCFullYear()}-${String(cell.v.getUTCMonth() + 1).padStart(2, "0")}-${String(cell.v.getUTCDate()).padStart(2, "0")}`;
  return String(cell.t === "n" ? cell.w ?? cell.v ?? "" : cell.v ?? "").trim();
}

export function readLeadContractWorkbook(bytes: Buffer, provider = "FPT", year?: number, quarter?: number) {
  let workbook: XLSX.WorkBook;
  try {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("Invalid XLSX archive");
    const names = XLSX.read(bytes, { type: "buffer", bookSheets: true }).SheetNames;
    const preferred = names.find(name => year && quarter && invoiceFieldName(name) === `q${quarter} ${year}`)
      ?? names.find(name => invoiceFieldName(name) === "bang ke");
    workbook = XLSX.read(bytes, { type: "buffer", ...(preferred ? { sheets: preferred } : {}), sheetRows: maxRows + 31, cellHTML: false, cellFormula: false, cellDates: true });
  } catch { throw inputError("Không đọc được file Excel .xlsx."); }
  const identity = provider === "VNPT" ? "account" : "contract";
  const headers = workbook.SheetNames.flatMap(name => {
    const sheet = workbook.Sheets[name];
    if (!sheet?.["!ref"]) return [];
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 29); row++) {
      const columns: Partial<Record<CustomerColumn | "serial", number>> = {};
      for (let col = range.s.c; col <= Math.min(range.e.c, range.s.c + 255); col++) {
        const label = invoiceFieldName(cellText(sheet[XLSX.utils.encode_cell({ c: col, r: row })]));
        const key = label === "stt" ? "serial" : customerColumn(label);
        if (key) columns[key] = col;
      }
      if (columns[identity] !== undefined) return [{ name, sheet, row, columns }];
    }
    return [];
  });
  const periodName = year && quarter ? `q${quarter} ${year}` : "";
  const selected = headers.find(header => invoiceFieldName(header.name) === periodName)
    ?? headers.find(header => invoiceFieldName(header.name) === "bang ke")
    ?? (headers.length === 1 ? headers[0] : undefined);
  if (!selected) throw inputError(provider === "VNPT"
    ? "Chọn file có cột Mã khách hàng/ACC. Với nhiều kỳ, đặt tên sheet theo dạng Q1.2026 đúng kỳ đã chọn."
    : "Cần một bảng có cột Số HĐ hoặc Mã hợp đồng. Với nhiều bảng, đặt tên bảng cần đối soát là Bảng kê.");
  if (periodName && /^q[1-4] \d{4}$/.test(invoiceFieldName(selected.name)) && invoiceFieldName(selected.name) !== periodName) {
    throw inputError("Kỳ trong tên sheet khác quý/năm đã chọn.");
  }
  // A selected quarter is a reporting period, never the date an image was uploaded.
  const period = year && quarter ? `Quý ${quarter}/${year}` : "";
  const titleText = Array.from({ length: selected.row }, (_, r) => cellText(selected.sheet[`A${r + 1}`])).join(" ");
  const declared = [...titleText.matchAll(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/g)];
  if (year && quarter && declared.length >= 2) {
    const dates = declared.slice(0, 2).map(match => ({ year: Number(match[3]), quarter: Math.ceil(Number(match[2]) / 3) }));
    if (dates.some(date => date.year !== year || date.quarter !== quarter)) throw inputError("Kỳ trong bảng kê khác quý/năm đã chọn. Kiểm tra lại file và kỳ đối soát.");
  }
  const range = XLSX.utils.decode_range(selected.sheet["!fullref"] ?? selected.sheet["!ref"]!);
  if (range.e.r - selected.row > maxRows) throw inputError("Bảng kê vượt quá 20.000 dòng.");
  const codes = new Set<string>(), seen = new Set<string>();
  const invalidRows: number[] = [], records: CustomerRow[] = [];
  let duplicates = 0;
  for (let row = selected.row + 1; row <= range.e.r; row++) {
    const read = (key: CustomerColumn | "serial") => selected.columns[key] === undefined ? ""
      : cellText(selected.sheet[XLSX.utils.encode_cell({ c: selected.columns[key]!, r: row })]);
    const rawCode = read(identity), serial = read("serial");
    if (!rawCode && !/^\d+$/.test(serial)) continue;
    const code = normalizeLeadContractCode(rawCode);
    if (!code) { invalidRows.push(row + 1); continue; }
    const month = read("activationMonth"), activationYear = read("activationYear");
    const info: TelecomCustomerInfo = {
      ...(read("customerName") ? { customerName: read("customerName") } : {}),
      ...(read("address") ? { address: read("address") } : {}),
      ...(read("services") ? { services: serviceValues(read("services")) } : {}),
      ...(read("activatedAt") || (month && activationYear) ? { activatedAt: read("activatedAt") || `${month}/${activationYear}` } : {}),
      ...(read("periods") || period ? { periods: [read("periods") || period] } : {}),
    };
    const fingerprint = JSON.stringify([code, info]);
    if (seen.has(fingerprint)) duplicates++;
    seen.add(fingerprint); codes.add(code);
    records.push({ code, row: row + 1, serial, excelCode: rawCode, info });
  }
  if (!codes.size) throw inputError("Bảng kê chưa có mã khách hàng hợp lệ để đối soát.");
  return { codes, duplicates, invalidRows, records, sheetName: selected.name, identityLabel: identity === "account" ? "Mã khách hàng / Account" : "Số hợp đồng", period };
}

export function leadContractPeriod(year: number, quarter: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(quarter) || quarter < 1 || quarter > 4) throw inputError("Năm hoặc quý chưa hợp lệ.");
  const startMonth = (quarter - 1) * 3;
  return { $gte: new Date(Date.UTC(year, startMonth, 1, -7)), $lt: new Date(Date.UTC(year, startMonth + 3, 1, -7)) };
}

function compare(excel: TelecomCustomerInfo, lead: TelecomCustomerInfo, exactServices = true): TelecomCustomerDifference[] {
  const labels = { customerName: "Tên khách hàng", address: "Địa chỉ", services: "Dịch vụ", activatedAt: "Mốc hòa mạng / kích hoạt", periods: "Kỳ đối soát" } as const;
  return (Object.keys(labels) as Array<keyof typeof labels>).flatMap<TelecomCustomerDifference>(field => {
    const a = infoValue(excel, field), b = infoValue(lead, field);
    // Dates are supplemental. Absence in both sources is not a discrepancy.
    if (field === "activatedAt" && !a && !b) return [];
    if (field === "periods" && (!a || !b)) return [];
    if (!a && !b) return [{ field, label: labels[field], excel: a, lead: b, reason: "missing_both" as const }];
    if (!a || !b) return [{ field, label: labels[field], excel: a, lead: b,
      reason: !a ? "missing_excel" as const : "missing_lead" as const }];
    const equal = field === "services" ? (exactServices
      ? [...new Set(excel.services?.map(serviceName))].sort().join(";") === [...new Set(lead.services?.map(serviceName))].sort().join(";")
      : (excel.services || []).every(service => (lead.services || []).some(value => serviceName(value) === serviceName(service))))
      : field === "periods" ? periodKeys(excel.periods || []).every(month => periodKeys(lead.periods || []).includes(month))
      : field === "activatedAt" ? sameCustomerDate(a, b) : customerText(a) === customerText(b);
    return equal ? [] : [{ field, label: labels[field], excel: a, lead: b, reason: "different" as const }];
  });
}

type CustomerLead = { id: string; info: TelecomCustomerInfo; certain: boolean; codes: string[]; createdAt?: string; inScope: boolean; missingDate: boolean };
async function loadCustomerLeads(companyCode: string, provider: string, range?: LeadReconciliationRange, excelCodes?: Set<string>) {
  const window = range && readLeadReconciliationRange(range.from, range.to);
  const [links, accounts, profiles] = await Promise.all([
    LeadContractModel.find({ companyCode, provider }).select("leadId code").lean(),
    findContractAccountFields(companyCode, provider),
    LeadIntakeProfileModel.find({ companyCode, status: "active" }).sort({ version: -1 }).lean(),
  ]);
  const dateQuery = window ? { $or: [{ createdAt: { $gte: window.$gte, $lt: window.$lt } }, { $expr: { $ne: [{ $type: "$createdAt" }, "date"] } }] } : {};
  const codes = [...(excelCodes || [])];
  // Outside-period records are fetched only to identify Excel codes already on ERP.
  // Field snapshots can use custom keys, so prefilter by answer values, then verify
  // the actual identity field below. Other companies are always excluded.
  const related = codes.length ? [
    { _id: { $in: links.filter(link => excelCodes!.has(link.code)).map(link => link.leadId) } },
    { telecomSubscriberCode: { $in: codes } },
    { $expr: { $anyElementTrue: { $map: { input: { $objectToArray: { $cond: [{ $eq: [{ $type: "$answers" }, "object"] }, "$answers", {}] } }, as: "answer", in: {
      $in: [{ $cond: [{ $eq: [{ $type: "$$answer.v" }, "string"] }, { $toUpper: { $trim: { input: "$$answer.v" } } }, ""] }, codes],
    } } } } },
  ] : [];
  const query = { companyCode, ...(window ? related.length ? { $or: [dateQuery, ...related] } : dateQuery : {}) };
  const identityKind = provider === "VNPT" ? "account" : "contract";
  const linksByLead = new Map<string, typeof links>();
  for (const link of links) linksByLead.set(String(link.leadId), [...(linksByLead.get(String(link.leadId)) || []), link]);
  const accountMap = new Map(accounts.map(account => [`${account.sourcePlatform}:${account.sourceAccountId}`, account]));
  const profileMap = new Map<string, typeof profiles[number]>();
  for (const profile of profiles) {
    const key = profile.platform ? `${profile.platform}:${profile.accountId}` : "company";
    if (!profileMap.has(key)) profileMap.set(key, profile);
  }
  const result: CustomerLead[] = [];
  const cursor = CRMTicketModel.find(query).select("customerName answers intakeFields telecomSubscriberCode sourcePlatform sourceAccountId createdAt").lean().cursor();
  try { for await (const lead of cursor) {
    const companyProfile = profileMap.get("company");
    const accountProfile = profileMap.get(`${lead.sourcePlatform}:${lead.sourceAccountId}`);
    const active = companyProfile?.applyToAllAccounts ? companyProfile : accountProfile ?? companyProfile;
    const definitions = [...(lead.intakeFields || []), ...(active?.fields || [])] as LeadIntakeField[];
    const mapped = new Map<CustomerColumn, string[]>();
    for (const [key, value] of Object.entries(lead.answers || {})) {
      if (typeof value !== "string" || !value.trim()) continue;
      const definition = definitions.find(field => field.key === key);
      const target = customerColumn(key) || (definition && customerColumn(definition.label));
      if (target) mapped.set(target, [...(mapped.get(target) || []), value.trim()]);
    }
    const first = (key: CustomerColumn) => mapped.get(key)?.[0];
    const declaredProvider = normalizeLeadContractProvider(first("provider"));
    if (declaredProvider && declaredProvider !== provider) continue;
    const registered = linksByLead.get(String(lead._id)) || [];
    const account = accountMap.get(`${lead.sourcePlatform}:${lead.sourceAccountId}`);
    const certain = declaredProvider === provider || Boolean(registered.length || account);
    const codeValues = new Set([...(mapped.get(identityKind) || []),
      ...(identityKind === "contract" ? registered.map(link => link.code) : lead.telecomSubscriberCode ? [lead.telecomSubscriberCode] : []),
      ...(identityKind === "contract" && account ? [lead.answers?.[account.key] || ""] : []),
    ].flatMap(value => normalizeLeadContractCode(value) || []));
    if (!certain && !codeValues.size) continue;
    const customerName = first("customerName") || (lead.customerName && !/^(?:(?:Khách mới|Khách nội bộ|Khách hàng)$|(?:Hợp đồng|Thuê bao)\s)/.test(lead.customerName) ? lead.customerName : undefined);
    const info: TelecomCustomerInfo = { ...(customerName ? { customerName } : {}),
      ...(first("address") ? { address: first("address") } : {}),
      ...(mapped.has("services") ? { services: mapped.get("services")!.flatMap(serviceValues) } : {}),
      ...(first("activatedAt") ? { activatedAt: first("activatedAt") } : {}),
      ...(mapped.has("periods") ? { periods: mapped.get("periods") } : {}),
    };
    const created = lead.createdAt instanceof Date && !Number.isNaN(lead.createdAt.getTime()) ? lead.createdAt : undefined;
    const inScope = !window || Boolean(created && created >= window.$gte && created < window.$lt);
    if (window && !inScope && created && ![...codeValues].some(code => excelCodes?.has(code))) continue;
    result.push({ id: String(lead._id), info, certain, codes: [...codeValues], createdAt: created?.toISOString(), inScope, missingDate: !created });
    if (result.length > maxRows) throw inputError("Có hơn 20.000 Lead liên quan. Chọn khoảng ngày ngắn hơn hoặc chia nhỏ file Excel.");
  } } finally { await cursor.close(); }
  return result;
}

function scopeSummary(range: LeadReconciliationRange, leads: CustomerLead[]): LeadReconciliationScope {
  return { ...range, dateField: "createdAt", leadCount: leads.filter(lead => lead.inScope).length,
    missingDateCount: leads.filter(lead => lead.missingDate).length,
    invalidCodeCount: leads.filter(lead => lead.inScope && !lead.codes.length).length };
}

export async function previewLeadReconciliation(companyCode: string, rawProvider: string, range: LeadReconciliationRange) {
  readLeadReconciliationRange(range.from, range.to);
  const provider = normalizeLeadContractProvider(rawProvider);
  if (!provider) throw inputError("Chọn nhà mạng cần đối soát.");
  return scopeSummary(range, await loadCustomerLeads(companyCode, provider, range));
}

export async function reconcileLeadContracts(companyCode: string, rawProvider: string, year: number, quarter: number, bytes: Buffer, range?: LeadReconciliationRange): Promise<LeadContractReport> {
  const period = leadContractPeriod(year, quarter);
  if (range) readLeadReconciliationRange(range.from, range.to);
  const provider = normalizeLeadContractProvider(rawProvider);
  if (!provider) throw inputError("Chọn nhà mạng cần đối soát.");
  const parsed = readLeadContractWorkbook(bytes, provider, year, quarter);
  const leads = await loadCustomerLeads(companyCode, provider, range, parsed.codes);
  const candidates = new Map<string, CustomerLead[]>();
  for (const lead of leads) {
    const activation = customerDate(lead.info.activatedAt || "");
    const startsAfterPeriod = activation && new Date(`${activation.length === 7 ? activation + "-01" : activation}T00:00:00+07:00`) >= period.$lt;
    for (const code of lead.codes) {
      if (!parsed.codes.has(code) && (range ? !lead.inScope : !lead.certain || startsAfterPeriod)) continue;
      candidates.set(code, [...(candidates.get(code) || []), lead]);
    }
  }
  const grouped = new Map<string, CustomerRow[]>();
  for (const record of parsed.records) grouped.set(record.code, [...(grouped.get(record.code) || []), record]);
  const rows = [...new Set([...parsed.codes, ...candidates.keys()])].sort((a, b) => a.localeCompare(b, "vi")).map<LeadContractComparison>(code => {
    const source = grouped.get(code) || [], matches = candidates.get(code) || [];
    const sourceRows = source.map(item => item.row);
    const conflict = (["customerName", "address", "activatedAt"] as const).some(field => {
      const values = source.map(item => infoValue(item.info, field)).filter(Boolean);
      return values.some(value => field === "activatedAt" ? !sameCustomerDate(value, values[0]) : customerText(value) !== customerText(values[0]));
    });
    const excel: TelecomCustomerInfo = Object.assign({}, ...source.map(item => item.info));
    if (source.length) {
      excel.services = [...new Set(source.flatMap(item => item.info.services || []))];
      excel.periods = [...new Set(source.flatMap(item => item.info.periods || []))];
    }
    if (matches.length > 1 || matches.some(item => !item.certain || (range && item.missingDate)) || conflict) return { code, status: "needs_review", sourceRows,
      ...(matches.length === 1 ? { leadId: matches[0].id, customerName: matches[0].info.customerName, lead: matches[0].info, leadCreatedAt: matches[0].createdAt } : {}),
      ...(source.length ? { excel } : {}), issue: conflict ? "Cùng mã trong Excel có thông tin khách hàng không thống nhất."
        : matches.length > 1 ? "Mã có trên nhiều Lead." : matches.some(item => range && item.missingDate) ? "Lead thiếu ngày tạo, chưa xác định được có thuộc khoảng ngày đã chọn hay không." : "Lead chưa xác định được nhà mạng; cần kiểm tra trước khi ghép." };
    if (!matches.length) return { code, status: "excel_only", excel, sourceRows, issue: "Không tìm thấy Lead cùng mã và nhà mạng trên ERP." };
    const match = matches[0];
    const base = { code, leadId: match.id, customerName: match.info.customerName, lead: match.info, sourceRows, leadCreatedAt: match.createdAt };
    if (range && !match.inScope) return { ...base, excel, status: "out_of_scope", issue: "Đã có trên ERP nhưng ngày tạo Lead nằm ngoài khoảng ngày đã chọn; chưa đối chiếu thông tin." };
    if (!source.length) return { ...base, status: "lead_only", issue: "Lead trong phạm vi đã chọn không có mã tương ứng trong Excel." };
    const differences = compare(excel, match.info);
    return { ...base, excel, differences, status: differences.some(item => item.reason === "different") ? "different" : differences.length ? "incomplete" : "matched" };
  });
  if (range) for (const lead of leads.filter(item => (!item.codes.length && item.inScope) || (item.missingDate && !item.codes.some(code => parsed.codes.has(code))))) {
    rows.push({ code: lead.codes[0] || "Chưa có mã", leadId: lead.id, customerName: lead.info.customerName, lead: lead.info,
      status: "needs_review", sourceRows: [], leadCreatedAt: lead.createdAt,
      issue: lead.missingDate ? "Lead thiếu ngày tạo, không thể xác định phạm vi đối soát." : "Lead thiếu hoặc sai định dạng mã đối soát; chưa ghép vào dòng Excel." });
  }
  const byCode = new Map(rows.map(row => [row.code, row]));
  // Match each source line independently and retain its exact position, including
  // identical repeats. One customer's other services must not invalidate this line.
  const excelRows = parsed.records.map<LeadContractComparison>(record => {
    const result = byCode.get(record.code)!;
    const source = { ...result, excel: record.info, sourceRows: [record.row], sourceSerial: record.serial, excelCode: record.excelCode };
    if (!result.lead || result.status === "needs_review" || result.status === "out_of_scope") return source;
    const differences = compare(record.info, result.lead, false);
    // An individual Internet line can match a multi-service Lead, but a service
    // absent from every Excel line must still be reported at customer level.
    const excelServices = new Set(result.excel?.services?.map(serviceName));
    if (result.lead.services?.some(service => !excelServices.has(serviceName(service))) && !differences.some(item => item.field === "services")) {
      const customerDifference = result.differences?.find(item => item.field === "services");
      if (customerDifference) differences.push(customerDifference);
    }
    return { ...source, differences, status: differences.some(item => item.reason === "different") ? "different" : differences.length ? "incomplete" : "matched" };
  });
  return { rows, excelRows, excelCount: parsed.codes.size, duplicates: parsed.duplicates, invalidRows: parsed.invalidRows, provider,
    ...(range ? { scope: scopeSummary(range, leads) } : {}),
    sheetName: parsed.sheetName, identityLabel: parsed.identityLabel, period: parsed.period, sourceRowCount: parsed.records.length };
}
