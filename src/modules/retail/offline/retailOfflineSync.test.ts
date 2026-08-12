import { describe, expect, it, vi } from "vitest";
import { createMemoryRetailOfflineQueue, createRetailOfflineOrder } from "./retailOfflineQueue";
import { syncRetailOfflineQueue } from "./retailOfflineSync";
describe("offline sync", () => {
  it("checks idempotency before resending ambiguous syncing items", async () => { const queue = createMemoryRetailOfflineQueue(), item = { ...createRetailOfflineOrder({ companyCode: "A", branchId: "B", userId: "u" }, {}, "key", new Date()), status: "syncing" as const }; await queue.put(item); const check = vi.fn().mockResolvedValue({ status: "completed", order: { _id: "o1" }, invoice: { _id: "i1" } }), send = vi.fn(); const result = await syncRetailOfflineQueue(queue, { companyCode: "A", branchId: "B", userId: "u" }, { check, send }); expect(send).not.toHaveBeenCalled(); expect(result[0]).toMatchObject({ status: "synced", orderId: "o1", invoiceId: "i1" }); });
});
