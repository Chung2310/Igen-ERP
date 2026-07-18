import { auditService } from "./audit.service";
import type { AuditEventInsert } from "../model/audit-event.model";

type AuditRecorder = {
  record(event: Partial<AuditEventInsert> & Pick<AuditEventInsert, "actionType" | "actorSuperAdminId" | "result">): Promise<unknown>;
};

type MutationContext = {
  actorId: string;
  companyCode: string;
  correlationId: string;
};

type ProjectMutation = MutationContext & {
  action: "created" | "deleted";
  project: Record<string, any>;
};

type TaskMutation = MutationContext & {
  action: "created" | "updated" | "deleted";
  task: Record<string, any>;
  before?: Record<string, any>;
};

function idOf(value: unknown) {
  return String(value || "");
}

function safeProject(project: Record<string, any>) {
  return { name: String(project.name || "") };
}

function safeTask(task: Record<string, any>) {
  const snapshot: Record<string, unknown> = {};
  for (const field of ["title", "status", "priority", "assigneeUid", "dueDate"] as const) {
    if (task[field] !== undefined) snapshot[field] = task[field];
  }
  return snapshot;
}

export function createKanbanAuditService(recorder: AuditRecorder = auditService) {
  return {
    recordProjectMutation(input: ProjectMutation) {
      const projectId = idOf(input.project._id);
      return recorder.record({
        actionType: `project.${input.action}`,
        actorSuperAdminId: input.actorId as any,
        result: "success",
        riskClass: "standard",
        companyCode: input.companyCode,
        tenantId: input.companyCode,
        correlationId: input.correlationId,
        entityType: "project",
        entityId: projectId,
        projectId,
        ...(input.action === "deleted"
          ? { before: safeProject(input.project) }
          : { after: safeProject(input.project) }),
      });
    },

    recordTaskMutation(input: TaskMutation) {
      const taskId = idOf(input.task._id);
      const statusChanged = input.action === "updated"
        && input.before?.status !== undefined
        && input.before.status !== input.task.status;
      return recorder.record({
        actionType: statusChanged ? "kanban.task.status_changed" : `kanban.task.${input.action}`,
        actorSuperAdminId: input.actorId as any,
        result: "success",
        riskClass: "standard",
        companyCode: input.companyCode,
        tenantId: input.companyCode,
        correlationId: input.correlationId,
        entityType: "task",
        entityId: taskId,
        taskId,
        projectId: idOf(input.task.projectId) || undefined,
        workflowId: idOf(input.task.workflowId) || undefined,
        ...(input.action === "deleted"
          ? { before: safeTask(input.task) }
          : input.before
            ? { before: safeTask(input.before), after: safeTask(input.task) }
            : { after: safeTask(input.task) }),
      });
    },
  };
}

export const kanbanAuditService = createKanbanAuditService();
