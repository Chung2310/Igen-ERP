export type PayrollProcessingAction = { visible: boolean; disabled: boolean; label: string; reason?: string };

export function hasActivePolicyForMonth(policies: any[], periodKey: string): boolean {
  const first = new Date(`${periodKey}-01T00:00:00.000Z`);
  const end = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0);
  return policies.some((policy) => policy.status === "active"
    && new Date(policy.effectiveFrom).getTime() <= end
    && (!policy.effectiveTo || new Date(policy.effectiveTo).getTime() >= end));
}

export function getPayrollProcessingAction(runStatus: string | undefined, loading: boolean, hasPolicy = true): PayrollProcessingAction {
  const visible = runStatus === undefined || runStatus === "draft";
  const updating = runStatus === "draft";
  return {
    visible,
    disabled: loading || !hasPolicy,
    label: loading
      ? updating ? "Đang cập nhật..." : "Đang tính lương..."
      : updating ? "Cập nhật bảng lương" : "Tính lương",
    ...(!hasPolicy ? { reason: "Cần áp dụng công thức lương cho kỳ này" } : {}),
  };
}
