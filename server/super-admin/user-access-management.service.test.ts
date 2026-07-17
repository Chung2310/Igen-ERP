import test from "node:test";
import assert from "node:assert/strict";
import { createUserAccessManagementService } from "./user-access-management.service";

test("search is tenant scoped and paginated", async () => {
  let query: any; const service = createUserAccessManagementService({ users: { count: async (q: any) => { query = q; return 3; }, search: async () => [{ _id: "u1" }] }, sessions: {}, audit: async () => {} });
  const result = await service.search({ tenantId: "ACME", page: 2, limit: 1 });
  assert.deepEqual(query, { companyCode: "ACME" }); assert.equal(result.total, 3); assert.equal(result.page, 2);
});
test("tenant roles cannot escalate to superadmin and privileged 2FA reset revokes sessions", async () => {
  let revoked = false; const service = createUserAccessManagementService({ users: { find: async () => ({ _id: "u1", role: "superadmin", superAdminSecurity: {}, save: async () => {} }) }, sessions: { revokeAll: async () => { revoked = true; } }, audit: async () => {} });
  await assert.rejects(() => service.assignRole({ tenantId: "ACME", userId: "u1", role: "superadmin" }));
  await service.resetTwoFactor({ tenantId: "SYSTEM", userId: "u1" }); assert.equal(revoked, true);
});
test("impersonation needs a reason and never targets superadmin", async () => {
  const service = createUserAccessManagementService({ users: { find: async () => ({ _id: "u1", role: "superadmin" }) }, sessions: {}, audit: async () => {} });
  await assert.rejects(() => service.startImpersonation({ tenantId: "SYSTEM", userId: "u1", reason: "incident" }));
});
