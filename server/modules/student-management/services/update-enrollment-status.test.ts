import assert from "node:assert/strict";
import { describe, it, afterAll } from "vitest";
import mongoose from "mongoose";
import { updateEnrollmentStatus } from "./batch.service";

describe("updateEnrollmentStatus functional flows", () => {
  // Setup mongoose readystate mock
  const originalReadyState = mongoose.connection.readyState;
  Object.defineProperty(mongoose.connection, "readyState", {
    get: () => 1,
    configurable: true,
  });

  const originalQueryExec = mongoose.Query.prototype.exec;
  const originalSave = mongoose.Model.prototype.save;

  // Mock globally to avoid hanging on DB connection
  mongoose.Model.prototype.save = async function (this: any) {
    return this;
  };

  afterAll(() => {
    Object.defineProperty(mongoose.connection, "readyState", {
      get: () => originalReadyState,
      configurable: true,
    });
    mongoose.Query.prototype.exec = originalQueryExec;
    mongoose.Model.prototype.save = originalSave;
  });

  // Mock data
  const mockBatch = {
    _id: new mongoose.Types.ObjectId("60c72b2f9b1d8b23456789a1"),
    ownerId: "owner-1",
    learnerIds: ["student-1"],
    code: "TEST-101",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    daysOfWeek: [1, 3, 5],
    attendanceSessions: [],
    save: async function() { return this; },
  };

  const mockTargetBatch = {
    _id: new mongoose.Types.ObjectId("60c72b2f9b1d8b23456789a2"),
    ownerId: "owner-1",
    learnerIds: [],
    code: "TEST-102",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    daysOfWeek: [1, 3, 5],
    quota: 10,
    save: async function() { return this; },
  };

  const mockEnrollment = {
    batchId: "60c72b2f9b1d8b23456789a1",
    studentId: "student-1",
    allowedSessions: 12,
    attendedSessions: 5,
    status: "Đang học",
    retakeCount: 0,
    retakeHistory: [] as any[],
    history: [] as any[],
    save: async function() { return this; },
    toObject: function() { return this; },
  };

  // Mock Mongoose Query exec globally so it never hangs
  mongoose.Query.prototype.exec = async function (this: any) {
    const modelName = this.model.modelName;
    const op = this.op;
    const filter = this.getFilter();

    if (modelName === "Batch") {
      if (filter._id === "60c72b2f9b1d8b23456789a2") {
        return mockTargetBatch;
      }
      return mockBatch;
    }
    if (modelName === "BatchEnrollment") {
      if (op === "find") {
        return [mockEnrollment];
      }
      return mockEnrollment;
    }
    // Return empty objects/arrays for other models to prevent hanging
    if (op === "find") {
      return [];
    }
    return {};
  };

  it("suspends enrollment correctly with reason and return date", async () => {
    mockEnrollment.status = "Đang học";
    const result = await updateEnrollmentStatus("owner-1", "60c72b2f9b1d8b23456789a1", "student-1", "Bảo lưu", "Lý do bảo lưu", "2026-09-15");
    assert.ok(result);
    assert.equal(result.status, "Bảo lưu");
    assert.equal(result.suspensionReason, "Lý do bảo lưu");
    assert.equal(result.expectedReturnAt, "2026-09-15");
  });

  it("throws error if suspending without a reason", async () => {
    mockEnrollment.status = "Đang học";
    await assert.rejects(
      async () => {
        await updateEnrollmentStatus("owner-1", "60c72b2f9b1d8b23456789a1", "student-1", "Bảo lưu", "");
      },
      /Lý do bảo lưu là bắt buộc/
    );
  });

  it("transitions other standard statuses", async () => {
    mockEnrollment.status = "Đang học";
    const result = await updateEnrollmentStatus("owner-1", "60c72b2f9b1d8b23456789a1", "student-1", "Hoàn thành khóa", "Hoàn thành lớp");
    assert.ok(result);
    assert.equal(result.status, "Hoàn thành khóa");
  });

  it("first retake is free, second retake requires fee", async () => {
    // Reset enrollment for retake
    mockEnrollment.status = "Đang học";
    mockEnrollment.retakeCount = 0;
    mockEnrollment.retakeHistory = [];
    
    // First retake (free)
    const result1 = await updateEnrollmentStatus("owner-1", "60c72b2f9b1d8b23456789a1", "student-1", "Học lại", "Học lại lần 1", null, undefined, 0);
    assert.ok(result1);
    assert.equal(result1.status, "Học lại");
    assert.equal(result1.retakeCount, 1);
    assert.equal(result1.retakeHistory.length, 1);
    assert.equal(result1.retakeHistory[0].fee, 0);

    // Second retake with fee = 0 should fail
    await assert.rejects(
      async () => {
        await updateEnrollmentStatus("owner-1", "60c72b2f9b1d8b23456789a1", "student-1", "Học lại", "Học lại lần 2", null, undefined, 0);
      },
      /Từ lần học lại thứ hai, lệ phí là bắt buộc/
    );

    // Second retake with fee > 0 should succeed
    const result2 = await updateEnrollmentStatus("owner-1", "60c72b2f9b1d8b23456789a1", "student-1", "Học lại", "Học lại lần 2", null, undefined, 150000);
    assert.ok(result2);
    assert.equal(result2.status, "Học lại");
    assert.equal(result2.retakeCount, 2);
    assert.equal(result2.retakeHistory.length, 2);
    assert.equal(result2.retakeHistory[1].fee, 150000);
  });
});
