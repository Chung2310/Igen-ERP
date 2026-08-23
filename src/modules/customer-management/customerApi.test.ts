import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../shared/lib/apiFetch";
import { customerApi } from "./customerApi";

vi.mock("../shared/lib/apiFetch", () => ({ apiFetch: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("customerApi", () => {
  it("sends company-wide list filters", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: { items: [], total: 0, page: 2, limit: 20 } });
    await customerApi.list({ companyCode: "IGEN", q: "An", status: "inactive", type: "vat", page: 2, limit: 20 });
    expect(apiFetch).toHaveBeenCalledWith("/customers", { params: { companyCode: "IGEN", q: "An", status: "inactive", type: "vat", page: 2, limit: 20 } });
  });

  it("includes version in profile and status mutations", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: {} });
    await customerApi.update("c1", { name: "An", phone: "0901" }, 3, "IGEN");
    await customerApi.setStatus("c1", "inactive", 4, "IGEN");
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/customers/c1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "An", phone: "0901", version: 3 }) }));
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/customers/c1/deactivate", expect.objectContaining({ method: "POST", body: JSON.stringify({ version: 4 }) }));
  });

  it("lists and creates VAT billing profiles", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: [] });
    await customerApi.billingProfiles("c1", "IGEN");
    await customerApi.createBillingProfile("c1", { legalName: "Công ty A", taxId: "0312345678", address: "1 Nguyễn Huệ", invoiceEmail: "invoice@a.vn" }, "IGEN");
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/customers/c1/billing-profiles", { params: { companyCode: "IGEN" } });
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/customers/c1/billing-profiles", expect.objectContaining({ method: "POST" }));
  });

  it("loads purchase history scoped to a company branch", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true, data: { summary: {}, items: [] } });

    await customerApi.purchaseHistory("c1", { companyCode: "IGEN", branchId: "B1" });

    expect(apiFetch).toHaveBeenCalledWith("/customers/c1/purchase-history", { params: { companyCode: "IGEN", branchId: "B1" } });
  });
});
