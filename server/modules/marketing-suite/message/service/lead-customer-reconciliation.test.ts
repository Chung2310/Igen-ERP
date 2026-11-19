import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { LeadContractModel } from "../model/lead-contract.model";
import { LeadIntakeProfileModel } from "../model/lead-intake-profile.model";
import { TelecomInvoiceSettingsModel } from "../model/telecom-invoice.model";
import { readLeadContractWorkbook, reconcileLeadContracts } from "./lead-contract-reconciliation";

let mongo: MongoMemoryServer;
const models = [CRMTicketModel, LeadContractModel, LeadIntakeProfileModel, TelecomInvoiceSettingsModel];
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all(models.map(model => model.init()));
}, 60_000);
afterEach(async () => { for (const model of models) await model.collection.deleteMany({}); });
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
const headers = ["STT", "Số HĐ", "Tên Khách Hàng", "Địa Chỉ", "Dịch vụ", "Online", "Thời gian", "Doanh thu", "Hoa Hồng"];
function workbook(rows: unknown[][], sheetName = "Bảng kê ", otherSheets: Record<string, unknown[][]> = {}) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), sheetName);
  for (const [name, data] of Object.entries(otherSheets)) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(data), name);
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
async function lead(code: string, overrides: Record<string, unknown> = {}, companyCode = "CUSTOMERS") {
  return CRMTicketModel.create({ companyCode, customerName: "Nguyễn An", answers: {
    nha_mang: "FPT", so_hop_dong: code, ho_va_ten: "Nguyễn An", dia_chi_lap_dat: "Căn 101 Green Pearl",
    dich_vu: "Internet; Truyền hình", moc_hoa_mang: "2023-07-04", ...overrides,
  } });
}

