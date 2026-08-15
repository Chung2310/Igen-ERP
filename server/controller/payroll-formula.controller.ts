import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { activatePayrollFormula, clonePayrollFormula, createPayrollFormula, listPayrollFormulas, retirePayrollFormula, updatePayrollFormula } from "../service/payroll-formula-operations.service";
const tenant = (req: AuthenticatedRequest) => req.user!.companyCode!;
const translateMongooseError = (message: string): string => {
  let msg = message;
  msg = msg.replace(/validation failed:/gi, "kiểm thực thất bại:");
  msg = msg.replace(/Path `(.+?)` is required\./gi, "Trường `$1` là bắt buộc.");
  msg = msg.replace(/`(.+?)` is not a valid enum value for path `(.+?)`\./gi, "Giá trị `$1` không hợp lệ cho trường `$2`.");
  msg = msg.replace(/Cast to (.+?) failed for value "(.+?)" \(type (.+?)\) at path "(.+?)"/gi, "Giá trị \"$2\" không đúng kiểu dữ liệu $1 tại trường \"$4\"");
  msg = msg.replace(/Cast to (.+?) failed for value "(.+?)" at path "(.+?)"/gi, "Giá trị \"$2\" không đúng kiểu dữ liệu $1 tại trường \"$3\"");
  return msg;
};

const sendError = (res: Response, error: any) => {
  const rawMessage = error instanceof Error ? error.message : "Không thể xử lý công thức";
  return res.status(error?.status ?? 500).json({
    status: "error",
    code: error?.code ?? "PAYROLL_FORMULA_ERROR",
    message: translateMongooseError(rawMessage)
  });
};
export const payrollFormulaController = {
  async list(req: AuthenticatedRequest, res: Response) { try { return res.json({ status: "success", data: await listPayrollFormulas(tenant(req)) }); } catch (e) { return sendError(res, e); } },
  async create(req: AuthenticatedRequest, res: Response) { try { return res.status(201).json({ status: "success", data: await createPayrollFormula(tenant(req), req.user!.id, req.body) }); } catch (e) { return sendError(res, e); } },
  async update(req: AuthenticatedRequest, res: Response) { const { expectedVersion, ...definition } = req.body; try { return res.json({ status: "success", data: await updatePayrollFormula(tenant(req), req.params.id, Number(expectedVersion), definition) }); } catch (e) { return sendError(res, e); } },
  async activate(req: AuthenticatedRequest, res: Response) { try { return res.json({ status: "success", data: await activatePayrollFormula(tenant(req), req.params.id, req.user!.id) }); } catch (e) { return sendError(res, e); } },
  async retire(req: AuthenticatedRequest, res: Response) { try { return res.json({ status: "success", data: await retirePayrollFormula(tenant(req), req.params.id, req.user!.id) }); } catch (e) { return sendError(res, e); } },
  async clone(req: AuthenticatedRequest, res: Response) { try { return res.status(201).json({ status: "success", data: await clonePayrollFormula(tenant(req), req.params.id, req.user!.id, String(req.body.code ?? "")) }); } catch (e) { return sendError(res, e); } },
};
