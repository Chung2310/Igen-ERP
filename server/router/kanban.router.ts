import { Router, Response } from "express";
import Joi from "joi";
import mongoose from "mongoose";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { ProjectModel } from "../model/project.model";
import { UserModel } from "../model/user.model";
import { notificationService } from "../service/notification.service";
import { emitToCompany, emitToUser } from "../socket";

export const kanbanRouter = Router();

const MANAGER_ROLES = new Set(["superadmin", "admin", "manager"]);
const STATUS_MAP: Record<string, string> = {
  todo: "Not Started",
  doing: "In Progress",
  done: "Done",
};
const VALID_STATUSES = ["Not Started", "In Progress", "Review/Testing", "Done", "Archived"] as const;
const VALID_PRIORITIES = ["High", "Medium", "Low"] as const;

function httpError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

function normalizeStatus(value: unknown) {
  const raw = String(value || "Not Started");
  return STATUS_MAP[raw] || raw;
}

function isManager(role?: string) {
  return MANAGER_ROLES.has(role || "");
}

function companyFilter(req: AuthenticatedRequest) {
  const companyCode = req.user?.companyCode || "SYSTEM";
  return req.user?.role === "superadmin" && companyCode === "SYSTEM" ? {} : { companyCode };
}

async function actorName(req: AuthenticatedRequest) {
  const user = await UserModel.findById(req.user?.id).select("displayName email").lean();
  return user?.displayName || user?.email || req.user?.email || "Thành viên";
}

function toClient(item: any) {
  const plain = typeof item?.toObject === "function" ? item.toObject() : item;
  return { ...plain, status: normalizeStatus(plain?.status) };
}

async function validateRelations(companyCode: string, assigneeUid?: string, projectId?: string) {
  if (assigneeUid) {
    const assignee = await UserModel.findOne({ _id: assigneeUid, companyCode }).select("_id displayName photoURL").lean();
    if (!assignee) throw httpError(400, "Người được giao việc không thuộc doanh nghiệp hiện tại.");
  }
  if (projectId) {
    const project = await ProjectModel.findOne({ _id: projectId, companyCode }).select("_id").lean();
    if (!project) throw httpError(400, "Dự án không thuộc doanh nghiệp hiện tại.");
  }
}

function validateTimeline(data: any, existing?: any) {
  const dueDate = data.dueDate ?? existing?.dueDate;
  const startTime = data.startTime ?? existing?.startTime;
  const endTime = data.endTime ?? existing?.endTime;
  const estTime = data.estTime ?? existing?.estTime;
  const actualTime = data.actualTime ?? existing?.actualTime;

  if (!dueDate || dueDate === "Chưa cập nhật" || Number.isNaN(new Date(dueDate).getTime())) {
    throw httpError(400, "Hạn chót là bắt buộc và phải là ngày giờ hợp lệ.");
  }
  const due = new Date(dueDate).getTime();
  if (startTime) {
    const start = new Date(startTime).getTime();
    if (Number.isNaN(start)) throw httpError(400, "Thời gian bắt đầu không hợp lệ.");
    if (due < start) throw httpError(400, "Hạn chót không được trước thời gian bắt đầu.");
    if (endTime) {
      const end = new Date(endTime).getTime();
      if (Number.isNaN(end) || end < start) throw httpError(400, "Thời gian kết thúc không được trước thời gian bắt đầu.");
    }
  }
  if (estTime !== undefined && (!Number.isFinite(Number(estTime)) || Number(estTime) < 0)) {
    throw httpError(400, "Số giờ dự tính phải là số không âm.");
  }
  if (actualTime !== undefined && (!Number.isFinite(Number(actualTime)) || Number(actualTime) < 0)) {
    throw httpError(400, "Số giờ thực tế phải là số không âm.");
  }
}

function changesFor(oldTask: any, update: any) {
  const labels: Record<string, string> = {
    title: "Tên việc",
    description: "Mô tả",
    assigneeUid: "Người thực hiện",
    dueDate: "Hạn chót",
    priority: "Độ ưu tiên",
    status: "Trạng thái",
    projectId: "Dự án",
    startTime: "Bắt đầu",
    endTime: "Kết thúc",
    estTime: "Giờ dự tính",
    actualTime: "Giờ thực tế",
    category: "Phân loại",
    tags: "Nhãn",
    linkNote: "Ghi chú",
  };
  return Object.keys(labels)
    .filter((key) => update[key] !== undefined && JSON.stringify(oldTask[key] ?? "") !== JSON.stringify(update[key] ?? ""))
    .map((key) => `${labels[key]}: "${String(oldTask[key] ?? "Chưa thiết lập")}" → "${String(update[key] ?? "Chưa thiết lập")}"`);
}

async function handleError(res: Response, error: any) {
  console.error("[KanbanRouter Error]", error);
  const status = error?.statusCode || (error instanceof mongoose.Error.ValidationError ? 400 : 500);
  return res.status(status).json({ status: "error", message: error?.message || "Lỗi xử lý công việc." });
}

