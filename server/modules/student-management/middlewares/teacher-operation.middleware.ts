import type { NextFunction, Response } from "express";
import { getEffectivePermissions, hasAnyPermission } from "../../../middleware/auth";
import { AssignmentModel } from "../models/assignment.model";
import { Batch } from "../models/batch.model";
import type { AuthRequest } from "./auth.middleware";

/** Allows managers everywhere, and teachers only on batches assigned to their account. */
export async function requireTeacherOperation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: "Chưa xác thực." });
    const permissions = await getEffectivePermissions(user.uid, user.role, user.companyCode || user.centerId);
    if (hasAnyPermission(permissions, ["student:manage", "worker:manage"])) return next();
    if (!hasAnyPermission(permissions, ["teacher:operate"])) {
      return res.status(403).json({ success: false, error: "Tài khoản chưa có quyền thao tác giảng dạy." });
    }

    let batchId = String(req.params.batchId || req.body?.batchId || req.query?.batchId || "");
    if (!batchId && req.params.id && req.originalUrl.includes("/batches/")) batchId = req.params.id;
    if (!batchId && req.params.id && req.originalUrl.includes("/assignments/")) {
      const assignment = await AssignmentModel.findById(req.params.id).select("batchId").lean();
      batchId = String(assignment?.batchId || "");
    }
    if (!batchId) return res.status(400).json({ success: false, error: "Không xác định được lớp học để kiểm tra quyền giáo viên." });

    const batch = await Batch.findOne({ _id: batchId, instructorId: user.uid, ...(user.branchId ? { branchId: user.branchId } : {}) }).select("_id").lean();
    if (!batch) return res.status(403).json({ success: false, error: "Bạn chỉ có thể thao tác trên lớp được phân công giảng dạy." });
    return next();
  } catch (error) {
    return next(error);
  }
}
