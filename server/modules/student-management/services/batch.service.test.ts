import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { BatchService } from "./batch.service";
import { EmailService } from "./email.service";

test("BatchService teacher assignment notification email flow", async (t) => {
  // 1. Mocks
  const originalReadyState = mongoose.connection.readyState;
  Object.defineProperty(mongoose.connection, "readyState", {
    get: () => 1,
    configurable: true,
  });

  const originalQueryExec = mongoose.Query.prototype.exec;
  const originalSave = mongoose.Model.prototype.save;
  const originalSendMail = EmailService.sendMail;

  const mockInstructor = {
    _id: new mongoose.Types.ObjectId("60c72b2f9b1d8b2345678911"),
    role: "user",
    email: "teacher@igen.vn",
    displayName: "Thầy Nguyễn Văn A",
    smtpHost: "smtp.gmail.com",
    smtpUser: "system@igen.vn",
    smtpPass: "pass123",
  };

  const mockCourse = {
    _id: new mongoose.Types.ObjectId("60c72b2f9b1d8b2345678912"),
    code: "ENG-101",
    title: "Tiếng Anh Giao Tiếp",
    maxLearners: 25,
    fee: "2000000",
  };

  // Track sendMail calls
  const sendMailCalls: any[] = [];
  EmailService.sendMail = async (options: any, settings?: any) => {
    sendMailCalls.push({ options, settings });
    return { success: true, messageId: "mock-message-id" };
  };

  // Mock Mongoose Query exec
  mongoose.Query.prototype.exec = async function (this: any) {
    const modelName = this.model.modelName;
    const op = this.op;
    const filter = this.getFilter();

    if (modelName === "Batch" && op === "findOne") {
      // Return null for duplicate code checks during creation
      return null;
    }
    if (modelName === "Course" && op === "findOne") {
      return mockCourse;
    }
    if (modelName === "User" && op === "findOne") {
      return mockInstructor;
    }
    if (modelName === "User" && op === "findById") {
      return mockInstructor;
    }
    if (modelName === "Course" && op === "find") {
      return [mockCourse];
    }
    if (modelName === "User" && op === "find") {
      return [mockInstructor];
    }

    return originalQueryExec.apply(this);
  };

  // Mock model save
  mongoose.Model.prototype.save = async function (this: any) {
    return this;
  };

  await t.test("should send notification email when batch is created with an instructor", async () => {
    sendMailCalls.length = 0; // reset

    const batchData = {
      code: "ENG101-B1",
      courseId: mockCourse._id.toString(),
      instructorId: mockInstructor._id.toString(),
      daysOfWeek: [1, 3, 5],
      startTime: "18:00",
      endTime: "20:00",
      startDate: "2026-08-01",
      endDate: "2026-10-31",
      location: "Phòng 101",
    };

    const actor = {
      uid: "admin-1",
      role: "admin",
      companyCode: "SYSTEM",
    };

    const result = await BatchService.createBatch("owner-1", actor, batchData);

    assert.equal(result.code, "ENG101-B1");
    assert.equal(result.instructorName, "Thầy Nguyễn Văn A");

    // Wait a brief moment for async mail sending to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(sendMailCalls.length, 1);
    const call = sendMailCalls[0];
    assert.equal(call.options.to, "teacher@igen.vn");
    assert.ok(call.options.subject.includes("ENG101-B1"));
    assert.ok(call.options.subject.includes("Tiếng Anh Giao Tiếp"));
    assert.ok(call.options.html.includes("Thầy Nguyễn Văn A"));
    assert.ok(call.options.html.includes("Mã lớp"));
    assert.ok(call.options.html.includes("Lịch học"));
  });

  await t.test("should send notification email when instructor is changed during update", async () => {
    sendMailCalls.length = 0; // reset

    // Mock initial findOne of Batch for update check
    const mockExistingBatch = {
      _id: "batch-1",
      ownerId: "owner-1",
      code: "ENG101-B1",
      courseId: mockCourse._id.toString(),
      instructorId: "some-other-instructor", // different instructor
      daysOfWeek: [1, 3, 5],
      startTime: "18:00",
      endTime: "20:00",
      startDate: "2026-08-01",
      endDate: "2026-10-31",
      location: "Phòng 101",
      set: function (data: any) {
        Object.assign(this, data);
      },
      save: async function () {
        return this;
      },
      toObject: function () {
        return this;
      },
    };

    const originalQueryExecWithBatch = mongoose.Query.prototype.exec;
    mongoose.Query.prototype.exec = async function (this: any) {
      const modelName = this.model.modelName;
      const op = this.op;
      if (modelName === "Batch" && op === "findOne") {
        return mockExistingBatch as any;
      }
      return originalQueryExecWithBatch.apply(this);
    };

    const updateData = {
      instructorId: mockInstructor._id.toString(),
    };

    const actor = {
      uid: "admin-1",
      role: "admin",
      companyCode: "SYSTEM",
    };

    await BatchService.updateBatch("owner-1", actor, "batch-1", updateData);

    // Wait a brief moment for async mail sending to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(sendMailCalls.length, 1);
    assert.equal(sendMailCalls[0].options.to, "teacher@igen.vn");
    assert.ok(sendMailCalls[0].options.subject.includes("[Phân công lớp]"));
  });

  // Restore mocks
  Object.defineProperty(mongoose.connection, "readyState", {
    get: () => originalReadyState,
    configurable: true,
  });
  mongoose.Query.prototype.exec = originalQueryExec;
  mongoose.Model.prototype.save = originalSave;
  EmailService.sendMail = originalSendMail;
});
