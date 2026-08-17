import { describe, expect, it, vi } from "vitest";
import { inventorySerialService } from "./inventorySerialService";

vi.mock("../modules/shared/lib/apiFetch", () => ({ apiFetch: vi.fn() }));
import { apiFetch } from "../modules/shared/lib/apiFetch";

describe("inventorySerialService", () => {
  it("lists serial units with filters", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ status: "success", data: { items: [], total: 0, page: 1, limit: 25 } });
    await inventorySerialService.list({ status: "in_stock", sku: "SKU-1" });
    expect(apiFetch).toHaveBeenCalledWith("/inventory/serials", { params: { status: "in_stock", sku: "SKU-1" } });
  });

  it("imports a serial batch", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ status: "success", data: [] });
    await inventorySerialService.importBatch({ productId: "p1", sku: "SKU-1", productName: "Phone", serialNumbers: ["IMEI-1"] });
    expect(apiFetch).toHaveBeenCalledWith("/inventory/serials", expect.objectContaining({ method: "POST" }));
  });

  it("transfers a serial unit with a reason", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ status: "success", data: {} });
    await inventorySerialService.transfer("s1", { toBranchId: "branch-2", reason: "Điều chuyển" });
    expect(apiFetch).toHaveBeenCalledWith("/inventory/serials/s1/transfer", expect.objectContaining({ method: "POST" }));
  });
});
