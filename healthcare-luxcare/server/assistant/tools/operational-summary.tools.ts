import { canAccessResourceItem } from "../../service/resource.service";
import type { Model } from "mongoose";
import { UserModel } from "../../model/user.model";
import { TimekeepingLogModel } from "../../model/timekeeping.model";
import { HRLeaveApplicationModel } from "../../model/hr-leave-application.model";
import { PayrollRunModel } from "../../model/payroll-run.model";
import { RecruitmentJobModel } from "../../model/recruitment-job.model";
import { RecruitmentApplicantModel } from "../../model/recruitment-applicant.model";
import { ProjectModel } from "../../model/project.model";
import { KanbanTaskModel } from "../../model/kanban-task.model";
import { EquipmentModel } from "../../model/equipment.model";
import { ResourceItemModel } from "../../model/resource-item.model";
import { NotificationModel } from "../../model/notification.model";
import { TrainingCourseModel } from "../../model/training-course.model";
import { WorkflowModel } from "../../model/workflow.model";
import type { AssistantToolDefinition } from "./assistant-tool.types";

function filter(context: Parameters<AssistantToolDefinition["execute"]>[1], branchScoped = true) {
  return {
    companyCode: context.companyCode,
    ...(!context.allBranches && branchScoped ? { branchId: { $in: context.branchIds } } : {}),
  };
}

function countTool(
  name: string,
  permission: string,
  title: string,
  models: Array<{ label: string; model: Model<any>; branchScoped?: boolean }>,
): AssistantToolDefinition {
  return {
    name,
    permission,
    parseArgs: () => ({}),
    async execute(_args, context) {
      if (!context.allBranches && !context.branchIds.length && models.some((item) => item.branchScoped !== false))
        throw new Error("Bạn không có quyền tra cứu khi chưa được gắn chi nhánh.");
      const counts = await Promise.all(
        models.map(
          async ({ label, model, branchScoped }) =>
            `${label}: ${await model.countDocuments({ ...filter(context, branchScoped !== false), isDeleted: { $ne: true }, ...(model === NotificationModel ? { recipientUid: context.userId } : {}) })}`,
        ),
      );
      const queriedAt = new Date().toISOString();
      const scope =
        name === "notification_summary"
          ? "Thông báo của người đang hỏi"
          : context.allBranches
            ? "Toàn doanh nghiệp"
            : `Chi nhánh: ${context.branchIds.join(", ")}`;
      return [
        {
          id: `${name}:${queriedAt}`,
          sourceType: "database",
          title,
          content: `Phạm vi: ${scope}. Chỉ thống kê tổng số; không lọc thời gian, trạng thái và không thể suy ra số liệu cá nhân ngoài phạm vi này.\n${counts.join("\n")}`,
          citation: {
            id: name,
            sourceType: "database",
            title,
            scope,
            queriedAt,
          },
        },
      ];
    },
  };
}

export const operationalSummaryTools: AssistantToolDefinition[] = [
  countTool("hr_summary", "hr:read", "Nhân sự", [
    { label: "Nhân viên", model: UserModel },
    { label: "Khóa đào tạo", model: TrainingCourseModel },
    { label: "Quy trình", model: WorkflowModel },
  ]),
  countTool("attendance_leave_summary", "timekeeping:read", "Chấm công và nghỉ phép", [
    { label: "Bản ghi chấm công", model: TimekeepingLogModel },
    { label: "Đơn nghỉ phép", model: HRLeaveApplicationModel },
  ]),
  countTool("payroll_summary", "payroll:read", "Tính lương", [{ label: "Kỳ chạy lương", model: PayrollRunModel }]),
  countTool("recruitment_summary", "recruitment:manage", "Tuyển dụng", [
    { label: "Vị trí", model: RecruitmentJobModel },
    { label: "Ứng viên", model: RecruitmentApplicantModel },
  ]),
  countTool("project_summary", "project:read", "Dự án và công việc", [
    { label: "Dự án", model: ProjectModel },
    { label: "Công việc", model: KanbanTaskModel },
  ]),
  countTool("equipment_summary", "equipment:read", "Thiết bị", [{ label: "Thiết bị", model: EquipmentModel }]),
  {
    name: "resource_summary",
    permission: "resource:read",
    parseArgs: () => ({}),
    async execute(_args, context) {
      let count = 0;
      for await (const item of ResourceItemModel.find({ companyCode: context.companyCode, isDeleted: { $ne: true } })
        .lean()
        .cursor()) {
        if (await canAccessResourceItem(context.companyCode, item, context.userId, context.role)) count++;
      }
      return [
        {
          id: "resource_summary",
          sourceType: "database",
          title: "Tài nguyên",
          content: `Tổng số tài nguyên người dùng được phép đọc: ${count}. Không lọc thời gian hoặc trạng thái khác.`,
          citation: { id: "resource_summary", sourceType: "database", title: "Tài nguyên được phép đọc" },
        },
      ];
    },
  },
  countTool("notification_summary", "chat:read", "Thông báo", [
    { label: "Thông báo", model: NotificationModel, branchScoped: false },
  ]),
];
