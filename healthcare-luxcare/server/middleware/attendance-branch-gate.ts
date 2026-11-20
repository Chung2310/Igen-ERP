import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./auth";
import { BranchModel } from "../model/branch.model";
import { AttendanceAttemptModel } from "../model/attendance-attempt.model";
import { BranchAttendanceGateError, validateBranchAttendance } from "../service/branch-attendance-gate.service";
import { getRequestPublicIp } from "../utils/request-ip";

export async function attendanceBranchGate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const latitude = Number(req.body.latitude), longitude = Number(req.body.longitude);
  const base = { uid: req.user!.id, companyCode: req.user?.companyCode || "SYSTEM", branchId: req.user?.branchId,
    action: req.path.includes("check-out") ? "check-out" : "check-in", latitude, longitude, ipAddress: getRequestPublicIp(req), attemptedAt: new Date() };
  if (!req.user?.branchId) {
    await AttendanceAttemptModel.create({ ...base, outcome: "rejected", reasonCode: "branch_missing" });
    return res.status(400).json({ reasonCode: "branch_missing", message: "Tài khoản chưa được gán chi nhánh." });
  }
  const branch = await BranchModel.findOne({ _id: req.user.branchId, companyCode: base.companyCode, isActive: true }).lean();
  try {
    (req as any).attendanceBranchGate = { ...base, ...validateBranchAttendance({ branch, latitude, longitude, requestIp: base.ipAddress }) };
    return next();
  } catch (error) {
    const gateError = error as BranchAttendanceGateError;
    await AttendanceAttemptModel.create({ ...base, distance: gateError.distance, outcome: "rejected", reasonCode: gateError.reasonCode });
    const message = gateError.reasonCode === "outside_radius" ? "Bạn đang ở ngoài khu vực chấm công của chi nhánh."
      : gateError.reasonCode === "network_not_allowed" ? "Bạn phải kết nối đúng mạng Wi-Fi của chi nhánh để chấm công."
      : "Chi nhánh chưa cấu hình đầy đủ vị trí và mạng chấm công.";
    return res.status(400).json({ reasonCode: gateError.reasonCode, message });
  }
}
