import assert from "node:assert/strict";
import test from "node:test";
import { createRetryableFinanceReminderAssistantService } from "./reminder-assistant.service";

const scope = { companyCode: "ACME", branchId: "B1" };

test("lists only scoped retryable in-app reminders and projects a readable exact notification preview", async () => {
  const calls: any[] = [];
  const service = createRetryableFinanceReminderAssistantService({
    async listDeliveries(filter, skip, limit) {
      calls.push(["list", filter, skip, limit]);
      return [{
        _id: "PRIVATE-DELIVERY-ID", receivableId: "PRIVATE-RECEIVABLE-ID", channel: "in_app", attempt: 2, maxAttempts: 5,
        payload: { sourceCode: "DH-001", balance: 125000, daysOverdue: 8 }, createdAt: new Date("2026-08-12T01:00:00.000Z"),
      }];
    },
    async countDeliveries(filter) { calls.push(["count", filter]); return 101; },
    async listReceivables(receivableScope, ids) {
      calls.push(["receivables", receivableScope, ids]);
      return [{ _id: "PRIVATE-RECEIVABLE-ID", customerName: "Nguyễn An", receivableCode: "CN-001", sourceCode: "DH-001", balance: 125000, daysOverdue: 8 }];
    },
  });

  const result = await service.list(scope, { page: 2, limit: 1000 });
  assert.equal(result.total, 101);
  assert.equal(result.page, 2);
  assert.equal(result.limit, 100);
  assert.deepEqual(calls[0], ["list", {
    ...scope, channel: "in_app", status: "failed", failureType: "temporary", $expr: { $lt: ["$attempt", "$maxAttempts"] },
  }, 100, 100]);
  assert.deepEqual(calls[1], ["count", calls[0][1]]);
  assert.deepEqual(calls[2], ["receivables", scope, ["PRIVATE-RECEIVABLE-ID"]]);
  assert.deepEqual(result.items, [{
    _id: "PRIVATE-DELIVERY-ID", customerName: "Nguyễn An", receivableCode: "CN-001", sourceCode: "DH-001",
    balance: 125000, daysOverdue: 8, notificationTitle: "Công nợ quá hạn · DH-001",
    notificationBody: "Khoản công nợ còn 125000 ₫ và đã quá hạn 8 ngày.", attempt: 2, maxAttempts: 5,
    nextAttemptAt: undefined, createdAt: new Date("2026-08-12T01:00:00.000Z"),
  }]);
  assert.equal(result.items[0]._id, "PRIVATE-DELIVERY-ID");
  assert.doesNotMatch(JSON.stringify(result.items), /companyCode|branchId|customerId|receivableId|error/);
});

test("does not offer orphaned deliveries and handles empty pages without querying receivables", async () => {
  let receivableLookups = 0;
  const service = createRetryableFinanceReminderAssistantService({
    async listDeliveries() { return [{ _id: "d1", receivableId: "missing", channel: "in_app" }]; },
    async countDeliveries() { return 1; },
    async listReceivables() { receivableLookups++; return []; },
  });
  const result = await service.list(scope, { page: 0, limit: "bad" });
  assert.equal(result.page, 1);
  assert.equal(result.limit, 20);
  assert.equal(result.items.length, 0);
  assert.equal(receivableLookups, 1);
});
