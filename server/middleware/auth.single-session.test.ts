import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import type { Response } from "express";
import { UserModel } from "../model/user.model";
import { requireAuth } from "./auth";
import { getJwtAccessSecret } from "../config/env";

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

function invoke(token: string, activeSessionId: string) {
  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: () => ({
      lean: async () => ({ branchId: "branch-1", activeSessionId }),
    }),
  } as any);
  const req = { headers: { authorization: `Bearer ${token}` }, method: "GET", originalUrl: "/api/v1/auth/me" } as any;
  const res = makeResponse();
  let passed = false;
  return requireAuth(req, res as unknown as Response, () => { passed = true; }).then(() => ({ req, res, passed }));
}

describe("requireAuth regular active session", () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET ||= "test-access-secret-at-least-32-characters";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a valid access token whose regular session was replaced", async () => {
    const token = jwt.sign({ id: "user-1", email: "user@example.com", role: "user", companyCode: "ACME", sid: "old-session" }, getJwtAccessSecret(), { expiresIn: "15m" });
    const result = await invoke(token, "new-session");

    assert.equal(result.passed, false);
    assert.equal(result.res.statusCode, 401);
    assert.equal(result.res.body?.code, "SESSION_REPLACED");
  });

  it("accepts a regular access token with the current session", async () => {
    const token = jwt.sign({ id: "user-1", email: "user@example.com", role: "user", companyCode: "ACME", sid: "current-session" }, getJwtAccessSecret(), { expiresIn: "15m" });
    const result = await invoke(token, "current-session");

    assert.equal(result.passed, true);
    assert.equal(result.req.user.sessionId, "current-session");
  });
});
