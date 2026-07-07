import { WorkflowModel } from "../model/workflow.model";
import { KanbanTaskModel } from "../model/kanban-task.model";
import { UserModel } from "../model/user.model";

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

  const tzOffset = targetDate.getTimezoneOffset() * 60000;
  return new Date(targetDate.getTime() - tzOffset).toISOString().slice(0, 16);
}

function mapPriority(priority?: string): "High" | "Medium" | "Low" {
  if (priority === "urgent_important" || priority === "urgent") return "High";
  if (priority === "important") return "Medium";
  return "Low";
}

export const workflowLinkService = {
  /**
   * Chuyển participant sang bước tiếp theo & tự động sinh Kanban Tasks từ subtasks
   */
  async advanceParticipant(
    companyCode: string,
    workflowId: string,
    participantId: string,
    nextStepId: string
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

    const previousStepId = participant.currentStepId;
    participant.currentStepId = nextStepId;
    participant.updatedAt = new Date().toISOString();

    await workflow.save();

    // 3. Nếu sang bước hoàn thành, không sinh task
    if (nextStepId === "__done__") {
      return { workflow, participant, tasksCreated: 0 };
    }

    // 4. Tìm thông tin bước mới để sinh task
    const step = workflow.steps.find((s) => s.id === nextStepId);
    if (!step) {
      return { workflow, participant, tasksCreated: 0 };
    }

    // 5. Chuẩn bị danh sách subtasks để tạo Kanban Task
    const subTasksToCreate = step.subTasks && step.subTasks.length > 0
      ? step.subTasks
      : [{ id: "default", title: step.title, assigneeUid: step.assigneeUid, assignee: step.assignee }];

    let tasksCreated = 0;

    for (const sub of subTasksToCreate) {
      // Xác định người nhận việc
      const taskAssigneeUid = sub.assigneeUid || step.assigneeUid || (step.assigneeUids && step.assigneeUids[0]) || workflow.creatorUid;
      let taskAssignee = sub.assignee || step.assignee || "Thành viên";

      // Lấy avatar thực tế từ User Profile nếu có
      let assigneeAvatar = "👨‍💻";
      if (taskAssigneeUid) {
        const userDoc = await UserModel.findOne({ uid: taskAssigneeUid }).select("displayName photoURL").lean();
        if (userDoc) {
          if (userDoc.displayName) taskAssignee = userDoc.displayName;
          if (userDoc.photoURL) assigneeAvatar = userDoc.photoURL;
        }
      }

      const dueDate = calculateDueDate(step.deadlineType, step.deadlineDays, step.deadlineTime);
      const priority = mapPriority(step.priority);

      // Tạo Kanban Task mới
      await KanbanTaskModel.create({
        title: sub.title,
        description: step.description || `Công việc thuộc quy trình "${workflow.name}" - Bước: ${step.title}`,
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
        tags: [workflow.name, step.title],
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

      tasksCreated++;
    }

    return {
      workflow,
      participant,
      tasksCreated,
    };
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
};
