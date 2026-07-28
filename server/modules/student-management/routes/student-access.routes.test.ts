import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, it, vi } from "vitest";
import { studentManagementRouter } from "../router";
import { User } from "../models/user.model";
import { StudentService } from "../services/student.service";
import * as studentValidation from "../validations/student.validation";
import studentRouter from "./student.routes";

afterEach(() => vi.restoreAllMocks());

function responseCapture() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

async function request(method: string, path: string, body?: unknown) {
  const app = express();
  app.use(express.json());
  app.use("/api", studentManagementRouter);
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error?.isJoi ? 400 : 500).json({ success: false, error: error?.message });
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch("http://127.0.0.1:" + port + path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as any };
  } finally {
    server.close();
    await once(server, "close");
  }
}

it("exports installment params validation for id and a positive integer number", () => {
  const schema = (studentValidation as Record<string, any>).installmentParamsSchema;
  assert.ok(schema, "installmentParamsSchema should be exported");
  assert.equal(schema.validate({ id: "507f1f77bcf86cd799439011", no: "1" }).error, undefined);
  assert.ok(schema.validate({ id: "507f1f77bcf86cd799439011", no: "0" }).error);
  assert.ok(schema.validate({ id: "507f1f77bcf86cd799439011", no: "1.5" }).error);
});

it("the live installment route validation reaches the branch-scoped controller service call", async () => {
  const routeLayer = (studentRouter as any).stack.find((layer: any) => layer.route?.path === "/:id/installment/:no/mark-paid");
  assert.ok(routeLayer, "installment route should exist");
  const handlers = routeLayer.route.stack.map((layer: any) => layer.handle);
  const validateParams = handlers[1];
  const controller = handlers[2];
  const req = {
    user: { uid: "user-a", role: "user", centerId: "ACME", branchId: "branch-a" },
    params: { id: "507f1f77bcf86cd799439011", no: "1" },
  } as any;
  const res = responseCapture();
  let validationError: unknown;
  let validationPassed = false;
  validateParams(req, res, (error?: unknown) => {
    validationError = error;
    validationPassed = !error;
  });
  assert.equal(validationError, undefined);
  assert.equal(validationPassed, true);

  vi.spyOn(User as any, "find").mockImplementation(() => ({ select: async () => [] }));
  const markPaid = vi.spyOn(StudentService, "markInstallmentPaid").mockResolvedValue({ success: true });
  await controller(req, res);

  assert.deepEqual(markPaid.mock.calls[0], ["user-a", "507f1f77bcf86cd799439011", 1, "branch-a"]);
  assert.equal(res.statusCode, 200);
});

it("allows anonymous public registration and lookup to reach their public handlers", async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    const registration = await request("POST", "/api/students/public-register", {});
    const lookup = await request("GET", "/api/students/public-lookup");
    assert.equal(registration.status, 400);
    assert.equal(registration.body.success, false);
    assert.equal(lookup.status, 400);
    assert.equal(lookup.body.success, false);
  } finally {
    console.warn = originalWarn;
  }
});

it("keeps authenticated student endpoints protected", async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    const response = await request("GET", "/api/students");
    assert.equal(response.status, 401);
  } finally {
    console.warn = originalWarn;
  }
});
