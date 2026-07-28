import assert from "node:assert/strict";
import type { Response } from "express";
import { afterEach, it, vi } from "vitest";
import { StudentController } from "../controllers/student.controller";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { StudentService } from "./student.service";

type ResponseCapture = {
  statusCode: number;
  body: unknown;
  status(code: number): ResponseCapture;
  json(body: unknown): ResponseCapture;
};

function responseCapture(): ResponseCapture {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function mockBranchOwnerResolution() {
  vi.spyOn(User as any, "find").mockImplementation(() => ({
    select: async () => [{ _id: { toString: () => "branch-owner-a" } }],
  }));
  vi.spyOn(User as any, "findOne").mockImplementation(() => ({
    sort: () => ({
      select: async () => ({ _id: { toString: () => "branch-owner-a" } }),
    }),
  }));
}

afterEach(() => vi.restoreAllMocks());

const branchAdmin = {
  uid: "global-admin",
  role: "admin",
  centerId: "ACME",
  companyCode: "ACME",
  branchId: "branch-a",
};

it("manual student creation assigns the selected branch owner and branch", async () => {
  mockBranchOwnerResolution();
  const calls: unknown[][] = [];
  vi.spyOn(StudentService as any, "createStudent").mockImplementation(async (...args: unknown[]) => {
    calls.push(args);
    return { _id: "student-a" };
  });

  const res = responseCapture();
  await StudentController.create({ user: branchAdmin, body: { fullName: "Student A", phone: "0900000000" } } as any, res as unknown as Response);

  assert.equal(res.statusCode, 201);
  assert.equal(calls[0]?.[0], "branch-owner-a");
  assert.equal((calls[0]?.[2] as { branchId?: string }).branchId, "branch-a");
});

it("bulk student import assigns the selected branch owner and branch", async () => {
  mockBranchOwnerResolution();
  const calls: unknown[][] = [];
  vi.spyOn(StudentService as any, "bulkCreateStudents").mockImplementation(async (...args: unknown[]) => {
    calls.push(args);
    return { importedCount: 1, skippedCount: 0, errors: [] };
  });

  const res = responseCapture();
  await StudentController.bulkCreate({ user: branchAdmin, body: { students: [{ fullName: "Student A", phone: "0900000000" }] }, query: {} } as any, res as unknown as Response, () => {});

  assert.equal(res.statusCode, 200);
  assert.equal(calls[0]?.[3], "branch-owner-a");
  assert.equal(calls[0]?.[4], "branch-a");
});

it("rejects a branch import that has no branch owner before querying students", async () => {
  const databaseReached = new Error("database should not be queried without a branch owner");
  vi.spyOn(Student as any, "find").mockImplementation(() => {
    throw databaseReached;
  });

  await assert.rejects(
    () => StudentService.bulkCreateStudents("global-admin", ["global-admin"], [], undefined, "branch-a"),
    /Không thể xác định chủ sở hữu thuộc chi nhánh đã chọn/,
  );
});
