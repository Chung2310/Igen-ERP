// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { crmService } from "../../services/crmService";
import { LeadTelecomInvoices } from "./LeadTelecomInvoices";
import { TelecomInvoiceSettingsPanel } from "./TelecomInvoiceSettings";

vi.mock("../../services/crmService", () => ({ crmService: {
  getTelecomInvoiceSettings: vi.fn(), saveTelecomInvoiceSettings: vi.fn(), getLeadTelecomInvoices: vi.fn(),
} }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it.each([["facebook", "Page"], ["zalo", "Zalo OA"]] as const)("uses the selected %s account's Lead fields for the subscriber mapping", async (platform, label) => {
  const leadFields = [{ key: "ref", label: "Mã dịch vụ" }, { key: "address", label: "Địa chỉ" }];
  vi.mocked(crmService.getTelecomInvoiceSettings).mockResolvedValue({ enabled: false, leadFields });
  vi.mocked(crmService.saveTelecomInvoiceSettings).mockResolvedValue({ enabled: true, leadFields, subscriberFieldKey: "ref" });
  render(<TelecomInvoiceSettingsPanel platform={platform} accountId="account-test-2" />);
  fireEvent.click(screen.getByText("Đọc hóa đơn nhà mạng"));
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
