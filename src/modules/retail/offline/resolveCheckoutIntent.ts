import { retailOrdersApi } from "../api/retailOrders.api";
import { clearDraftCreation, withDraftRequestLock } from "./draftCreationRequest";
import { verifyConfirmation } from "./confirmationEvidence";
import type { OfflineScope, RetailOfflineOrder, RetailOfflineQueue } from "./retailOfflineQueue";

/** Caller holds the shared checkout lock through reconciliation and local cleanup. */
export async function resolveCheckoutIntentLocked(scope: OfflineScope, queue: RetailOfflineQueue, item: RetailOfflineOrder, revoke = false) {
  if (item.companyCode !== scope.companyCode || item.branchId !== scope.branchId || item.userId !== scope.userId) throw new Error("Yêu cầu không thuộc tài khoản/chi nhánh hiện tại.");
  const result = await (revoke ? retailOrdersApi.revokeCheckout : retailOrdersApi.reconcileCheckout)(scope, { idempotencyKey: item.idempotencyKey, payload: item.payload });
  if (result?.status !== "completed" && result?.status !== "revoked") return result;
  const latest = (await queue.list(scope)).find(row => row.id === item.id);
  if (!latest || latest.idempotencyKey !== item.idempotencyKey || JSON.stringify(latest.payload) !== JSON.stringify(item.payload)) throw new Error("Yêu cầu đã thay đổi. Không dọn bản lưu khác.");
  const payload = item.payload as any;
  if (result.status === "completed") verifyConfirmation(result, payload?.draftId);
  if (payload?.draftCreation) clearDraftCreation(scope, scope.userId, payload.draftCreation);
  if (payload?.draftUpdate) clearDraftCreation(scope, scope.userId, payload.draftUpdate, payload.draftUpdate.orderId);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("retail-draft-requests-changed"));
  await queue.update(item.id, { status: result.status === "revoked" ? "revoked" : "synced", lastError: undefined });
  return result;
}
export async function resolveCheckoutIntent(scope: OfflineScope, queue: RetailOfflineQueue, id: string, revoke = false) {
  return withDraftRequestLock(scope, scope.userId, async () => {
    const item = (await queue.list(scope)).find(row => row.id === id);
    if (!item) throw new Error("Không tìm thấy yêu cầu thanh toán trong phạm vi hiện tại.");
    return resolveCheckoutIntentLocked(scope, queue, item, revoke);
  });
}
