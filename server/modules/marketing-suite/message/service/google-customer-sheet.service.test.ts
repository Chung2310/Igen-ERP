import { beforeEach, describe, expect, it, vi } from "vitest";
import { googleCustomerSheetService, CUSTOMER_SHEET_HEADERS, LEAD_SHEET_BASE_HEADERS, resetLeadSheetHeaderCache } from "./google-customer-sheet.service";
import { sheetsFetch, ensureTabs } from "./google-order-sheet.service";

vi.mock("./google-order-sheet.service", async original => ({
  ...await original<typeof import("./google-order-sheet.service")>(), sheetsFetch: vi.fn(), ensureTabs: vi.fn(),
}));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(sheetsFetch).mockReset(); resetLeadSheetHeaderCache(); });
describe("Customer Sheet rows", () => {
  it("creates a header and appends a new customer with formula-safe cells", async () => {
    vi.mocked(sheetsFetch).mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({}).mockResolvedValueOnce({});
    await googleCustomerSheetService.upsert("SHEET", "Leads", { key: "ACME:PAGE:CUSTOMER", name: "An", phone: "0901234567", notes: "=IMPORTXML(1)" });
    expect(ensureTabs).toHaveBeenCalledWith("SHEET", ["Leads"]);
    const calls = vi.mocked(sheetsFetch).mock.calls;
    expect(JSON.parse(String(calls[1][1]?.body)).values[0]).toEqual(CUSTOMER_SHEET_HEADERS);
    expect(calls[3][0]).toContain(":append?valueInputOption=RAW");
    expect(JSON.parse(String(calls[3][1]?.body)).values[0][6]).toBe("'=IMPORTXML(1)");
  });
  it("updates an existing customer instead of appending another row on retries", async () => {
    vi.mocked(sheetsFetch).mockResolvedValueOnce({ values: [CUSTOMER_SHEET_HEADERS] })
      .mockResolvedValueOnce({ values: [["OTHER"], ["ACME:PAGE:CUSTOMER"]] }).mockResolvedValueOnce({});
    await googleCustomerSheetService.upsert("SHEET", "Khách ' mới", { key: "ACME:PAGE:CUSTOMER", name: "An", notes: "Cần khảo sát" });
    const call = vi.mocked(sheetsFetch).mock.calls.at(-1)!;
    expect(decodeURIComponent(call[0])).toContain("'Khách '' mới'!A3:I3?valueInputOption=RAW");
    expect(call[1]?.method).toBe("PUT");
  });
  it("refuses to replace headers in a tab containing unrelated data", async () => {
    vi.mocked(sheetsFetch).mockResolvedValueOnce({ values: [["Existing customer records"]] });
    await expect(googleCustomerSheetService.prepare("SHEET", "Leads")).rejects.toThrow("mẫu cột khác");
    expect(sheetsFetch).toHaveBeenCalledTimes(1);
  });
});
describe("Lead Sheet rows", () => {
  it("updates a stable Lead row, appends dynamic intake columns, and protects formulas", async () => {
    vi.mocked(sheetsFetch)
      .mockResolvedValueOnce({ values: [LEAD_SHEET_BASE_HEADERS] } as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({} as never);
    const row = await googleCustomerSheetService.upsertLead("SHEET", "Leads", {
      key: "ACME:PAGE:LEAD", customerName: "An", status: "cold", sourcePlatform: "facebook",
      answers: { need: "=IMPORTXML(1)" }, intakeFields: [{ key: "need", label: "Dịch vụ quan tâm" }],
    }, 2);
    expect(row).toBe(2);
    const calls = vi.mocked(sheetsFetch).mock.calls;
    expect(ensureTabs).toHaveBeenCalledWith("SHEET", ["Leads"], LEAD_SHEET_BASE_HEADERS.length + 50);
    expect(JSON.parse(String(calls[1][1]?.body)).values[0]).toEqual([...LEAD_SHEET_BASE_HEADERS, "Dịch vụ quan tâm"]);
    expect(decodeURIComponent(calls[2][0])).toContain("!A2:N2");
    expect(calls[2][1]?.method).toBe("PUT");
    expect(JSON.parse(String(calls[2][1]?.body)).values[0][13]).toBe("'=IMPORTXML(1)");
  });
  it("appends a new Lead and captures its row number for later updates", async () => {
    vi.mocked(sheetsFetch)
      .mockResolvedValueOnce({ values: [LEAD_SHEET_BASE_HEADERS] } as never)
      .mockResolvedValueOnce({ updates: { updatedRange: "'Leads'!A2:M2" } } as never);
    const row = await googleCustomerSheetService.upsertLead("SHEET", "Leads", {
      key: "ACME:PAGE:LEAD", customerName: "An", status: "cold",
    });
    expect(row).toBe(2);
    const calls = vi.mocked(sheetsFetch).mock.calls;
    expect(calls[1][0]).toContain(":append?valueInputOption=RAW");
    expect(JSON.parse(String(calls[1][1]?.body)).values[0][0]).toBe("ACME:PAGE:LEAD");
  });
  it("finds an existing row before retrying an uncertain append", async () => {
    vi.mocked(sheetsFetch)
      .mockResolvedValueOnce({ values: [LEAD_SHEET_BASE_HEADERS] } as never)
      .mockResolvedValueOnce({ values: [["OTHER"], ["ACME:PAGE:LEAD"]] } as never)
      .mockResolvedValueOnce({} as never);
    const row = await googleCustomerSheetService.upsertLead("SHEET", "Leads", {
      key: "ACME:PAGE:LEAD", customerName: "An", status: "cold",
    }, undefined, true);
    expect(row).toBe(3);
    expect(decodeURIComponent(vi.mocked(sheetsFetch).mock.calls[2][0])).toContain("!A3:M3");
    expect(vi.mocked(sheetsFetch).mock.calls[2][1]?.method).toBe("PUT");
  });
});
