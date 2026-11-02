import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { createServer } from "node:http";
import { io as connectSocket } from "socket.io-client";

describe("administrative access changes with a real database", () => {
  let mongo: MongoMemoryServer;
  let User: any, Company: any, Sessions: any, auth: any, access: any, requireAuth: any, TenantService: any;
  let user: any;
  const password = "Local-test-password-123!";
  let passwordHash: string;
  const oldConfig = dotenv.config;
  const oldConfigDotenv = dotenv.configDotenv;

  beforeAll(async () => {
    process.env.DOTENV_CONFIG_PATH = "tmp/local-qa/no-external-config.env";
    process.env.JWT_ACCESS_SECRET = "integration-access-secret-only-for-local-tests";
    process.env.JWT_REFRESH_SECRET = "integration-refresh-secret-only-for-local-tests";
    process.env.DEPLOYMENT_ENV = "staging";
    dotenv.config = () => ({ parsed: {} });
    dotenv.configDotenv = () => ({ parsed: {} });
    mongoose.set("autoIndex", false);
    mongo = await MongoMemoryServer.create({ instance: { dbName: "igen_access_regression", launchTimeout: 60000 } });
    await mongoose.connect(mongo.getUri());
    User = (await import("../model/user.model")).UserModel;
    Company = (await import("../model/company.model")).CompanyModel;
    Sessions = (await import("../model/super-admin-session.model")).SuperAdminSessionModel;
    auth = (await import("../service/auth.service")).authService;
    access = (await import("../super-admin/user-access-management.service")).userAccessManagementService;
    requireAuth = (await import("../middleware/auth")).requireAuth;
    TenantService = (await import("../super-admin/tenant-management.service")).TenantManagementService;
    passwordHash = await (await import("bcryptjs")).default.hash(password, 4);
  }, 120000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
    dotenv.config = oldConfig;
    dotenv.configDotenv = oldConfigDotenv;
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Company.deleteMany({}), Sessions.deleteMany({})]);
    await Company.create({ code: "ACCESS_QA", name: "Access QA", ownerEmail: "admin@example.test", lifecycleStatus: "active" });
    user = await User.create({ email: "admin@example.test", displayName: "QA Admin", password: passwordHash, role: "admin", companyCode: "ACCESS_QA", activeSessionId: randomUUID() });
  });

  async function request(token: string) {
    const req: any = { headers: { authorization: `Bearer ${token}` }, query: {}, method: "GET", originalUrl: "/api/v1/auth/me" };
    const res: any = { statusCode: 200, body: null, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
    let allowed = false;
    await requireAuth(req, res, () => { allowed = true; });
    return { allowed, status: res.statusCode, code: res.body?.code, role: req.user?.role };
  }
  const command = () => ({ tenantId: "ACCESS_QA", userId: String(user._id), actorId: "507f1f77bcf86cd799439011", correlationId: randomUUID() });
  const tokens = () => auth.generateTokens(user, user.activeSessionId);

  it("persists a lock, rejects access/login/refresh, and does not resurrect the old session on unlock", async () => {
    const old = tokens();
    expect((await request(old.accessToken)).allowed).toBe(true);
    await access.lock(command());
    expect((await User.findById(user._id)).lockedAt).toBeInstanceOf(Date);
    expect(await request(old.accessToken)).toMatchObject({ allowed: false, code: "ACCOUNT_LOCKED" });
    await expect(auth.login(user.email, password)).rejects.toThrow();
    await expect(auth.refresh(old.refreshToken)).rejects.toThrow();
    await access.unlock(command());
    expect((await request(old.accessToken)).allowed).toBe(false);
    const fresh = await auth.login(user.email, password);
    expect((await request(fresh.accessToken)).allowed).toBe(true);
  });

  it("revokes both regular access and refresh tokens", async () => {
    const old = tokens();
    await access.revokeSessions(command());
    expect((await User.findById(user._id)).activeSessionId).toBe("");
    expect(await request(old.accessToken)).toMatchObject({ allowed: false, code: "SESSION_REPLACED" });
    await expect(auth.refresh(old.refreshToken)).rejects.toThrow();
  });

  it("rejects stale role claims after demotion and issues the new role only after login", async () => {
    const old = tokens();
    await access.assignRole({ ...command(), role: "user", permissions: [] });
    expect(await request(old.accessToken)).toMatchObject({ allowed: false, code: "ACCOUNT_ACCESS_CHANGED" });
    await expect(auth.refresh(old.refreshToken)).rejects.toThrow();
    const fresh = await auth.login(user.email, password);
    expect(await request(fresh.accessToken)).toMatchObject({ allowed: true, role: "user" });
  });

  it("rejects an old company claim even if the session id has not changed", async () => {
    const old = tokens();
    await User.updateOne({ _id: user._id }, { $set: { companyCode: "OTHER" } });
    expect(await request(old.accessToken)).toMatchObject({ allowed: false, code: "ACCOUNT_ACCESS_CHANGED" });
  });

  it("enforces suspension on existing sessions without removing individual locks on reactivation", async () => {
    const old = tokens();
    const tenants = new TenantService();
    await tenants.transitionLifecycle("ACCESS_QA", "suspended");
    expect(await request(old.accessToken)).toMatchObject({ allowed: false, code: "COMPANY_UNAVAILABLE" });
    await expect(auth.login(user.email, password)).rejects.toThrow();
    await expect(auth.refresh(old.refreshToken)).rejects.toThrow();
    await access.lock(command());
    await tenants.transitionLifecycle("ACCESS_QA", "active");
    expect((await User.findById(user._id)).lockedAt).toBeInstanceOf(Date);
    expect((await request(old.accessToken)).allowed).toBe(false);
    await access.unlock(command());
    expect((await request(old.accessToken)).allowed).toBe(false);
    expect((await request((await auth.login(user.email, password)).accessToken)).allowed).toBe(true);
  });

  it("checks current company state even if the session was not revoked by a service", async () => {
    const old = tokens();
    await Company.updateOne({ code: "ACCESS_QA" }, { $set: { lifecycleStatus: "archived" } });
    expect((await request(old.accessToken)).allowed).toBe(false);
    await Company.deleteMany({});
    expect((await request(old.accessToken)).allowed).toBe(false);
  });

  it("enforces persisted account disable flags", async () => {
    const old = tokens();
    await User.updateOne({ _id: user._id }, { $set: { disabledAt: new Date() } });
    expect(await request(old.accessToken)).toMatchObject({ allowed: false, code: "ACCOUNT_DISABLED" });
    await User.updateOne({ _id: user._id }, { $set: { disabledAt: null, isActive: false } });
    expect((await request(old.accessToken)).allowed).toBe(false);
    await expect(auth.login(user.email, password)).rejects.toThrow();
  });

  it("revokes privileged sessions on ordinary APIs too", async () => {
    user.role = "superadmin"; user.companyCode = "SYSTEM"; await user.save();
    await Sessions.create({ userId: user._id, sessionId: user.activeSessionId, deviceId: randomUUID(), expiresAt: new Date(Date.now() + 60000) });
    const old = tokens();
    expect((await request(old.accessToken)).allowed).toBe(true);
    await access.revokeSessions({ ...command(), tenantId: "SYSTEM" });
    expect(await request(old.accessToken)).toMatchObject({ allowed: false, code: "SESSION_REVOKED" });
    await expect(auth.refresh(old.refreshToken)).rejects.toThrow();
  });

  it("counts active/suspended tenants correctly and excludes archived/deletion states", async () => {
    for (const lifecycleStatus of ["suspended", "archived", "scheduled-deletion"]) {
      await Company.create({ code: lifecycleStatus.toUpperCase(), name: lifecycleStatus, ownerEmail: `${lifecycleStatus}@example.test`, lifecycleStatus });
    }
    const { superAdminDashboardService } = await import("../service/super-admin-dashboard.service");
    const summary = await superAdminDashboardService.getSummary();
    expect(summary.counts.tenants).toEqual({ total: 4, active: 1, suspended: 1 });
    await User.updateOne({ _id: user._id }, { $set: { lockedAt: new Date() } });
    expect((await superAdminDashboardService.getSummary()).counts.lockedAccounts).toBe(1);
  });

  it("disconnects a live socket on revocation and rejects reconnecting with the revoked token", async () => {
    const { initSocketServer } = await import("../socket");
    const http = createServer();
    const io = await initSocketServer(http);
    await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
    const address = http.address() as { port: number };
    const token = tokens().accessToken;
    const socket = connectSocket(`http://127.0.0.1:${address.port}`, { auth: { token }, transports: ["websocket"], reconnection: false, autoConnect: false });
    const event = (name: string) => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Socket timeout: ${name}`)), 5000);
      socket.once(name, () => { clearTimeout(timer); resolve(); });
    });
    try {
      const connected = event("connect"); socket.connect(); await connected;
      const disconnected = event("disconnect"); await access.revokeSessions(command()); await disconnected;
      const rejected = event("connect_error"); socket.connect(); await rejected;
    } finally {
      socket.disconnect();
      await new Promise<void>(resolve => io.close(() => resolve()));
    }
  }, 20000);
});
