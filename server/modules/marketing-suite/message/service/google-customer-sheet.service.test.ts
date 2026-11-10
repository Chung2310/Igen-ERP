import { beforeEach, describe, expect, it, vi } from "vitest";
import { googleCustomerSheetService, CUSTOMER_SHEET_HEADERS } from "./google-customer-sheet.service";
import { sheetsFetch, ensureTabs } from "./google-order-sheet.service";

vi.mock("./google-order-sheet.service", async original => ({
  ...await original<typeof import("./google-order-sheet.service")>(), sheetsFetch: vi.fn(), ensureTabs: vi.fn(),
}));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(sheetsFetch).mockReset(); });
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
