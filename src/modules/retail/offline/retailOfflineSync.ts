import { verifyConfirmation } from "./confirmationEvidence";
import type {
  OfflineScope,
  RetailOfflineOrder,
  RetailOfflineQueue,
} from "./retailOfflineQueue";
export interface RetailOfflineSyncResult {
  itemId: string;
  status: "synced" | "failed" | "revoked";
  orderId?: string;
  invoiceId?: string;
  error?: string;
}
type Adapter = {
  check(key: string, item: RetailOfflineOrder): Promise<any>;
  send(item: RetailOfflineOrder): Promise<any>;
};
export function isRetailNetworkFailure(error: unknown) {
  const value = error as any;
  if (Number(value?.status || value?.response?.status)) return false;
  return (
    error instanceof TypeError ||
    /failed to fetch|network|offline|load failed/i.test(
      String(value?.message || value || ""),
    )
  );
}
export async function syncRetailOfflineQueue(
  queue: RetailOfflineQueue,
  scope: OfflineScope,
  adapter: Adapter,
): Promise<RetailOfflineSyncResult[]> {
  const results: RetailOfflineSyncResult[] = [];
  for (const item of (await queue.list(scope)).filter(
    (x) => x.status === "syncing",
  )) {
    let attempt: any;
    try { attempt = await adapter.check(item.idempotencyKey, item); }
    catch { continue; }
    if (attempt?.status === "revoked") {
      await queue.update(item.id, { status: "revoked", lastError: undefined });
      results.push({ itemId: item.id, status: "revoked" });
    } else if (attempt?.status === "completed") {
      try { verifyConfirmation(attempt, (item.payload as any)?.draftId); } catch { continue; }
      await queue.update(item.id, { status: "synced" });
      results.push({
        itemId: item.id,
        status: "synced",
        orderId: attempt.order?._id,
        invoiceId: attempt.invoice?._id,
      });
    } else if (attempt?.status === "not_found") await queue.update(item.id, { status: "pending" });
  }
  for (;;) {
    const item = await queue.claimNext(scope);
    if (!item) break;
    try {
      const response = await adapter.send(item);
      verifyConfirmation(response, (item.payload as any)?.draftId);
      await queue.update(item.id, { status: "synced", lastError: undefined });
      results.push({
        itemId: item.id,
        status: "synced",
        orderId: response.order?._id,
        invoiceId: response.invoice?._id,
      });
    } catch (error: any) {
      const message = String(error?.message || error);
      await queue.update(item.id, { status: "failed", lastError: message });
      results.push({ itemId: item.id, status: "failed", error: message });
    }
  }
  return results;
}
