import assert from "node:assert/strict";
import { StudentController } from '../controllers/student.controller';
import { afterEach, it, vi } from "vitest";
import { Student } from "../models/student.model";
import { StudentService } from "./student.service";

const ownerScope = ["shared-owner"];
const branchA = "branch-a";
const branchB = "branch-b";

vi.mock('../utils/auth.util', async () => {
  const actual = await vi.importActual<typeof import('../utils/auth.util')>('../utils/auth.util');
  return {
    ...actual,
    getAllowedOwnerIds: vi.fn(async () => ownerScope),
    getCenterOwnerIds: vi.fn(async () => ownerScope),
  };
});

function expectedOwnerAndBranchScope(extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    ownerId: { $in: ownerScope },
    branchId: branchA,
  };
}

afterEach(() => vi.restoreAllMocks());

it('forwards the authenticated selected branch to every scoped student action', async () => {
  const getStudents = vi.spyOn(StudentService, 'getStudents').mockResolvedValue({ students: [], total: 0, page: 1, limit: 1, totalPages: 0 });
  const getStudentById = vi.spyOn(StudentService, 'getStudentById').mockResolvedValue({ _id: 'student-a' } as any);
  const updateStudent = vi.spyOn(StudentService, 'updateStudent').mockResolvedValue({ _id: 'student-a' } as any);
  const deleteStudent = vi.spyOn(StudentService, 'deleteStudent').mockResolvedValue({ _id: 'student-a' } as any);
  const bulkDeleteStudents = vi.spyOn(StudentService, 'bulkDeleteStudents').mockResolvedValue(1);
  const markInstallmentPaid = vi.spyOn(StudentService, 'markInstallmentPaid').mockResolvedValue({ success: true });
  const response: any = { status: () => response, json: () => response };
  const user = { uid: 'shared-owner', role: 'admin', centerId: 'acme', companyCode: 'acme', branchId: branchA };

  await StudentController.getList({ user, query: {} } as any, response, () => {});
  await StudentController.getDetail({ user, params: { id: 'student-a' } } as any, response, () => {});
  await StudentController.update({ user, params: { id: 'student-a' }, body: {} } as any, response);
  await StudentController.delete({ user, params: { id: 'student-a' } } as any, response, () => {});
  await StudentController.bulkDelete({ user, body: { ids: ['student-a'] } } as any, response, () => {});
  await StudentController.markInstallmentPaid({ user, params: { id: 'student-a', no: '1' } } as any, response);

  assert.equal(getStudents.mock.calls[0]?.[2], branchA);
  assert.equal(getStudentById.mock.calls[0]?.[2], branchA);
  assert.equal(updateStudent.mock.calls[0]?.[5], branchA);
  assert.equal(deleteStudent.mock.calls[0]?.[2], branchA);
  assert.equal(bulkDeleteStudents.mock.calls[0]?.[2], branchA);
  assert.equal(markInstallmentPaid.mock.calls[0]?.[3], branchA);
});

it("scopes student list and count queries to the selected branch when owners overlap", async () => {
  const countDocuments = vi.spyOn(Student as any, "countDocuments").mockResolvedValue(0);
  const find = vi.spyOn(Student as any, "find").mockImplementation(() => ({
    sort: () => ({ skip: () => ({ limit: async () => [] }) }),
  }));

  await StudentService.getStudents(ownerScope, {}, branchA);

  assert.deepEqual(countDocuments.mock.calls[0]?.[0], expectedOwnerAndBranchScope());
  assert.deepEqual(find.mock.calls[0]?.[0], expectedOwnerAndBranchScope());
});

it("does not select a same-owner student from another branch", async () => {
  const findOne = vi.spyOn(Student as any, "findOne").mockImplementation(async (query: Record<string, unknown>) => (
    query.branchId === branchA ? { _id: "student-a" } : null
  ));

  const selected = await StudentService.getStudentById(ownerScope, "student-a", branchA);
  const otherBranch = await StudentService.getStudentById(ownerScope, "student-a", branchB);

  assert.deepEqual(findOne.mock.calls[0]?.[0], expectedOwnerAndBranchScope({ _id: "student-a" }));
  assert.deepEqual(findOne.mock.calls[1]?.[0], {
    _id: "student-a",
    ownerId: { $in: ownerScope },
    branchId: branchB,
  });
  assert.deepEqual(selected, { _id: "student-a" });
  assert.equal(otherBranch, null);
});

it("scopes the update preload query to the selected branch", async () => {
  const findOne = vi.spyOn(Student as any, "findOne").mockResolvedValue({ ownerId: "shared-owner" });
  vi.spyOn(StudentService.customFieldWrites, "prepareUpdate").mockResolvedValue({});
  vi.spyOn(Student as any, "findOneAndUpdate").mockResolvedValue({ _id: "student-a" });

  await StudentService.updateStudent(ownerScope, ownerScope, "student-a", {}, {
    tenantId: "acme",
    moduleKey: "students",
    actorRole: "admin",
  }, branchA);

  assert.deepEqual(findOne.mock.calls[0]?.[0], expectedOwnerAndBranchScope({ _id: "student-a" }));
});

it("scopes delete and bulk-delete selection queries to the selected branch", async () => {
  const findOneAndDelete = vi.spyOn(Student as any, "findOneAndDelete").mockResolvedValue(null);
  const find = vi.spyOn(Student as any, "find").mockImplementation(() => ({ select: async () => [] }));
  const firstId = "507f1f77bcf86cd799439011";
  const secondId = "507f1f77bcf86cd799439012";

  await StudentService.deleteStudent(ownerScope, "student-a", branchA);
  await StudentService.bulkDeleteStudents(ownerScope, [firstId, secondId], branchA);

  assert.deepEqual(findOneAndDelete.mock.calls[0]?.[0], expectedOwnerAndBranchScope({ _id: "student-a" }));
  assert.deepEqual(find.mock.calls[0]?.[0], expectedOwnerAndBranchScope({ _id: { $in: [firstId, secondId] } }));
});

it("scopes installment payment student lookup to the selected branch", async () => {
  const findOne = vi.spyOn(Student as any, "findOne").mockResolvedValue(null);

  await StudentService.markInstallmentPaid(ownerScope, "student-a", 1, branchA);

  assert.deepEqual(findOne.mock.calls[0]?.[0], expectedOwnerAndBranchScope({ _id: "student-a" }));
});

it("scopes bulk-import uniqueness lookup to the selected branch", async () => {
  const find = vi.spyOn(Student as any, "find").mockImplementation(() => ({ select: async () => [] }));

  await StudentService.bulkCreateStudents("shared-owner", ownerScope, [], "shared-owner", branchA);

  assert.deepEqual(find.mock.calls[0]?.[0], expectedOwnerAndBranchScope());
});