kanbanRouter.use(requireAuth as any);

kanbanRouter.get("/tasks", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter: any = companyFilter(req);
    if (!isManager(req.user?.role)) {
      filter.$or = [{ assigneeUid: req.user?.id }, { creatorUid: req.user?.id }];
    }
    const tasks = await KanbanTaskModel.find(filter).sort("-createdAt").lean();
    const now = Date.now();
    const nextDay = now + 24 * 60 * 60 * 1000;
    void Promise.all(tasks.map(async (task: any) => {
      const due = new Date(task.dueDate).getTime();
      if (!Number.isFinite(due) || ["Done", "Archived"].includes(normalizeStatus(task.status))) return;
      const overdue = due < now;
      const reminder = due >= now && due <= nextDay;
      if (!overdue && !reminder) return;
      const flag = overdue ? "overdueNotifiedAt" : "deadlineReminderSentAt";
      if (task[flag]) return;
      const claimed = await KanbanTaskModel.findOneAndUpdate(
        { _id: task._id, [flag]: { $exists: false } },
        { $set: { [flag]: new Date() } },
        { new: true }
      );
      if (!claimed) return;
      await notificationService.createNotification({
        title: overdue ? "Công việc đã quá hạn" : "Công việc sắp đến hạn",
        body: `Công việc "${task.title}" ${overdue ? "đã quá hạn" : "sẽ đến hạn trong 24 giờ"}.`,
        type: "task", companyCode: task.companyCode, recipientUid: task.assigneeUid, read: false,
        action: { tab: "NHÂN SỰ", subTab: "GIAO VIỆC KANBAN" },
      });
    }));    return res.json({ status: "success", data: tasks.map(toClient) });
  } catch (error) {
    return handleError(res, error);
  }
});

kanbanRouter.post("/tasks", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isManager(req.user?.role)) throw httpError(403, "Chỉ quản lý mới được giao công việc mới.");
    const companyCode = req.user?.companyCode || "SYSTEM";
    const status = normalizeStatus(req.body.status);
    if (!VALID_STATUSES.includes(status as any)) throw httpError(400, "Trạng thái công việc không hợp lệ.");
    if (!VALID_PRIORITIES.includes(req.body.priority || "Medium")) throw httpError(400, "Độ ưu tiên không hợp lệ.");
    await validateRelations(companyCode, req.body.assigneeUid, req.body.projectId);
    validateTimeline(req.body);
    const assignee = await UserModel.findById(req.body.assigneeUid).select("displayName photoURL").lean();
    const now = new Date();
    const task = await KanbanTaskModel.create({
      title: String(req.body.title || "").trim(),
      description: String(req.body.description || "").trim(),
      assigneeUid: req.body.assigneeUid,
      assignee: assignee?.displayName || "Thành viên",
      assigneeAvatar: assignee?.photoURL || "",
      dueDate: req.body.dueDate,
      priority: req.body.priority || "Medium",
      status: status as any,
      category: req.body.category || "Onboarding",
      companyCode,
      creatorUid: req.user?.id,
      createdAt: now,
      projectId: req.body.projectId || "",
      startTime: req.body.startTime || "",
      estTime: Number(req.body.estTime || 0),
      endTime: req.body.endTime || "",
      actualTime: Number(req.body.actualTime || 0),
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      linkNote: String(req.body.linkNote || ""),
      history: [{ time: now.toISOString(), user: await actorName(req), action: "Tạo công việc mới" }],
    });
    await notificationService.notifyTaskAssigned(task as any);
    emitToCompany(companyCode, "kanban:task-created", toClient(task));
    return res.status(201).json({ status: "success", data: toClient(task) });
  } catch (error) {
    return handleError(res, error);
  }
});

