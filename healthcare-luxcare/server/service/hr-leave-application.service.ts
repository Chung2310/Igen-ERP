import { HistoricalUserModel } from "../model/historical-user.model";
import { annotateHistoricalRecords } from "./historical-user.service";
import mongoose, { type ClientSession } from "mongoose";
import { HRCalendarEventModel } from "../model/hr-calendar-event.model";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";
import { HRLeaveTemplateModel } from "../model/hr-leave-template.model";
import { UserModel } from "../model/user.model";
import type { LeaveRequestKind } from "../interface/hr-leave.interface";
import { calculateChargeableDates, getEmployeeAnnualLeaveBalance } from "./annual-leave.service";
import { createLeaveApprovalScopeService, type LeaveActor, type LeaveScope } from "./leave-approval-scope.service";
import { leaveResourceService } from "./leave-resource.service";
import type { ManagedUploadActor } from "./managed-upload.service";
import { LeaveOperationError } from "./hr-leave-template.service";
import { paginationMeta, parsePagination } from "../utils/pagination";

export interface LeaveRequestActor extends LeaveActor, ManagedUploadActor {}

interface ApplicationInput {
  templateId?: string;
  type: string;
  requestKind: LeaveRequestKind;
  startDate: string | Date;
  endDate: string | Date;
  reason: string;
  attachments?: any[];
}

type DecisionInput =
  | { decision: "approved"; approvalType: "justified" | "unjustified"; note?: string }
  | { decision: "rejected"; rejectReason: string; note?: string };

interface ApplicationDependencies {
  findUser(companyCode: string, id: string): Promise<any | null>;
  visibleEmployeeIds(actor: LeaveRequestActor): Promise<string[]>;
  canDecide(actor: LeaveRequestActor, employeeId: string): Promise<boolean>;
  list(scope: LeaveScope, employeeIds: string[], skip: number, limit: number): Promise<any[]>;
  count(scope: LeaveScope, employeeIds: string[]): Promise<number>;
  findTemplate(scope: LeaveScope, id: string): Promise<any | null>;
  calculateDates(companyCode: string, start: string, end: string): Promise<string[]>;
  getBalance(employeeId: string, companyCode: string, year: number): Promise<{ remaining: number; pending: number }>;
  create(value: any): Promise<any>;
  finalizeApplication(actor: ManagedUploadActor, application: any): Promise<unknown>;
  findById(scope: LeaveScope, id: string, session?: ClientSession): Promise<any | null>;
  decidePending(scope: LeaveScope, id: string, update: any, session?: ClientSession): Promise<any | null>;
  createCalendar(value: any, session?: ClientSession): Promise<any>;
  removePending(scope: LeaveScope, id: string): Promise<any | null>;
  trashApplication(actor: ManagedUploadActor, application: any): Promise<unknown>;
  transaction<T>(work: (session?: ClientSession) => Promise<T>): Promise<T>;
}

const isAdmin = (role: string) => role === "admin" || role === "superadmin";

