import { describe, expect, it, vi } from "vitest";
import { inventorySerialService } from "./inventorySerialService";

vi.mock("../modules/shared/lib/apiFetch", () => ({ apiFetch: vi.fn() }));
import { apiFetch } from "../modules/shared/lib/apiFetch";

describe("inventorySerialService", () => {
  it("allocates globally unique internal barcodes for device labels", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ status: "success", data: ["DVU000000000123"] });
    await expect(inventorySerialService.allocateInternalBarcodes(1)).resolves.toEqual(["DVU000000000123"]);
    expect(apiFetch).toHaveBeenCalledWith("/inventory/serials/barcodes/allocate", { method: "POST", body: JSON.stringify({ count: 1 }) });
  });

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

  it("uses a stable request key and the transfer document for compatibility actions", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ status: "success", data: {} });
    const request = { toBranchId: "branch-2", reason: "Điều chuyển", idempotencyKey: "request-1" };
    await inventorySerialService.requestTransfer("s1", request);
    expect(apiFetch).toHaveBeenLastCalledWith("/inventory/serials/s1/transfer/request", { method: "POST", body: JSON.stringify(request) });
    await inventorySerialService.acceptTransfer("s1", { transferId: "t1" });
    expect(apiFetch).toHaveBeenLastCalledWith("/inventory/serials/s1/transfer/accept", { method: "POST", body: JSON.stringify({ transferId: "t1" }) });
    await inventorySerialService.cancelTransfer("s1", "Cancel", "t1");
    expect(apiFetch).toHaveBeenLastCalledWith("/inventory/serials/s1/transfer/cancel", { method: "POST", body: JSON.stringify({ reason: "Cancel", transferId: "t1" }) });
  });
});
