import assert from "node:assert/strict";
import { afterEach, it, vi } from "vitest";
import { Course } from "../models/course.model";
import { Batch } from "../models/batch.model";
import { Exam } from "../models/exam.model";
import { Resource } from "../models/resource.model";
import { CommissionLevel } from "../models/commission-level.model";
import { Partner } from "../models/partner.model";
import { Student } from "../models/student.model";
import { User } from "../models/user.model";
import { CourseCategory } from "../models/course-category.model";
import { ResourceCategory } from "../models/resource-category.model";
import { CourseService } from "./course.service";
import { BatchService } from "./batch.service";
import { ExamService } from "./exam.service";
import { ResourceService } from "./resource.service";
import { PartnerService } from "./partner.service";
import { CourseCategoryService } from "./course-category.service";
import { ResourceCategoryService } from "./resource-category.service";

const ownerScope = ["shared-owner"];
const branchA = "branch-a";
const branchB = "branch-b";

afterEach(() => vi.restoreAllMocks());

it("scopes course list/detail/delete queries to the selected branch", async () => {
  const countDocuments = vi.spyOn(Course as any, "countDocuments").mockResolvedValue(0);
  const find = vi.spyOn(Course as any, "find").mockImplementation(() => ({
    sort: () => ({ skip: () => ({ limit: async () => [] }) }),
  }));
  await CourseService.getCourses(ownerScope, {}, branchA);
  assert.deepEqual(countDocuments.mock.calls[0]?.[0], { ownerId: { $in: ownerScope }, branchId: branchA });
  assert.deepEqual(find.mock.calls[0]?.[0], { ownerId: { $in: ownerScope }, branchId: branchA });

  const findOne = vi.spyOn(Course as any, "findOne").mockImplementation(async (query: Record<string, unknown>) => (
    query.branchId === branchA ? null : null
  ));
  await CourseService.getCourseById(ownerScope, "course-a", branchA);
  await CourseService.getCourseById(ownerScope, "course-a", branchB);
  assert.equal((findOne.mock.calls[0]?.[0] as any).branchId, branchA);
  assert.equal((findOne.mock.calls[1]?.[0] as any).branchId, branchB);

  vi.spyOn(BatchService, "countActiveByCourse").mockResolvedValue(new Map());
  const findOneAndDelete = vi.spyOn(Course as any, "findOneAndDelete").mockResolvedValue(null);
  await CourseService.deleteCourse(ownerScope, "course-a", branchA);
  assert.equal((findOneAndDelete.mock.calls[0]?.[0] as any).branchId, branchA);
});

it("scopes batch list/detail/delete queries to the selected branch", async () => {
  vi.spyOn(Course as any, "find").mockReturnValue({ select: () => Promise.resolve([]) });
  vi.spyOn(User as any, "find").mockReturnValue({ select: () => Promise.resolve([]) });
  const countDocuments = vi.spyOn(Batch as any, "countDocuments").mockResolvedValue(0);
  const find = vi.spyOn(Batch as any, "find").mockImplementation(() => ({
    sort: () => ({ skip: () => ({ limit: () => Promise.resolve([]) }) }),
  }));
  await BatchService.getBatches(ownerScope, {}, branchA);
  assert.equal((countDocuments.mock.calls[0]?.[0] as any).branchId, branchA);
  assert.equal((find.mock.calls[0]?.[0] as any).branchId, branchA);

  const findOneAndDelete = vi.spyOn(Batch as any, "findOneAndDelete").mockResolvedValue(null);
  await BatchService.deleteBatch(ownerScope, "batch-a", branchA);
  assert.equal((findOneAndDelete.mock.calls[0]?.[0] as any).branchId, branchA);
});

it("scopes exam list/detail/delete queries to the selected branch", async () => {
  const countDocuments = vi.spyOn(Exam as any, "countDocuments").mockResolvedValue(0);
  const find = vi.spyOn(Exam as any, "find").mockImplementation(() => ({
    sort: () => ({ skip: () => ({ limit: async () => [] }) }),
  }));
  await ExamService.getExams(ownerScope, {}, branchA);
  assert.equal((countDocuments.mock.calls[0]?.[0] as any).branchId, branchA);
  assert.equal((find.mock.calls[0]?.[0] as any).branchId, branchA);

  const findOneAndDelete = vi.spyOn(Exam as any, "findOneAndDelete").mockResolvedValue(null);
  await ExamService.deleteExam(ownerScope, "exam-a", branchA);
  assert.equal((findOneAndDelete.mock.calls[0]?.[0] as any).branchId, branchA);
});

