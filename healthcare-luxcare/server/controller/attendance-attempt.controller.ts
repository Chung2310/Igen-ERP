import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { AttendanceAttemptModel } from "../model/attendance-attempt.model";
import { UserModel } from "../model/user.model";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const attendanceAttemptController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const date = String(req.query.date || "");
    if (!DAY.test(date)) return res.status(400).json({ status: "error", message: "Ngày không hợp lệ." });
    if (!req.user?.branchId) return res.status(400).json({ status: "error", message: "Chưa chọn chi nhánh." });
    const start = new Date(`${date}T00:00:00+07:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const attempts = await (AttendanceAttemptModel as any).find({
      companyCode: req.user.companyCode || "SYSTEM", branchId: req.user.branchId,
      attemptedAt: { $gte: start, $lt: end }, outcome: { $in: ["rejected", "error"] },
    }).select("uid action outcome reasonCode attemptedAt latitude longitude distance ipAddress").sort({ attemptedAt: -1 }).limit(500).lean();
    const users = await (UserModel as any).find({ _id: { $in: [...new Set(attempts.map((item: any) => String(item.uid)))] } }).select("displayName email").lean();
    const byId = new Map<string, any>(users.map((user: any) => [String(user._id), user]));
    return res.json({ status: "success", data: attempts.map((attempt: any) => ({
      ...attempt, displayName: byId.get(String(attempt.uid))?.displayName || "Nhân viên iGen",
      email: byId.get(String(attempt.uid))?.email || "",
    })) });
  },
};
