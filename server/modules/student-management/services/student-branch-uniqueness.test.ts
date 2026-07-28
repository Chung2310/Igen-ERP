import assert from "node:assert/strict";
import { afterEach, it, vi } from "vitest";
import { Student } from "../models/student.model";
import { StudentService } from "./student.service";

const ownerScope = ["shared-owner"];
const branchA = "branch-a";

afterEach(() => vi.restoreAllMocks());

it("does not let a branch-B phone block manual creation in branch A", async () => {
  const uniquenessQueries: Record<string, unknown>[] = [];
  vi.spyOn(Student as any, "findOne").mockImplementation((query: Record<string, unknown>) => ({
    select: async () => {
      uniquenessQueries.push(query);
      return query.branchId === branchA ? null : { _id: "student-b" };
    },
  }));
  vi.spyOn(Student.prototype as any, "save").mockImplementation(async function (this: any) { return this; });

  await StudentService.createStudent("shared-owner", ownerScope, {
    fullName: "Student A",
    phone: "0900 000 001",
    email: "STUDENT@EXAMPLE.COM ",
    idCard: "001 002 003 004",
    branchId: branchA,
  });

  assert.deepEqual(uniquenessQueries, [
    { ownerId: { $in: ownerScope }, branchId: branchA, email: "student@example.com" },
    { ownerId: { $in: ownerScope }, branchId: branchA, phone: "0900000001" },
    { ownerId: { $in: ownerScope }, branchId: branchA, idCard: "001002003004" },
  ]);
});

it("does not leak a branch-B duplicate during a branch-A manual update", async () => {
  const existingStudent = { _id: "student-a", ownerId: "shared-owner", paymentHistory: [] };
  const uniquenessQueries: Record<string, unknown>[] = [];
  vi.spyOn(Student as any, "findOne").mockImplementation((query: Record<string, unknown>) => {
    if (query._id === "student-a") return Promise.resolve(existingStudent);
    return {
      select: async () => {
        uniquenessQueries.push(query);
        return query.branchId === branchA ? null : { _id: "student-b" };
      },
    };
  });
  vi.spyOn(StudentService.customFieldWrites, "prepareUpdate").mockResolvedValue({
    phone: "0900000002",
    email: "student2@example.com",
    idCard: "005006007008",
  });
  vi.spyOn(Student as any, "findOneAndUpdate").mockResolvedValue({ _id: "student-a" });

  await StudentService.updateStudent(
    ownerScope,
    ownerScope,
    "student-a",
    { phone: "0900000002", email: "student2@example.com", idCard: "005006007008" },
    { tenantId: "ACME", moduleKey: "students", actorRole: "admin" },
    branchA,
  );

  assert.deepEqual(uniquenessQueries, [
    { ownerId: { $in: ownerScope }, branchId: branchA, email: "student2@example.com", _id: { $ne: "student-a" } },
    { ownerId: { $in: ownerScope }, branchId: branchA, phone: "0900000002", _id: { $ne: "student-a" } },
    { ownerId: { $in: ownerScope }, branchId: branchA, idCard: "005006007008", _id: { $ne: "student-a" } },
  ]);
});
