import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailScopeFromRequest, requireRetailBranch } from "../../retail/contracts";
import { reconcileWarehouse } from "./reconciliation.service";
import { WarehouseModel } from "../../../model/warehouse.model";
import { cancelInventoryTransfer, listInventoryTransfers, receiveInventoryTransfer, requestInventoryTransfer, reverseInventoryTransfer } from "./transfer.service";

export const inventoryTransferRouter = Router();
const read = requirePermission("inventory:read") as any;
const manage = requirePermission("inventory:manage") as any;
const scope = (req: any) => requireRetailBranch(retailScopeFromRequest(req.user || {}, req.query));
const actor = (req: any) => ({ id: String(req.user?.id || req.user?.uid || ""), name: String(req.user?.displayName || req.user?.email || "") });
const handle = (work: (req: any) => Promise<unknown>, created = false) => async (req: any, res: any, next: any) => {
  try { res.status(created ? 201 : 200).json({ success: true, data: await work(req) }); }
  catch (error) { next(error); }
};
inventoryTransferRouter.get("/warehouses", manage, handle((req) => WarehouseModel.find({ companyCode: scope(req).companyCode, isActive: true }).sort({ branchId: 1, name: 1 }).lean()));
inventoryTransferRouter.get("/reconciliation", read, handle((req) => reconcileWarehouse(scope(req).companyCode, scope(req).branchId, String(req.query.warehouseId || ""))));
inventoryTransferRouter.get("/", read, handle((req) => listInventoryTransfers(scope(req).companyCode, scope(req).branchId)));
inventoryTransferRouter.post("/", manage, handle((req) => requestInventoryTransfer(scope(req), req.body || {}, actor(req)), true));
inventoryTransferRouter.post("/:id/receive", manage, handle((req) => receiveInventoryTransfer(scope(req), req.params.id, actor(req))));
inventoryTransferRouter.post("/:id/cancel", manage, handle((req) => cancelInventoryTransfer(scope(req), req.params.id, String(req.body?.reason || ""), actor(req))));
inventoryTransferRouter.post("/:id/reverse", manage, handle((req) => reverseInventoryTransfer(scope(req), req.params.id, String(req.body?.reason || ""), actor(req))));
