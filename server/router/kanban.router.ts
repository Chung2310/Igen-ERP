import { Router, Response } from "express";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../middleware/auth";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { ProjectModel } from "../model/project.model";
import { UserModel } from "../model/user.model";
import { notificationService } from "../service/notification.service";
import { kanbanAuditService } from "../service/kanban-audit.service";
import { sourceUploadFinalizer } from "../service/source-upload-finalizer.service";
import { calculateProjectProgress, deriveProjectLifecycle, newUploadAttachments, validateProjectPayload } from "../service/kanban-project.service";
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

function correlationId(req: AuthenticatedRequest) {
  return String(req.get("X-Correlation-Id") || (req as any).id || randomUUID());
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

const ATTACHMENT_TYPES = new Set(["image", "video", "audio", "file", "link"]);

/** Làm sạch mảng đính kèm từ client: chỉ giữ các trường hợp lệ, bỏ phần tử thiếu url/name */
function sanitizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((a: any) => a && typeof a.url === "string" && a.url.trim() && typeof a.name === "string" && a.name.trim())
    .slice(0, 30)
    .map((a: any) => ({
      id: String(a.id || `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
      name: String(a.name).trim().slice(0, 255),
      url: String(a.url).trim(),
      type: ATTACHMENT_TYPES.has(a.type) ? a.type : "file",
      ...(Number.isFinite(Number(a.size)) && Number(a.size) > 0 ? { size: Number(a.size) } : {}),
      ...(typeof a.uploadToken === "string" && a.uploadToken.trim() ? { uploadToken: a.uploadToken.trim() } : {}),
    }));
}

async function finalizeTaskAttachments(req: AuthenticatedRequest, task: any) {
  await sourceUploadFinalizer.finalize({
    companyCode: task.companyCode,
    branchId: task.branchId || req.user?.branchId,
    actorId: req.user?.id || "",
    actorName: req.user?.email,
  }, {
    entityType: "kanban-task",
    entityId: String(task._id),
    entityLabel: task.title,
    sourceRecordId: String(task._id),
    uploads: (task.attachments || []).map((attachment: any, index: number) => ({
      uploadToken: attachment.uploadToken,
      sourceField: `attachments.${index}`,
    })),
  });
}

function projectScope(req: AuthenticatedRequest) {
  return { ...companyFilter(req), ...(req.user?.branchId ? { branchId: req.user.branchId } : {}) };
}

async function finalizeProjectAttachments(req: AuthenticatedRequest, project: any, existingAttachments: any[] = []) {
  await sourceUploadFinalizer.finalize({ companyCode: project.companyCode, branchId: project.branchId || req.user?.branchId, actorId: req.user?.id || "", actorName: req.user?.email }, {
    entityType: "kanban-project", entityId: String(project._id), entityLabel: project.name, sourceRecordId: String(project._id),
    uploads: newUploadAttachments(project.attachments || [], existingAttachments).map((attachment: any) => ({ uploadToken: attachment.uploadToken, sourceField: `attachments.${(project.attachments || []).findIndex((item: any) => item.id === attachment.id)}` })),
  });
}

async function projectProgress(companyCode: string, projectId: string) {
  const tasks = await KanbanTaskModel.find({ companyCode, projectId }).select("status").lean();
  return calculateProjectProgress(tasks as any[]);
}

async function syncProjectLifecycle(companyCode: string, projectIds: Array<string | undefined>) {
  for (const projectId of [...new Set(projectIds.filter(Boolean))] as string[]) {
    const project: any = await ProjectModel.findOne({ _id: projectId, companyCode }).select("status").lean();
    if (!project) continue;
    const lifecycle = deriveProjectLifecycle(project.status, await projectProgress(companyCode, projectId));
    if (lifecycle) {
      const updated: any = await ProjectModel.findOneAndUpdate({ _id: projectId, companyCode }, { $set: lifecycle }, { returnDocument: 'after' });
      if (updated) emitToCompany(companyCode, "kanban:project-updated", updated.toObject());
    }
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
    attachments: "Tệp đính kèm",
  };
  return Object.keys(labels)
    .filter((key) => update[key] !== undefined && JSON.stringify(oldTask[key] ?? "") !== JSON.stringify(update[key] ?? ""))
    .map((key) =>
      key === "attachments"
        ? `${labels[key]}: ${(oldTask[key] || []).length} → ${(update[key] || []).length} file`
        : `${labels[key]}: "${String(oldTask[key] ?? "Chưa thiết lập")}" → "${String(update[key] ?? "Chưa thiết lập")}"`
    );
}

async function handleError(res: Response, error: any) {
  console.error("[KanbanRouter Error]", error);
  const status = error?.statusCode || (error instanceof mongoose.Error.ValidationError ? 400 : 500);
  return res.status(status).json({ status: "error", message: error?.message || "Lỗi xử lý công việc." });
}

kanbanRouter.use(requireAuth as any);

kanbanRouter.get("/tasks", requirePermission("work:read") as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter: any = companyFilter(req);
    if (req.user?.branchId) {
      filter.branchId = req.user.branchId;
    } else if (req.query.branchId) {
      filter.branchId = req.query.branchId;
    }
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
        { returnDocument: 'after' }
      );
      if (!claimed) return;
      await notificationService.createNotification({
        title: overdue ? "Công việc đã quá hạn" : "Công việc sắp đến hạn",
        body: `Công việc "${task.title}" ${overdue ? "đã quá hạn" : "sẽ đến hạn trong 24 giờ"}.`,
        type: "task", companyCode: task.companyCode, recipientUid: task.assigneeUid, read: false,
        action: { tab: "NHÂN SỰ", subTab: "Giao Việc" },
      });
    }));    return res.json({ status: "success", data: tasks.map(toClient) });
  } catch (error) {
    return handleError(res, error);
  }
});

kanbanRouter.post("/tasks", requirePermission("work:manage") as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
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
      branchId: req.user?.branchId || req.body.branchId || "",
      creatorUid: req.user?.id,
      createdAt: now,
      projectId: req.body.projectId || "",
      startTime: req.body.startTime || "",
      estTime: Number(req.body.estTime || 0),
      endTime: req.body.endTime || "",
      actualTime: Number(req.body.actualTime || 0),
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      linkNote: String(req.body.linkNote || ""),
      attachments: sanitizeAttachments(req.body.attachments) || [],
      history: [{ time: now.toISOString(), user: await actorName(req), action: "Tạo công việc mới" }],
    });
    await finalizeTaskAttachments(req, task);
    await syncProjectLifecycle(companyCode, [task.projectId]);
    await kanbanAuditService.recordTaskMutation({
      action: "created",
      actorId: req.user?.id || "",
      companyCode,
      correlationId: correlationId(req),
      task: toClient(task),
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

    const managerFields = ["title", "description", "assigneeUid", "dueDate", "priority", "status", "projectId", "startTime", "actualStartTime", "endTime", "estTime", "actualTime", "tags", "linkNote", "attachments", "category"];
    // Nhân viên được đính kèm file kết quả (ghi âm, hình ảnh, tài liệu…) vào task của mình
    const staffFields = ["status", "startTime", "actualStartTime", "endTime", "actualTime", "linkNote", "attachments", "description", "dueDate", "estTime"];
    const allowed = manager ? managerFields : staffFields;
    const update: any = {};
    for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
    if (update.attachments !== undefined) update.attachments = sanitizeAttachments(update.attachments) || [];

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
      const plannedStartAt = new Date(merged.startTime).getTime();
      if (Number.isFinite(plannedStartAt) && plannedStartAt > Date.now()) {
        throw httpError(400, "Chưa đến thời gian bắt đầu đã chọn nên không thể hoàn thành công việc.");
      }
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
      { returnDocument: 'after', runValidators: true }
    );
    if (!updated) throw httpError(409, "Công việc vừa được thay đổi. Vui lòng tải lại.");

    await finalizeTaskAttachments(req, updated);
    await syncProjectLifecycle(task.companyCode, [task.projectId, updated.projectId]);
    await kanbanAuditService.recordTaskMutation({
      action: "updated",
      actorId: req.user?.id || "",
      companyCode: task.companyCode,
      correlationId: correlationId(req),
      before: task,
      task: toClient(updated),
    });

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

kanbanRouter.delete("/tasks/:id", requirePermission("work:manage") as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const task: any = await KanbanTaskModel.findOneAndDelete({ _id: req.params.id, ...companyFilter(req) });
    if (!task) throw httpError(404, "Không tìm thấy công việc.");
    await syncProjectLifecycle(task.companyCode, [task.projectId]);
    await kanbanAuditService.recordTaskMutation({
      action: "deleted",
      actorId: req.user?.id || "",
      companyCode: task.companyCode,
      correlationId: correlationId(req),
      task: toClient(task),
    });
    emitToCompany(task.companyCode, "kanban:task-deleted", { id: task._id.toString() });
    return res.json({ status: "success", data: toClient(task) });
  } catch (error) {
    return handleError(res, error);
  }
});

kanbanRouter.get("/projects", requirePermission("work:read") as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter: any = companyFilter(req);
    if (req.user?.branchId) {
      filter.branchId = req.user.branchId;
    } else if (req.query.branchId) {
      filter.branchId = req.query.branchId;
    }
    const projects: any[] = await ProjectModel.find(filter).sort("-createdAt").lean();
    const ids = projects.map((project) => String(project._id));
    const companyCodes = [...new Set(projects.map((project) => project.companyCode))];
    const grouped = ids.length ? await KanbanTaskModel.aggregate([
      { $match: { projectId: { $in: ids }, companyCode: { $in: companyCodes } } },
      { $group: { _id: "$projectId", statuses: { $push: "$status" } } },
    ]) : [];
    const progressById = new Map(grouped.map((group: any) => [String(group._id), calculateProjectProgress(group.statuses.map((status: string) => ({ status })))]));
    return res.json({ status: "success", data: projects.map((project) => ({ ...project, progress: progressById.get(String(project._id)) || calculateProjectProgress([]) })) });
  } catch (error) {
    return handleError(res, error);
  }
});

kanbanRouter.post("/projects", requirePermission("work:manage") as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const companyCode = req.user?.companyCode || "SYSTEM";
    const name = String(req.body.name || "").trim();
    if (!name) throw httpError(400, "Tên dự án là bắt buộc.");
    const attachments = sanitizeAttachments(req.body.attachments) || [];
    try { validateProjectPayload({ ...req.body, attachments }); } catch (error: any) { throw httpError(400, error.message); }
    const project = await ProjectModel.create({
      name,
      companyCode,
      branchId: req.user?.branchId || req.body.branchId || "",
      creatorUid: req.user?.id,
      status: req.body.status || "not_started",
      priority: req.body.priority || "medium",
      startAt: req.body.startAt || undefined,
      dueAt: req.body.dueAt || undefined,
      attachments,
      createdAt: new Date()
    });
    await finalizeProjectAttachments(req, project);
    await kanbanAuditService.recordProjectMutation({
      action: "created",
      actorId: req.user?.id || "",
      companyCode,
      correlationId: correlationId(req),
      project: project.toObject(),
    });
    emitToCompany(companyCode, "kanban:project-created", project.toObject());
    return res.status(201).json({ status: "success", data: project });
  } catch (error) {
    return handleError(res, error);
  }
});

kanbanRouter.patch("/projects/:id", requirePermission("work:manage") as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const project: any = await ProjectModel.findOne({ _id: req.params.id, ...projectScope(req) }).lean();
    if (!project) throw httpError(404, "Không tìm thấy dự án.");
    const update: any = {};
    for (const key of ["name", "status", "priority", "startAt", "dueAt", "attachments"]) if (req.body[key] !== undefined) update[key] = req.body[key];
    if (update.name !== undefined) { update.name = String(update.name).trim(); if (!update.name) throw httpError(400, "Tên dự án là bắt buộc."); }
    if (update.attachments !== undefined) update.attachments = sanitizeAttachments(update.attachments) || [];
    const progress = await projectProgress(project.companyCode, req.params.id);
    try { validateProjectPayload({ ...project, ...update, status: update.status }, progress); } catch (error: any) { throw httpError(400, error.message); }
    for (const key of ["startAt", "dueAt"]) if (update[key] === "" || update[key] === null) update[key] = null;
    if (update.status === "completed") update.completedAt = new Date();
    else if (update.status !== undefined) update.completedAt = null;
    const lifecycle = deriveProjectLifecycle(update.status ?? project.status, progress);
    if (lifecycle) Object.assign(update, lifecycle);
    const updated: any = await ProjectModel.findOneAndUpdate({ _id: req.params.id, ...projectScope(req) }, { $set: update }, { returnDocument: 'after', runValidators: true });
    await finalizeProjectAttachments(req, updated, project.attachments || []);
    await kanbanAuditService.recordProjectMutation({ action: "updated", actorId: req.user?.id || "", companyCode: project.companyCode, correlationId: correlationId(req), before: project, project: updated.toObject() });
    emitToCompany(project.companyCode, "kanban:project-updated", updated.toObject());
    return res.json({ status: "success", data: { ...updated.toObject(), progress } });
  } catch (error) { return handleError(res, error); }
});

kanbanRouter.delete("/projects/:id", requirePermission("work:manage") as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const project: any = await ProjectModel.findOneAndDelete({ _id: req.params.id, ...projectScope(req) });
    if (!project) throw httpError(404, "Không tìm thấy dự án.");
    await kanbanAuditService.recordProjectMutation({
      action: "deleted",
      actorId: req.user?.id || "",
      companyCode: project.companyCode,
      correlationId: correlationId(req),
      project: toClient(project),
    });
    await KanbanTaskModel.updateMany({ companyCode: project.companyCode, projectId: req.params.id }, { $set: { projectId: "" } });
    emitToCompany(project.companyCode, "kanban:project-deleted", { id: req.params.id });
    return res.json({ status: "success", data: project });
  } catch (error) {
    return handleError(res, error);
  }
});
