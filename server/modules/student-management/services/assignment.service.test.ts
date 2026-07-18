import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { setRateLimitRedisClientForTesting } from "../../../infrastructure/rate-limit-redis";

// Mock Redis client to prevent ioredis connections during test execution
const mockRedisClient = {
  eval: async () => [1, 60000],
  decr: async () => 0,
  del: async () => 0,
  on: () => {},
  disconnect: () => {},
  quit: () => {},
};
setRateLimitRedisClientForTesting(mockRedisClient);

import jwt from "jsonwebtoken";
const { AssignmentService } = await import("./assignment.service");
const { EmailService } = await import("./email.service");
const { AssignmentModel } = await import("../models/assignment.model");
const { SubmissionModel } = await import("../models/submission.model");
const { Batch } = await import("../models/batch.model");
const { Student } = await import("../models/student.model");
const { User } = await import("../models/user.model");
const { getJwtAccessSecret } = await import("../../../config/env");
const socketModule = await import("../../../socket");

test("AssignmentService implementation flows", async (t) => {
  // 1. Mocks
  const originalReadyState = mongoose.connection.readyState;
  Object.defineProperty(mongoose.connection, "readyState", {
    get: () => 1,
    configurable: true,
  });

  const originalQueryExec = mongoose.Query.prototype.exec;
  const originalSave = mongoose.Model.prototype.save;
  const originalSendMail = EmailService.sendMail;
  const originalCreate = mongoose.Model.create;
  const originalFindOneAndUpdate = mongoose.Model.findOneAndUpdate;
  const originalDeleteOne = mongoose.Model.deleteOne;

  const mockBatchId = new mongoose.Types.ObjectId().toString();
  const mockAssignmentId = new mongoose.Types.ObjectId().toString();
  const mockStudentId = new mongoose.Types.ObjectId().toString();
  const mockInstructorId = new mongoose.Types.ObjectId().toString();
  const mockOwnerId = new mongoose.Types.ObjectId().toString();

  const mockBatch = {
    _id: mockBatchId,
    code: "ENG-101-BATCH",
    courseId: "ENG-101",
    learnerIds: [mockStudentId],
    instructorId: mockInstructorId,
  };

  const mockStudent = {
    _id: mockStudentId,
    fullName: "Học viên Nguyễn Văn B",
    email: "student@igen.vn",
  };

  const mockOwner = {
    _id: mockOwnerId,
    smtpHost: "smtp.gmail.com",
    smtpUser: "owner@igen.vn",
    smtpPass: "pass123",
  };

  const mockAssignment = {
    _id: mockAssignmentId,
    title: "Bài tập 1",
    description: "Làm bài CRUD",
    dueDate: new Date(Date.now() + 86400000),
    instructorId: mockInstructorId,
    ownerId: mockOwnerId,
  };

  const mockSubmission = {
    _id: new mongoose.Types.ObjectId().toString(),
    assignmentId: mockAssignmentId,
    studentId: mockStudentId,
    status: "submitted",
    submittedAt: new Date(),
  };

  const sendMailCalls: any[] = [];
  EmailService.sendMail = async (options: any, settings?: any) => {
    sendMailCalls.push({ options, settings });
    return { success: true, messageId: "mock-assignment-msg-id" };
  };

  const socketCalls: any[] = [];
  socketModule.setEmitToUserMockForTesting((userId: string, event: string, data: any) => {
    socketCalls.push({ userId, event, data });
  });

  // Mock model static helper methods
  (AssignmentModel as any).create = async (data: any) => {
    return { ...mockAssignment, ...data };
  };

  (AssignmentModel as any).findById = async (id: any) => {
    if (String(id) === mockAssignmentId) return mockAssignment;
    return null;
  };

  (SubmissionModel as any).deleteOne = async () => {
    return { acknowledged: true, deletedCount: 1 };
  };

  (SubmissionModel as any).findOneAndUpdate = async (filter: any, update: any, options: any) => {
    return { ...mockSubmission, ...update };
  };

  mongoose.Query.prototype.exec = async function (this: any) {
    const modelName = this.model.modelName;
    const op = this.op;
    const filter = this.getFilter();

    if (modelName === "Batch" && op === "findOne") {
      return mockBatch;
    }
    if (modelName === "Student" && op === "find") {
      return [mockStudent];
    }
    if (modelName === "User" && op === "findOne") {
      return mockOwner;
    }
    if (modelName === "Assignment" && op === "findOne") {
      return mockAssignment;
    }
    if (modelName === "Submission" && op === "findOne") {
      return mockSubmission;
    }
    return null;
  };

  await t.test("createAssignment compiles email and calls notify", async () => {
    const data = {
      title: "Bài tập 1",
      description: "Làm bài CRUD",
      batchId: mockBatchId,
      dueDate: new Date(Date.now() + 86400000),
    };

    const assignment = await AssignmentService.createAssignment(data, mockInstructorId, mockOwnerId);
    assert.strictEqual(assignment.title, "Bài tập 1");
    assert.strictEqual(assignment.instructorId, mockInstructorId);

    // Give asynchronous email dispatch a tiny tick to execute
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(sendMailCalls.length, 1);
    assert.strictEqual(sendMailCalls[0].options.to, "student@igen.vn");
  });

  await t.test("verifySubmissionToken decodes correct JWT payloads", async () => {
    const token = jwt.sign(
      {
        studentId: mockStudentId,
        email: "student@igen.vn",
        batchId: mockBatchId,
        assignmentId: mockAssignmentId,
      },
      getJwtAccessSecret(),
      { expiresIn: "1d" }
    );

    const decoded = await AssignmentService.verifySubmissionToken(token);
    assert.strictEqual(decoded.studentId, mockStudentId);
    assert.strictEqual(decoded.assignmentId, mockAssignmentId);
  });

  await t.test("submitProof updates DB and emits socket to instructor", async () => {
    const decodedToken = {
      studentId: mockStudentId,
      email: "student@igen.vn",
      batchId: mockBatchId,
      assignmentId: mockAssignmentId,
    };

    const inputData = {
      attachments: [{ name: "proof.png", url: "http://cloudinary/proof.png", type: "image/png" }],
      studentNotes: "Hoàn thành bài tập",
    };

    const submission = await AssignmentService.submitProof(decodedToken, inputData);
    assert.strictEqual(submission.status, "submitted");
    assert.strictEqual(socketCalls.length, 1);
    assert.strictEqual(socketCalls[0].userId, mockInstructorId);
    assert.strictEqual(socketCalls[0].event, "submission_updated");
  });

  await t.test("cancelSubmission deletes record and emits socket", async () => {
    const decodedToken = {
      studentId: mockStudentId,
      email: "student@igen.vn",
      batchId: mockBatchId,
      assignmentId: mockAssignmentId,
    };

    await AssignmentService.cancelSubmission(decodedToken);
    assert.strictEqual(socketCalls.length, 2); // Previous submitProof + this delete call
    assert.strictEqual(socketCalls[1].userId, mockInstructorId);
    assert.strictEqual(socketCalls[1].data.status, "deleted");
  });

  // Restore mocks
  Object.defineProperty(mongoose.connection, "readyState", {
    get: () => originalReadyState,
    configurable: true,
  });
  mongoose.Query.prototype.exec = originalQueryExec;
  mongoose.Model.prototype.save = originalSave;
  EmailService.sendMail = originalSendMail;
  mongoose.Model.create = originalCreate;
  mongoose.Model.findOneAndUpdate = originalFindOneAndUpdate;
  mongoose.Model.deleteOne = originalDeleteOne;
  socketModule.setEmitToUserMockForTesting(null);

  // Disconnect rate-limit Redis client to let the process exit cleanly
  const { getRateLimitRedisClient } = await import("../../../infrastructure/rate-limit-redis");
  getRateLimitRedisClient().disconnect();
});