export function createHrLeaveApplicationService(deps: ApplicationDependencies) {
  return {
    async listApplications(scope: LeaveScope, actor: LeaveRequestActor, filters: Record<string, any> = {}) {
      const { page, limit, skip } = parsePagination(filters);
      const employeeIds = await deps.visibleEmployeeIds(actor);
      const [applications, total] = await Promise.all([
        deps.list(scope, employeeIds, skip, limit),
        deps.count(scope, employeeIds),
      ]);
      const data = await Promise.all(applications.map(async (application) => ({
        ...application,
        canDecide: await deps.canDecide(actor, String(application.employeeId)),
      })));
      return { data, pagination: paginationMeta(page, limit, total) };
    },

    async createApplication(scope: LeaveScope, actor: LeaveRequestActor, input: ApplicationInput) {
      const employee = await deps.findUser(scope.companyCode, actor.id);
      if (!employee) throw new LeaveOperationError("LEAVE_EMPLOYEE_NOT_FOUND", 404, "Không tìm thấy hồ sơ nhân viên.");

      let type = input.type;
      let requestKind = input.requestKind;
      if (input.templateId) {
        const template = await deps.findTemplate(scope, input.templateId);
        if (!template) throw new LeaveOperationError("LEAVE_TEMPLATE_NOT_FOUND", 404, "Không tìm thấy biểu mẫu.");
        type = template.name;
        requestKind = template.requestKind;
      }

      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);
      const year = startDate.getUTCFullYear();
      let chargeableDates: string[] | undefined;
      let chargeableDays = 0;
      if (requestKind === "leave") {
        chargeableDates = await deps.calculateDates(
          scope.companyCode,
          startDate.toISOString().slice(0, 10),
          endDate.toISOString().slice(0, 10),
        );
        chargeableDays = chargeableDates.length;
        if (!chargeableDays) throw new LeaveOperationError("LEAVE_NO_WORKING_DAY", 400, "Khoảng ngày không có ngày làm việc để tính nghỉ.");
        const balance = await deps.getBalance(actor.id, scope.companyCode, year);
        if (chargeableDays > Math.max(0, balance.remaining - balance.pending)) {
          throw new LeaveOperationError("LEAVE_BALANCE_EXCEEDED", 400, "Số ngày nghỉ vượt quá số phép còn lại.");
        }
      }

      const application = await deps.create({
        companyCode: scope.companyCode,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        employeeId: actor.id,
        employeeName: employee.displayName || employee.email || "Nhân viên",
        type,
        requestKind,
        startDate,
        endDate,
        reason: input.reason,
        attachments: input.attachments || [],
        uploadedFileUrl: input.attachments?.[0]?.url || "",
        uploadedFileName: input.attachments?.[0]?.name || "",
        status: "pending",
        year,
        chargeableDays,
        ...(chargeableDates ? { chargeableDates } : {}),
      });
      await deps.finalizeApplication(actor, application);
      return application;
    },

    async decideApplication(scope: LeaveScope, actor: LeaveRequestActor, id: string, input: DecisionInput) {
      return deps.transaction(async (session) => {
        const application = await deps.findById(scope, id, session);
        if (!application) throw new LeaveOperationError("LEAVE_APPLICATION_NOT_FOUND", 404, "Không tìm thấy đơn.");
        if (!(await deps.canDecide(actor, String(application.employeeId)))) {
          throw new LeaveOperationError("LEAVE_DECISION_FORBIDDEN", 403, "Bạn không có quyền duyệt đơn này.");
        }
        const now = new Date();
        const update = input.decision === "approved"
          ? { status: "approved", approvalType: input.approvalType, approvalNote: input.note || "", approvedBy: actor.id, approvedAt: now }
          : { status: "rejected", rejectReason: input.rejectReason, note: input.note || "", approvedBy: actor.id, approvedAt: now };
        const decided = await deps.decidePending(scope, id, update, session);
        if (!decided) throw new LeaveOperationError("LEAVE_STATUS_CONFLICT", 409, "Đơn đã được xử lý trước đó.");

        if (input.decision === "approved") {
          const titles: Record<LeaveRequestKind, string> = {
            event: "đăng ký sự kiện", leave: "xin nghỉ phép", wfh: "xin làm tại nhà", exception: "xin ngoại lệ",
          };
          await deps.createCalendar({
            companyCode: scope.companyCode,
            ...(scope.branchId ? { branchId: scope.branchId } : {}),
            leaveApplicationId: id,
            type: application.requestKind,
            title: `${application.employeeName} ${titles[application.requestKind as LeaveRequestKind]}${application.type ? ` (${application.type})` : ""}`,
            description: `Đơn đã duyệt. Lý do: ${application.reason}${input.note ? `. Phản hồi: ${input.note}` : ""}`,
            startDate: application.startDate,
            endDate: application.endDate,
            employeeId: application.employeeId,
            employeeName: application.employeeName,
            status: "approved",
            creatorId: actor.id,
          }, session);
        }
        return decided;
      });
    },

    async deleteApplication(scope: LeaveScope, actor: LeaveRequestActor, id: string) {
      const application = await deps.findById(scope, id);
      if (!application) throw new LeaveOperationError("LEAVE_APPLICATION_NOT_FOUND", 404, "Không tìm thấy đơn.");
      if (application.employeeId !== actor.id && !isAdmin(actor.role)) {
        throw new LeaveOperationError("LEAVE_DELETE_FORBIDDEN", 403, "Bạn không có quyền xóa đơn này.");
      }
      if (application.status !== "pending") {
        throw new LeaveOperationError("LEAVE_DELETE_STATUS_INVALID", 409, "Chỉ có thể xóa đơn đang chờ duyệt.");
      }
      const removed = await deps.removePending(scope, id);
      if (!removed) throw new LeaveOperationError("LEAVE_STATUS_CONFLICT", 409, "Trạng thái đơn đã thay đổi.");
      await deps.trashApplication(actor, removed);
      return removed;
    },
  };
}

