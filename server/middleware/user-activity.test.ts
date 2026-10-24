import test from "node:test";
import assert from "node:assert/strict";
import { buildUserActivityFromRequest, createActivityBatchWriter } from "./user-activity";

test("builds a sanitized activity event for authenticated mutations", () => {
  const event = buildUserActivityFromRequest({
    method: "PATCH",
    originalUrl: "/api/v1/users/secret-id?token=secret",
    baseUrl: "/api/v1",
    route: { path: "/users/:id" },
    ip: "::ffff:203.0.113.7",
    get: (name: string) => name === "user-agent" ? "Browser" : name === "authorization" ? "Bearer secret" : undefined,
    user: { id: "507f1f77bcf86cd799439011", companyCode: "ACME" },
    body: { password: "secret", message: "private" },
  } as any, 200);

  assert.deepEqual(event, {
    userId: "507f1f77bcf86cd799439011",
    companyCode: "ACME",
    actionType: "user.update",
    category: "data",
    result: "success",
    method: "PATCH",
    route: "/api/v1/users/:id",
    description: "Cập nhật người dùng",
    sourceIp: "203.0.113.7",
    userAgent: "Browser",
    deviceSummary: "Trình duyệt khác trên Thiết bị khác",
    statusCode: 200,
  });
  assert.equal("body" in (event as any), false);
  assert.equal(JSON.stringify(event).includes("Bearer"), false);
});

test("records reads but skips activity queries and unauthenticated requests", () => {
  const base = { baseUrl: "/api/v1", route: { path: "/items" }, user: { id: "u1", companyCode: "ACME" }, get: () => undefined };
  assert.equal(buildUserActivityFromRequest({ ...base, method: "GET" } as any, 200)?.category, "view");
  assert.equal(buildUserActivityFromRequest({ ...base, method: "POST", route: { path: "/users/:userId/activity" } } as any, 200), null);
  assert.equal(buildUserActivityFromRequest({ ...base, method: "POST", user: undefined } as any, 200), null);
  assert.equal(buildUserActivityFromRequest({ ...base, method: "GET", baseUrl: "/api/v1/super-admin", route: { path: "/activity/events" } } as any, 200), null);
  assert.equal(buildUserActivityFromRequest({ ...base, method: "GET", baseUrl: "/api/v1/super-admin", route: { path: "/activity/accounts" } } as any, 200), null);
});

test("categorizes communication and failed security mutations", () => {
  const event = buildUserActivityFromRequest({ method: "DELETE", baseUrl: "/api/v1/chat", route: { path: "/rooms/:roomId" }, user: { id: "u1", companyCode: "ACME" }, get: () => undefined } as any, 403);
  assert.equal(event?.category, "communication");
  assert.equal(event?.result, "failure");
});

test("describes searches without storing query values", () => {
  const event = buildUserActivityFromRequest({ method: "GET", baseUrl: "/api/v1", route: { path: "/students" }, query: { search: "private-name" }, user: { id: "u1", companyCode: "ACME" }, get: () => undefined } as any, 200);
  assert.equal(event?.actionType, "student.search");
  assert.equal(event?.description, "Tìm kiếm học viên");
  assert.equal(JSON.stringify(event).includes("private-name"), false);
});

test("describes logout as authentication instead of generic data creation", () => {
  const event = buildUserActivityFromRequest({ method: "POST", baseUrl: "/api/v1", route: { path: "/auth/logout" }, user: { id: "u1", companyCode: "ACME" }, get: () => undefined } as any, 200);
  assert.equal(event?.actionType, "auth.logout");
  assert.equal(event?.category, "authentication");
  assert.equal(event?.description, "Đăng xuất khỏi hệ thống");
});

test("uses friendly module names for common company workflows", () => {
  const makeEvent = (path: string) => buildUserActivityFromRequest({
    method: "GET",
    baseUrl: "/api/v1",
    route: { path },
    user: { id: "u1", companyCode: "ACME" },
    get: () => undefined,
  } as any, 200);

  assert.equal(makeEvent("/recruitment/candidates")?.actionType, "recruitment.view");
  assert.equal(makeEvent("/projects/:id")?.actionType, "project.view");
  assert.equal(makeEvent("/leave-requests")?.actionType, "leave.view");
  assert.equal(makeEvent("/branches")?.actionType, "company.view");
});

test("batches routine activity writes", async () => {
  const batches: any[][] = [];
  const writer = createActivityBatchWriter(async (events) => { batches.push(events); }, { maxBatchSize: 10, flushIntervalMs: 60_000 });
  await writer({ actionType: "data.view" });
  await writer({ actionType: "data.search" });
  assert.equal(batches.length, 0);
  await writer.flush();
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 2);
});

test("identifies CRUD resources and stores only safe target identifiers", () => {
  const event = buildUserActivityFromRequest({
    method: "PATCH", baseUrl: "/api/v1/crud", route: { path: "/:modelName/:id" },
    params: { modelName: "products", id: "507f1f77bcf86cd799439011", token: "secret-token" },
    user: { id: "user-1", companyCode: "ACME" }, get: () => undefined,
    body: { password: "secret-password" },
  } as any, 403);
  assert.equal(event?.actionType, "inventory.update");
  assert.equal(event?.entityId, "507f1f77bcf86cd799439011");
  assert.equal(event?.statusCode, 403);
  assert.equal(event?.result, "failure");
  assert.equal(JSON.stringify(event).includes("secret"), false);
});
