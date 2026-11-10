import mongoose from "mongoose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ examFindOne: vi.fn(), studentFind: vi.fn(), studentUpdateMany: vi.fn(), batchFindOne: vi.fn() }));

vi.mock("../models/exam.model", () => ({ Exam: { findOne: mocks.examFindOne } }));
vi.mock("../models/student.model", () => ({ Student: { find: mocks.studentFind, updateMany: mocks.studentUpdateMany } }));
vi.mock("../models/batch.model", () => ({ Batch: { findOne: mocks.batchFindOne } }));

import { ExamService } from "./exam.service";

describe("ExamService.getGradeRoster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns only registered students scoped to the selected exam owner and branch", async () => {
    const examId = "507f1f77bcf86cd799439021";
    const studentId = "507f1f77bcf86cd799439022";
    const exam = {
      _id: examId,
      ownerId: "exam-owner",
      branchId: "branch-a",
      results: [
        { studentId, score: 85, outcome: "Đậu" },
        { studentId: "507f1f77bcf86cd799439023", outcome: "Chưa có" },
      ],
    };
    mocks.examFindOne.mockResolvedValue(exam);
    const lean = vi.fn().mockResolvedValue([{ _id: studentId, fullName: "Nguyễn An", phone: "0912345678" }]);
    const select = vi.fn().mockReturnValue({ lean });
    mocks.studentFind.mockReturnValue({ select });

    const roster = await ExamService.getGradeRoster(["owner-a", "owner-b"], examId, "branch-a");

    expect(mocks.examFindOne).toHaveBeenCalledWith({ _id: examId, ownerId: { $in: ["owner-a", "owner-b"] }, branchId: "branch-a" });
    expect(mocks.studentFind).toHaveBeenCalledWith({
      _id: { $in: [studentId, "507f1f77bcf86cd799439023"] },
      ownerId: "exam-owner",
      branchId: "branch-a",
    });
    expect(select).toHaveBeenCalledWith("fullName phone");
    expect(roster).toEqual([{ _id: studentId, name: "Nguyễn An", phone: "0912345678", score: 85, outcome: "Đậu" }]);
  });

  it("returns null for an exam outside the caller's scope without querying students", async () => {
    mocks.examFindOne.mockResolvedValue(null);

    const roster = await ExamService.getGradeRoster("owner-a", "507f1f77bcf86cd799439021", "branch-a");

    expect(roster).toBeNull();
    expect(mocks.studentFind).not.toHaveBeenCalled();
  });
});

describe("ExamService.getAssignedStudents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it("lists only students currently assigned to the scoped exam", async () => {
    const examId = "507f1f77bcf86cd799439031";
    mocks.examFindOne.mockResolvedValue({ _id: examId, ownerId: "exam-owner", branchId: "branch-a" });
    const lean = vi.fn().mockResolvedValue([
      { _id: "507f1f77bcf86cd799439032", fullName: "Nguyễn An", phone: "0900000000", fee: "9000000" },
    ]);
    const select = vi.fn().mockReturnValue({ lean });
    mocks.studentFind.mockReturnValue({ select });

    const students = await ExamService.getAssignedStudents(["owner-a", "owner-b"], examId, "branch-a");

    expect(mocks.examFindOne).toHaveBeenCalledWith({ _id: examId, ownerId: { $in: ["owner-a", "owner-b"] }, branchId: "branch-a" });
    expect(mocks.studentFind).toHaveBeenCalledWith({ examId, ownerId: "exam-owner", branchId: "branch-a" });
    expect(select).toHaveBeenCalledWith("fullName phone");
    expect(students).toEqual([{ _id: "507f1f77bcf86cd799439032", name: "Nguyễn An", phone: "0900000000" }]);
    expect(JSON.stringify(students)).not.toMatch(/fee|PRIVATE-TUITION/);
  });

  it("returns null for an exam outside the caller scope", async () => {
    mocks.examFindOne.mockResolvedValue(null);

    await expect(ExamService.getAssignedStudents("owner-a", "507f1f77bcf86cd799439031", "branch-a")).resolves.toBeNull();
    expect(mocks.studentFind).not.toHaveBeenCalled();
  });
});

describe("ExamService.getEligibleStudents", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("offers only paid, unassigned students on the exam's scoped batch roster", async () => {
    const examId = "507f1f77bcf86cd799439041";
    const batchId = "507f1f77bcf86cd799439042";
    mocks.examFindOne.mockResolvedValue({ _id: examId, ownerId: "exam-owner", branchId: "branch-a", batchId, rank: "B2" });
    const batch = { learnerIds: ["student-1", "student-2", "student-3", "student-1"] };
    const batchQuery: any = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(batch),
    };
    mocks.batchFindOne.mockReturnValue(batchQuery);
    const students = [
      { _id: "student-1", fullName: "Nguyễn An", phone: "0900000001", fee: "1.000.000", paidAmount: 1_000_000 },
      { _id: "student-2", fullName: "Trần Bình", phone: "0900000002", fee: "1.000.000", paidAmount: 500_000 },
      { _id: "student-3", fullName: "Lê Chi", phone: "0900000003", fee: "1.000.000", paidAmount: 1_000_000, examId: "another-exam" },
    ];
    const studentQuery: any = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(students),
    };
    mocks.studentFind.mockReturnValue(studentQuery);

    const result = await ExamService.getEligibleStudents(["owner-a", "owner-b"], examId, "branch-a");

    expect(mocks.examFindOne).toHaveBeenCalledWith({ _id: examId, ownerId: { $in: ["owner-a", "owner-b"] }, branchId: "branch-a" });
    expect(mocks.batchFindOne).toHaveBeenCalledWith({ _id: batchId, ownerId: "exam-owner", branchId: "branch-a" });
    expect(mocks.studentFind).toHaveBeenCalledWith({ _id: { $in: ["student-1", "student-2", "student-3"] }, ownerId: "exam-owner", branchId: "branch-a" });
    expect(studentQuery.select).toHaveBeenCalledWith("fullName phone fee paidAmount examId exams.id rank");
    expect(result).toEqual([{ _id: "student-1", name: "Nguyễn An", phone: "0900000001" }]);
  });

  it("returns no choices when the exam has no batch and null when it is outside scope", async () => {
    mocks.examFindOne.mockResolvedValueOnce({ _id: "exam-1", batchId: "" }).mockResolvedValueOnce(null);

    await expect(ExamService.getEligibleStudents("owner-a", "exam-1", "branch-a")).resolves.toEqual([]);
    await expect(ExamService.getEligibleStudents("owner-a", "exam-2", "branch-a")).resolves.toBeNull();
    expect(mocks.batchFindOne).not.toHaveBeenCalled();
    expect(mocks.studentFind).not.toHaveBeenCalled();
  });
});

