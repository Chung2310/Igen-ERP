import * as XLSX from "xlsx";
import { normalizeLeadContractCode, type LeadContractComparison, type LeadContractReport } from "../../../../../shared/marketing-suite/telecom-invoice";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { LeadContractModel, LeadContractPhotoModel } from "../model/lead-contract.model";
import { findContractAccountFields } from "./lead-contract.service";
import { invoiceFieldName } from "./telecom-invoice-profile";

const maxRows = 20_000;
const contractHeaders = new Set(["so hd", "ma hd", "so hop dong", "ma hop dong", "contract number", "contract code"]);

function inputError(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export function readLeadContractWorkbook(bytes: Buffer) {
  let workbook: XLSX.WorkBook;
  try {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error("Invalid XLSX archive");
    workbook = XLSX.read(bytes, { type: "buffer", sheetRows: maxRows + 31, cellHTML: false, cellFormula: false });
  } catch {
    throw inputError("Không đọc được file Excel .xlsx.");
  }
  const headers = workbook.SheetNames.flatMap(name => {
    const sheet = workbook.Sheets[name];
    if (!sheet["!ref"]) return [];
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 29); row++) {
      let serialColumn = -1;
      const columns: number[] = [];
      for (let col = range.s.c; col <= Math.min(range.e.c, range.s.c + 255); col++) {
        const cell = sheet[XLSX.utils.encode_cell({ c: col, r: row })];
        const label = invoiceFieldName(String(cell?.v ?? ""));
        if (label === "stt") serialColumn = col;
        if (contractHeaders.has(label)) columns.push(col);
      }
      if (columns.length === 1) return [{ name, sheet, row, col: columns[0], serialColumn }];
    }
    return [];
  });
  const selected = headers.find(header => invoiceFieldName(header.name) === "bang ke")
    ?? (headers.length === 1 ? headers[0] : undefined);
  if (!selected) throw inputError("Cần một bảng có cột Số HĐ hoặc Mã hợp đồng. Nếu file có nhiều bảng, đặt tên bảng cần đối soát là Bảng kê.");
  const range = XLSX.utils.decode_range(selected.sheet["!fullref"] ?? selected.sheet["!ref"]!);
  if (range.e.r - selected.row > maxRows) throw inputError("Bảng kê vượt quá 20.000 dòng.");
  const codes = new Set<string>();
  const invalidRows: number[] = [];
  let duplicates = 0;
  for (let row = selected.row + 1; row <= range.e.r; row++) {
    const cell = selected.sheet[XLSX.utils.encode_cell({ c: selected.col, r: row })];
    const serial = selected.serialColumn < 0 ? undefined : selected.sheet[XLSX.utils.encode_cell({ c: selected.serialColumn, r: row })]?.v;
    if (!String(cell?.v ?? "").trim() && !/^\d+$/.test(String(serial ?? "").trim())) continue;
    const code = typeof cell?.v === "number" && Number.isSafeInteger(cell.v)
      ? normalizeLeadContractCode(cell.w) ?? normalizeLeadContractCode(String(cell.v))
      : normalizeLeadContractCode(cell?.v);
    if (!code) invalidRows.push(row + 1);
    else if (codes.has(code)) duplicates++;
    else codes.add(code);
  }
  if (!codes.size) throw inputError("Bảng kê chưa có mã hợp đồng hợp lệ để đối soát.");
  return { codes, duplicates, invalidRows };
}

export function leadContractPeriod(year: number, quarter: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw inputError("Năm hoặc quý chưa hợp lệ.");
  }
  const startMonth = (quarter - 1) * 3;
  return { $gte: new Date(Date.UTC(year, startMonth, 1, -7)), $lt: new Date(Date.UTC(year, startMonth + 3, 1, -7)) };
}

export async function reconcileLeadContracts(companyCode: string, provider: string, year: number, quarter: number, bytes: Buffer): Promise<LeadContractReport> {
  const period = leadContractPeriod(year, quarter);
  const { codes, duplicates, invalidRows } = readLeadContractWorkbook(bytes);
  const scope = { companyCode, provider };
  const [registered, recordedInPeriod, accountFields] = await Promise.all([
    LeadContractModel.find({ ...scope, $or: [{ code: { $in: [...codes] } }, { firstSeenAt: period }] }).select("leadId code firstSeenAt").lean(),
    LeadContractPhotoModel.distinct("contractCode", { ...scope, status: "recorded", receivedAt: period }),
    findContractAccountFields(companyCode, provider),
  ]);
  const registeredCodes = new Set(registered.map(contract => contract.code));
  const laterReceipts = recordedInPeriod.filter(code => !codes.has(code) && !registeredCodes.has(code));
  const additional = laterReceipts.length ? await LeadContractModel.find({ ...scope, code: { $in: laterReceipts } }).select("leadId code firstSeenAt").lean() : [];
  const links = [...registered, ...additional];
  const [linkedLeads, legacyLeads] = await Promise.all([
    links.length ? CRMTicketModel.find({ companyCode, _id: { $in: links.map(link => link.leadId) } }).select("customerName").lean() : [],
    accountFields.length ? CRMTicketModel.find({ companyCode, $or: accountFields.map(({ key, ...account }) => ({
      ...account, [`answers.${key}`]: { $type: "string" },
    })) }).select("customerName answers sourcePlatform sourceAccountId lastInteractionAt").lean() : [],
  ]);
  const leadMap = new Map<string, string>(linkedLeads.map(lead => [String(lead._id), lead.customerName] as const));
  const candidates = new Map<string, Map<string, string>>();
  const inPeriod = new Set<string>(recordedInPeriod);
  const addLead = (code: string, id: string, customerName: string) => {
    const matches = candidates.get(code) ?? new Map<string, string>();
    matches.set(id, customerName);
    candidates.set(code, matches);
  };
  for (const link of links) {
    const id = String(link.leadId);
    const name = leadMap.get(id);
    if (!name) continue;
    addLead(link.code, id, name);
    if (link.firstSeenAt >= period.$gte && link.firstSeenAt < period.$lt) inPeriod.add(link.code);
  }
  const keysByAccount = new Map(accountFields.map(({ sourcePlatform, sourceAccountId, key }) => [`${sourcePlatform}:${sourceAccountId}`, key]));
  for (const lead of legacyLeads) {
    const key = keysByAccount.get(`${lead.sourcePlatform}:${lead.sourceAccountId}`);
    const code = key && normalizeLeadContractCode(lead.answers?.[key]);
    if (!code) continue;
    addLead(code, String(lead._id), lead.customerName);
    if (lead.lastInteractionAt && lead.lastInteractionAt >= period.$gte && lead.lastInteractionAt < period.$lt) inPeriod.add(code);
  }
  const comparable = new Set([...codes, ...[...inPeriod].filter(code => candidates.has(code))]);
  const rows = [...comparable].sort((a, b) => a.localeCompare(b, "vi")).map<LeadContractComparison>(code => {
    const matches = candidates.get(code);
    if (matches && matches.size > 1) return { code, status: "needs_review" };
    if (!matches) return { code, status: "excel_only" };
    const [leadId, customerName] = matches.entries().next().value!;
    return { code, leadId, customerName, status: codes.has(code) ? "matched" : "lead_only" };
  });
  return { rows, excelCount: codes.size, duplicates, invalidRows };
}
