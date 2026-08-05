import { Response } from "express";
import { AuthenticatedRequest, getEffectivePermissions, DEFAULT_ROLE_LEVELS } from "../middleware/auth";
import { crudService } from "../service/crud.service";
import { SupportedModelName } from "../interface/crud.interface";
import { UserModel } from "../model/user.model";
import { RolePermissionModel } from "../model/role-permission.model";
import { TrainingCourseModel } from "../model/training-course.model";
import { HRCalendarEventModel } from "../model/hr-calendar-event.model";
import { HRLeaveTemplateModel } from "../model/hr-leave-template.model";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";
import { LEAVE_REQUEST_KINDS, LeaveRequestKind } from "../interface/hr-leave.interface";
import { listWorkingDates, toVietnamDate } from "../service/company-work-calendar.service";
import { getEmployeeAnnualLeaveBalance } from "../service/annual-leave.service";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { AttendancePeriodResultModel } from "../model/attendance-period-result.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { TimekeepingAdjustmentAuditModel } from "../model/timekeeping-adjustment-audit.model";

/**
 * Chuyển lỗi Mongo duplicate key (E11000) thành lỗi 409 dễ hiểu thay vì để lọt
 * xuống 500 mặc định. Ví dụ message gốc:
 * "E11000 duplicate key error collection: igen-erp.categories index: companyCode_1_code_1 dup key: { companyCode: \"ABC\", code: \"ASA\" }"
 */
function toClientError(error: any): { statusCode: number; message: string } {
  if (error?.statusCode) return { statusCode: error.statusCode, message: error.message };
  if (error?.code === 11000) {
    const dupFields = Object.keys(error.keyValue || {}).filter((key) => key !== "companyCode" && key !== "branchId");
    const dupValues = dupFields.map((key) => `${key}="${error.keyValue[key]}"`).join(", ");
    return {
      statusCode: 409,
      message: dupValues ? `Dữ liệu đã tồn tại (${dupValues}). Vui lòng dùng giá trị khác.` : "Dữ liệu đã tồn tại. Vui lòng dùng giá trị khác.",
    };
  }
  return { statusCode: 500, message: error?.message || "Đã xảy ra lỗi không xác định." };
}

export function shouldSnapshotChargeableDays(leave: { status: string; type: string } | null | undefined): boolean {
  return !!leave && leave.status !== "approved" && leave.type === "leave";
}

export async function computeChargeableSnapshot(
  companyCode: string,
  leave: { startDate: Date | string; endDate: Date | string }
): Promise<{ chargeableDates: string[]; chargeableDays: number }> {
  const chargeableDates = await listWorkingDates(companyCode, toVietnamDate(new Date(leave.startDate)), toVietnamDate(new Date(leave.endDate)));
  return { chargeableDates, chargeableDays: chargeableDates.length };
}

/**
 * True for superadmin/admin/manager OR any role explicitly granted the
 * timekeeping:manage permission (e.g. a custom "hr" role) — used to gate
 * approving/creating/deleting leave, wfh, exception, and template entries.
 */
async function canManageTimekeeping(req: AuthenticatedRequest): Promise<boolean> {
  const userRole = req.user?.role || "user";
  if (userRole === "superadmin" || userRole === "admin" || userRole === "manager") return true;
  const permissions = await getEffectivePermissions(req.user!.id, userRole, req.user?.companyCode);
  return permissions.has("*") || permissions.has("leave:approve");
}

/**
 * Narrower than canManageTimekeeping: superadmin/admin OR timekeeping:manage —
 * used for actions previously restricted to admin/superadmin only (approving
 * leave applications, managing leave templates), where "manager" was never included.
 */
async function canApproveLeave(req: AuthenticatedRequest): Promise<boolean> {
  const userRole = req.user?.role || "user";
  if (userRole === "superadmin" || userRole === "admin") return true;
  const permissions = await getEffectivePermissions(req.user!.id, userRole, req.user?.companyCode);
  return permissions.has("*") || permissions.has("leave:approve");
}

