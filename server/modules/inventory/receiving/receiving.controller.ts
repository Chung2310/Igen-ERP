import type { Request, Response } from "express";
import { cancelReceipt, confirmReceipt, createReceipt, createSupplier, deleteSupplier, listReceipts, listSuppliers, startReceiving, submitReceipt, updateReceipt, updateSupplier } from "./receiving.service";
import { BranchModel } from "../../../model/branch.model";

function actor(req: Request) { const user = (req as any).user || {}; return { id: user.id, email: user.email }; }
function company(req: Request) { return String((req as any).user?.companyCode || "").trim().toUpperCase(); }
async function scope(req: Request) {
  const user = (req as any).user || {};
  const companyCode = company(req);
  const accountBranchId = String(user.branchId || "").trim();
  const requestedBranchId = String(req.query.branchId || "").trim();
  const role = String(user.role || "");
  if (!companyCode) throw Object.assign(new Error("Vui lòng chọn công ty."), { statusCode: 400 });
  if (requestedBranchId && !/^[a-f\d]{24}$/i.test(requestedBranchId)) throw Object.assign(new Error("Chi nhánh được chọn không hợp lệ."), { statusCode: 400 });
  if (accountBranchId && requestedBranchId && requestedBranchId !== accountBranchId) throw Object.assign(new Error("Bạn chỉ được thao tác tại chi nhánh của mình."), { statusCode: 403 });
  let branchId = accountBranchId;
  if (!branchId && ["admin", "superadmin"].includes(role)) {
    branchId = requestedBranchId;
    if (!branchId) throw Object.assign(new Error("Hãy chọn chi nhánh theo tên trước khi thao tác nhập kho."), { statusCode: 400 });
    const selected = await BranchModel.findOne({ _id: branchId, companyCode, isActive: true }).select("_id").lean();
    if (!selected) throw Object.assign(new Error("Không tìm thấy chi nhánh đang hoạt động trong công ty."), { statusCode: 403 });
  }
  if (!branchId) throw Object.assign(new Error("Vui lòng chọn công ty và chi nhánh."), { statusCode: 400 });
  return { companyCode, branchId };
}
function sendError(res: Response, error: any) { return res.status(Number(error?.statusCode) || 400).json({ status: "error", message: error?.message || "Không thể xử lý dữ liệu nhập hàng." }); }

export const receivingController = {
  listSuppliers: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await listSuppliers({ ...{ companyCode: company(req) }, q: req.query.q, status: req.query.status }) }); } catch (error) { return sendError(res, error); } },
  createSupplier: async (req: Request, res: Response) => { try { return res.status(201).json({ status: "success", data: await createSupplier({ companyCode: company(req) }, req.body, actor(req)) }); } catch (error) { return sendError(res, error); } },
  updateSupplier: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await updateSupplier({ companyCode: company(req) }, req.params.id, req.body, actor(req)) }); } catch (error) { return sendError(res, error); } },
  deleteSupplier: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await deleteSupplier({ companyCode: company(req) }, req.params.id) }); } catch (error) { return sendError(res, error); } },
  listReceipts: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await listReceipts(await scope(req), req.query) }); } catch (error) { return sendError(res, error); } },
  createReceipt: async (req: Request, res: Response) => { try { return res.status(201).json({ status: "success", data: await createReceipt(await scope(req), req.body, actor(req)) }); } catch (error) { return sendError(res, error); } },
  updateReceipt: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await updateReceipt(await scope(req), req.params.id, req.body, actor(req)) }); } catch (error) { return sendError(res, error); } },
  submitReceipt: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await submitReceipt(await scope(req), req.params.id, actor(req)) }); } catch (error) { return sendError(res, error); } },
  startReceiving: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await startReceiving(await scope(req), req.params.id, actor(req)) }); } catch (error) { return sendError(res, error); } },
  confirmReceipt: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await confirmReceipt(await scope(req), req.params.id, actor(req)) }); } catch (error) { return sendError(res, error); } },
  cancelReceipt: async (req: Request, res: Response) => { try { return res.json({ status: "success", data: await cancelReceipt(await scope(req), req.params.id, req.body?.reason, actor(req)) }); } catch (error) { return sendError(res, error); } },
};
