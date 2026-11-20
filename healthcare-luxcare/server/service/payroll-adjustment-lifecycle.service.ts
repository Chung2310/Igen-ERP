export type PayrollAdjustmentStatus = "draft" | "pending" | "approved" | "rejected" | "snapshotted";

export function transitionPayrollAdjustment(
  adjustment: { status: PayrollAdjustmentStatus; version?: number },
  next: PayrollAdjustmentStatus,
  snapshotRevisionId?: string,
) {
  const allowed: Record<PayrollAdjustmentStatus, PayrollAdjustmentStatus[]> = {
    draft: ["pending"],
    pending: ["approved", "rejected"],
    approved: ["snapshotted"],
    rejected: [],
    snapshotted: [],
  };
  if (!allowed[adjustment.status].includes(next)) throw new Error("Chuyển trạng thái điều chỉnh không hợp lệ.");
  if (next === "snapshotted" && !snapshotRevisionId) throw new Error("Phiên bản bản chụp là bắt buộc.");
  return { status: next, ...(adjustment.version !== undefined ? { version: adjustment.version + 1 } : {}), ...(next === "snapshotted" ? { snapshotRevisionId } : {}) };
}
