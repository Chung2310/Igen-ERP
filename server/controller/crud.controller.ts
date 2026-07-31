import { Response } from "express";
import { AuthenticatedRequest, getEffectivePermissions } from "../middleware/auth";
import { crudService } from "../service/crud.service";
import { SupportedModelName } from "../interface/crud.interface";
import { UserModel } from "../model/user.model";
import { TrainingCourseModel } from "../model/training-course.model";
import { HRCalendarEventModel } from "../model/hr-calendar-event.model";
import { HRLeaveTemplateModel } from "../model/hr-leave-template.model";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";
import { listWorkingDates, toVietnamDate } from "../service/company-work-calendar.service";
import { getEmployeeAnnualLeaveBalance } from "../service/annual-leave.service";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { AttendancePeriodResultModel } from "../model/attendance-period-result.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { TimekeepingAdjustmentAuditModel } from "../model/timekeeping-adjustment-audit.model";

/**
 * Chuy?n l?i Mongo duplicate key (E11000) th�nh l?i 409 d? hi?u thay v� d? l?t
 * xu?ng 500 m?c d?nh. V� d? message g?c:
 * "E11000 duplicate key error collection: igen-erp.categories index: companyCode_1_code_1 dup key: { companyCode: \"ABC\", code: \"ASA\" }"
 */