describe("Customer information reconciliation", () => {
  it("preserves source order, repeated STT/customer cells and even identical lines while matching services individually", async () => {
    await lead("B002");
    await lead("A001", { dich_vu: "Internet" });
    const bytes = workbook([headers,
      [1, "B002", "Nguyễn An", "Căn 101 Green Pearl", "Internet", "04/07/2023", "01/02/2026-28/02/2026"],
      [1, "B002", "Nguyễn An", "Căn 101 Green Pearl", "Truyền hình", "04/07/2023", "01/02/2026-28/02/2026"],
      [1, "B002", "Nguyễn An", "Căn 101 Green Pearl", "Truyền hình", "04/07/2023", "01/02/2026-28/02/2026"],
      [2, "A001", "Nguyễn An", "Căn 101 Green Pearl", "Truyền hình", "04/07/2023", "01/03/2026-31/03/2026"],
    ]);
    const report = await reconcileLeadContracts("CUSTOMERS", "FPT", 2026, 1, bytes);
    expect(report).toMatchObject({ excelCount: 2, sourceRowCount: 4, duplicates: 1 });
    expect(report.excelRows?.map(row => [row.code, row.sourceSerial, row.sourceRows?.[0], row.status])).toEqual([
      ["B002", "1", 2, "matched"], ["B002", "1", 3, "matched"], ["B002", "1", 4, "matched"], ["A001", "2", 5, "different"],
    ]);
    expect(report.excelRows?.map(row => row.excel?.customerName)).toEqual(Array(4).fill("Nguyễn An"));
    expect(report.excelRows?.map(row => row.excel?.services)).toEqual([["Internet"], ["Truyền hình"], ["Truyền hình"], ["Truyền hình"]]);
    expect(await CRMTicketModel.countDocuments({ companyCode: "CUSTOMERS" })).toBe(2);
  });
  it("compares an explicitly recorded reconciliation quarter and keeps missing period data optional", async () => {
    await lead("A", { ky_doi_soat: "Quý 2/2026", dich_vu: "Internet" });
    await lead("B", { ky_doi_soat: "Quý 1/2026", dich_vu: "Internet" });
    await lead("C", { ky_doi_soat: "03/2026", dich_vu: "Internet" });
    const report = await reconcileLeadContracts("CUSTOMERS", "FPT", 2026, 1, workbook([headers,
      [1, "A", "Nguyễn An", "Căn 101 Green Pearl", "Internet", "04/07/2023", "01/02/2026-28/02/2026"],
      [2, "B", "Nguyễn An", "Căn 101 Green Pearl", "Internet", "04/07/2023", "01/03/2026-31/03/2026"],
      [3, "C", "Nguyễn An", "Căn 101 Green Pearl", "Internet", "04/07/2023", "01/02/2026-28/02/2026"],
    ]));
    expect(report.rows[0]).toMatchObject({ status: "different", differences: [expect.objectContaining({ field: "periods" })] });
    expect(report.rows[1].status).toBe("matched");
    expect(report.rows[2]).toMatchObject({ status: "different", differences: [expect.objectContaining({ field: "periods" })] });
  });
  it("keeps separate services and periods for one contract and never compares financial columns", async () => {
    await lead("0001");
    const bytes = workbook([headers,
      [1, "0001", "Nguyen An", "Can 101 Green Pearl", "Cuoc Internet", "04/07/2023", "01/02/2026-28/02/2026", 100, 999999],
      [1, "0001", "Nguyễn An", "Căn 101 Green Pearl", "Truyen hinh co ban", "04/07/2023", "01/02/2026-28/02/2026", 200, 0],
      [1, "0001", "Nguyễn An", "Căn 101 Green Pearl", "Internet", "04/07/2023", "01/03/2026-31/03/2026", 300, -1],
    ]);
    const report = await reconcileLeadContracts("CUSTOMERS", "FPT", 2026, 1, bytes);
    expect(report).toMatchObject({ excelCount: 1, duplicates: 0, sourceRowCount: 3 });
    expect(report.rows[0]).toMatchObject({ code: "0001", status: "matched", sourceRows: [2, 3, 4], differences: [] });
    expect(report.rows[0].excel?.periods).toHaveLength(2);
    expect(report.excelRows?.map(row => [row.sourceRows?.[0], row.status])).toEqual([[2, "matched"], [3, "matched"], [4, "matched"]]);
    expect(JSON.stringify(report)).not.toMatch(/999999|Hoa Hồng|Doanh thu/);
  });

  it("selects the VNPT quarter sheet, preserves month precision and matches a historical customer", async () => {
    await lead("unused", { nha_mang: "VNPT", account: "abc001", dich_vu: "Internet", moc_hoa_mang: "2023-07-04" });
    const rows = [["Từ 01/01/2026 đến 31/03/2026"], ["STT", "Dịch vụ", "Mã khách hàng/ ACC", "Tên khách hàng", "Địa chỉ", "Tháng HM", "Năm HM"],
      [1, "Fiber", "abc001", "Nguyễn An", "Căn 101 Green Pearl", 7, 2023]];
    const bytes = workbook(rows, "Q1.2026", { "12": rows, "PBH -Quý 3.2025": rows });
    const report = await reconcileLeadContracts("CUSTOMERS", "VNPT", 2026, 1, bytes);
    expect(report).toMatchObject({ identityLabel: "Mã khách hàng / Account", sheetName: "Q1.2026", period: "Quý 1/2026" });
    expect(report.rows[0]).toMatchObject({ code: "ABC001", status: "matched", excel: { activatedAt: "7/2023" } });
    expect(() => readLeadContractWorkbook(bytes, "VNPT", 2026, 2)).toThrow();
  });

  it("distinguishes differences from missing information and excludes other providers and companies", async () => {
    await lead("A", { dia_chi_lap_dat: "Căn 202", dich_vu: "Internet" });
    await lead("B", { dia_chi_lap_dat: "", dich_vu: "Internet", moc_hoa_mang: "" });
    await lead("C", { nha_mang: "VNPT" });
    await lead("D", {}, "OTHER");
    const bytes = workbook([headers, ...["A", "B", "C", "D"].map((code, index) => [index + 1, code, "Nguyễn An", "Căn 101 Green Pearl", "Internet"])]);
    const report = await reconcileLeadContracts("CUSTOMERS", "FPT", 2026, 1, bytes);
    expect(report.rows.map(row => [row.code, row.status])).toEqual([["A", "different"], ["B", "incomplete"], ["C", "excel_only"], ["D", "excel_only"]]);
    expect(report.rows[0].differences).toContainEqual(expect.objectContaining({ field: "address", reason: "different" }));
    expect(report.rows[1].differences).toContainEqual(expect.objectContaining({ field: "address", reason: "missing_lead" }));
    expect(await CRMTicketModel.countDocuments()).toBe(4);
  });

  it("holds duplicate Leads, conflicting Excel customer data and an unknown provider for review", async () => {
    await lead("A"); await lead("A");
    await lead("B"); await lead("C", { nha_mang: "" });
    const bytes = workbook([headers,
      [1, "A", "Nguyễn An", "Căn 101", "Internet"],
      [2, "B", "Nguyễn An", "Căn 101", "Internet"],
      [3, "B", "Nguyễn Bình", "Căn 202", "Internet"],
      [4, "C", "Nguyễn An", "Căn 101", "Internet"],
    ]);
    const report = await reconcileLeadContracts("CUSTOMERS", "FPT", 2026, 1, bytes);
    expect(report.rows.map(row => row.status)).toEqual(["needs_review", "needs_review", "needs_review"]);
    expect(report.rows.every(row => !row.leadId)).toBe(true);
  });

  it("uses configured custom field names and includes old subscribers without using message dates", async () => {
    await LeadIntakeProfileModel.create({ companyCode: "CUSTOMERS", version: 1, status: "active", goal: "Đối soát", completionMessage: "Đã nhận",
      fields: [{ key: "custom_id", label: "Số hợp đồng", question: "Mã?" }, { key: "operator", label: "Nhà mạng", question: "Nhà mạng?" }] });
    await CRMTicketModel.create({ companyCode: "CUSTOMERS", customerName: "Khách cũ", lastInteractionAt: new Date("2027-01-01"), answers: { custom_id: "OLD001", operator: "FPT" } });
    await lead("FUTURE", { moc_hoa_mang: "2027-01" });
    const report = await reconcileLeadContracts("CUSTOMERS", "FPT", 2026, 1, workbook([headers, [1, "NEW001"]]));
    expect(report.rows.map(row => [row.code, row.status])).toEqual([["NEW001", "excel_only"], ["OLD001", "lead_only"]]);
  });

  it("reports missing/invalid codes and counts exact information repeats while retaining every source row", () => {
    const parsed = readLeadContractWorkbook(workbook([headers, [1, "0001", "An"], [2, "0001", "An"], [3, null], [4, "mã lỗi"]]));
    expect(parsed).toMatchObject({ duplicates: 1, invalidRows: [4, 5], codes: new Set(["0001"]) });
    expect(parsed.records.map(row => row.row)).toEqual([2, 3]);
  });

  it("rejects the wrong selected quarter and does not infer a customer identity from invoice numbers", () => {
    expect(() => readLeadContractWorkbook(workbook([["Từ 01/04/2026 đến 30/06/2026"], headers, [1, "A"]]), "FPT", 2026, 1)).toThrow(/Kỳ/);
    expect(() => readLeadContractWorkbook(workbook([["STT", "Số hóa đơn", "Tên khách hàng"], [1, "INV001", "An"]]))).toThrow(/Số HĐ/);
  });
});
