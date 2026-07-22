import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express, { type Router } from "express";
import jwt from "jsonwebtoken";
import type { NextFunction, Response } from "express";
import { getJwtAccessSecret } from "../../../config/env";
import { CustomFieldController } from "../controllers/custom-field.controller";
import customFieldRouter from "./custom-field.routes";
import {
  createFieldSchema,
  fieldParamsSchema,
  moduleParamSchema,
  updateFieldSchema,
} from "../validations/custom-field.validation";
import { authMiddleware, requireRoles } from "../middlewares/auth.middleware";

type ResponseCapture = {
  statusCode: number;
  body: unknown;
  status: (statusCode: number) => ResponseCapture;
  json: (body: unknown) => ResponseCapture;
};

function responseCapture(): ResponseCapture {
  return {
    statusCode: 200,
    body: undefined,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function invokeRoleGuard(role?: "superadmin" | "admin" | "manager" | "user") {
  const req = { user: role ? { role } : undefined } as any;
  const res = responseCapture();
  let passed = false;
  requireRoles("superadmin", "admin", "manager")(req, res as unknown as Response, () => { passed = true; });
  return { passed, res };
}

function validCreateBody() {
  return { label: "Preferred name", type: "text", isVisible: false, isRequired: true };
}

async function requestRouter(router: Router, mountPath: string, method: string, path: string, body?: unknown) {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const token = jwt.sign({ id: "actor-a", email: "actor@example.com", role: "manager", companyCode: "tenant-a" }, getJwtAccessSecret());

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, contentType: response.headers.get("content-type"), raw: await response.text() };
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("router exposes all custom field endpoints", () => {
  const methods = customFieldRouter.stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`)
    .sort();

  assert.deepEqual(methods, [
    "GET /:moduleKey",
    "PATCH /:moduleKey/:id",
    "POST /:moduleKey",
    "POST /:moduleKey/:id/archive",
    "POST /:moduleKey/:id/delete",
    "POST /:moduleKey/:id/restore",
    "POST /:moduleKey/:id/upload",
  ]);
});

test("unauthenticated requests receive 401 before the custom field handlers", () => {
  const res = responseCapture();
  let passed = false;
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    authMiddleware({ headers: {}, query: {}, method: "POST", originalUrl: "/custom-fields/students" } as any, res as unknown as Response, () => { passed = true; });
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(passed, false);
  assert.equal(res.statusCode, 401);
});

test("ordinary users cannot mutate custom fields", () => {
  const user = invokeRoleGuard("user");
  assert.equal(user.passed, false);
  assert.equal(user.res.statusCode, 403);
});

test("manager, admin and superadmin can mutate custom fields", () => {
  for (const role of ["manager", "admin", "superadmin"] as const) {
    assert.equal(invokeRoleGuard(role).passed, true, role);
  }
});

test("validates only supported modules and Mongo ObjectId parameters", () => {
  assert.equal(moduleParamSchema.validate({ moduleKey: "students" }).error, undefined);
  assert.ok(moduleParamSchema.validate({ moduleKey: "payments" }).error);
  assert.equal(fieldParamsSchema.validate({ moduleKey: "students", id: "507f1f77bcf86cd799439011" }).error, undefined);
  assert.ok(fieldParamsSchema.validate({ moduleKey: "students", id: "not-an-object-id" }).error);
});

test("create and update validation reject protected, unknown, and unsafe payload keys", () => {
  for (const protectedKey of ["moduleKey", "tenantId", "key", "createdBy", "updatedBy"]) {
    assert.ok(createFieldSchema.validate({ ...validCreateBody(), [protectedKey]: "client-value" }).error, protectedKey);
  }
  assert.ok(createFieldSchema.validate({ ...validCreateBody(), unexpected: true }).error);
  assert.ok(updateFieldSchema.validate({ tenantId: "tenant-b" }).error);
  assert.ok(createFieldSchema.validate({ label: "Status", type: "singleSelect" }).error);
  assert.ok(createFieldSchema.validate({ label: "Status", type: "singleSelect", options: [{ label: "New", value: "new" }, { label: "Duplicate", value: "new" }] }).error);
  assert.ok(createFieldSchema.validate({ ...validCreateBody(), validation: JSON.parse('{"__proto__":{"polluted":true}}') }).error);
});

test("validation accepts every supported field type and type-specific validation keys", () => {
  const cases = [
    ["text", { minLength: 1, maxLength: 100, pattern: "^[A-Z]+$" }],
    ["email", { maxLength: 254 }],
    ["phone", { pattern: "^0" }],
    ["url", { maxLength: 2048 }],
    ["percent", { min: 0, max: 100, decimals: 2 }],
    ["currency", { min: 0, max: 1000000, decimals: 0 }],
    ["dateTime", { minDateTime: "2026-01-01T00:00:00.000Z" }],
    ["checkbox", {}],
    ["file", { maxSizeMb: 10, allowedMimeTypes: ["application/pdf"] }],
    ["image", { maxSizeMb: 10, allowedMimeTypes: ["image/png"] }],
  ] as const;

  for (const [type, validation] of cases) {
    const body: Record<string, unknown> = { label: `Field ${type}`, type, validation };
    assert.equal(createFieldSchema.validate(body).error, undefined, type);
  }
});

test("rejects unsafe patterns and exposes only bounded maxSizeMb file configuration", () => {
  assert.ok(createFieldSchema.validate({
    label: "Unsafe pattern",
    type: "text",
    validation: { pattern: "^(a+)+$" },
  }).error);
  assert.equal(createFieldSchema.validate({
    label: "Safe pattern",
    type: "text",
    validation: { pattern: "^[A-Z]+$" },
  }).error, undefined);

  for (const maxSizeMb of [0, 0.5, 101]) {
    assert.ok(createFieldSchema.validate({ label: "File", type: "file", validation: { maxSizeMb } }).error);
    assert.ok(updateFieldSchema.validate({ type: "file", validation: { maxSizeMb } }).error);
  }
  for (const maxSizeMb of [1, 100]) {
    assert.equal(createFieldSchema.validate({ label: "File", type: "file", validation: { maxSizeMb } }).error, undefined);
    assert.equal(updateFieldSchema.validate({ type: "file", validation: { maxSizeMb } }).error, undefined);
  }
  assert.ok(createFieldSchema.validate({ label: "Legacy", type: "file", validation: { maxFileSize: 1000 } }).error);
});

test("custom-field router returns JSON 400 for invalid module, id, body, and query", async () => {
  const cases: Array<[string, string, string, unknown?]> = [
    ["GET", "/custom-fields/payments", "invalid module"],
    ["PATCH", "/custom-fields/students/not-an-object-id", "invalid id", { label: "Updated" }],
    ["POST", "/custom-fields/students", "invalid body", { label: "", type: "text" }],
    ["GET", "/custom-fields/students?includeArchived=invalid", "invalid query"],
  ];

  for (const [method, path, label, body] of cases) {
    const response = await requestRouter(customFieldRouter, "/custom-fields", method, path, body);
    assert.equal(response.status, 400, label);
    assert.match(response.contentType ?? "", /^application\/json/, label);
    assert.equal((JSON.parse(response.raw) as { success: boolean }).success, false, label);
  }
});

test("student-management router exposes the literal documented custom field endpoint", async () => {
  const routerSource = readFileSync(new URL("../router.ts", import.meta.url), "utf8");
  assert.match(routerSource, /studentManagementRouter\.use\("\/student-management\/custom-fields", (?:[^,]+, )*customFieldRoutes\)/);
});

test("controller derives tenant and actor from authentication and normalizes hidden required fields in the service", async () => {
  const calls: any[] = [];
  const previousService = CustomFieldController.service;
  CustomFieldController.service = {
    async create(context: unknown, input: unknown) {
      calls.push({ context, input });
      return { id: "field-1", ...(input as object) };
    },
  } as any;

  const req = {
    user: { uid: "actor-a", companyCode: "tenant-a", centerId: "center-a", role: "manager" },
    params: { moduleKey: "students" },
    body: { ...validCreateBody(), tenantId: "tenant-b" },
  } as any;
  const res = responseCapture();

  try {
    await CustomFieldController.create(req, res as unknown as Response, (() => { throw new Error("unexpected next"); }) as NextFunction);
    assert.deepEqual(calls, [{
      context: { tenantId: "tenant-a", actorId: "actor-a" },
      input: { moduleKey: "students", ...validCreateBody() },
    }]);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body, { success: true, data: { id: "field-1", moduleKey: "students", ...validCreateBody() } });
  } finally {
    CustomFieldController.service = previousService;
  }
});

test("list restricts includeArchived to managing roles", async () => {
  const calls: any[] = [];
  const previousService = CustomFieldController.service;
  CustomFieldController.service = {
    async list(...args: unknown[]) {
      calls.push(args);
      return [];
    },
  } as any;

  try {
    for (const [role, includeArchived] of [["user", false], ["manager", true]] as const) {
      const res = responseCapture();
      await CustomFieldController.list({ user: { uid: "actor-a", companyCode: "tenant-a", centerId: "center-a", role }, params: { moduleKey: "students" }, query: { includeArchived: true } } as any, res as unknown as Response, (() => { throw new Error("unexpected next"); }) as NextFunction);
    }
    assert.deepEqual(calls, [["tenant-a", "students", false], ["tenant-a", "students", true]]);
  } finally {
    CustomFieldController.service = previousService;
  }
});

test("archive and restore call their corresponding tenant-scoped service methods", async () => {
  const calls: any[] = [];
  const previousService = CustomFieldController.service;
  CustomFieldController.service = {
    async archive(...args: unknown[]) { calls.push(["archive", ...args]); return { isArchived: true }; },
    async restore(...args: unknown[]) { calls.push(["restore", ...args]); return { isArchived: false }; },
  } as any;
  const base = { user: { uid: "actor-a", companyCode: "tenant-a", centerId: "center-a", role: "admin" }, params: { moduleKey: "students", id: "507f1f77bcf86cd799439011" } } as any;
  try {
    await CustomFieldController.archive(base, responseCapture() as unknown as Response, (() => { throw new Error("unexpected next"); }) as NextFunction);
    await CustomFieldController.restore(base, responseCapture() as unknown as Response, (() => { throw new Error("unexpected next"); }) as NextFunction);
    assert.deepEqual(calls, [
      ["archive", { tenantId: "tenant-a", actorId: "actor-a" }, "students", "507f1f77bcf86cd799439011"],
      ["restore", { tenantId: "tenant-a", actorId: "actor-a" }, "students", "507f1f77bcf86cd799439011"],
    ]);
  } finally {
    CustomFieldController.service = previousService;
  }
});

test("controller returns a conflict response for domain duplicate errors", async () => {
  const previousService = CustomFieldController.service;
  CustomFieldController.service = { async create() { throw new Error("Trường tùy chỉnh này đã bị trùng."); } } as any;
  const res = responseCapture();
  try {
    await CustomFieldController.create({ user: { uid: "actor-a", companyCode: "tenant-a", centerId: "center-a" }, params: { moduleKey: "students" }, body: validCreateBody() } as any, res as unknown as Response, (() => { throw new Error("unexpected next"); }) as NextFunction);
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, { success: false, error: "Trường tùy chỉnh này đã bị trùng." });
  } finally {
    CustomFieldController.service = previousService;
  }
});

test("POST /student-management/custom-fields/:moduleKey/:id/delete invokes delete service and returns success", async () => {
  const previousService = CustomFieldController.service;
  let deletedId = "";
  CustomFieldController.service = {
    async delete(context: any, moduleKey: string, id: string) {
      deletedId = id;
    }
  } as any;
  try {
    const response = await requestRouter(customFieldRouter, "/custom-fields", "POST", "/custom-fields/students/669865fae3bbab7f00000001/delete");
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.raw), { success: true });
    assert.equal(deletedId, "669865fae3bbab7f00000001");
  } finally {
    CustomFieldController.service = previousService;
  }
});