describe("ExamService.assignStudents", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("verifies the class roster and tuition, then updates student history and the exam roster atomically", async () => {
    const examId = "507f1f77bcf86cd799439051";
    const batchId = "507f1f77bcf86cd799439052";
    const studentId = "student-1";
    const session: any = { withTransaction: vi.fn(async (work: () => Promise<void>) => work()), endSession: vi.fn() };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    const exam: any = {
      _id: examId, ownerId: "exam-owner", branchId: "branch-a", batchId, name: "Thi sát hạch B2", tentativeDate: "2026-12-01",
      studentCount: 1, results: [{ studentId: "existing-student", outcome: "Chưa có" }], save: vi.fn().mockResolvedValue(undefined),
    };
    const examQuery: any = { session: vi.fn().mockResolvedValue(exam) };
    mocks.examFindOne.mockReturnValue(examQuery);
    const batchQuery: any = { session: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue({ learnerIds: [studentId] }) };
    mocks.batchFindOne.mockReturnValue(batchQuery);
    const studentQuery: any = { session: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([
      { _id: studentId, fullName: "Nguyễn An", fee: "1.000.000", paidAmount: 1_000_000, exams: [] },
    ]) };
    mocks.studentFind.mockReturnValue(studentQuery);
    mocks.studentUpdateMany.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

    const result = await ExamService.assignStudents("owner-a", examId, [studentId], "branch-a");

    expect(mocks.batchFindOne).toHaveBeenCalledWith({ _id: batchId, ownerId: "exam-owner", branchId: "branch-a" });
    expect(mocks.studentUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: [studentId] }, ownerId: "exam-owner", branchId: "branch-a", examId: { $in: ["", null] }, "exams.id": { $ne: examId } },
      expect.objectContaining({ $set: expect.objectContaining({ examId, status: ["Đang thi"] }) }),
      { session },
    );
    expect(exam.results).toContainEqual({ studentId, outcome: "Chưa có" });
    expect(exam.studentCount).toBe(2);
    expect(exam.save).toHaveBeenCalledWith({ session });
    expect(result).toEqual({ success: true, examName: "Thi sát hạch B2", assignedCount: 1 });
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it("rejects students outside the selected class before writing anything", async () => {
    const session: any = { withTransaction: vi.fn(async (work: () => Promise<void>) => work()), endSession: vi.fn() };
    vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    mocks.examFindOne.mockReturnValue({ session: vi.fn().mockResolvedValue({ _id: "exam-1", ownerId: "exam-owner", branchId: "branch-a", batchId: "batch-1" }) });
    mocks.batchFindOne.mockReturnValue({ session: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue({ learnerIds: ["class-student"] }) });

    await expect(ExamService.assignStudents("owner-a", "exam-1", ["other-student"], "branch-a")).rejects.toThrow("thuộc lớp của kỳ thi");
    expect(mocks.studentFind).not.toHaveBeenCalled();
    expect(mocks.studentUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects unpaid or already assigned students without updating either record", async () => {
    for (const student of [
      { _id: "student-1", fullName: "Chưa đóng phí", fee: "1.000.000", paidAmount: 0, exams: [] },
      { _id: "student-1", fullName: "Đã có kỳ thi", fee: "0", paidAmount: 0, examId: "other-exam", exams: [] },
    ]) {
      vi.clearAllMocks();
      const session: any = { withTransaction: vi.fn(async (work: () => Promise<void>) => work()), endSession: vi.fn() };
      vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
      const exam: any = { _id: "exam-1", ownerId: "exam-owner", branchId: "branch-a", batchId: "batch-1", name: "Kỳ thi", tentativeDate: "2026-12-01", results: [], studentCount: 0, save: vi.fn() };
      mocks.examFindOne.mockReturnValue({ session: vi.fn().mockResolvedValue(exam) });
      mocks.batchFindOne.mockReturnValue({ session: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue({ learnerIds: ["student-1"] }) });
      mocks.studentFind.mockReturnValue({ session: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([student]) });

      await expect(ExamService.assignStudents("owner-a", "exam-1", ["student-1"], "branch-a")).rejects.toThrow();
      expect(mocks.studentUpdateMany).not.toHaveBeenCalled();
      expect(exam.save).not.toHaveBeenCalled();
    }
  });
});
