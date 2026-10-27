import { verifyConfirmation } from "./confirmationEvidence";
import { retailOrdersApi } from "../api/retailOrders.api";
import type { OfflineScope, RetailOfflineOrder, RetailOfflineQueue } from "./retailOfflineQueue";
import { verifyDraftResult, clearDraftCreation, retainDraftRequest, withDraftRequestLock } from "./draftCreationRequest";

export async function confirmOfflineOrder(scope: OfflineScope, item: RetailOfflineOrder, queue?: RetailOfflineQueue) {
  return withDraftRequestLock(scope, scope.userId, () => confirmOfflineOrderLocked(scope, item, queue));
}

/** Caller holds the scoped draft/checkout lock through queue completion. */
export async function confirmOfflineOrderLocked(scope: OfflineScope, item: RetailOfflineOrder, queue?: RetailOfflineQueue) {
    let payload = item.payload as any;
    if (item.companyCode !== scope.companyCode || item.branchId !== scope.branchId || item.userId !== scope.userId) {
      throw new Error("Yêu cầu offline không thuộc tài khoản/chi nhánh hiện tại.");
    }
    if (!payload?.draftCreation && !payload?.draftUpdate && payload?.draftSaved !== true) {
      const result = await retailOrdersApi.checkout(scope, {
        input: payload.input,
        expectedGrandTotal: payload.expectedGrandTotal,
        payments: payload.payments,
        ...(payload.paymentCode ? { paymentCode: payload.paymentCode } : {}),
        ...(payload.pendingTransferAmount > 0 ? { pendingTransferAmount: payload.pendingTransferAmount } : {}),
        idempotencyKey: item.idempotencyKey,
        posSessionId: payload.posSessionId,
      });
      verifyConfirmation(result);
      return result;
    }
    if (payload?.draftSaved !== true && payload?.draftId && payload?.draftUpdate?.idempotencyKey && queue) {
      const request = payload.draftUpdate;
      if (request.orderId !== payload.draftId) throw new Error("Yêu cầu sửa nháp không khớp đơn offline.");
      retainDraftRequest(scope, scope.userId, request, request.orderId);
      const order = await retailOrdersApi.updateDraft(scope, request.orderId, { ...request.input, idempotencyKey: request.idempotencyKey });
      verifyDraftResult(order, request.orderId);
      payload = { ...payload, draftId: order._id, draftVersion: order.version, draftSaved: true };
      await queue.update(item.id, { payload });
      clearDraftCreation(scope, scope.userId, request, request.orderId);
    }
    if (payload?.draftSaved !== true && !payload?.draftId && payload?.draftCreation?.idempotencyKey && queue) {
      const request = payload.draftCreation;
      retainDraftRequest(scope, scope.userId, request);
      const order = await retailOrdersApi.createDraft(scope, { ...request.input, idempotencyKey: request.idempotencyKey });
      verifyDraftResult(order);
      payload = { ...payload, draftId: order._id, draftVersion: order.version, draftSaved: true };
      // Save the recovered version before confirmation, so retries never create
      // another draft after a lost confirmation response.
      await queue.update(item.id, { payload });
      clearDraftCreation(scope, scope.userId, request);
    }
    // Never infer a new version or create a replacement draft for an uncertain
    // save. The original request may already have reached the server.
    if (payload?.draftSaved !== true || typeof payload.draftId !== "string" || !payload.draftId ||
        !Number.isSafeInteger(payload.draftVersion) || payload.draftVersion < 0) {
      throw new Error("Chưa xác định được bản nháp và phiên bản đã lưu. Vui lòng đối chiếu đơn gốc; không tự tạo hoặc xác nhận đơn thay thế.");
    }
    const result = await retailOrdersApi.confirm(scope, payload.draftId, {
      expectedVersion: payload.draftVersion,
      expectedGrandTotal: payload.expectedGrandTotal,
      payments: payload.payments,
      idempotencyKey: item.idempotencyKey,
      posSessionId: payload.posSessionId,
    });
    verifyConfirmation(result, payload.draftId);
    return result;
}