export const crudController = {
  /**
   * GET /api/v1/crud/:modelName
   */
  async getList(req: AuthenticatedRequest, res: Response) {
    try {
      const modelName = req.params.modelName as SupportedModelName;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const userRole = req.user?.role || "user";

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 1000;
      const sort = req.query.sort as string;
      const search = req.query.search as string;

      // Trích xuất các tham số còn lại làm bộ lọc động (filters)
      const { page: _p, limit: _l, sort: _s, search: _sh, filters: queryFilters, ...otherParams } = req.query;
      const filters: any = {
        ...(typeof queryFilters === "object" && queryFilters !== null ? queryFilters : {}),
        ...otherParams,
      };

      if (req.user?.branchId) {
        if (modelName === "timekeeping-logs") {
          filters.branchId = { $in: [req.user.branchId, null, undefined] };
        } else if (modelName !== "training-courses" && modelName !== "training-enrollments" && modelName !== "workflows") {
          filters.branchId = req.user.branchId;
        }
      }

      if (modelName === "training-enrollments") {
        let isSupervisor = ["superadmin", "admin", "manager"].includes(userRole);
        if (!isSupervisor && req.user?.id) {
          const userDoc = await UserModel.findById(req.user.id).select("level").lean();
          if (userDoc && typeof userDoc.level === "number" && userDoc.level <= 3) {
            isSupervisor = true;
          }
        }
        if (!isSupervisor) {
          filters.uid = req.user?.id;
        }
      }

      if (modelName === "hr-leave-applications") {
        const isSupervisor = await canApproveLeave(req);
        if (!isSupervisor && req.user?.id) {
          filters.employeeId = req.user.id;
        }
      }

      const result = await crudService.getList(modelName, companyCode, {
        page,
        limit,
        sort,
        search,
        filters,
      }, userRole);

      if (modelName === "timekeeping-logs" && result.items.length) {
        const logIds = result.items.map((item: any) => item._id);
        const audits = await TimekeepingAdjustmentAuditModel.find({ companyCode, logId: { $in: logIds } }).sort({ createdAt: -1 }).lean();
        const byLog = new Map<string, any[]>();
        for (const entry of audits) {
          const key = String(entry.logId);
          if ((byLog.get(key)?.length || 0) >= 10) continue;
          byLog.set(key, [...(byLog.get(key) || []), entry]);
        }
        result.items = result.items.map((item: any) => ({ ...item, adjustmentHistory: byLog.get(String(item._id)) || [] }));
      }

      return res.status(200).json({
        status: "success",
        data: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error: any) {
      console.error("[crudController.getList] Error:", error);
      return res.status(error.statusCode || 500).json({
        status: "error",
        message: "Lỗi khi tải danh sách tài nguyên",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/crud/:modelName/:id
   */
  async getById(req: AuthenticatedRequest, res: Response) {
    try {
      const { modelName, id } = req.params;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const userRole = req.user?.role || "user";

      const item = await crudService.getById(modelName as SupportedModelName, id, companyCode, userRole, req.user?.branchId);
      return res.status(200).json({
        status: "success",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.getById] Error:", error);
      return res.status(error.statusCode || 500).json({
        status: "error",
        message: "Lỗi khi tải thông tin tài nguyên",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/crud/:modelName
   */
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const modelName = req.params.modelName as SupportedModelName;
      const companyCode = req.user?.companyCode || "SYSTEM";

      console.log(`[crudController.create] modelName=${modelName} body:`, req.body);

      if (modelName === "users") {
        const actorRole = req.user?.role || "user";
        if (actorRole !== "superadmin" && actorRole !== "admin") {
          return res.status(403).json({
            status: "error",
            message: "Chỉ Admin hoặc Superadmin mới có quyền thay đổi vai trò của người dùng.",
          });
        }
        
        let targetRoleLevel = DEFAULT_ROLE_LEVELS[req.body.role];
        if (targetRoleLevel === undefined) {
          const rolePerm = await RolePermissionModel.findOne({
            companyCode,
            role: req.body.role,
          });
          targetRoleLevel = rolePerm ? rolePerm.level : 4;
        }

        const callerRolePerm = await RolePermissionModel.findOne({
          companyCode,
          role: actorRole,
        });
        const callerLevel = callerRolePerm ? callerRolePerm.level : (DEFAULT_ROLE_LEVELS[actorRole] || 4);

        if (actorRole !== "superadmin" && targetRoleLevel <= callerLevel) {
          return res.status(403).json({
            status: "error",
            message: "Bạn không thể gán vai trò có cấp bậc tương đương hoặc cao hơn cấp bậc của bạn.",
          });
        }
      }

      if (modelName === "hr-leave-applications") {
        if (!req.body.employeeId || !req.body.startDate || !req.body.endDate) throw Object.assign(new Error("Thiếu nhân viên và khoảng ngày nghỉ."), { statusCode: 400 });
        const requestKind: LeaveRequestKind = LEAVE_REQUEST_KINDS.includes(req.body.requestKind) ? req.body.requestKind : "leave";
        const year = new Date(req.body.startDate).getUTCFullYear();
        const base = { ...req.body, requestKind, status: "pending", year, approvalType: undefined, approvedBy: undefined, approvedAt: undefined };

        // Chỉ đơn nghỉ phép mới trừ vào hạn mức phép năm; sự kiện / WFH / ngoại lệ không tính công.
        if (requestKind === "leave") {
          const snapshot = await computeChargeableSnapshot(companyCode, req.body as { startDate: Date; endDate: Date });
          if (snapshot.chargeableDays < 1) throw Object.assign(new Error("Khoảng ngày không có ngày làm việc để tính nghỉ."), { statusCode: 400 });
          const balance = await getEmployeeAnnualLeaveBalance(req.body.employeeId, companyCode, year);
          if (balance.remaining < snapshot.chargeableDays) throw Object.assign(new Error(`Số ngày nghỉ vượt số pháp còn lại (${balance.remaining} ngày).`), { statusCode: 400 });
          req.body = { ...base, chargeableDates: snapshot.chargeableDates, chargeableDays: snapshot.chargeableDays };
        } else {
          req.body = { ...base, chargeableDates: undefined, chargeableDays: 0 };
        }
      }

      const LEAVE_TYPES = ["leave", "wfh", "exception"];
      if (modelName === "hr-calendar-events" && LEAVE_TYPES.includes(req.body.type)) {
        if (!(await canManageTimekeeping(req))) {
          return res.status(403).json({
            status: "error",
            message: "Chỉ quản lý và admin mới có quyền tạo đơn nghỉ phép, làm tại nhà hoặc ngoại lệ.",
          });
        }
        if (req.body.status === "approved") {
          return res.status(403).json({
            status: "error",
            message: "Bạn không được phép tự duyệt khi tạo đơn.",
          });
        }
      }

      if (modelName === "hr-leave-templates") {
        if (!(await canApproveLeave(req))) {
          return res.status(403).json({
            status: "error",
            message: "Chỉ admin mới có quyền tải lên biểu mẫu mẫu.",
          });
        }
      }

      // Nhân viên thường chỉ được nộp đơn đứng tên chính mình và luôn ở trạng thái
      // chờ duyệt — không cho gửi hộ người khác hay tự duyệt qua body.
      if (modelName === "hr-leave-applications" && !(await canApproveLeave(req))) {
        req.body.employeeId = req.user!.id;
        req.body.status = "pending";
      }

      const item = await crudService.create(modelName, req.body, companyCode, req.user?.branchId);
      return res.status(201).json({
        status: "success",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.create] Error:", error);
      const { statusCode, message } = toClientError(error);
      return res.status(statusCode).json({
        status: "error",
        message,
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/crud/:modelName/:id
   */
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { modelName, id } = req.params;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const branchId = req.user?.branchId || "";
      const userRole = req.user?.role || "user";

      console.log(`[crudController.update] modelName=${modelName} id=${id} body:`, req.body);

      if (modelName === "users") {
        const actorRole = req.user?.role || "user";
        if (actorRole !== "superadmin") {
          const targetUser = await UserModel.findOne({ _id: id, companyCode }).lean();
          if (targetUser) {
            const callerRolePerm = await RolePermissionModel.findOne({ companyCode, role: actorRole });
            const callerLevel = callerRolePerm ? callerRolePerm.level : (DEFAULT_ROLE_LEVELS[actorRole] || 4);

            let currentTargetLevel = DEFAULT_ROLE_LEVELS[targetUser.role];
            if (currentTargetLevel === undefined) {
              const currentTargetPerm = await RolePermissionModel.findOne({ companyCode, role: targetUser.role });
              currentTargetLevel = currentTargetPerm ? currentTargetPerm.level : 4;
            }

            if (currentTargetLevel <= callerLevel) {
              return res.status(403).json({
                status: "error",
                message: "Bạn không có quyền chỉnh sửa tài khoản có cấp bậc tương đương hoặc cao hơn.",
              });
            }
          }

          if (req.body.role !== undefined) {
            if (actorRole !== "admin") {
              return res.status(403).json({
                status: "error",
                message: "Chỉ Admin hoặc Superadmin mới có quyền thay đổi vai trò của người dùng.",
              });
            }

            let targetLevel = DEFAULT_ROLE_LEVELS[req.body.role];
            if (targetLevel === undefined) {
              const targetRolePerm = await RolePermissionModel.findOne({ companyCode, role: req.body.role });
              targetLevel = targetRolePerm ? targetRolePerm.level : 4;
            }

            const callerRolePerm = await RolePermissionModel.findOne({ companyCode, role: actorRole });
            const callerLevel = callerRolePerm ? callerRolePerm.level : (DEFAULT_ROLE_LEVELS[actorRole] || 4);

            if (targetLevel <= callerLevel) {
              return res.status(403).json({
                status: "error",
                message: "Bạn không thể gán vai trò có cấp bậc tương đương hoặc cao hơn cấp bậc của bạn.",
              });
            }
          }
        }
      }

      let attendanceBefore: any = null;
      let attendanceReason = "";
      if (modelName === "timekeeping-logs") {
        attendanceReason = String(req.body.editReason || "").trim();
        if (attendanceReason.length < 3) return res.status(400).json({ status: "error", message: "Vui lòng nhập lý do chỉnh sửa chấm công." });
        const logBranchFilter = branchId ? { $in: [branchId, null, undefined] } : { $in: [null, undefined, ""] };
        attendanceBefore = await TimekeepingLogModel.findOne({ _id: id, companyCode, branchId: logBranchFilter }).lean();
        if (!attendanceBefore) return res.status(404).json({ status: "error", message: "Không tìm thấy lịch sử chấm công." });
        const periodKey = attendanceBefore.date.slice(0, 7);
        const queryBranchId = attendanceBefore.branchId || branchId;
        const [lockedResult, payrollRun] = await Promise.all([
          AttendancePeriodResultModel.findOne({ companyCode, branchId: queryBranchId, periodKey, status: "locked" }).lean(),
          PayrollRunModel.findOne({ companyCode, branchId: queryBranchId, periodKey, type: "regular" })
            .sort({ createdAt: 1, _id: 1 })
            .lean(),
        ]);
        if (lockedResult || payrollRun?.status === "closed") return res.status(409).json({ status: "error", message: "Kỳ công đã khóa hoặc đã tính lương. Hãy reset/mở kỳ trước khi sửa chấm công." });
        delete req.body.editReason;
        req.body.manuallyAdjusted = true;
        req.body.adjustedAt = new Date();
        req.body.adjustedBy = req.user?.id;
        req.body.adjustmentReason = attendanceReason;
        if (!attendanceBefore.branchId && branchId) {
          req.body.branchId = branchId;
        }
      }

      if (modelName === "training-courses") {
        const course = await TrainingCourseModel.findOne({ _id: id, companyCode }).lean();
        if (course && course.creatorUid !== req.user?.id && userRole !== "superadmin" && userRole !== "admin") {
          return res.status(403).json({
            status: "error",
            message: "Bạn không có quyền sửa đổi khóa học này và không phải là người tạo.",
          });
        }
      }

      if (modelName === "hr-calendar-events") {
        const LEAVE_TYPES = ["leave", "wfh", "exception"];
        const event = await HRCalendarEventModel.findOne({ _id: id, companyCode }).lean();
        if (event && (LEAVE_TYPES.includes(event.type) || LEAVE_TYPES.includes(req.body.type))) {
          if (!(await canManageTimekeeping(req))) {
            return res.status(403).json({
              status: "error",
              message: "Chỉ quản lý và admin mới có quyền chỉnh sửa đơn nghỉ phép / làm tại nhà / ngoại lệ.",
            });
          }
          if (req.body.status === "approved" && event.creatorId === req.user?.id) {
            return res.status(403).json({
              status: "error",
              message: "Người tạo đơn không được phép tự duyệt.",
            });
          }
        }
      }

      if (modelName === "hr-leave-templates") {
        if (!(await canApproveLeave(req))) {
          return res.status(403).json({
            status: "error",
            message: "Chỉ admin mới có quyền chỉnh sửa biểu mẫu mẫu.",
          });
        }
      }

      if (modelName === "hr-leave-applications") {
        const app = await HRLeaveApplicationModel.findOne({ _id: id, companyCode }).lean();
        if (app) {
          const isSupervisor = await canApproveLeave(req);
          if (!isSupervisor) {
            if (app.employeeId !== req.user?.id) {
              return res.status(403).json({
                status: "error",
                message: "Bạn không có quyền chỉnh sửa đơn của người khác.",
              });
            }
          }
          if (req.body.status && req.body.status !== app.status) {
            if (!isSupervisor) {
              return res.status(403).json({
                status: "error",
                message: "Chỉ Admin và Superadmin mới có quyền phê duyệt/thay đổi trạng thái đơn từ.",
              });
            }
          }
        }
      }

      if (modelName === "hr-leave-applications" && req.body.status === "approved") {
        if (!["justified", "unjustified"].includes(req.body.approvalType)) throw Object.assign(new Error("Cần chọn loại duyệt chính đáng hoặc không chính đáng."), { statusCode: 400 });
        req.body.approvedAt = new Date();
        req.body.approvalNote = req.body.note || req.body.approvalNote || "";
      }

      if (modelName === "hr-leave-applications" && (req.body.status === "approved" || req.body.status === "rejected")) {
        const leave = await HRLeaveApplicationModel.findOne({ _id: id, companyCode }).lean();
        if (req.body.status === "approved" && shouldSnapshotChargeableDays(leave)) {
          const { chargeableDates, chargeableDays } = await computeChargeableSnapshot(companyCode, leave as { startDate: Date; endDate: Date });
          req.body.chargeableDates = chargeableDates;
          req.body.chargeableDays = chargeableDays;
          req.body.year = new Date(leave!.startDate).getUTCFullYear();
        }
      }

      const item = await crudService.update(modelName as SupportedModelName, id, req.body, companyCode, userRole, req.user?.branchId);

      if (modelName === "timekeeping-logs" && attendanceBefore && item) {
        const periodKey = attendanceBefore.date.slice(0, 7);
        await Promise.all([
          TimekeepingAdjustmentAuditModel.create({ companyCode, logId: attendanceBefore._id, employeeId: attendanceBefore.uid, date: attendanceBefore.date, actorId: req.user!.id, reason: attendanceReason, before: attendanceBefore, after: item }),
          AttendancePeriodResultModel.updateMany({ companyCode, branchId, periodKey, status: "draft" }, { $set: { needsRecalculation: true } }),
        ]);
      }

      // Tự động đồng bộ sang hr-calendar-events khi đơn được duyệt — mỗi loại yêu cầu
      // sinh ra một sự kiện đúng loại trên tab Lịch trình.
      if (modelName === "hr-leave-applications" && item && item.status === "approved") {
        const requestKind: LeaveRequestKind = LEAVE_REQUEST_KINDS.includes(item.requestKind) ? item.requestKind : "leave";
        const existingEvent = await HRCalendarEventModel.findOne({
          employeeId: item.employeeId,
          startDate: item.startDate,
          endDate: item.endDate,
          type: requestKind,
          companyCode: item.companyCode
        });

        if (!existingEvent) {
          const KIND_TITLES: Record<LeaveRequestKind, string> = {
            event: "đăng ký sự kiện",
            leave: "xin nghỉ phép",
            wfh: "xin làm tại nhà",
            exception: "xin ngoại lệ",
          };
          const title = `${item.employeeName} ${KIND_TITLES[requestKind]}${item.type ? ` (${item.type})` : ""}`;

          await HRCalendarEventModel.create({
            companyCode: item.companyCode,
            branchId: item.branchId,
            type: requestKind,
            title,
            description: `Đơn đã duyệt. Lý do: ${item.reason}. Đơn đính kèm: ${item.uploadedFileName}${item.note ? `. Phản hồi: ${item.note}` : ""}`,
            startDate: item.startDate,
            endDate: item.endDate,
            employeeId: item.employeeId,
            employeeName: item.employeeName,
            status: "approved",
            creatorId: item.approvedBy || req.user?.id || "system"
          });
        }
      }

      return res.status(200).json({
        status: "success",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.update] Error:", error);
      const { statusCode, message } = toClientError(error);
      return res.status(statusCode).json({
        status: "error",
        message,
        details: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/crud/:modelName/:id
   */
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const { modelName, id } = req.params;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const userRole = req.user?.role || "user";

      if (modelName === "training-courses") {
        const course = await TrainingCourseModel.findOne({ _id: id, companyCode }).lean();
        if (course && course.creatorUid !== req.user?.id && userRole !== "superadmin" && userRole !== "admin") {
          return res.status(403).json({
            status: "error",
            message: "Bạn không có quyền xóa khóa học này vì không phải là người tạo.",
          });
        }
      }

      if (modelName === "hr-calendar-events") {
        const LEAVE_TYPES = ["leave", "wfh", "exception"];
        const event = await HRCalendarEventModel.findOne({ _id: id, companyCode }).lean();
        if (event && LEAVE_TYPES.includes(event.type)) {
          if (!(await canManageTimekeeping(req))) {
            return res.status(403).json({
              status: "error",
              message: "Chỉ quản lý và admin mới có quyền xóa đơn nghỉ phép / làm tại nhà / ngoại lệ.",
            });
          }
        }
      }

      if (modelName === "hr-leave-templates") {
        if (!(await canApproveLeave(req))) {
          return res.status(403).json({
            status: "error",
            message: "Chỉ admin mới có quyền xóa biểu mẫu mẫu.",
          });
        }
      }

      if (modelName === "hr-leave-applications") {
        const app = await HRLeaveApplicationModel.findOne({ _id: id, companyCode }).lean();
        if (app) {
          const isSupervisor = await canApproveLeave(req);
          if (!isSupervisor && app.employeeId !== req.user?.id) {
            return res.status(403).json({
              status: "error",
              message: "Bạn không có quyền xóa đơn của người khác.",
            });
          }
        }
      }

      const item = await crudService.delete(modelName as SupportedModelName, id, companyCode, userRole, req.user?.branchId);
      return res.status(200).json({
        status: "success",
        message: "Xóa tài nguyên thành công",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.delete] Error:", error);
      return res.status(error.statusCode || 500).json({
        status: "error",
        message: error.statusCode ? error.message : "Lỗi khi xóa tài nguyên",
        details: error.message,
      });
    }
  },
};
