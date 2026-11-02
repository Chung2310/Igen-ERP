import { verifyConfirmation } from "./confirmationEvidence";
import { withRetailCheckoutLock } from "./draftCreationRequest";
import { createRetailOfflineOrder, type OfflineScope, type RetailOfflineQueue } from "./retailOfflineQueue";
import { confirmOfflineOrderLocked } from "./confirmOfflineOrder";
import type { RetailPaymentInput } from "../types";

export class PendingCheckoutError extends Error {
  constructor(message: string, readonly intentId: string) { super(message); this.name = "PendingCheckoutError"; }
}

export async function checkoutWithPersistedIntent(scope: OfflineScope, queue: RetailOfflineQueue, input: Record<string, unknown>, payments: RetailPaymentInput[], expectedGrandTotal: number, posSessionIdOrPreviousContext?: string | { _id: string; version: number } | null, previousPosSessionId?: string, paymentCode?: string, pendingTransferAmount = 0) {
  const posSessionId = typeof posSessionIdOrPreviousContext === "string" ? posSessionIdOrPreviousContext : previousPosSessionId;
  return withRetailCheckoutLock(scope, scope.userId, async () => {
    if ((await queue.list(scope)).some(item => item.status !== "synced" && item.status !== "revoked")) throw new Error("Còn yêu cầu thanh toán chưa rõ kết quả. Xử lý tại mục đồng bộ trước khi thanh toán mới.");
    const item = createRetailOfflineOrder(scope, JSON.parse(JSON.stringify({
      input, expectedGrandTotal, payments, posSessionId, paymentCode, pendingTransferAmount,
    })), crypto.randomUUID());
    item.status = "syncing";
    await queue.put(item);
    try {
      const result = await confirmOfflineOrderLocked(scope, item, queue);
      verifyConfirmation(result);
      await queue.update(item.id, { status: "synced", lastError: undefined });
      return result;
    } catch (error) {
      // Retain the same intent even if recording this error fails or the tab closes.
      await queue.update(item.id, { status: "failed", lastError: error instanceof Error ? error.message : "Chưa rõ kết quả thanh toán." }).catch(() => undefined);
      throw new PendingCheckoutError(error instanceof Error ? error.message : "Chưa rõ kết quả thanh toán.", item.id);
    }
  });
}
