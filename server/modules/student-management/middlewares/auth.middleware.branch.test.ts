import assert from "node:assert/strict";
import type { Response } from "express";
import { it, vi } from "vitest";

vi.mock("../../../middleware/auth", () => ({
  requireAuth(req: any, _res: Response, next: () => void) {
    req.user = req.authenticatedUser;
    next();
  },
}));

import { adminUnassignedAuthMiddleware, authMiddleware } from "./auth.middleware";

function invoke(role: string, branchId?: string) {
  const req = {
    authenticatedUser: {
      id: role + "-user",
      email: role + "@example.com",
      role,
      companyCode: "ACME",
      branchId,
    },
    method: "GET",
  } as any;
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  let passed = false;
  authMiddleware(req, res as unknown as Response, () => { passed = true; });
  return { req, res, passed };
}

it("rejects branchless branch-pinned roles on authenticated reads", () => {
  for (const role of ["manager", "branch_owner"]) {
    const result = invoke(role);
    assert.equal(result.passed, false, role);
    assert.equal(result.res.statusCode, 400, role);
    assert.match(String((result.res.body as { error?: string })?.error), /chi nh/i, role);
  }
});

it("rejects a branchless admin on normal student routes", () => {
  const result = invoke("admin");
  assert.equal(result.passed, false);
  assert.equal(result.res.statusCode, 400);
  assert.match(String((result.res.body as { error?: string })?.error), /chi nh/i);
});

it("allows tenant-scoped roles when an authenticated branch is present", () => {
  for (const role of ["admin", "manager", "branch_owner"]) {
    const result = invoke(role, "branch-a");
    assert.equal(result.passed, true, role);
    assert.equal(result.req.user.branchId, "branch-a", role);
  }
});

it("preserves branchless superadmin and legacy user compatibility", () => {
  assert.equal(invoke("superadmin").passed, true);
  assert.equal(invoke("user").passed, true);
});

it("allows only admins through the explicit unassigned-student middleware", () => {
  const adminReq = {
    authenticatedUser: { id: "admin-user", email: "admin@example.com", role: "admin", companyCode: "ACME" },
  } as any;
  const adminRes = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json() { return this; } };
  let adminPassed = false;
  adminUnassignedAuthMiddleware(adminReq, adminRes as unknown as Response, () => { adminPassed = true; });
  assert.equal(adminPassed, true);

  const managerReq = {
    authenticatedUser: { id: "manager-user", email: "manager@example.com", role: "manager", companyCode: "ACME", branchId: "branch-a" },
  } as any;
  const managerRes = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json() { return this; } };
  let managerPassed = false;
  adminUnassignedAuthMiddleware(managerReq, managerRes as unknown as Response, () => { managerPassed = true; });
  assert.equal(managerPassed, false);
  assert.equal(managerRes.statusCode, 403);
});