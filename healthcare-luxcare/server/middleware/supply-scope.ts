import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth";
import { BranchModel } from "../model/branch.model";

/** Resolve a trusted scope once, including legacy clients passing branch in query/body. */
export async function requireSupplyScope(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user?.companyCode)
    return res.status(403).json({ status: "error", message: "Vui lòng chọn công ty để quản lý vật tư." });
  const candidates = [req.query.branchId, req.body?.branchId, req.headers["x-branch-id"]].filter(
    (v) => v !== undefined && v !== "",
  );
  if (candidates.some((v) => typeof v !== "string" || !/^[a-f\d]{24}$/i.test(v)))
    return res.status(400).json({ status: "error", message: "Chi nhánh không hợp lệ." });
  const requested = candidates[0] as string | undefined;
  if (candidates.some((v) => v !== requested))
    return res.status(400).json({ status: "error", message: "Chi nhánh trong yêu cầu không thống nhất." });
  const privileged = user.role === "admin" || user.role === "superadmin";
  if ((!privileged && !user.branchId) || (!privileged && requested && requested !== user.branchId))
    return res.status(403).json({ status: "error", message: "Không có quyền truy cập kho của chi nhánh này." });
  const branchId = requested || user.branchId;
  if (branchId) {
    try {
      const branch = await BranchModel.exists({ _id: branchId, companyCode: user.companyCode, isActive: true });
      if (!branch)
        return res
          .status(403)
          .json({ status: "error", message: "Chi nhánh không thuộc công ty hoặc đã ngừng hoạt động." });
    } catch {
      return res.status(503).json({ status: "error", message: "Không xác minh được phạm vi kho." });
    }
  }
  user.branchId = branchId;
  next();
}
