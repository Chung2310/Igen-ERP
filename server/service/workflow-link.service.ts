import { WorkflowModel } from "../model/workflow.model";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { UserModel } from "../model/user.model";
import { ProjectModel } from "../model/project.model";
import { emitToCompany, emitToUser } from "../socket";

const DONE_COL = "__done__";
const DONE_STATUSES = ["Done", "done"] as const;
/** Trạng thái không tính là "đang chờ xử lý" khi xét hoàn thành một bước */
const INACTIVE_STATUSES = ["Done", "done", "Archived"] as const;

/** Lưu trữ các task chưa xong khớp bộ lọc; giữ nguyên task đã Done làm lịch sử */
async function archivePendingTasks(
  companyCode: string,
  filter: { workflowId: string; participantId?: string }
): Promise<number> {
  const result = await KanbanTaskModel.updateMany(
    { companyCode, ...filter, status: { $nin: INACTIVE_STATUSES } },
    {
      $set: { status: "Archived" },
      $push: {
        history: {
          time: new Date().toLocaleString("vi-VN"),
          user: "Hệ thống",
          action: "Lưu trữ tự động do công việc/quy trình liên kết bị xóa",
        },
      },
    }
  );
  return result.modifiedCount || 0;
}

function toLocalDatetimeString(d: Date): string {
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function calculateDueDate(deadlineType?: string, deadlineDays?: number, deadlineTime?: string): string {
  const now = new Date();
  const targetDate = new Date(now);

  if (deadlineType === "same_day") {
    // Keep today
  } else if (deadlineType === "after_1") {
    targetDate.setDate(now.getDate() + 1);
  } else if (deadlineType === "after_2") {
    targetDate.setDate(now.getDate() + 2);
  } else if (deadlineType === "after_x") {
    targetDate.setDate(now.getDate() + (deadlineDays || 3));
  } else if (deadlineType === "none") {
    return "Chưa cập nhật";
  }

  if (deadlineTime && deadlineTime.includes(":")) {
    const [h, m] = deadlineTime.split(":");
    targetDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
  } else {
    targetDate.setHours(18, 0, 0, 0);
  }

  return toLocalDatetimeString(targetDate);
}

/**
 * Thời lượng hiệu dụng của một bước (ngày). Ưu tiên ước lượng estDays;
 * nếu không có thì suy từ cấu hình deadline của bước. Trả null khi bước
 * không có bất kỳ thông tin thời gian nào (deadlineType "none" và không estDays).
 */
function getStepDurationDays(step: {
  estDays?: number;
  deadlineType?: string;
  deadlineDays?: number;
}): number | null {
  if (step.estDays && step.estDays > 0) return step.estDays;
  switch (step.deadlineType) {
    case "same_day":
    case "custom_time":
      return 0;
    case "after_1":
      return 1;
    case "after_2":
      return 2;
    case "after_x":
      return step.deadlineDays || 3;
    default:
      return null;
  }
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Cộng N ngày làm việc (bỏ T7/CN). Nếu mốc xuất phát rơi vào cuối tuần thì
 * dời tới thứ Hai kế tiếp trước khi cộng.
 */
function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) remaining--;
  }
  return d;
}

/** Dời sang ngày làm việc kế tiếp, giữ nguyên giờ */
function nextWorkingDay(d: Date): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + 1);
  while (isWeekend(out)) out.setDate(out.getDate() + 1);
  return out;
}

type StepWindow = { start: Date; due: Date | null; durationDays: number | null };

/**
 * Lịch trình dự kiến cho toàn quy trình của một công việc (case): các bước nối đuôi
 * nhau — bước sau bắt đầu khi bước trước đến hạn. Mốc khởi đầu là ngày bắt đầu của
 * case (nếu người giao việc chọn), nếu không thì thời điểm case được khởi tạo.
 */
