import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { actMyPayrollReconciliation, actPayrollReconciliation, listMyPayrollReconciliation, listPayrollReconciliation, publishPayrollReconciliation } from "../service/payroll-reconciliation.service";
import { reconciliationError } from "../service/payroll-reconciliation-state";
import { getPayrollPublicationSchedule, savePayrollPublicationSchedule } from "../service/payroll-publication-schedule.service";
const scope = (req: AuthenticatedRequest) => {
  if (!req.user?.companyCode || !req.user.branchId) throw reconciliationError("Cần tài khoản thuộc công ty và chi nhánh.", 400);
  return { companyCode: req.user.companyCode, branchId: req.user.branchId };
};
const company = (req: AuthenticatedRequest) => {
  if (!req.user?.companyCode) throw reconciliationError("Cần tài khoản thuộc công ty.", 400);
  return req.user.companyCode;
};
const handler = (operation: (req: AuthenticatedRequest) => Promise<unknown>) => async (req: AuthenticatedRequest, res: Response) => {
  try { return res.json({ status: "success", data: await operation(req) }); }
  catch (error: any) { return res.status(error.status ?? 500).json({ status: "error", code: error.code ?? "PAYROLL_RECONCILIATION_ERROR", message: error.message ?? "Không thể đối soát lương." }); }
};
const action = (req: AuthenticatedRequest) => ({ action: req.body?.action, body: req.body?.body, field: req.body?.field, issueId: req.body?.issueId });
export const payrollReconciliationController = {
  getSchedule: handler(req => getPayrollPublicationSchedule(scope(req))),
  saveSchedule: handler(req => savePayrollPublicationSchedule(scope(req), req.user!.id, req.body)),
  list: handler(req => listPayrollReconciliation(scope(req), req.params.id)),
  publish: handler(req => publishPayrollReconciliation(scope(req), req.params.id, req.user!.id, req.body?.expectedVersion)),
  staffAction: handler(req => actPayrollReconciliation(scope(req), req.params.id, req.params.employeeId, { id: req.user!.id, name: req.user!.displayName || req.user!.email || "Kế toán", role: "staff" }, req.body?.expectedVersion, action(req))),
  mine: handler(req => listMyPayrollReconciliation(company(req), req.user!.id)),
  employeeAction: handler(req => actMyPayrollReconciliation(company(req), req.user!.id, req.params.id, req.user!.displayName || req.user!.email || "Nhân viên", req.body?.expectedVersion, action(req))),
};
