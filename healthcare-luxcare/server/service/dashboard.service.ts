import mongoose from "mongoose";
import { ProjectModel } from "../model/project.model";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { UserModel } from "../model/user.model";
import { ChatRoomModel } from "../model/chat-room.model";
import { ChatMessageModel } from "../model/chat-message.model";
import { ResourceItemModel } from "../model/resource-item.model";
import { TrainingCourseModel } from "../model/training-course.model";
import { TrainingEnrollmentModel } from "../model/training-enrollment.model";
import { resolveDashboardModuleAccess } from "./dashboard-module-access";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";
import { createLeaveApprovalScopeService } from "./leave-approval-scope.service";

export interface DashboardUser {
  id: string;
  role: string;
  companyCode?: string;
  branchId?: string;
  enabledModules?: string[];
  /** Tập hợp mã quyền hiệu lực của user, dùng để lọc dữ liệu theo RolePermission. */
  permissions?: Set<string>;
}

export interface DashboardRange {
  start: Date;
  end: Date;
  filter: string;
}

/**
 * Xây query cách ly theo doanh nghiệp — cùng quy ước với crud.service.ts:
 * superadmin thuộc công ty SYSTEM (hoặc không có companyCode) xem toàn hệ thống,
 * còn lại chỉ xem dữ liệu của doanh nghiệp mình.
 */
function buildCompanyQuery(user: DashboardUser): Record<string, any> {
  if (user.role !== "superadmin" || (user.companyCode && user.companyCode !== "SYSTEM")) {
    return { companyCode: user.companyCode, ...(user.branchId ? { branchId: user.branchId } : {}) };
  }
  return {};
}

// Chuỗi ngày local YYYY-MM-DD (cùng cách tính với timekeeping.controller.ts)
function getLocalDateString(): string {
  const localOffset = new Date().getTimezoneOffset() * 60000;
  return new Date(Date.now() - localOffset).toISOString().slice(0, 10);
}

// Chuỗi datetime-local YYYY-MM-DDTHH:mm hiện tại, dùng so sánh lexicographic với KanbanTask.dueDate
function getLocalDateTimeString(): string {
  const localOffset = new Date().getTimezoneOffset() * 60000;
  return new Date(Date.now() - localOffset).toISOString().slice(0, 16);
}

function parseFeeString(fee: unknown): number {
  return parseInt(String(fee || "").replace(/\D/g, ""), 10) || 0;
}

