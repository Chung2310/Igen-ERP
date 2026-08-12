// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccessToken } from "../../shared/lib/apiFetch";
import { retailInvoicesApi } from "./retailInvoices.api";

vi.mock("../../shared/lib/apiFetch", () => ({ apiFetch: vi.fn(), getAccessToken: vi.fn(() => "token") }));

describe("retailInvoicesApi.downloadPdf", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getAccessToken).mockReturnValue("token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob(["pdf"]), {
      status: 200,
      headers: { "Content-Disposition": 'attachment; filename="HD-01.pdf"' },
    })));
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:invoice"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("downloads the scoped invoice PDF and cleans up the object URL", async () => {
    await retailInvoicesApi.downloadPdf({ companyCode: "ACME", branchId: "B1" }, "invoice-1");
    expect(fetch).toHaveBeenCalledWith("/api/v1/retail/invoices/invoice-1/pdf?companyCode=ACME&branchId=B1", {
      headers: { Authorization: "Bearer token" },
      signal: undefined,
    });
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:invoice");
  });
});
