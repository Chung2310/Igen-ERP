export function canMarkPayrollPaid(canManage: boolean, status?: string): boolean {
  return canManage && status === "closed";
}