function calculateStepSchedule(
  workflow: {
    steps?: Array<{
      id: string;
      estDays?: number;
      deadlineType?: string;
      deadlineDays?: number;
      deadlineTime?: string;
    }>;
  },
  participant: { startDate?: string; startedAt?: string }
): Map<string, StepWindow> {
  let cursor: Date;
  if (participant.startDate && /^\d{4}-\d{2}-\d{2}/.test(participant.startDate)) {
    cursor = new Date(`${participant.startDate.slice(0, 10)}T08:00:00`);
  } else if (participant.startedAt) {
    cursor = new Date(participant.startedAt);
  } else {
    cursor = new Date();
  }
  if (isNaN(cursor.getTime())) cursor = new Date();

  const schedule = new Map<string, StepWindow>();
  for (const step of workflow.steps || []) {
    const durationDays = getStepDurationDays(step);
    // Mốc bắt đầu hiệu dụng của bước: né cuối tuần (rơi T7/CN → sáng thứ Hai kế tiếp)
    const start = new Date(cursor);
    if (isWeekend(start)) {
      while (isWeekend(start)) start.setDate(start.getDate() + 1);
      start.setHours(8, 0, 0, 0);
    }
    if (durationDays === null) {
      // Bước không có thông tin thời gian → không dịch mốc, hạn để trống
      schedule.set(step.id, { start, due: null, durationDays: null });
      continue;
    }
    // Hạn = mốc bắt đầu + N ngày LÀM VIỆC (bỏ T7/CN)
    const due = addWorkingDays(start, Math.max(durationDays - 1, 0));
    if (step.deadlineTime && step.deadlineTime.includes(":")) {
      const [h, m] = step.deadlineTime.split(":");
      due.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    } else {
      due.setHours(23, 59, 59, 999);
    }
    // Bước 0 ngày mà giờ hạn lại sớm hơn mốc bắt đầu (VD bắt đầu 19:00, hạn 18:00)
    // → dồn sang ngày làm việc kế tiếp
    if (due.getTime() < start.getTime()) {
      const shifted = nextWorkingDay(due);
      due.setTime(shifted.getTime());
    }
    schedule.set(step.id, { start, due, durationDays });
    // A following step begins on the next working day, not at the previous
    // step''s deadline time on the same date.
    cursor = nextWorkingDay(due);
    cursor.setHours(8, 0, 0, 0);
  }
  return schedule;
}

function mapPriority(priority?: string): "High" | "Medium" | "Low" {
  if (priority === "urgent_important" || priority === "urgent") return "High";
  if (priority === "important") return "Medium";
  return "Low";
}

type SubTaskLike = { id: string; title: string; assigneeUid?: string; assignee?: string; done?: boolean };

/**
 * Sinh Kanban Tasks cho một participant (công việc) tại một bước.
 * extraSubTasks: công việc con riêng của case (chỉ truyền khi khởi tạo công việc).
 */
