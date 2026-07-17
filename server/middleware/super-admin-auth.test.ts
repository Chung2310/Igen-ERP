import assert from "node:assert/strict";
import test from "node:test";
import { createSuperAdminMiddleware } from "./super-admin-auth";

function response() { const state: any = {}; return { state, status(code: number) { state.code = code; return this; }, json(body: any) { state.body = body; return this; } }; }

test("rejects a forged superadmin JWT when the current database role is tenant admin", async () => {
  const middleware = createSuperAdminMiddleware({ users: { find: async () => ({ role: "admin" }) }, sessions: { find: async () => null }, now: () => new Date() });
  const req: any = { user: { id: "u1", role: "superadmin", sessionId: "s1" } }; const res: any = response(); let next = false;
  await middleware.requireRealSuperAdmin(req, res, () => { next = true; });
  assert.equal(res.state.code, 403); assert.equal(next, false);
});

test("accepts only a live privileged session owned by the real superadmin", async () => {
  const middleware = createSuperAdminMiddleware({ users: { find: async () => ({ _id: "u1", role: "superadmin" }) }, sessions: { find: async () => ({ sessionId: "s1", userId: "u1", expiresAt: new Date("2030-01-01"), revokedAt: null }) }, now: () => new Date("2026-01-01") });
  const req: any = { user: { id: "u1", role: "superadmin", sessionId: "s1" } }; const res: any = response(); let next = false;
  await middleware.requireRealSuperAdmin(req, res, () => { next = true; }); await middleware.requirePrivilegedSession(req, res, () => { next = true; });
  assert.equal(next, true); assert.equal(req.realActor.role, "superadmin");
});

test("rejects a session idle for more than thirty minutes", async () => {
  const middleware = createSuperAdminMiddleware({ users: { find: async () => ({ _id: "u1", role: "superadmin" }) }, sessions: { find: async () => ({ sessionId: "s1", userId: "u1", lastSeenAt: new Date("2026-01-01T00:00:00Z"), expiresAt: new Date("2030-01-01"), revokedAt: null }) }, now: () => new Date("2026-01-01T00:31:00Z") });
  const req: any = { user: { id: "u1", role: "superadmin", sessionId: "s1" } }; const res: any = response();
  await middleware.requirePrivilegedSession(req, res, () => undefined);
  assert.equal(res.state.code, 401);
});
