import { Router, type Request, type Response } from "express";
import { BranchModel } from "../../../model/branch.model";
import { requirePermission } from "../../../middleware/auth";
import { acceptTransfer, cancelTransfer, createTransfer, getTransfer, listTransfers, transferDestinations } from "./transfer.service";
import { inventoryError } from "../inventory-scope";

async function scope(req: Request) {
  const companyCode = String((req as any).user?.companyCode || "").trim().toUpperCase();
  const accountBranchId = String((req as any).user?.branchId || "").trim();
  const requestedBranchId = String(req.query.branchId || "").trim();
  const role = String((req as any).user?.role || "");
  if (!companyCode) inventoryError("Vui lòng chọn công ty.");
  if (requestedBranchId && !/^[a-f\d]{24}$/i.test(requestedBranchId)) inventoryError("Chi nhánh được chọn không hợp lệ.");
  if (accountBranchId && requestedBranchId && requestedBranchId !== accountBranchId) inventoryError("Bạn chỉ được thao tác tại chi nhánh của mình.", 403);
  let branchId = accountBranchId;
  if (!branchId && ["admin", "superadmin"].includes(role)) {
    branchId = requestedBranchId;
    if (!branchId) inventoryError("Hãy chọn chi nhánh theo tên trước khi thao tác điều chuyển kho.");
    const selected = await BranchModel.findOne({ _id: branchId, companyCode, isActive: true }).select("_id").lean();
    if (!selected) inventoryError("Không tìm thấy chi nhánh đang hoạt động trong công ty.");
  }
  if (!branchId) inventoryError("Vui lòng chọn công ty và chi nhánh.");
  return { companyCode, branchId };
}
function actor(req: Request) {
  const user = (req as any).user;
  return { id: String(user?.id || user?._id || ""), name: String(user?.displayName || user?.name || user?.fullName || user?.email || user?.id || "") };
}
const handle = (work: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response) => {
  try { return res.status(status).json({ status: "success", data: await work(req) }); }
  catch (error: any) { return res.status(Number(error?.statusCode || error?.status) || 400).json({ status: "error", code: error?.code, message: error?.message || "Không thể xử lý điều chuyển." }); }
};
export const inventoryTransferRouter = Router();
inventoryTransferRouter.get("/destinations", requirePermission("inventory:read") as any, handle(async (req) => transferDestinations((await scope(req)).companyCode)));
inventoryTransferRouter.get("/", requirePermission("inventory:read") as any, handle(async (req) => listTransfers(await scope(req), req.query)));
inventoryTransferRouter.get("/:id", requirePermission("inventory:read") as any, handle(async (req) => getTransfer(await scope(req), req.params.id)));
inventoryTransferRouter.post("/", requirePermission("inventory:manage") as any, handle(async (req) => createTransfer(await scope(req), req.body, actor(req)), 201));
inventoryTransferRouter.post("/:id/accept", requirePermission("inventory:manage") as any, handle(async (req) => acceptTransfer(await scope(req), req.params.id, actor(req))));
inventoryTransferRouter.post("/:id/cancel", requirePermission("inventory:manage") as any, handle(async (req) => cancelTransfer(await scope(req), req.params.id, String(req.body?.reason || ""), actor(req))));
