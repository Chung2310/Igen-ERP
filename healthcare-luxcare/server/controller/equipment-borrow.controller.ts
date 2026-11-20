import type { Request, Response } from "express";
import { UserModel } from "../model/user.model";
import { getEffectivePermissions } from "../middleware/auth";
import { equipmentBorrowService, EquipmentBorrowError } from "../service/equipment-borrow.service";

const defaultCanManage = async (user: any) => {
  const permissions = await getEffectivePermissions(user.id, user.role, user.companyCode);
  return permissions.has("*") || permissions.has("equipment:manage");
};

const defaultResolveName = async (user: any) => {
  const profile = await UserModel.findById(user.id).select("displayName email").lean();
  return profile?.displayName || profile?.email || user.email || "Nhân viên";
};

export function createEquipmentBorrowController(
  service: any = equipmentBorrowService,
  canManage = defaultCanManage,
  resolveName = defaultResolveName,
) {
  const actor = async (req: any) => ({
    uid: String(req.user?.id || ""),
    name: await resolveName(req.user || {}),
    companyCode: String(req.user?.companyCode || ""),
    branchId: req.user?.branchId ? String(req.user.branchId) : undefined,
    canManage: await canManage(req.user || {}),
  });

  const fail = (res: Response, error: any) => {
    if (error instanceof EquipmentBorrowError) {
      return res.status(error.status).json({ status: "error", code: error.code, message: error.message });
    }
    return res.status(400).json({ status: "error", code: "EQUIPMENT_REQUEST_FAILED", message: error?.message || "Không thể xử lý yêu cầu thiết bị." });
  };

  return {
    createBorrow: async (req: Request, res: Response) => {
      try { return res.status(201).json({ status: "success", data: await service.createBorrowRequest(await actor(req), req.params.id, req.body) }); }
      catch (error) { return fail(res, error); }
    },
    createReturn: async (req: Request, res: Response) => {
      try { return res.status(201).json({ status: "success", data: await service.createReturnRequest(await actor(req), req.params.id, req.body) }); }
      catch (error) { return fail(res, error); }
    },
    cancel: async (req: Request, res: Response) => {
      try { return res.json({ status: "success", message: "Đã hủy yêu cầu thiết bị.", data: await service.cancelRequest(await actor(req), req.params.requestId) }); }
      catch (error) { return fail(res, error); }
    },
    decide: async (req: Request, res: Response) => {
      try { return res.json({ status: "success", message: req.body.decision === "approved" ? "Đã duyệt yêu cầu thiết bị." : "Đã từ chối yêu cầu thiết bị.", data: await service.decideRequest(await actor(req), req.params.requestId, req.body) }); }
      catch (error) { return fail(res, error); }
    },
    list: async (req: Request, res: Response) => {
      try { return res.json({ status: "success", ...(await service.listRequests(await actor(req), req.query)) }); }
      catch (error) { return fail(res, error); }
    },
    history: async (req: Request, res: Response) => {
      try { return res.json({ status: "success", data: await service.getHistory(await actor(req), req.params.id) }); }
      catch (error) { return fail(res, error); }
    },
  };
}

export const equipmentBorrowController = createEquipmentBorrowController();