function toClientError(error: any): { statusCode: number; message: string } {
  if (error?.statusCode) return { statusCode: error.statusCode, message: error.message };
  if (error?.code === 11000) {
    const dupFields = Object.keys(error.keyValue || {}).filter((key) => key !== "companyCode" && key !== "branchId");
    const dupValues = dupFields.map((key) => `${key}="${error.keyValue[key]}"`).join(", ");
    return {
      statusCode: 409,
      message: dupValues ? `D? li?u d� t?n t?i (${dupValues}). Vui l�ng d�ng gi� tr? kh�c.` : "D? li?u d� t?n t?i. Vui l�ng d�ng gi� tr? kh�c.",
    };
  }
  return { statusCode: 500, message: error?.message || "�� x?y ra l?i kh�ng x�c d?nh." };
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
 * timekeeping:manage permission (e.g. a custom "hr" role) � used to gate
 * approving/creating/deleting leave, wfh, exception, and template entries.
 */
async function canManageTimekeeping(req: AuthenticatedRequest): Promise<boolean> {
  const userRole = req.user?.role || "user";
  if (userRole === "superadmin" || userRole === "admin" || userRole === "manager") return true;
  const permissions = await getEffectivePermissions(req.user!.id, userRole, req.user?.companyCode);
  return permissions.has("*") || permissions.has("leave:approve");
}

/**
 * Narrower than canManageTimekeeping: superadmin/admin OR timekeeping:manage �
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

      // Tr�ch xu?t c�c tham s? c�n l?i l�m b? l?c d?ng (filters)
      const { page: _p, limit: _l, sort: _s, search: _sh, filters: queryFilters, ...otherParams } = req.query;
      const filters: any = {
        ...(typeof queryFilters === "object" && queryFilters !== null ? queryFilters : {}),
        ...otherParams,
      };

      if (req.user?.branchId) filters.branchId = req.user.branchId;

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
        message: "L?i khi t?i danh s�ch t�i nguy�n",
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
        message: "L?i khi t?i th�ng tin t�i nguy�n",
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

      if (modelName === "hr-leave-applications") {
        if (!req.body.employeeId || !req.body.startDate || !req.body.endDate) throw Object.assign(new Error("Thi?u nh�n vi�n v� kho?ng ng�y ngh?."), { statusCode: 400 });
        const snapshot = await computeChargeableSnapshot(companyCode, req.body as { startDate: Date; endDate: Date });
        if (snapshot.chargeableDays < 1) throw Object.assign(new Error("Kho?ng ng�y kh�ng c� ng�y l�m vi?c d? t�nh ngh?."), { statusCode: 400 });
        const year = new Date(req.body.startDate).getUTCFullYear();
        const balance = await getEmployeeAnnualLeaveBalance(req.body.employeeId, companyCode, year);
        if (balance.remaining < snapshot.chargeableDays) throw Object.assign(new Error(`S? ng�y ngh? vu?t s? ph�p c�n l?i (${balance.remaining} ng�y).`), { statusCode: 400 });
        req.body = { ...req.body, status: "pending", year, chargeableDates: snapshot.chargeableDates, chargeableDays: snapshot.chargeableDays, approvalType: undefined, approvedBy: undefined, approvedAt: undefined };
      }

      const LEAVE_TYPES = ["leave", "wfh", "exception"];
      if (modelName === "hr-calendar-events" && LEAVE_TYPES.includes(req.body.type)) {
        if (!(await canManageTimekeeping(req))) {
          return res.status(403).json({
            status: "error",
            message: "Ch? qu?n l� v� admin m?i c� quy?n t?o don ngh? ph�p, l�m t?i nh� ho?c ngo?i l?.",
          });
        }
        if (req.body.status === "approved") {
          return res.status(403).json({
            status: "error",
            message: "B?n kh�ng du?c ph�p t? duy?t khi t?o don.",
          });
        }
      }

      if (modelName === "hr-leave-templates") {
        if (!(await canApproveLeave(req))) {
          return res.status(403).json({
            status: "error",
            message: "Ch? admin m?i c� quy?n t?i l�n bi?u m?u m?u.",
          });
        }
      }

      // Nh�n vi�n thu?ng ch? du?c n?p don d?ng t�n ch�nh m�nh v� lu�n ? tr?ng
      // th�i ch? duy?t � kh�ng cho g?i h? ngu?i kh�c hay t? duy?t qua body.
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

      let attendanceBefore: any = null;
      let attendanceReason = "";
      if (modelName === "timekeeping-logs") {
        attendanceReason = String(req.body.editReason || "").trim();
        if (attendanceReason.length < 3) return res.status(400).json({ status: "error", message: "Vui l�ng nh?p l� do ch?nh s?a ch?m c�ng." });
        attendanceBefore = await TimekeepingLogModel.findOne({ _id: id, companyCode, branchId }).lean();
        if (!attendanceBefore) return res.status(404).json({ status: "error", message: "Kh�ng t�m th?y l?ch s? ch?m c�ng." });
        const periodKey = attendanceBefore.date.slice(0, 7);
        const [lockedResult, payrollRun] = await Promise.all([
          AttendancePeriodResultModel.findOne({ companyCode, branchId, periodKey, status: "locked" }).lean(),
          PayrollRunModel.findOne({ companyCode, branchId, periodKey, type: "regular" })
            .sort({ createdAt: 1, _id: 1 })
            .lean(),
        ]);
        if (lockedResult || payrollRun?.status === "closed") return res.status(409).json({ status: "error", message: "K? c�ng d� kh�a ho?c d� t�nh luong. H�y reset/m? k? tru?c khi s?a ch?m c�ng." });
        delete req.body.editReason;
        req.body.manuallyAdjusted = true;
        req.body.adjustedAt = new Date();
        req.body.adjustedBy = req.user?.id;
        req.body.adjustmentReason = attendanceReason;
      }

      if (modelName === "training-courses") {
        const course = await TrainingCourseModel.findOne({ _id: id, companyCode }).lean();
        if (course && course.creatorUid !== req.user?.id && userRole !== "superadmin" && userRole !== "admin") {
          return res.status(403).json({
            status: "error",
            message: "B?n kh�ng c� quy?n s?a d?i kh�a h?c n�y v� kh�ng ph?i l� ngu?i t?o.",
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
              message: "Ch? qu?n l� v� admin m?i c� quy?n ch?nh s?a don ngh? ph�p / l�m t?i nh� / ngo?i l?.",
            });
          }
          if (req.body.status === "approved" && event.creatorId === req.user?.id) {
            return res.status(403).json({
              status: "error",
              message: "Ngu?i t?o don kh�ng du?c ph�p t? duy?t.",
            });
          }
        }
      }

      if (modelName === "hr-leave-templates") {
        if (!(await canApproveLeave(req))) {
          return res.status(403).json({
            status: "error",
            message: "Ch? admin m?i c� quy?n ch?nh s?a bi?u m?u m?u.",
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
                message: "B?n kh�ng c� quy?n ch?nh s?a don c?a ngu?i kh�c.",
              });
            }
          }
          if (req.body.status && req.body.status !== app.status) {
            if (!isSupervisor) {
              return res.status(403).json({
                status: "error",
                message: "Ch? Admin v� Superadmin m?i c� quy?n ph� duy?t/thay d?i tr?ng th�i don t?.",
              });
            }
          }
        }
      }

      if (modelName === "hr-leave-applications" && req.body.status === "approved") {
        if (!["justified", "unjustified"].includes(req.body.approvalType)) throw Object.assign(new Error("C?n ch?n lo?i duy?t ch�nh d�ng ho?c kh�ng ch�nh d�ng."), { statusCode: 400 });
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

      // T? d?ng d?ng b? sang hr-calendar-events khi don xin ngh?/tr? du?c duy?t
      if (modelName === "hr-leave-applications" && item && item.status === "approved") {
        const existingEvent = await HRCalendarEventModel.findOne({
          employeeId: item.employeeId,
          startDate: item.startDate,
          endDate: item.endDate,
          type: "leave",
          companyCode: item.companyCode
        });

        if (!existingEvent) {
          let title = `${item.employeeName} - ${item.type}`;
          if (item.type === "leave") title = `${item.employeeName} xin ngh? ph�p`;
          if (item.type === "late") title = `${item.employeeName} xin di tr?`;
          if (item.type === "early") title = `${item.employeeName} xin v? s?m`;
          if (item.type === "other") title = `${item.employeeName} xin ph�p kh�c`;

          await HRCalendarEventModel.create({
            companyCode: item.companyCode,
            type: "leave",
            title,
            description: `�on d� duy?t. L� do: ${item.reason}. �on d�nh k�m: ${item.uploadedFileName}${item.note ? `. Ph?n h?i: ${item.note}` : ""}`,
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
            message: "B?n kh�ng c� quy?n x�a kh�a h?c n�y v� kh�ng ph?i l� ngu?i t?o.",
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
              message: "Ch? qu?n l� v� admin m?i c� quy?n x�a don ngh? ph�p / l�m t?i nh� / ngo?i l?.",
            });
          }
        }
      }

      if (modelName === "hr-leave-templates") {
        if (!(await canApproveLeave(req))) {
          return res.status(403).json({
            status: "error",
            message: "Ch? admin m?i c� quy?n x�a bi?u m?u m?u.",
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
              message: "B?n kh�ng c� quy?n x�a don c?a ngu?i kh�c.",
            });
          }
        }
      }

      const item = await crudService.delete(modelName as SupportedModelName, id, companyCode, userRole, req.user?.branchId);
      return res.status(200).json({
        status: "success",
        message: "X�a t�i nguy�n th�nh c�ng",
        data: item,
      });
    } catch (error: any) {
      console.error("[crudController.delete] Error:", error);
      return res.status(error.statusCode || 500).json({
        status: "error",
        message: error.statusCode ? error.message : "L?i khi x�a t�i nguy�n",
        details: error.message,
      });
    }
  },
};
