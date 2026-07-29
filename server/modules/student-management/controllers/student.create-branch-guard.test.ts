import assert from "node:assert/strict";
import { afterEach, it, vi } from "vitest";
import { StudentController } from "./student.controller";
import { StudentService } from "../services/student.service";

vi.mock("../utils/auth.util", async () => {
  const actual = await vi.importActual<typeof import("../utils/auth.util")>("../utils/auth.util");
  return {
    ...actual,
    getCenterOwnerIds: vi.fn(async () => ["shared-owner"]),
    resolveCreateOwnerId: vi.fn(async () => "shared-owner"),
  };
});

afterEach(() => vi.restoreAllMocks());

function buildRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (payload: unknown) => { res.body = payload; return res; };
  return res;
}

it("rejects student creation by an admin with no branch selected (Tất cả chi nhánh)", async () => {
  const createStudent = vi.spyOn(StudentService, "createStudent");
  const res = buildRes();
  const user = { uid: "shared-owner", role: "admin", centerId: "acme", companyCode: "acme" };

  await StudentController.create({ user, body: { phone: "0900000000" } } as any, res);

  assert.equal(res.statusCode, 400);
  assert.match(String((res.body as { error?: string })?.error || ""), /chi nh/i);
  assert.equal(createStudent.mock.calls.length, 0);
});

it("allows student creation once a branch is selected", async () => {
  const createStudent = vi.spyOn(StudentService, "createStudent").mockResolvedValue({ _id: "student-a" } as any);
  const res = buildRes();
  const user = { uid: "shared-owner", role: "admin", centerId: "acme", companyCode: "acme", branchId: "branch-a" };

  await StudentController.create({ user, body: { phone: "0900000000" } } as any, res);

  assert.equal(createStudent.mock.calls.length, 1);
  assert.equal((createStudent.mock.calls[0]?.[2] as any)?.branchId, "branch-a");
});
