import { Router, type Request, type Response } from "express";
import { requirePermission } from "../../../middleware/auth";
import { acceptTransfer, cancelTransfer, createTransfer, getTransfer, listTransfers, transferDestinations } from "./transfer.service";
import { inventoryError } from "../inventory-scope";

function scope(req: Request) {
  const companyCode = String((req as any).user?.companyCode || "").trim().toUpperCase();
  const branchId = String((req as any).user?.branchId || "").trim();
  if (!companyCode || !branchId) inventoryError("Vui lòng chọn công ty và chi nhánh.");
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
inventoryTransferRouter.get("/destinations", requirePermission("inventory:read") as any, handle((req) => transferDestinations(scope(req).companyCode)));
inventoryTransferRouter.get("/", requirePermission("inventory:read") as any, handle((req) => listTransfers(scope(req), req.query)));
inventoryTransferRouter.get("/:id", requirePermission("inventory:read") as any, handle((req) => getTransfer(scope(req), req.params.id)));
inventoryTransferRouter.post("/", requirePermission("inventory:manage") as any, handle((req) => createTransfer(scope(req), req.body, actor(req)), 201));
inventoryTransferRouter.post("/:id/accept", requirePermission("inventory:manage") as any, handle((req) => acceptTransfer(scope(req), req.params.id, actor(req))));
inventoryTransferRouter.post("/:id/cancel", requirePermission("inventory:manage") as any, handle((req) => cancelTransfer(scope(req), req.params.id, String(req.body?.reason || ""), actor(req))));
