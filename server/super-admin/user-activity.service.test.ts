import test from "node:test";
import assert from "node:assert/strict";
import { createUserActivityService } from "./user-activity.service";

test("lists tenant-scoped activity with date, category and pagination", async () => {
  let filter: any; let paging: any;
  const service = createUserActivityService({
    users: { find: async () => ({ _id: "u1", companyCode: "ACME" }) },
    activities: {
      count: async (value: any) => { filter = value; return 3; },
      find: async (_value: any, value: any) => { paging = value; return [{ eventId: "e1" }]; },
    },
  });

  const result = await service.list({ tenantId: "ACME", userId: "u1", from: "2026-07-01", to: "2026-07-03", category: "security", result: "failure", search: "đăng nhập", page: 2, limit: 1 });

  assert.equal(String(filter.userId), "u1");
  assert.equal(filter.companyCode, "ACME");
  assert.equal(filter.category, "security");
  assert.equal(filter.result, "failure");
  assert.equal(filter.description.$options, "i");
  assert.equal(filter.occurredAt.$gte.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(filter.occurredAt.$lte.toISOString(), "2026-07-03T23:59:59.999Z");
  assert.deepEqual(paging, { skip: 1, limit: 1 });
  assert.deepEqual(result, { data: [{ eventId: "e1" }], total: 3, page: 2, limit: 1 });
});

test("rejects activity access outside tenant scope", async () => {
  const service = createUserActivityService({
    users: { find: async () => ({ _id: "u1", companyCode: "OTHER" }) },
    activities: { count: async () => 0, find: async () => [] },
  });
  await assert.rejects(() => service.list({ tenantId: "ACME", userId: "u1" }), /outside tenant scope/i);
});
