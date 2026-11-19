import mongoose from "mongoose";
import * as XLSX from "xlsx";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { LeadContractModel } from "../model/lead-contract.model";
import { LeadIntakeProfileModel } from "../model/lead-intake-profile.model";
import { TelecomInvoiceSettingsModel } from "../model/telecom-invoice.model";
import { previewLeadReconciliation, readLeadReconciliationRange, readLeadContractWorkbook, reconcileLeadContracts } from "./lead-contract-reconciliation";

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
  it("selects full Vietnam calendar days by Lead creation and reports Excel matches outside the range separately", async () => {
    const range = { from: "2026-01-01", to: "2026-03-31" };
    const dates = { START: "2025-12-31T17:00:00.000Z", LAST: "2026-03-31T16:59:59.999Z",
      BEFORE: "2025-12-31T16:59:59.999Z", AFTER: "2026-03-31T17:00:00.000Z", ERP_ONLY: "2026-02-02T00:00:00Z" };
    for (const [code, createdAt] of Object.entries(dates)) {
      const item = await lead(code, { dich_vu: "Internet", moc_hoa_mang: code === "ERP_ONLY" ? "2027-01" : "2023-07-04" });
      await CRMTicketModel.collection.updateOne({ _id: item._id }, { $set: { createdAt: new Date(createdAt) } });
    }
    await lead("OTHER_PROVIDER", { nha_mang: "VNPT" });
    await lead("OTHER_COMPANY", {}, "OTHER");
    expect(await previewLeadReconciliation("CUSTOMERS", "FPT", range)).toMatchObject({ ...range, dateField: "createdAt", leadCount: 3, invalidCodeCount: 0, missingDateCount: 0 });
    const bytes = workbook([headers, ...["START", "LAST", "BEFORE", "AFTER", "MISSING"].map((code, index) =>
      [index + 1, code, "Nguyễn An", "Căn 101 Green Pearl", "Internet", "04/07/2023"])]);
    const before = await CRMTicketModel.find({}).sort({ _id: 1 }).lean();
    const report = await reconcileLeadContracts("CUSTOMERS", "FPT", 2026, 1, bytes, range);
    expect(report.scope?.leadCount).toBe(3);
    expect(Object.fromEntries(report.rows.map(row => [row.code, row.status]))).toEqual({
      AFTER: "out_of_scope", BEFORE: "out_of_scope", ERP_ONLY: "lead_only", LAST: "matched", MISSING: "excel_only", START: "matched",
    });
    expect(report.excelRows?.map(row => row.status)).toEqual(["matched", "matched", "out_of_scope", "out_of_scope", "excel_only"]);
    expect(report.rows.find(row => row.code === "BEFORE")).toMatchObject({ leadCreatedAt: dates.BEFORE, issue: expect.stringContaining("ngoài khoảng ngày") });
    expect(await CRMTicketModel.find({}).sort({ _id: 1 }).lean()).toEqual(before);
  });

  it("holds missing dates, missing identity codes and duplicate codes for review rather than reporting them as absent", async () => {
    const range = { from: "2026-01-01", to: "2026-12-31" };
    const noDate = await lead("NO_DATE");
    await CRMTicketModel.collection.updateOne({ _id: noDate._id }, { $unset: { createdAt: 1 } });
    const noCode = await lead("", { so_hop_dong: "", dich_vu: "Internet" });
    await CRMTicketModel.collection.updateOne({ _id: noCode._id }, { $set: { createdAt: new Date("2026-02-01") } });
    for (const createdAt of ["2025-01-01", "2026-02-01"]) {
      const duplicate = await lead("DUP");
      await CRMTicketModel.collection.updateOne({ _id: duplicate._id }, { $set: { createdAt: new Date(createdAt) } });
    }
    const report = await reconcileLeadContracts("CUSTOMERS", "FPT", 2026, 1, workbook([headers, [1, "NO_DATE"], [2, "DUP"]]), range);
    expect(report.rows).toHaveLength(3);
    expect(report.rows.every(row => row.status === "needs_review")).toBe(true);
    expect(report.rows.find(row => row.code === "NO_DATE")?.issue).toContain("thiếu ngày tạo");
    expect(report.rows.find(row => row.code === "DUP")?.issue).toContain("nhiều Lead");
    expect(report.rows.find(row => row.code === "Chưa có mã")?.issue).toContain("thiếu hoặc sai định dạng mã");
    expect(await previewLeadReconciliation("CUSTOMERS", "FPT", range)).toMatchObject({ leadCount: 2, missingDateCount: 1, invalidCodeCount: 1 });
  });

  it("recognizes outside-range identities with archived custom field snapshots and case-insensitive codes", async () => {
    await CRMTicketModel.collection.insertOne({ companyCode: "CUSTOMERS", createdAt: new Date("2020-01-01"),
      customerName: "Nguyễn An", answers: { old_id: " lowercase.id ", old_provider: "FPT" },
      intakeFields: [{ key: "old_id", label: "Số hợp đồng" }, { key: "old_provider", label: "Nhà mạng" }] });
    const report = await reconcileLeadContracts("CUSTOMERS", "FPT", 2026, 1, workbook([headers, [1, "LOWERCASE.ID"]]), { from: "2026-01-01", to: "2026-03-31" });
    expect(report.rows).toMatchObject([{ code: "LOWERCASE.ID", status: "out_of_scope" }]);
    expect(report.scope?.leadCount).toBe(0);
  });

  it("reports missing fields on both sides and does not use an autogenerated subscriber label as a customer name", async () => {
    const item = await lead("EMPTY", { ho_va_ten: "", dia_chi_lap_dat: "", dich_vu: "" });
    await CRMTicketModel.collection.updateOne({ _id: item._id }, { $set: { customerName: "Thuê bao EMPTY", createdAt: new Date("2026-02-01") } });
    const report = await reconcileLeadContracts("CUSTOMERS", "FPT", 2026, 1, workbook([headers, [1, "EMPTY"]]), { from: "2026-01-01", to: "2026-03-31" });
    expect(report.rows[0].status).toBe("incomplete");
    expect(report.rows[0].differences).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "customerName", reason: "missing_both" }),
      expect.objectContaining({ field: "address", reason: "missing_both" }),
      expect.objectContaining({ field: "services", reason: "missing_both" }),
    ]));
  });

  it("does not call every row complete when an ERP service is absent from all Excel rows", async () => {
    await lead("EXTRA_SERVICE", { dich_vu: "Internet; Truyền hình" });
    const report = await reconcileLeadContracts("CUSTOMERS", "FPT", 2026, 1, workbook([headers,
      [1, "EXTRA_SERVICE", "Nguyễn An", "Căn 101 Green Pearl", "Internet", "04/07/2023"],
    ]));
    expect(report.rows[0].status).toBe("different");
    expect(report.excelRows?.[0]).toMatchObject({ status: "different", differences: [expect.objectContaining({ field: "services", excel: "Internet", lead: "Internet; Truyền hình" })] });
  });

  it.each([["2026-02-30", "2026-03-01"], ["2026-1-01", "2026-03-01"], ["2026-02-01", "2026-01-01"], [undefined, "2026-01-01"], ["2026-01-01", { bad: true }]])("rejects invalid or reversed Lead date ranges %s – %s", (from, to) => {
    expect(() => readLeadReconciliationRange(from, to)).toThrow();
  });
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
    expect(report.rows.find(row => row.code === "A")?.leadId).toBeUndefined();
    expect(report.rows.find(row => row.code === "B")?.leadId).toBeTruthy();
    expect(report.rows.find(row => row.code === "C")?.leadId).toBeTruthy();
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
