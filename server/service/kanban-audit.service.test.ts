import assert from "node:assert/strict";
import test from "node:test";
import { createKanbanAuditService } from "./kanban-audit.service";

test("records project lifecycle events with tenant and correlation context", async () => {
  const recorded: any[] = [];
  const service = createKanbanAuditService({
    record: async (event) => {
      recorded.push(event);
      return event;
    },
  });

  await service.recordProjectMutation({
    action: "created",
    actorId: "507f1f77bcf86cd799439011",
    companyCode: "ACME",
    correlationId: "corr-project",
    project: { _id: "project-1", name: "Launch" },
  });

  assert.deepEqual(recorded[0], {
    actionType: "project.created",
    actorSuperAdminId: "507f1f77bcf86cd799439011",
    result: "success",
    riskClass: "standard",
    companyCode: "ACME",
    tenantId: "ACME",
    correlationId: "corr-project",
    entityType: "project",
    entityId: "project-1",
    projectId: "project-1",
    after: { name: "Launch" },
  });
});

test("records task status transitions with linked project and workflow references", async () => {
  const recorded: any[] = [];
  const service = createKanbanAuditService({
    record: async (event) => {
      recorded.push(event);
      return event;
    },
  });

  await service.recordTaskMutation({
    action: "updated",
    actorId: "507f1f77bcf86cd799439011",
    companyCode: "ACME",
    correlationId: "corr-task",
    before: { _id: "task-1", title: "Verify", status: "In Progress", projectId: "project-1", workflowId: "workflow-1" },
    task: { _id: "task-1", title: "Verify", status: "Done", projectId: "project-1", workflowId: "workflow-1" },
  });

  assert.equal(recorded[0].actionType, "kanban.task.status_changed");
  assert.equal(recorded[0].entityType, "task");
  assert.equal(recorded[0].entityId, "task-1");
  assert.equal(recorded[0].projectId, "project-1");
  assert.equal(recorded[0].taskId, "task-1");
  assert.equal(recorded[0].workflowId, "workflow-1");
  assert.deepEqual(recorded[0].before, { title: "Verify", status: "In Progress" });
  assert.deepEqual(recorded[0].after, { title: "Verify", status: "Done" });
});