it("scopes resource list/detail/delete queries to the selected branch", async () => {
  const countDocuments = vi.spyOn(Resource as any, "countDocuments").mockResolvedValue(0);
  const find = vi.spyOn(Resource as any, "find").mockImplementation(() => ({
    sort: () => ({ skip: () => ({ limit: async () => [] }) }),
  }));
  await ResourceService.getResources(ownerScope, {}, branchA);
  assert.equal((countDocuments.mock.calls[0]?.[0] as any).branchId, branchA);
  assert.equal((find.mock.calls[0]?.[0] as any).branchId, branchA);

  const findOneAndDelete = vi.spyOn(Resource as any, "findOneAndDelete").mockResolvedValue(null);
  await ResourceService.deleteResource(ownerScope, "resource-a", branchA);
  assert.equal((findOneAndDelete.mock.calls[0]?.[0] as any).branchId, branchA);
});

it("scopes commission-level list/delete queries to the selected branch", async () => {
  const find = vi.spyOn(CommissionLevel as any, "find").mockImplementation(() => ({ sort: async () => [] }));
  await PartnerService.getCommissionLevels(ownerScope, branchA);
  assert.equal((find.mock.calls[0]?.[0] as any).branchId, branchA);

  const findOneAndDelete = vi.spyOn(CommissionLevel as any, "findOneAndDelete").mockResolvedValue(null);
  await PartnerService.deleteCommissionLevel(ownerScope, "level-a", branchA);
  assert.equal((findOneAndDelete.mock.calls[0]?.[0] as any).branchId, branchA);
});

it("stamps partner creates and scopes partner queries to the selected branch", async () => {
  vi.spyOn(PartnerService.customFieldWrites, "prepareCreate").mockImplementation(async (_context, data) => data);
  vi.spyOn(Partner as any, "findOne").mockResolvedValue(null);
  vi.spyOn(Student as any, "find").mockImplementation(() => ({ select: async () => [] }));
  vi.spyOn(CommissionLevel as any, "find").mockImplementation(() => ({ sort: async () => [] }));
  const save = vi.spyOn(Partner.prototype as any, "save").mockImplementation(async function () { return this; });
  const countDocuments = vi.spyOn(Partner as any, "countDocuments").mockResolvedValue(0);
  const find = vi.spyOn(Partner as any, "find").mockImplementation(() => ({
    sort: () => ({ skip: () => ({ limit: async () => [] }) }),
  }));

  await PartnerService.createPartner(
    "shared-owner",
    { name: "Partner A", phone: "0900000001", commissionType: "fixed", commissionValue: 0, branchId: branchA },
    { tenantId: "ACME", moduleKey: "partners" },
  );
  assert.equal((save.mock.instances[0] as any).branchId, branchA);

  await PartnerService.getPartners(ownerScope, {}, branchA);
  assert.equal((countDocuments.mock.calls[0]?.[0] as any).branchId, branchA);
  assert.equal((find.mock.calls[0]?.[0] as any).branchId, branchA);

  const findOneAndDelete = vi.spyOn(Partner as any, "findOneAndDelete").mockResolvedValue(null);
  vi.spyOn(Student as any, "countDocuments").mockResolvedValue(0);
  await PartnerService.deletePartner(ownerScope, "partner-a", branchA);
  assert.equal((findOneAndDelete.mock.calls[0]?.[0] as any).branchId, branchA);
});
it("scopes course/resource category list queries to the selected branch", async () => {
  const courseFind = vi.spyOn(CourseCategory as any, "find").mockImplementation(() => ({ sort: async () => [] }));
  await CourseCategoryService.getCategories(ownerScope, {}, branchA);
  assert.equal((courseFind.mock.calls[0]?.[0] as any).branchId, branchA);

  const resourceFind = vi.spyOn(ResourceCategory as any, "find").mockImplementation(() => ({ sort: async () => [] }));
  await ResourceCategoryService.getCategories(ownerScope, branchA);
  assert.equal((resourceFind.mock.calls[0]?.[0] as any).branchId, branchA);
});
