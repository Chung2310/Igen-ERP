import test from "node:test";
import assert from "node:assert/strict";
import { buildUserActivityFromRequest } from "./user-activity";

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
    actionType: "PATCH /api/v1/users/:id",
    category: "data",
    result: "success",
    method: "PATCH",
    route: "/api/v1/users/:id",
    description: "PATCH /api/v1/users/:id",
    sourceIp: "203.0.113.7",
    userAgent: "Browser",
  });
  assert.equal("body" in (event as any), false);
  assert.equal(JSON.stringify(event).includes("secret"), false);
});

test("skips reads, activity queries and unauthenticated requests", () => {
  const base = { baseUrl: "/api/v1", route: { path: "/items" }, user: { id: "u1", companyCode: "ACME" }, get: () => undefined };
  assert.equal(buildUserActivityFromRequest({ ...base, method: "GET" } as any, 200), null);
  assert.equal(buildUserActivityFromRequest({ ...base, method: "POST", route: { path: "/users/:userId/activity" } } as any, 200), null);
  assert.equal(buildUserActivityFromRequest({ ...base, method: "POST", user: undefined } as any, 200), null);
});

test("categorizes communication and failed security mutations", () => {
  const event = buildUserActivityFromRequest({ method: "DELETE", baseUrl: "/api/v1/chat", route: { path: "/rooms/:roomId" }, user: { id: "u1", companyCode: "ACME" }, get: () => undefined } as any, 403);
  assert.equal(event?.category, "communication");
  assert.equal(event?.result, "failure");
});
