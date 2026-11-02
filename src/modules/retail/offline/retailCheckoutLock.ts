import type { OfflineScope } from "./retailOfflineQueue";

export class RetailCheckoutLockBusyError extends Error {
  constructor() {
    super("POS đang xử lý giao dịch ở tab khác. Hãy thử lại sau.");
    this.name = "RetailCheckoutLockBusyError";
  }
}

export async function withRetailCheckoutLock<T>(scope: OfflineScope, work: () => Promise<T>): Promise<T> {
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (!locks?.request) throw new Error("Trình duyệt cần hỗ trợ khóa giao dịch để thanh toán an toàn.");
  const name = `retail-pos-checkout:v1:${JSON.stringify([scope.companyCode, scope.branchId, scope.userId])}`;
  return locks.request(name, { mode: "exclusive", ifAvailable: true }, async (lock) => {
    if (!lock) throw new RetailCheckoutLockBusyError();
    return work();
  });
}
