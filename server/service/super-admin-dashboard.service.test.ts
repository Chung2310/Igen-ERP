import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { setRateLimitRedisClientForTesting } from "../infrastructure/rate-limit-redis";

test("getSummary aggregates correct counts, financial summaries, and health values", async () => {
  // 1. Mock redis client immediately BEFORE loading other modules
  const mockRedisClient = {
    ping: async () => "PONG",
    status: "ready",
  };
  setRateLimitRedisClientForTesting(mockRedisClient as any);

  // 2. Dynamically import modules to avoid load-time ESM side-effects
  const { CompanyModel } = await import("../model/company.model");
  const { UserModel } = await import("../model/user.model");
  const { SuperAdminSessionModel } = await import("../model/super-admin-session.model");
  const { AuditEventModel } = await import("../model/audit-event.model");
  const { superAdminDashboardService } = await import("./super-admin-dashboard.service");
  const socketModule = await import("../socket");


  // 3. Mocks
  const originalReadyState = mongoose.connection.readyState;
  Object.defineProperty(mongoose.connection, "readyState", {
    get: () => 1,
    configurable: true,
  });

  socketModule.setSocketIoHealthyForTesting(true);

  // Mock Mongoose Query exec
  const originalQueryExec = mongoose.Query.prototype.exec;
  mongoose.Query.prototype.exec = async function (this: any) {
    const modelName = this.model.modelName;
    const op = this.op;
    const filter = this.getFilter();

    if (modelName === "Company" && op === "countDocuments") {
      if (filter.status === "suspended") return 1;
      if (filter.status === "active" || filter.status?.$ne === "suspended") return 4;
      return 5;
    }
    if (modelName === "User" && op === "countDocuments") {
      return 42;
    }
    if (modelName === "SuperAdminSession" && op === "countDocuments") {
      return 2;
    }
    if (modelName === "AuditEvent" && op === "find") {
      if (filter.result === "failure") {
        return [
          {
            eventId: "alert-1",
            actionType: "security.login.totp.failure",
            actorSuperAdminId: "user-1",
            sourceIp: "127.0.0.1",
            occurredAt: new Date("2026-07-17T09:00:00Z"),
          },
        ];
      }
      return [
        {
          eventId: "activity-1",
          actionType: "security.login.totp.success",
          actorSuperAdminId: "user-2",
          result: "success",
          occurredAt: new Date("2026-07-17T09:10:00Z"),
          sourceIp: "127.0.0.1",
        },
      ];
    }
    if (modelName === "User" && op === "find") {
      return [
        { _id: "user-1", email: "user1@igen.vn", displayName: "User 1" },
        { _id: "user-2", email: "user2@igen.vn", displayName: "User 2" },
      ];
    }

    return originalQueryExec.apply(this);
  };

  try {
    // 4. Call service
    const summary = await superAdminDashboardService.getSummary();

    // 5. Assertions
    assert.deepEqual(summary.counts, {
      tenants: { total: 5, active: 4, suspended: 1 },
      users: 42,
      activeSessions: 2,
      lockedAccounts: 42,
    });


    assert.equal(summary.health.database, "healthy");
    assert.equal(summary.health.redis, "healthy");
    assert.equal(summary.health.socketIo, "healthy");

    assert.equal(summary.securityAlerts.length, 1);
    assert.equal(summary.securityAlerts[0].type, "security.login.totp.failure");
    assert.equal(summary.securityAlerts[0].message.includes("user1@igen.vn"), true);

    assert.equal(summary.recentActivity.length, 1);
    assert.equal(summary.recentActivity[0].actionType, "security.login.totp.success");
    assert.equal(summary.recentActivity[0].actorEmail, "user2@igen.vn");

  } finally {
    // 6. Cleanup
    Object.defineProperty(mongoose.connection, "readyState", {
      get: () => originalReadyState,
      configurable: true,
    });
    socketModule.setSocketIoHealthyForTesting(false);
    mongoose.Query.prototype.exec = originalQueryExec;
    setRateLimitRedisClientForTesting(null);
  }
});
