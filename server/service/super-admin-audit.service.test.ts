import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { superAdminAuditService } from "./super-admin-audit.service";

test("queryEvents returns paginated audit events with resolved actor emails", async () => {
  // 1. Mocks
  let findQueryFilter: any = null;
  let findQueryOptions: any = null;

  const originalQueryExec = mongoose.Query.prototype.exec;
  mongoose.Query.prototype.exec = async function (this: any) {
    const modelName = this.model.modelName;
    const op = this.op;
    const filter = this.getFilter();

    if (modelName === "AuditEvent" && op === "find") {
      findQueryFilter = filter;
      findQueryOptions = this.options;
      return [
        {
          eventId: "event-1",
          actionType: "security.login.totp.success",
          riskClass: "standard",
          result: "success",
          actorSuperAdminId: "user-admin-1",
          companyCode: "SYSTEM",
          environment: "staging",
          occurredAt: new Date("2026-07-17T09:00:00Z"),
        },
      ];
    }

    if (modelName === "AuditEvent" && op === "countDocuments") {
      return 100;
    }

    if (modelName === "User" && op === "find") {
      return [
        {
          _id: "user-admin-1",
          email: "superadmin@igen.vn",
          displayName: "Super Admin User",
        },
      ];
    }

    return originalQueryExec.apply(this);
  };

  try {
    // 2. Call Service
    const filters = {
      actorSuperAdminId: "user-admin-1",
      riskClass: "standard",
      result: "success",
      environment: "staging",
      actionType: "totp",
      correlationId: "corr-1", projectId: "project-1", taskId: "task-1", workflowId: "workflow-1", tenantId: "tenant-1", entityType: "task", entityId: "task-1",
      startDate: "2026-07-16T00:00:00Z",
      endDate: "2026-07-18T00:00:00Z",
    };
    const pagination = { page: 2, limit: 10 };

    const result = await superAdminAuditService.queryEvents(filters, pagination);

    // 3. Assertions
    assert.equal(result.total, 100);
    assert.equal(result.page, 2);
    assert.equal(result.limit, 10);
    assert.equal(result.pages, 10);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].actorEmail, "superadmin@igen.vn");
    assert.equal(result.events[0].actorDisplayName, "Super Admin User");

    // Verify correct queries were passed
    assert.equal(findQueryFilter.actorSuperAdminId, "user-admin-1");
    assert.equal(findQueryFilter.riskClass, "standard");
    assert.equal(findQueryFilter.result, "success");
    assert.equal(findQueryFilter.environment, "staging");
    assert.deepEqual(findQueryFilter.actionType, { $regex: "totp", $options: "i" });
    assert.equal(findQueryFilter.correlationId, "corr-1");
    assert.equal(findQueryFilter.projectId, "project-1");
    assert.equal(findQueryFilter.taskId, "task-1");
    assert.equal(findQueryFilter.workflowId, "workflow-1");
    assert.equal(findQueryFilter.tenantId, "tenant-1");
    assert.equal(findQueryFilter.entityType, "task");
    assert.equal(findQueryFilter.entityId, "task-1");
    assert.ok(findQueryFilter.occurredAt.$gte instanceof Date);
    assert.ok(findQueryFilter.occurredAt.$lte instanceof Date);

    // Verify correct pagination options
    assert.equal(findQueryOptions.skip, 10);
    assert.equal(findQueryOptions.limit, 10);
    assert.deepEqual(findQueryOptions.sort, { occurredAt: -1 });

  } finally {
    // 4. Cleanup
    mongoose.Query.prototype.exec = originalQueryExec;
  }
});