async function generateStepTasks(
  companyCode: string,
  workflow: any,
  participant: any,
  step: any,
  extraSubTasks: SubTaskLike[] = []
): Promise<number> {
  // Chống sinh trùng: nếu case đã có task ở bước này (VD: lùi bước rồi tiến lại)
  // thì giữ nguyên các task cũ, không tạo lại
  const existingCount = await KanbanTaskModel.countDocuments({
    companyCode,
    workflowId: workflow.id,
    participantId: participant.id,
    workflowStepId: step.id,
  });
  if (existingCount > 0) return 0;

  const stepSubTasks: SubTaskLike[] =
    step.subTasks && step.subTasks.length > 0
      ? step.subTasks
      : [{ id: "default", title: step.title, assigneeUid: step.assigneeUid, assignee: step.assignee }];

  // Lịch trình dự kiến của cả quy trình: các bước nối đuôi nhau từ ngày bắt đầu case.
  // Mọi công việc con trong một bước dùng chung cửa sổ thời gian của bước cha.
  const schedule = calculateStepSchedule(workflow, participant);
  const stepWindow = schedule.get(step.id);
  const now = new Date();
  let stepStart = stepWindow ? new Date(stepWindow.start) : now;
  let stepDue = stepWindow?.due ? new Date(stepWindow.due) : null;
  // Case chạy chậm hơn kế hoạch (vào bước khi hạn dự kiến đã qua) → dời cửa sổ
  // về hiện tại, giữ nguyên thời lượng bước tính theo ngày làm việc
  if (stepDue && stepDue.getTime() < now.getTime()) {
    const dueHours = stepDue.getHours();
    const dueMinutes = stepDue.getMinutes();
    const stepIndex = (workflow.steps || []).findIndex((candidate: any) => candidate.id === step.id);
    stepStart = stepIndex > 0 ? nextWorkingDay(now) : new Date(now);
    if (stepIndex > 0) stepStart.setHours(8, 0, 0, 0);
    stepDue = addWorkingDays(stepStart, Math.max((stepWindow?.durationDays ?? 0) - 1, 0));
    stepDue.setHours(dueHours, dueMinutes, 0, 0);
    if (stepDue.getTime() < stepStart.getTime()) {
      stepDue = nextWorkingDay(stepDue);
    }
  }

  const subTasksToCreate = [...stepSubTasks, ...extraSubTasks];
  let tasksCreated = 0;

  for (const sub of subTasksToCreate) {
    // Xác định người nhận việc: subtask → bước → người phụ trách công việc → người tạo quy trình
    const taskAssigneeUid =
      sub.assigneeUid ||
      step.assigneeUid ||
      (step.assigneeUids && step.assigneeUids[0]) ||
      participant.userUid ||
      workflow.creatorUid;
    let taskAssignee = sub.assignee || step.assignee || "Thành viên";

    // Lấy avatar thực tế từ User Profile nếu có
    let assigneeAvatar = "👨‍💻";
    // Mongo _id của người nhận — room socket cá nhân dùng _id, không phải uid
    let assigneeMongoId = "";
    if (taskAssigneeUid) {
      const userDoc = await UserModel.findOne({ uid: taskAssigneeUid }).select("displayName photoURL").lean();
      if (userDoc) {
        if (userDoc.displayName) taskAssignee = userDoc.displayName;
        if (userDoc.photoURL) assigneeAvatar = userDoc.photoURL;
        assigneeMongoId = String(userDoc._id);
      }
    }

    // Công việc con riêng của case ưu tiên dùng hạn hoàn thành của case (nếu có)
    const isExtra = extraSubTasks.includes(sub);
    const dueDate =
      isExtra && participant.dueDate
        ? `${participant.dueDate}T18:00`
        : stepDue
          ? toLocalDatetimeString(stepDue)
          : calculateDueDate(step.deadlineType, step.deadlineDays, step.deadlineTime);
    // Ưu tiên của bước; nếu bước không đặt thì dùng ưu tiên của công việc
    const priority = mapPriority(step.priority && step.priority !== "normal" ? step.priority : participant.priority || step.priority);

    // Xác định projectId từ step.domain (có thể là project ID hoặc project name)
    let projectId = "";
    if (step.domain) {
      if (/^[0-9a-fA-F]{24}$/.test(step.domain)) {
        projectId = step.domain;
      } else {
        // Tìm dự án theo tên và companyCode
        const proj = await ProjectModel.findOne({ name: step.domain, companyCode }).lean();
        if (proj) {
          projectId = (proj._id as any).toString();
        }
      }
    }

    // Tạo Kanban Task mới — kèm tên công việc để phân biệt giữa các case cùng quy trình
    const createdTask = await KanbanTaskModel.create({
      title: participant.name ? `${sub.title} — ${participant.name}` : sub.title,
      description:
        participant.description || step.description ||
        `Công việc thuộc quy trình "${workflow.name}" - Bước: ${step.title}`,
      assigneeUid: taskAssigneeUid,
      assignee: taskAssignee,
      assigneeAvatar,
      dueDate,
      priority,
      status: "Not Started",
      category: "Quy trình",
      companyCode,
      creatorUid: workflow.creatorUid,
      createdAt: new Date(),
      projectId,
      // Thời gian bắt đầu dự kiến của bước — công việc con dùng chung với bước cha
      startTime: toLocalDatetimeString(stepStart),
      actualStartTime: "",
      // Prefill số giờ dự tính từ thời lượng hiệu dụng của bước (8h làm việc/ngày)
      // để người nhận không phải điền tay khi hoàn thành
      estTime: step.estDays && step.estDays > 0 ? step.estDays * 24 : 0,
      tags: [workflow.name, step.title],
      linkNote: (participant.docLinks && participant.docLinks[0]) || "",
      workflowId: workflow.id,
      workflowStepId: step.id,
      participantId: participant.id,
      isFromWorkflow: true,
      history: [
        {
          time: new Date().toLocaleString("vi-VN"),
          user: "Hệ thống",
          action: `Khởi tạo tự động từ Quy trình "${workflow.name}" (Bước: ${step.title})`,
        },
      ],
    });

    // Báo realtime cho người nhận việc để KanbanTab của họ hiện task mới ngay
    if (assigneeMongoId) {
      emitToUser(assigneeMongoId, "kanban:task-created", {
        taskId: createdTask._id.toString(),
        title: createdTask.title,
        workflowName: workflow.name,
        stepTitle: step.title,
        dueDate: createdTask.dueDate,
      });
    }

    tasksCreated++;
  }

  return tasksCreated;
}

