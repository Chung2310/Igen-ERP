// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { crmService } from "../../services/crmService";
import { LeadTelecomInvoices } from "./LeadTelecomInvoices";
import { LeadContractReconciliation } from "./LeadContractReconciliation";
import { TelecomInvoiceSettingsPanel } from "./TelecomInvoiceSettings";

vi.mock("../../services/crmService", () => ({ crmService: {
  getTelecomInvoiceSettings: vi.fn(), saveTelecomInvoiceSettings: vi.fn(), getLeadTelecomInvoices: vi.fn(),
  getLeadContractProviders: vi.fn(), reconcileLeadContracts: vi.fn(), getLeadContractPhotos: vi.fn(),
  confirmLeadContractPhoto: vi.fn(),
  getLeadReconciliationScope: vi.fn(),
} }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
beforeEach(() => {
  vi.mocked(crmService.getLeadReconciliationScope).mockImplementation(async (_provider, from, to) => ({
    from, to, dateField: "createdAt", leadCount: 2, missingDateCount: 0, invalidCodeCount: 0,
  }));
});
async function previewRange() {
  await screen.findByLabelText("File bảng kê (.xlsx)");
  fireEvent.change(screen.getByLabelText("Từ ngày tạo Lead"), { target: { value: "2026-01-01" } });
  fireEvent.change(screen.getByLabelText("Đến ngày tạo Lead"), { target: { value: "2026-03-31" } });
  fireEvent.click(screen.getByRole("button", { name: "Xem số Lead" }));
  await screen.findByText("2 Lead trong phạm vi 01/01/2026 – 31/03/2026.");
}

it("previews the selected Lead creation dates and invalidates the preview and report when dates change", async () => {
  vi.mocked(crmService.getLeadContractProviders).mockResolvedValue(["FPT"]);
  vi.mocked(crmService.reconcileLeadContracts).mockResolvedValue({ excelCount: 1, duplicates: 0, invalidRows: [], rows: [
    { code: "SCOPED", status: "matched" },
  ] });
  render(<LeadContractReconciliation onClose={vi.fn()} onOpenLead={vi.fn()} onOpenSource={vi.fn()} onSaved={vi.fn()} />);
  const upload = await screen.findByLabelText<HTMLInputElement>("File bảng kê (.xlsx)");
  expect(upload.disabled).toBe(true);
  expect(crmService.getLeadReconciliationScope).not.toHaveBeenCalled();
  await previewRange();
  expect(crmService.getLeadReconciliationScope).toHaveBeenCalledWith("FPT", "2026-01-01", "2026-03-31", expect.any(AbortSignal));
  expect(upload.disabled).toBe(false);
  fireEvent.change(upload, { target: { files: [new File(["file"], "scope.xlsx")] } });
  fireEvent.submit(screen.getByRole("button", { name: "Đối soát thông tin khách hàng" }).closest("form")!);
  expect(await screen.findByText("SCOPED")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Từ ngày tạo Lead"), { target: { value: "2026-02-01" } });
  expect(screen.queryByText("SCOPED")).toBeNull();
  expect(upload.disabled).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Đối soát thông tin khách hàng" }).disabled).toBe(true);
  expect(crmService.getLeadReconciliationScope).toHaveBeenCalledTimes(1);
});

it("rejects reversed dates and allows a failed preview to be retried", async () => {
  vi.mocked(crmService.getLeadContractProviders).mockResolvedValue(["FPT"]);
  render(<LeadContractReconciliation onClose={vi.fn()} onOpenLead={vi.fn()} onOpenSource={vi.fn()} onSaved={vi.fn()} />);
  await screen.findByLabelText("File bảng kê (.xlsx)");
  fireEvent.change(screen.getByLabelText("Từ ngày tạo Lead"), { target: { value: "2026-04-01" } });
  fireEvent.change(screen.getByLabelText("Đến ngày tạo Lead"), { target: { value: "2026-03-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Xem số Lead" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Từ ngày không được sau Đến ngày");
  expect(crmService.getLeadReconciliationScope).not.toHaveBeenCalled();
  vi.mocked(crmService.getLeadReconciliationScope).mockRejectedValueOnce(new Error("Không kết nối được dữ liệu"));
  fireEvent.change(screen.getByLabelText("Từ ngày tạo Lead"), { target: { value: "2026-01-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Xem số Lead" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Không kết nối được dữ liệu");
  fireEvent.click(screen.getByRole("button", { name: "Xem số Lead" }));
  expect(await screen.findByText("2 Lead trong phạm vi 01/01/2026 – 01/03/2026.")).toBeTruthy();
});

it("shows missing field reasons, date warnings and outside-range results without marking them as missing ERP Leads", async () => {
  vi.mocked(crmService.getLeadContractProviders).mockResolvedValue(["FPT"]);
  vi.mocked(crmService.getLeadReconciliationScope).mockResolvedValue({ from: "2026-01-01", to: "2026-03-31", dateField: "createdAt", leadCount: 2, missingDateCount: 1, invalidCodeCount: 1 });
  vi.mocked(crmService.reconcileLeadContracts).mockResolvedValue({ excelCount: 2, duplicates: 0, invalidRows: [], rows: [
    { code: "OLD", status: "out_of_scope", sourceRows: [2], leadCreatedAt: "2025-12-01T00:00:00Z", issue: "Đã có trên ERP nhưng ngoài khoảng ngày" },
    { code: "INCOMPLETE", status: "incomplete", sourceRows: [3], differences: [
      { field: "address", label: "Địa chỉ", reason: "missing_lead", excel: "Căn 101", lead: "" },
      { field: "customerName", label: "Tên khách hàng", reason: "missing_both", excel: "", lead: "" },
    ] },
    { code: "Chưa có mã", status: "needs_review", leadId: "review", issue: "Thiếu mã đối soát" },
  ], excelRows: [
    { code: "OLD", status: "out_of_scope", sourceRows: [2], issue: "Đã có trên ERP nhưng ngoài khoảng ngày" },
    { code: "INCOMPLETE", status: "incomplete", sourceRows: [3], differences: [
      { field: "address", label: "Địa chỉ", reason: "missing_lead", excel: "Căn 101", lead: "" },
      { field: "customerName", label: "Tên khách hàng", reason: "missing_both", excel: "", lead: "" },
    ] },
  ] });
  render(<LeadContractReconciliation onClose={vi.fn()} onOpenLead={vi.fn()} onOpenSource={vi.fn()} onSaved={vi.fn()} />);
  await previewRange();
  expect(screen.getByText(/1 Lead thiếu ngày tạo/)).toBeTruthy();
  expect(screen.getByText(/1 Lead thiếu hoặc sai mã/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("File bảng kê (.xlsx)"), { target: { files: [new File(["file"], "test.xlsx")] } });
  fireEvent.submit(screen.getByRole("button", { name: "Đối soát thông tin khách hàng" }).closest("form")!);
  expect(await screen.findByText("Ngoài phạm vi ngày tạo Lead")).toBeTruthy();
  expect(screen.getByText("Địa chỉ: Lead chưa có dữ liệu.")).toBeTruthy();
  expect(screen.getByText("Tên khách hàng: cả Excel và Lead đều thiếu dữ liệu.")).toBeTruthy();
  expect(screen.getByText("Thiếu mã đối soát")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Lọc kết quả"), { target: { value: "out_of_scope" } });
  const table = screen.getByRole<HTMLTableElement>("table", { name: "Đối soát theo từng dòng Excel" });
  expect(table.tBodies[0].rows).toHaveLength(1);
  expect(table.tBodies[0].rows[0].cells[1].textContent).toBe("OLD");
});

it("renders repeated Excel lines in their original order with adjacent customer columns", async () => {
  vi.mocked(crmService.getLeadContractProviders).mockResolvedValue(["FPT"]);
  const excel = { customerName: "Khách A", address: "Căn 101", activatedAt: "7/2023", periods: ["02/2026"] };
  vi.mocked(crmService.reconcileLeadContracts).mockResolvedValue({
    excelCount: 2, duplicates: 1, invalidRows: [], sourceRowCount: 4,
    rows: [{ code: "A001", status: "matched" }, { code: "B002", status: "matched" }, { code: "ERP-ONLY", status: "lead_only", lead: { customerName: "Khách cũ" } }],
    excelRows: [
      { code: "B002", excelCode: "b002", status: "matched", sourceRows: [8], sourceSerial: "1", excel: { ...excel, services: ["Internet"] } },
      { code: "B002", excelCode: "b002", status: "matched", sourceRows: [9], sourceSerial: "1", excel: { ...excel, services: ["Truyền hình"] } },
      { code: "B002", excelCode: "b002", status: "matched", sourceRows: [10], sourceSerial: "1", excel: { ...excel, services: ["Truyền hình"] } },
      { code: "A001", status: "matched", sourceRows: [11], sourceSerial: "2", excel: { ...excel, services: ["Internet"] } },
    ],
  });
  render(<LeadContractReconciliation onClose={vi.fn()} onOpenLead={vi.fn()} onOpenSource={vi.fn()} onSaved={vi.fn()} />);
  await previewRange();
  fireEvent.change(await screen.findByLabelText("File bảng kê (.xlsx)"), { target: { files: [new File(["workbook"], "bang-ke.xlsx")] } });
  fireEvent.submit(screen.getByRole("button", { name: "Đối soát thông tin khách hàng" }).closest("form")!);
  const table = await screen.findByRole<HTMLTableElement>("table", { name: "Đối soát theo từng dòng Excel" });
  const rows = Array.from(table.tBodies[0].rows);
  expect(rows).toHaveLength(5);
  expect(rows.map(row => row.cells[1].textContent)).toEqual(["b002", "b002", "b002", "A001", "ERP-ONLY"]);
  expect(rows.slice(0, 4).map(row => row.cells[2].textContent)).toEqual(Array(4).fill("Khách A"));
  expect(rows.slice(0, 4).map(row => row.cells[3].textContent)).toEqual(Array(4).fill("Căn 101"));
  expect(rows.slice(0, 4).map(row => row.cells[4].textContent)).toEqual(["Internet", "Truyền hình", "Truyền hình", "Internet"]);
  expect(rows[0].cells[0].textContent).toContain("Dòng 8");
  expect(rows[2].cells[0].textContent).toContain("Dòng 10");
  expect(rows[4].cells[0].textContent).toContain("Ngoài Excel");
  fireEvent.change(screen.getByLabelText("Lọc kết quả"), { target: { value: "matched" } });
  expect(table.tBodies[0].rows).toHaveLength(4);
});

it("shows VNPT customer differences side by side without requiring OCR setup or displaying charges", async () => {
  vi.mocked(crmService.getLeadContractProviders).mockResolvedValue([]);
  vi.mocked(crmService.reconcileLeadContracts).mockResolvedValue({
    excelCount: 1, duplicates: 0, invalidRows: [], provider: "VNPT", identityLabel: "Mã khách hàng / Account", sheetName: "Q1.2026", period: "Quý 1/2026", sourceRowCount: 1,
    rows: [{ code: "ABC001", status: "different", customerName: "Nguyễn An", sourceRows: [10],
      excel: { customerName: "Nguyễn An", address: "Căn 101", services: ["Fiber"], activatedAt: "7/2023" },
      lead: { customerName: "Nguyễn An", address: "Căn 202", services: ["Internet"], activatedAt: "2023-07-04" },
      differences: [{ field: "address", label: "Địa chỉ", excel: "Căn 101", lead: "Căn 202", reason: "different" }],
    }],
  });
  render(<LeadContractReconciliation onClose={vi.fn()} onOpenLead={vi.fn()} onOpenSource={vi.fn()} onSaved={vi.fn()} />);
  const file = new File(["workbook"], "vnpt.xlsx");
  fireEvent.change(await screen.findByLabelText("Nhà mạng"), { target: { value: "VNPT" } });
  fireEvent.change(screen.getByLabelText("Năm"), { target: { value: "2026" } });
  fireEvent.change(screen.getByLabelText("Quý"), { target: { value: "1" } });
  await previewRange();
  fireEvent.change(screen.getByLabelText("File bảng kê (.xlsx)"), { target: { files: [file] } });
  fireEvent.submit(screen.getByRole("button", { name: "Đối soát thông tin khách hàng" }).closest("form")!);
  expect(await screen.findByText("Khác thông tin")).toBeTruthy();
  expect(screen.getByText("Địa chỉ: Excel “Căn 101” · Lead “Căn 202”.")).toBeTruthy();
  expect(screen.getAllByText("Căn 101").length).toBeGreaterThan(0);
  expect(screen.getByText("Căn 202")).toBeTruthy();
  expect(screen.getByText("04/07/2023")).toBeTruthy();
  expect(screen.queryByText(/Hoa hồng|Tổng tiền/i)).toBeNull();
  expect(crmService.reconcileLeadContracts).toHaveBeenCalledWith(file, "VNPT", 2026, 1, { from: "2026-01-01", to: "2026-03-31" }, expect.any(AbortSignal));
});

it.each([["facebook", "Page"], ["zalo", "Zalo OA"]] as const)("uses the selected %s account's Lead fields for the subscriber mapping", async (platform, label) => {
  const leadFields = [{ key: "ref", label: "Mã dịch vụ" }, { key: "address", label: "Địa chỉ" }];
  vi.mocked(crmService.getTelecomInvoiceSettings).mockResolvedValue({ enabled: false, leadFields });
  vi.mocked(crmService.saveTelecomInvoiceSettings).mockResolvedValue({ enabled: true, leadFields, subscriberFieldKey: "ref" });
  render(<TelecomInvoiceSettingsPanel platform={platform} accountId="account-test-2" />);
  fireEvent.click(screen.getByText("Đọc ảnh vào Lead"));
  fireEvent.click(await screen.findByRole("checkbox", { name: `Bật đọc hóa đơn cho ${label} này` }));
  fireEvent.click(screen.getByRole("button", { name: "Cột dùng làm Mã thuê bao" }));
  fireEvent.click(screen.getByRole("option", { name: "Mã dịch vụ" }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình hóa đơn" }));
  expect(await screen.findByText(`Đã bật đọc hóa đơn cho ${label} này.`)).toBeTruthy();
  expect(crmService.saveTelecomInvoiceSettings).toHaveBeenCalledWith(platform, "account-test-2", { enabled: true, subscriberFieldKey: "ref" });
});

it("shows each confirmed invoice separately and can open its own source conversation", async () => {
  const first = { id: "1", platform: "facebook" as const, values: { invoiceNumber: "M-1", amountDue: "289000" }, pageId: "page-1", conversationId: "c1", confirmedAt: "2026-11-17T02:00:00Z" };
  const second = { id: "2", platform: "zalo" as const, invoiceNumber: "M-2", values: { vat_printed: "31900", due_on: "2026-11-30" },
    leadFields: [{ key: "vat_printed", label: "VAT", question: "VAT?", type: "currency" as const }, { key: "due_on", label: "Hạn thanh toán", question: "Hạn thanh toán?", type: "date" as const }],
    pageId: "oa-2", conversationId: "c2", confirmedAt: "2026-11-17T02:10:00Z" };
  vi.mocked(crmService.getLeadTelecomInvoices).mockResolvedValueOnce({ items: [first], before: "1" }).mockResolvedValueOnce({ items: [second] });
  const open = vi.fn();
  render(<LeadTelecomInvoices leadId="lead-1" subscriberCode="0001" onOpenSource={open} />);
  const section = within(screen.getByRole("region", { name: "Hóa đơn nhà mạng" }));
  expect(await section.findByText("289.000đ")).toBeTruthy();
  fireEvent.click(section.getByRole("button", { name: "Xem thêm hóa đơn" }));
  fireEvent.click(await section.findByRole("button", { name: "Mở hội thoại gốc của hóa đơn M-2" }));
  expect(open).toHaveBeenCalledWith(second);
  expect(section.getAllByRole("listitem")).toHaveLength(2);
  expect(section.getByText("30/11/2026")).toBeTruthy();
  expect(section.getByText("31.900đ")).toBeTruthy();
});

it.each([["facebook", "Page"], ["zalo", "Zalo OA"]] as const)("saves contract OCR for the selected %s account", async (platform, label) => {
  const leadFields = [{ key: "contract", label: "Mã hợp đồng", type: "text" as const }];
  vi.mocked(crmService.getTelecomInvoiceSettings).mockResolvedValue({ enabled: false, mode: "contract", leadFields });
  vi.mocked(crmService.saveTelecomInvoiceSettings).mockResolvedValue({
    enabled: true, mode: "contract", contractFieldKey: "contract", contractProvider: "FPT", leadFields,
  });
  render(<TelecomInvoiceSettingsPanel platform={platform} accountId="linked" />);
  fireEvent.click(screen.getByText("Đọc ảnh vào Lead"));
  fireEvent.click(await screen.findByRole("checkbox", { name: `Bật đọc ảnh vào Lead cho ${label} này` }));
  fireEvent.click(screen.getByRole("button", { name: "Cột Mã hợp đồng" }));
  fireEvent.click(screen.getByRole("option", { name: "Mã hợp đồng" }));
  fireEvent.change(screen.getByLabelText("Nhà cung cấp"), { target: { value: "FPT" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình OCR" }));
  expect(await screen.findByText(`Đã bật đọc ảnh hợp đồng cho ${label} này.`)).toBeTruthy();
  expect(crmService.saveTelecomInvoiceSettings).toHaveBeenCalledWith(platform, "linked", {
    enabled: true, mode: "contract", contractFieldKey: "contract", contractProvider: "FPT",
  });
});

it("submits the selected period and file and filters the results by contract status", async () => {
  vi.mocked(crmService.getLeadContractProviders).mockResolvedValue(["FPT"]);
  vi.mocked(crmService.reconcileLeadContracts).mockResolvedValue({
    excelCount: 2, duplicates: 4, invalidRows: [],
    rows: [{ code: "001", status: "matched", leadId: "lead-1", customerName: "Khách A" }, { code: "002", status: "excel_only" }],
  });
  render(<LeadContractReconciliation onClose={vi.fn()} onOpenLead={vi.fn()} onOpenSource={vi.fn()} onSaved={vi.fn()} />);
  const file = new File(["workbook"], "bang-ke.xlsx");
  await previewRange();
  fireEvent.change(await screen.findByLabelText("File bảng kê (.xlsx)"), { target: { files: [file] } });
  fireEvent.change(screen.getByLabelText("Năm"), { target: { value: "2026" } });
  fireEvent.change(screen.getByLabelText("Quý"), { target: { value: "1" } });
  fireEvent.submit(screen.getByRole("button", { name: "Đối soát thông tin khách hàng" }).closest("form")!);
  expect(await screen.findByText("2 mã trong Excel · 2 dòng · 4 dòng có thông tin lặp (vẫn giữ đủ)")).toBeTruthy();
  expect(crmService.reconcileLeadContracts).toHaveBeenCalledWith(file, "FPT", 2026, 1, { from: "2026-01-01", to: "2026-03-31" }, expect.any(AbortSignal));
  fireEvent.change(screen.getByLabelText("Lọc kết quả"), { target: { value: "excel_only" } });
  expect(screen.queryByText("001")).toBeNull();
  expect(screen.getByText("002")).toBeTruthy();
});