kanbanRouter.patch("/tasks/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter = { _id: req.params.id, ...companyFilter(req) };
    const task: any = await KanbanTaskModel.findOne(filter).lean();
    if (!task) throw httpError(404, "Không tìm thấy công việc.");

    const manager = isManager(req.user?.role);
    const assigned = task.assigneeUid === req.user?.id;
    if (!manager && !assigned) throw httpError(403, "Bạn không có quyền cập nhật công việc này.");

    const managerFields = ["title", "description", "assigneeUid", "dueDate", "priority", "status", "projectId", "startTime", "actualStartTime", "endTime", "estTime", "actualTime", "tags", "linkNote", "category"];
    const staffFields = ["status", "startTime", "actualStartTime", "endTime", "actualTime", "linkNote", "description", "dueDate", "estTime"];
    const allowed = manager ? managerFields : staffFields;
    const update: any = {};
    for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];

    if (update.status !== undefined) {
      update.status = normalizeStatus(update.status);
      if (!VALID_STATUSES.includes(update.status)) throw httpError(400, "Trạng thái công việc không hợp lệ.");
      if (!manager && update.status === "Archived") throw httpError(403, "Nhân viên không được lưu trữ công việc.");
    }
    if (update.priority !== undefined && !VALID_PRIORITIES.includes(update.priority)) throw httpError(400, "Độ ưu tiên không hợp lệ.");
    await validateRelations(task.companyCode, update.assigneeUid, update.projectId);
    validateTimeline(update, task);

    if (update.assigneeUid && update.assigneeUid !== task.assigneeUid) {
      const assignee = await UserModel.findById(update.assigneeUid).select("displayName photoURL").lean();
      update.assignee = assignee?.displayName || "Thành viên";
      update.assigneeAvatar = assignee?.photoURL || "";
    }
    if (update.status === "In Progress") {
      if (task.isFromWorkflow && !task.actualStartTime && !update.actualStartTime) update.actualStartTime = new Date().toISOString();
      else if (!task.isFromWorkflow && !task.startTime && !update.startTime) update.startTime = new Date().toISOString();
    }
    if (update.status === "Done") {
      const merged = { ...task, ...update };
      if (!merged.description?.trim() || !merged.startTime || !Number(merged.estTime)) {
        throw httpError(400, "Hoàn thành công việc yêu cầu mô tả, thời gian bắt đầu và số giờ dự tính.");
      }
      if (!merged.endTime) update.endTime = new Date().toISOString();
      update.completedAt = update.endTime;
    }

    const changes = changesFor(task, update);
    if (changes.length === 0) return res.json({ status: "success", data: toClient(task) });
    const audit = { time: new Date().toISOString(), user: await actorName(req), action: changes.join(", ") };
    const revisionFilter = task.revision
      ? { revision: task.revision }
      : { $or: [{ revision: { $exists: false } }, { revision: 0 }] };
    const updated: any = await KanbanTaskModel.findOneAndUpdate(
      { ...filter, ...revisionFilter },
      { $set: update, $push: { history: audit }, $inc: { revision: 1 } },
      { new: true, runValidators: true }
    );
    if (!updated) throw httpError(409, "Công việc vừa được thay đổi. Vui lòng tải lại.");

    if (update.assigneeUid && update.assigneeUid !== task.assigneeUid) {
      await notificationService.notifyTaskReassigned(updated, task.assigneeUid);
    }
    if (update.dueDate && update.dueDate !== task.dueDate) await notificationService.notifyTaskDeadlineChanged(updated);
    if (update.status && update.status !== normalizeStatus(task.status)) {
      await notificationService.notifyTaskStatusChanged(updated, req.user?.id || "");
    }
    emitToCompany(task.companyCode, "kanban:task-updated", toClient(updated));
    emitToUser(updated.assigneeUid, "kanban:task-updated", toClient(updated));
    return res.json({ status: "success", data: toClient(updated) });
  } catch (error) {
    return handleError(res, error);
  }
});

kanbanRouter.delete("/tasks/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isManager(req.user?.role)) throw httpError(403, "Chỉ quản lý mới được xóa công việc.");
    const task: any = await KanbanTaskModel.findOneAndDelete({ _id: req.params.id, ...companyFilter(req) });
    if (!task) throw httpError(404, "Không tìm thấy công việc.");
    emitToCompany(task.companyCode, "kanban:task-deleted", { id: task._id.toString() });
    return res.json({ status: "success", data: toClient(task) });
  } catch (error) {
    return handleError(res, error);
  }
});

kanbanRouter.get("/projects", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projects = await ProjectModel.find(companyFilter(req)).sort("-createdAt").lean();
    return res.json({ status: "success", data: projects });
  } catch (error) {
    return handleError(res, error);
  }
});

kanbanRouter.post("/projects", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isManager(req.user?.role)) throw httpError(403, "Chỉ quản lý mới được tạo dự án.");
    const companyCode = req.user?.companyCode || "SYSTEM";
    const name = String(req.body.name || "").trim();
    if (!name) throw httpError(400, "Tên dự án là bắt buộc.");
    const project = await ProjectModel.create({ name, companyCode, creatorUid: req.user?.id, createdAt: new Date() });
    emitToCompany(companyCode, "kanban:project-created", project.toObject());
    return res.status(201).json({ status: "success", data: project });
  } catch (error) {
    return handleError(res, error);
  }
});

kanbanRouter.delete("/projects/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isManager(req.user?.role)) throw httpError(403, "Chỉ quản lý mới được xóa dự án.");
    const project: any = await ProjectModel.findOneAndDelete({ _id: req.params.id, ...companyFilter(req) });
    if (!project) throw httpError(404, "Không tìm thấy dự án.");
    await KanbanTaskModel.updateMany({ companyCode: project.companyCode, projectId: req.params.id }, { $set: { projectId: "" } });
    emitToCompany(project.companyCode, "kanban:project-deleted", { id: req.params.id });
    return res.json({ status: "success", data: project });
  } catch (error) {
    return handleError(res, error);
  }
});