export const workflowLinkService = {
  /**
   * Chuyển participant sang bước tiếp theo & tự động sinh Kanban Tasks từ subtasks
   */
  async advanceParticipant(
    companyCode: string,
    workflowId: string,
    participantId: string,
    nextStepId: string,
    options: { force?: boolean } = {}
  ) {
    // 1. Tìm Quy trình
    const workflow = await WorkflowModel.findOne({ _id: workflowId, companyCode });
    if (!workflow) {
      throw new Error("Không tìm thấy quy trình yêu cầu.");
    }

    // 2. Tìm Participant
    const participant = workflow.participants.find((p) => p.id === participantId);
    if (!participant) {
      throw new Error("Không tìm thấy người tham gia quy trình này.");
    }

    // Chặn chuyển bước khi còn task Kanban chưa xong ở bước hiện tại (trừ khi force)
    const currentStepId = participant.currentStepId;
    if (!options.force && currentStepId && currentStepId !== DONE_COL && nextStepId !== currentStepId) {
      const pendingCount = await KanbanTaskModel.countDocuments({
        companyCode,
        workflowId,
        participantId,
        workflowStepId: currentStepId,
        status: { $nin: INACTIVE_STATUSES },
      });
      if (pendingCount > 0) {
        const err: any = new Error(
          `Còn ${pendingCount} task Kanban chưa hoàn thành ở bước hiện tại. Hoàn thành hết trước khi chuyển bước.`
        );
        err.statusCode = 409;
        throw err;
      }
    }

    // Only one request may move a case out of its current step. This protects
    // auto-advance when the final tasks of a step are completed concurrently.
    const previousStepId = participant.currentStepId;
    const updatedAt = new Date().toISOString();
    const transitionedWorkflow = await WorkflowModel.findOneAndUpdate(
      {
        _id: workflowId,
        companyCode,
        participants: { $elemMatch: { id: participantId, currentStepId: previousStepId } },
      },
      {
        $set: {
          "participants.$.currentStepId": nextStepId,
          "participants.$.updatedAt": updatedAt,
        },
      },
      { new: true }
    );
    if (!transitionedWorkflow) {
      const err: any = new Error("Workflow case was moved by another request. Please reload.");
      err.statusCode = 409;
      throw err;
    }

    const transitionedParticipant = transitionedWorkflow.participants.find((p) => p.id === participantId);
    if (!transitionedParticipant) {
      throw new Error("Workflow case was not found after advancing.");
    }

    // 3. Nếu sang bước hoàn thành, không sinh task
    if (nextStepId === "__done__") {
      return { workflow: transitionedWorkflow, participant: transitionedParticipant, tasksCreated: 0 };
    }

    // 4. Tìm thông tin bước mới để sinh task
    const step = workflow.steps.find((s) => s.id === nextStepId);
    if (!step) {
      return { workflow: transitionedWorkflow, participant: transitionedParticipant, tasksCreated: 0 };
    }

    // 5. Sinh Kanban Tasks từ subtasks của bước mới
    const tasksCreated = await generateStepTasks(companyCode, transitionedWorkflow, transitionedParticipant, step);

    return {
      workflow: transitionedWorkflow,
      participant: transitionedParticipant,
      tasksCreated,
    };
  },

  /**
   * Tạo "công việc" (case) mới chạy theo quy trình: thêm participant với thông tin
   * chi tiết, đặt vào bước đầu tiên và sinh Kanban Tasks (subtasks bước 1 + công việc con riêng)
   */
  async createCase(
    companyCode: string,
    workflowId: string,
    caseData: {
      name: string;
      userUid?: string;
      avatar?: string;
      note?: string;
      description?: string;
      relatedUids?: string[];
      priority?: string;
      startDate?: string;
      dueDate?: string;
      docLinks?: string[];
      customSubTasks?: SubTaskLike[];
    }
  ) {
    const workflow = await WorkflowModel.findOne({ _id: workflowId, companyCode });
    if (!workflow) {
      throw new Error("Không tìm thấy quy trình yêu cầu.");
    }
    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error("Quy trình chưa có bước nào — hãy thêm bước trước khi tạo công việc.");
    }
    if (!caseData.name || !caseData.name.trim()) {
      throw new Error("Tên công việc là bắt buộc.");
    }

    const firstStep = workflow.steps[0];
    const now = new Date().toISOString();
    const participant: any = {
      id: `part_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: caseData.name.trim(),
      userUid: caseData.userUid || "",
      avatar: caseData.avatar || "",
      currentStepId: firstStep.id,
      note: caseData.note || "",
      description: caseData.description || "",
      relatedUids: caseData.relatedUids || [],
      priority: (caseData.priority as any) || "normal",
      startDate: caseData.startDate || "",
      dueDate: caseData.dueDate || "",
      docLinks: caseData.docLinks || [],
      customSubTasks: caseData.customSubTasks || [],
      startedAt: now,
      updatedAt: now,
    };

    // Một nguồn thời gian duy nhất: không gửi hạn hoàn thành thì hạn của case
    // = ngày kết thúc lịch trình các bước (UI chỉ gửi dueDate khi người giao việc
    // chủ động điều chỉnh và đã xác nhận)
    if (!participant.dueDate) {
      const schedule = calculateStepSchedule(workflow, participant);
      let lastDue: Date | null = null;
      for (const w of schedule.values()) {
        if (w.due && (!lastDue || w.due.getTime() > lastDue.getTime())) lastDue = w.due;
      }
      if (lastDue) participant.dueDate = toLocalDatetimeString(lastDue).slice(0, 10);
    }

    workflow.participants.push(participant);
    await workflow.save();

    // Sinh task cho bước đầu tiên + các công việc con riêng của case
    const tasksCreated = await generateStepTasks(
      companyCode,
      workflow,
      participant,
      firstStep,
      participant.customSubTasks
    );

    return { workflow, participant, tasksCreated };
  },

  /**
   * Lấy danh sách Kanban Tasks liên kết với participant tại một bước hoặc toàn quy trình
   */
  async getParticipantTasks(
    companyCode: string,
    workflowId: string,
    participantId: string,
    stepId?: string
  ) {
    const query: any = {
      companyCode,
      workflowId,
      participantId,
    };

    if (stepId) {
      query.workflowStepId = stepId;
    }

    const tasks = await KanbanTaskModel.find(query).sort({ createdAt: -1 }).lean();
    return tasks;
  },

  /**
   * Xóa "công việc" (case) khỏi quy trình và lưu trữ các task Kanban chưa xong của nó
   */
  async removeParticipant(companyCode: string, workflowId: string, participantId: string) {
    const workflow = await WorkflowModel.findOne({ _id: workflowId, companyCode });
    if (!workflow) {
      throw new Error("Không tìm thấy quy trình yêu cầu.");
    }
    const remaining = workflow.participants.filter((p) => p.id !== participantId);
    if (remaining.length === workflow.participants.length) {
      throw new Error("Không tìm thấy công việc trong quy trình này.");
    }
    workflow.participants = remaining as any;
    await workflow.save();

    const tasksArchived = await archivePendingTasks(companyCode, { workflowId, participantId });
    return { workflow, tasksArchived };
  },

  /**
   * Lưu trữ mọi task Kanban chưa xong của một quy trình (gọi khi quy trình bị xóa)
   */
  async archiveWorkflowTasks(companyCode: string, workflowId: string) {
    return archivePendingTasks(companyCode, { workflowId });
  },

  /**
   * Hook sau khi task Kanban đổi trạng thái: nếu mọi task ở bước hiện tại của case
   * đã xong → phát socket "workflow:step-ready" cho công ty; nếu quy trình bật
   * autoAdvance → tự chuyển case sang bước kế tiếp và sinh task mới.
   */
  async handleTaskStatusChange(task: any) {
    if (!task?.isFromWorkflow || !task.workflowId || !task.participantId || !task.workflowStepId) {
      return;
    }
    if (!DONE_STATUSES.includes(task.status)) return;

    const pendingCount = await KanbanTaskModel.countDocuments({
      companyCode: task.companyCode,
      workflowId: task.workflowId,
      participantId: task.participantId,
      workflowStepId: task.workflowStepId,
      status: { $nin: INACTIVE_STATUSES },
    });
    if (pendingCount > 0) return;

    const workflow = await WorkflowModel.findOne({
      _id: task.workflowId,
      companyCode: task.companyCode,
    });
    if (!workflow) return;

    const participant = workflow.participants.find((p) => p.id === task.participantId);
    // Chỉ phản ứng khi bước vừa xong đúng là bước hiện tại của case
    if (!participant || participant.currentStepId !== task.workflowStepId) return;

    const step = workflow.steps.find((s) => s.id === task.workflowStepId);
    const eventPayload = {
      workflowId: String(task.workflowId),
      workflowName: workflow.name,
      participantId: participant.id,
      participantName: participant.name,
      stepId: task.workflowStepId,
      stepTitle: step?.title || "",
    };
    emitToCompany(task.companyCode, "workflow:step-ready", eventPayload);

    if (workflow.autoAdvance) {
      const orderIds = [...workflow.steps.map((s) => s.id), DONE_COL];
      const idx = orderIds.indexOf(participant.currentStepId);
      const nextStepId = orderIds[idx + 1];
      if (!nextStepId) return;

      try {
        const result = await this.advanceParticipant(
          task.companyCode,
          task.workflowId,
          participant.id,
          nextStepId
        );
        emitToCompany(task.companyCode, "workflow:participant-advanced", {
          ...eventPayload,
          nextStepId,
          tasksCreated: result.tasksCreated,
        });
      } catch (error: any) {
        // Another final task may have advanced this participant first. The task
        // update itself succeeded, so this is an expected idempotent outcome.
        if (error?.statusCode !== 409) throw error;
      }
    }
  },

  /** Re-evaluate the active workflow step after a linked Kanban task is deleted. */
  async handleTaskDeletion(task: any) {
    if (!task?.isFromWorkflow) return;
    await this.handleTaskStatusChange({ ...task, status: "Done" });
  },
};
