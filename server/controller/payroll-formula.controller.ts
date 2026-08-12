import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { activatePayrollFormula, clonePayrollFormula, createPayrollFormula, listPayrollFormulas, retirePayrollFormula, updatePayrollFormula } from "../service/payroll-formula-operations.service";
const tenant = (req: AuthenticatedRequest) => req.user!.companyCode!;
const sendError = (res: Response, error: any) => res.status(error?.status ?? 500).json({ status: "error", code: error?.code ?? "PAYROLL_FORMULA_ERROR", message: error instanceof Error ? error.message : "Không thể xử lý công thức" });
export const payrollFormulaController = {
  async list(req: AuthenticatedRequest, res: Response) { try { return res.json({ status: "success", data: await listPayrollFormulas(tenant(req)) }); } catch (e) { return sendError(res, e); } },
  async create(req: AuthenticatedRequest, res: Response) { try { return res.status(201).json({ status: "success", data: await createPayrollFormula(tenant(req), req.user!.id, req.body) }); } catch (e) { return sendError(res, e); } },
  async update(req: AuthenticatedRequest, res: Response) { const { expectedVersion, ...definition } = req.body; try { return res.json({ status: "success", data: await updatePayrollFormula(tenant(req), req.params.id, Number(expectedVersion), definition) }); } catch (e) { return sendError(res, e); } },
  async activate(req: AuthenticatedRequest, res: Response) { try { return res.json({ status: "success", data: await activatePayrollFormula(tenant(req), req.params.id, req.user!.id) }); } catch (e) { return sendError(res, e); } },
  async retire(req: AuthenticatedRequest, res: Response) { try { return res.json({ status: "success", data: await retirePayrollFormula(tenant(req), req.params.id, req.user!.id) }); } catch (e) { return sendError(res, e); } },
  async clone(req: AuthenticatedRequest, res: Response) { try { return res.status(201).json({ status: "success", data: await clonePayrollFormula(tenant(req), req.params.id, req.user!.id, String(req.body.code ?? "")) }); } catch (e) { return sendError(res, e); } },
};
