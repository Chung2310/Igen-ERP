import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { getEmployeeAnnualLeaveBalance } from "../service/annual-leave.service";

export const leaveController = {
  async balance(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user?.companyCode || "SYSTEM";
      const employeeId = String(req.query.employeeId || req.user?.id || "");
      const year = Number(req.query.year || new Date().getFullYear());
      if (!employeeId || !Number.isInteger(year) || year < 2000 || year > 2200) {
        return res.status(400).json({ status: "error", message: "Thiếu nhân viên hoặc năm tính phép không hợp lệ." });
      }
      const data = await getEmployeeAnnualLeaveBalance(employeeId, companyCode, year);
      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      return res.status(500).json({ status: "error", message: "Không thể tải số dư phép năm.", details: error.message });
    }
  },
};