export type PayrollProcessingAction = { visible: boolean; disabled: boolean; label: string };

export function getPayrollProcessingAction(runStatus: string | undefined, loading: boolean): PayrollProcessingAction {
  const visible = runStatus === undefined || runStatus === "draft";
  const updating = runStatus === "draft";
  return {
    visible,
    disabled: loading,
    label: loading
      ? updating ? "Đang cập nhật..." : "Đang tính lương..."
      : updating ? "Cập nhật bảng lương" : "Tính lương",
  };
}
