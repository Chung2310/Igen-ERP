import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import express from "express";
import { ConflictError, InternalError } from "../errors/app-error";
import { createApiErrorHandler } from "./api-error-handler";
import { apiNotFound } from "./api-not-found";
import { requestContextMiddleware } from "./request-context";
import { redactLogData } from "../modules/student-management/config/logger";

test("terminal middleware returns the exact correlated error envelope", async () => {
  const logs: Array<{ level: string; event: unknown }> = [];
  const app = express();
  app.use(requestContextMiddleware);
  app.get("/conflict", () => { throw new ConflictError("PARTNER_PHONE_ALREADY_EXISTS", "Số điện thoại đã tồn tại.", { field: "phone" }); });
  app.get("/internal", () => { throw new InternalError({ cause: new Error("db-secret") }); });
  app.use(apiNotFound);
  app.use(createApiErrorHandler({
    warn: (event) => logs.push({ level: "warn", event }),
    error: (event) => logs.push({ level: "error", event }),
  }));
  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const conflict = await fetch(`${base}/conflict`, { headers: { "x-request-id": "test-request-1" } });
    assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), {
      ok: false,
      error: {
        code: "PARTNER_PHONE_ALREADY_EXISTS",
        message: "Số điện thoại đã tồn tại.",
        details: { field: "phone" },
        requestId: "test-request-1",
      },
    });
    assert.equal(conflict.headers.get("x-request-id"), "test-request-1");

    const internal = await fetch(`${base}/internal`);
    const internalBody = await internal.json() as any;
    assert.equal(internal.status, 500);
    assert.equal(internalBody.error.code, "INTERNAL_ERROR");
    assert.equal(internalBody.error.message, "Đã xảy ra lỗi hệ thống.");
    assert.equal(JSON.stringify(internalBody).includes("db-secret"), false);

    const missing = await fetch(`${base}/missing`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json() as any).error.code, "API_ROUTE_NOT_FOUND");
    assert.deepEqual(logs.map(({ level }) => level), ["warn", "error", "warn"]);
    assert.equal((logs[1].event as any).error.cause.message, "db-secret");
    assert.deepEqual(redactLogData({ password: "secret", nested: { token: "jwt", safe: 1 } }), {
      password: "[REDACTED]",
      nested: { token: "[REDACTED]", safe: 1 },
    });
  } finally {
    server.close();
    await once(server, "close");
  }
});
test("delegates the original error after response headers were sent", () => {
  const source = new Error("stream failed");
  let delegated: unknown;
  const handler = createApiErrorHandler({ warn: () => {}, error: () => {} });
  handler(source, {} as any, { headersSent: true } as any, ((error: unknown) => { delegated = error; }) as any);
  assert.equal(delegated, source);
});