/** Dự án & Công việc — số liệu là snapshot hiện tại, không theo bộ lọc thời gian */
async function getProjectStats(companyQ: Record<string, any>) {
  const [activeProjects, byStatus, overdueTasks] = await Promise.all([
    ProjectModel.countDocuments(companyQ),
    KanbanTaskModel.aggregate([{ $match: companyQ }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    // dueDate là chuỗi "YYYY-MM-DDTHH:mm" — $gt: "" loại giá trị rỗng,
    // "Chưa cập nhật" bắt đầu bằng chữ nên sắp sau chữ số và bị $lt loại luôn
    KanbanTaskModel.countDocuments({
      ...companyQ,
      status: { $nin: ["Done", "done"] },
      dueDate: { $gt: "", $lt: getLocalDateTimeString() },
    }),
  ]);

  const statusCount = (names: string[]) =>
    byStatus
      .filter((s: { _id: string; count: number }) => names.includes(s._id))
      .reduce((acc: number, s: { count: number }) => acc + s.count, 0);

  const todo = statusCount(["Not Started", "todo"]);
  const doing = statusCount(["In Progress", "doing"]);
  const done = statusCount(["Done", "done"]);
  const total = byStatus.reduce((acc: number, s: { count: number }) => acc + s.count, 0);

  return { activeProjects, tasks: { todo, doing, done, total }, overdueTasks };
}

/** Quản lý Học viên — scope theo ownerId của module học viên */
async function getTimekeepingStats(user: DashboardUser) {
  const todayStr = getLocalDateString();
  const tkQ = user.companyCode ? { companyCode: user.companyCode } : {};

  const [checkedInToday, lateToday, totalEmployees] = await Promise.all([
    TimekeepingLogModel.countDocuments({ ...tkQ, date: todayStr, checkIn: { $ne: null } }),
    TimekeepingLogModel.countDocuments({ ...tkQ, date: todayStr, status: "Late" }),
    UserModel.countDocuments({ ...tkQ, role: { $ne: "superadmin" } }),
  ]);

  return { checkedInToday, lateToday, totalEmployees, date: todayStr };
}

/** Chat nội bộ — luôn scope theo chính người gọi, không theo toàn công ty */
async function getChatStats(user: DashboardUser) {
  const userObjectId = new mongoose.Types.ObjectId(user.id);
  const rooms = await ChatRoomModel.find({
    ...(user.companyCode ? { companyCode: user.companyCode } : {}),
    "members.userId": userObjectId,
  })
    .select("_id")
    .lean();

  const unreadMessages = rooms.length
    ? await ChatMessageModel.countDocuments({
        roomId: { $in: rooms.map((r) => r._id) },
        senderId: { $ne: userObjectId },
        readBy: { $ne: userObjectId },
        isDeleted: false,
      })
    : 0;

  return { unreadMessages, roomCount: rooms.length };
}

/** Tài nguyên — số file và dung lượng, upload mới theo bộ lọc thời gian */
async function getResourceStats(companyQ: Record<string, any>, range: DashboardRange) {
  const [fileCount, recentUploads, sizeAgg] = await Promise.all([
    ResourceItemModel.countDocuments({ ...companyQ, type: "file" }),
    ResourceItemModel.countDocuments({
      ...companyQ,
      type: "file",
      createdAt: { $gte: range.start, $lte: range.end },
    }),
    ResourceItemModel.aggregate([
      { $match: { ...companyQ, type: "file" } },
      { $group: { _id: null, totalSize: { $sum: "$size" } } },
    ]),
  ]);

  return { fileCount, recentUploads, totalSize: sizeAgg[0]?.totalSize || 0 };
}

/** Đào tạo nội bộ — khóa học và ghi danh */
async function getTrainingStats(companyQ: Record<string, any>) {
  const [totalCourses, enrollAgg, ongoingCourseIds] = await Promise.all([
    TrainingCourseModel.countDocuments(companyQ),
    TrainingEnrollmentModel.aggregate([{ $match: companyQ }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    TrainingEnrollmentModel.distinct("courseId", { ...companyQ, status: "in_progress" }),
  ]);

  const enrollCount = (status: string) => enrollAgg.find((e: { _id: string }) => e._id === status)?.count || 0;
  const notStarted = enrollCount("not_started");
  const inProgress = enrollCount("in_progress");
  const completed = enrollCount("completed");

  return {
    totalCourses,
    ongoingCourses: ongoingCourseIds.length,
    enrollments: { notStarted, inProgress, completed, total: notStarted + inProgress + completed },
  };
}

const isManagerOrAbove = (role: string) => role === "admin" || role === "manager" || role === "superadmin";

/**
 * Việc cần xử lý hôm nay — tổng hợp gọn để hiển thị ở đầu trang Tổng quan.
 * Lưu ý giới hạn đã biết: `pendingApprovals` cho role "manager" hiện lấy
 * toàn bộ đơn pending trong công ty (chưa lọc theo cây tổ chức phía server
 * vì util scope theo parentId hiện chỉ tồn tại ở frontend
 * `getDescendantEmployees` trong DashboardTab.tsx). Sẽ thu hẹp lại khi có
 * util backend tương đương.
 */
async function getActionItems(user: DashboardUser) {
  const companyQ = buildCompanyQuery(user);
  const access = resolveDashboardModuleAccess(user);
  const manages = isManagerOrAbove(user.role);
  const leaveCompanyQ = { ...companyQ, branchId: undefined };
  delete leaveCompanyQ.branchId;

  // Keep this queue in the same organisational scope as the leave screen.
  // Managers can only approve requests from their own reporting tree.
  let approvableEmployeeIds: string[] = [];
  if (access.hr && manages) {
    const scopedUsers = await UserModel.find(companyQ)
      .select("_id companyCode branchId role parentId")
      .lean() as any[];
    const approvalScope = createLeaveApprovalScopeService({
      listUsers: async () => scopedUsers,
    });
    approvableEmployeeIds = (await approvalScope.visibleEmployeeIds({
      id: user.id,
      role: user.role,
      companyCode: String(user.companyCode || ""),
      ...(user.branchId ? { branchId: user.branchId } : {}),
    }));
  }

  const [overdueTasksRaw, pendingApprovalsRaw] = await Promise.all([
    access.hr
      ? KanbanTaskModel.find({
          ...companyQ,
          assigneeUid: user.id,
          status: { $nin: ["Done", "done"] },
          dueDate: { $gt: "", $lt: getLocalDateTimeString() },
        })
          .select("_id title dueDate")
          .sort({ dueDate: 1 })
          .limit(5)
          .lean()
      : Promise.resolve([]),
    access.hr && manages
      ? HRLeaveApplicationModel.find({
          ...leaveCompanyQ,
          status: "pending",
          employeeId: { $in: approvableEmployeeIds },
        })
          .select("_id employeeName createdAt")
          .sort({ createdAt: 1 })
          .limit(5)
          .lean()
      : Promise.resolve([]),
  ]);

  return {
    overdueTasks: overdueTasksRaw.map((t: any) => ({ id: String(t._id), title: t.title, dueDate: t.dueDate })),
    pendingApprovals: pendingApprovalsRaw.map((a: any) => ({
      id: String(a._id),
      type: "leave" as const,
      employeeName: a.employeeName,
      since: a.createdAt,
    })),
  };
}

export const dashboardService = {
  getActionItems,
  /**
   * Tổng hợp số liệu tất cả module cho trang tổng quan trong một lần gọi.
   */
  async getSummary(user: DashboardUser, range: DashboardRange) {
    const companyQ = buildCompanyQuery(user);
    const access = resolveDashboardModuleAccess(user);

    const [projects, timekeeping, chat, resources, training] = await Promise.all([
      access.hr
        ? getProjectStats(companyQ)
        : Promise.resolve({ activeProjects: 0, tasks: { todo: 0, doing: 0, done: 0, total: 0 }, overdueTasks: 0 }),
      access.timekeeping
        ? getTimekeepingStats(user)
        : Promise.resolve({ checkedInToday: 0, lateToday: 0, totalEmployees: 0, date: getLocalDateString() }),
      access.chat ? getChatStats(user) : Promise.resolve({ unreadMessages: 0, roomCount: 0 }),
      access.resource
        ? getResourceStats(companyQ, range)
        : Promise.resolve({ fileCount: 0, recentUploads: 0, totalSize: 0 }),
      access.hr
        ? getTrainingStats(companyQ)
        : Promise.resolve({
            totalCourses: 0,
            ongoingCourses: 0,
            enrollments: { notStarted: 0, inProgress: 0, completed: 0, total: 0 },
          }),
    ]);

    return {
      range: { start: range.start, end: range.end, filter: range.filter },
      projects,
      timekeeping,
      chat,
      resources,
      training,
    };
  },
};
