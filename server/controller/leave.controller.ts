import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { getEmployeeAnnualLeaveBalance } from "../service/annual-leave.service";
import { listCompanyAnnualLeaveBalances } from "../service/hr-leave-balance-report.service";

function currentVietnamYear() {
  return Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).format(new Date()));
}

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

  async balances(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user?.companyCode || "SYSTEM";
      const year = Number(req.query.year || currentVietnamYear());
      const data = await listCompanyAnnualLeaveBalances(companyCode, req.user?.branchId, year);
      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      const status = /không hợp lệ/i.test(String(error?.message || "")) ? 400 : 500;
      return res.status(status).json({ status: "error", message: status === 400 ? error.message : "Không thể tải thống kê phép năm nhân sự." });
    }
  },
};
