import express from "express";
import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const list = vi.hoisted(() => vi.fn());
// Exercise the actual router ordering; only authentication identity lookup is stubbed.
vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => { if (!req.headers["x-test-role"]) return res.status(401).end(); req.user = { id: "actor", role: req.headers["x-test-role"] }; next(); },
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  DEFAULT_ROLE_PERMISSIONS: {}, DEFAULT_ROLE_LEVELS: {}, getEffectivePermissions: vi.fn(),
}));
vi.mock("../middleware/super-admin-auth", () => ({
  requireRealSuperAdmin: (req: any, res: any, next: any) => req.user.role === "superadmin" ? next() : res.status(403).end(),
  requirePrivilegedSession: (req: any, res: any, next: any) => req.headers["x-test-privileged"] === "yes" ? next() : res.status(401).end(),
}));
vi.mock("../super-admin/activity-monitor.service", () => ({ activityMonitorService: { list, accounts: vi.fn(async () => []) } }));

import { superAdminRouter } from "./super-admin.router";

const app = express();
app.use(express.json());
app.use("/api/v1/super-admin", superAdminRouter);
const server = createServer(app);
let url = "";
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as any).port}/api/v1/super-admin/activity`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
describe("activity monitor route authorization", () => {
  it.each(["events", "accounts"])("rejects unauthenticated and ordinary company admins: %s", async (path) => {
    expect((await fetch(`${url}/${path}`)).status).toBe(401);
    expect((await fetch(`${url}/${path}`, { headers: { "x-test-role": "admin", "x-test-privileged": "yes" } })).status).toBe(403);
    expect((await fetch(`${url}/${path}`, { headers: { "x-test-role": "superadmin" } })).status).toBe(401);
  });
  it("allows a privileged Super Admin and forwards scoped filters without caching", async () => {
    list.mockResolvedValueOnce({ data: [], total: 0 });
    const response = await fetch(`${url}/events?companyCode=ACME&userId=abc`, { headers: { "x-test-role": "superadmin", "x-test-privileged": "yes" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "ACME", userId: "abc" }));
  });
});
