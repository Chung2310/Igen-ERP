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

test("assignRole rejects every Super Admin promotion", async () => {
  const service = createUserAccessManagementService({
    users: {
      findOtherSuperAdmin: async () => ({ _id: "root", email: "root@example.com" }),
      find: async () => ({ _id: "other", role: "user", save: async () => {} }),
    },
    sessions: {},
    audit: async () => {},
  });

  await assert.rejects(
    () => service.assignRole({ tenantId: "SYSTEM", userId: "other", role: "superadmin" }),
    /cannot be assigned/i,
  );
});

test("assignRole cannot promote users or demote the sole Super Admin", async () => {
  const regularService = createUserAccessManagementService({
    users: { find: async () => ({ _id: "user", role: "user", save: async () => {} }) },
    sessions: {}, audit: async () => {},
  });
  await assert.rejects(
    () => regularService.assignRole({ tenantId: "SYSTEM", userId: "user", role: "superadmin" }),
    /cannot be assigned/i,
  );

  const rootService = createUserAccessManagementService({
    users: { find: async () => ({ _id: "root", role: "superadmin", save: async () => {} }) },
    sessions: {}, audit: async () => {},
  });
  await assert.rejects(
    () => rootService.assignRole({ tenantId: "SYSTEM", userId: "root", role: "admin" }),
    /cannot be changed/i,
  );
});

test("assignRole persists valid permissions and rejects unknown codes", async () => {
  const saved: any = { _id: "user", role: "user", save: async () => {} };
  const service = createUserAccessManagementService({
    users: { find: async () => saved },
    sessions: {}, audit: async () => {},
  });

  await service.assignRole({ tenantId: "SYSTEM", userId: "user", role: "admin", permissions: ["stock:manage", "stock:read"] });
  assert.equal(saved.role, "admin");
  assert.deepEqual(saved.permissions, ["stock:manage", "stock:read"]);

  await assert.rejects(
    () => service.assignRole({ tenantId: "SYSTEM", userId: "user", role: "admin", permissions: ["not:a:permission"] }),
    /unknown permission/i,
  );
});

test("impersonation lifecycle persists start, stop, and active lookup", async () => {
  const store: any = { created: null, stopped: false };
  const service = createUserAccessManagementService({
    users: { find: async () => ({ _id: "target", role: "user", companyCode: "ACME" }) },
    sessions: {},
    impersonations: {
      create: async (doc: any) => { store.created = doc; return doc; },
      stop: async () => { store.stopped = true; },
      findActive: async () => (store.created && !store.stopped ? store.created : null),
    },
    audit: async () => {},
  });

  await service.startImpersonation({ tenantId: "ACME", userId: "target", actorId: "root", reason: "incident", correlationId: "corr-1" });
  assert.equal(store.created.targetUserId, "target");
  assert.equal(store.created.reason, "incident");
  assert.ok(store.created.expiresAt instanceof Date);

  const active = await service.activeImpersonation({ tenantId: "ACME", userId: "target" });
  assert.ok(active.active);

  await service.stopImpersonation({ tenantId: "ACME", userId: "target" });
  assert.equal(store.stopped, true);
  const after = await service.activeImpersonation({ tenantId: "ACME", userId: "target" });
  assert.equal(after.active, null);
});