const scopedFilter = (scope: LeaveScope) => ({ companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}) });
export const applicationScopedFilter = (scope: LeaveScope) => ({ companyCode: scope.companyCode });
const approvalScope = createLeaveApprovalScopeService({
  listUsers: async (scope) => {
    const [users, archived] = await Promise.all([
      UserModel.find(scopedFilter(scope)).select("_id companyCode branchId role parentId").lean(),
      HistoricalUserModel.find(scopedFilter(scope)).lean(),
    ]);
    const current = new Set(users.map((u: any) => String(u._id)));
    return [...users, ...archived.filter((u: any) => !current.has(u.userId)).map((u: any) => ({ ...u, _id: u.userId, isDeleted: true }))] as any[];
  },
});

async function runTransaction<T>(work: (session?: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

export const hrLeaveApplicationService = createHrLeaveApplicationService({
  findUser: (companyCode, id) => UserModel.findOne({ _id: id, companyCode }).select("_id displayName email").lean(),
  visibleEmployeeIds: async (actor) => {
    const visible = await approvalScope.visibleEmployeeIds(actor);
    // Old hard deletions have no archived hierarchy. Only scoped administrators
    // may recover these records; never broaden a supervisor's access.
    if (isAdmin(actor.role)) {
      const historical = await HRLeaveApplicationModel.distinct("employeeId", scopedFilter(actor));
      return [...new Set([...visible, ...historical.map(String)])];
    }
    return visible;
  },
  canDecide: (actor, employeeId) => approvalScope.canDecide(actor, employeeId),
  list: async (scope, employeeIds, skip, limit) => annotateHistoricalRecords(scope.companyCode, await HRLeaveApplicationModel.find({ ...applicationScopedFilter(scope), employeeId: { $in: employeeIds } }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean()),
  count: (scope, employeeIds) => HRLeaveApplicationModel.countDocuments({ ...applicationScopedFilter(scope), employeeId: { $in: employeeIds } }),
  findTemplate: (scope, id) => HRLeaveTemplateModel.findOne({ _id: id, ...scopedFilter(scope) }).lean(),
  calculateDates: calculateChargeableDates,
  getBalance: getEmployeeAnnualLeaveBalance,
  create: (value) => HRLeaveApplicationModel.create(value),
  finalizeApplication: (actor, application) => leaveResourceService.finalizeApplication(actor, application),
  findById: async (scope, id, session) => {
    const query = HRLeaveApplicationModel.findOne({ _id: id, ...applicationScopedFilter(scope) });
    if (session) query.session(session);
    return query.lean();
  },
  decidePending: (scope, id, update, session) => HRLeaveApplicationModel.findOneAndUpdate(
    { _id: id, ...applicationScopedFilter(scope), status: "pending" }, { $set: update }, { returnDocument: "after", runValidators: true, ...(session ? { session } : {}) },
  ).lean(),
  createCalendar: async (value, session) => {
    if (session) return (await HRCalendarEventModel.create([value], { session }))[0];
    return HRCalendarEventModel.create(value);
  },
  removePending: (scope, id) => HRLeaveApplicationModel.findOneAndDelete({ _id: id, ...applicationScopedFilter(scope), status: "pending" }).lean(),
  trashApplication: (actor, application) => leaveResourceService.trashApplication(actor, application),
  transaction: runTransaction,
});
