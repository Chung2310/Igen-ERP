import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("../models/batch.model", () => ({
  Batch: { findById: vi.fn() },
}));
vi.mock("../models/course.model", () => ({
  Course: { findById: vi.fn() },
}));
vi.mock("../models/student.model", () => ({
  Student: { findOne: vi.fn() },
}));
vi.mock("./batch.service", () => ({
  BatchService: { saveAttendanceSession: vi.fn() },
}));
vi.mock("./worker-attendance.service", () => ({
  WorkerAttendanceError: class WorkerAttendanceError extends Error {
    constructor(public readonly reasonCode: string, message: string) {
      super(message);
    }
  },
  WorkerAttendanceService: { mark: vi.fn() },
}));
vi.mock("./student-face-gate.service", () => ({
  verifyStudentAttendanceFace: vi.fn(),
}));
vi.mock("../models/student-attendance-attempt.model", () => ({
  StudentAttendanceAttemptModel: { create: vi.fn() },
}));
vi.mock("../../../socket", () => ({ emitToCompany: vi.fn() }));
vi.mock("../../../config/env", () => ({ getJwtAccessSecret: () => "test-secret" }));
vi.mock("../../../service/cloudinary.service", () => ({ cloudinaryService: {} }));
vi.mock("../../../service/insightface.service", () => ({ InsightFaceClient: class {} }));
vi.mock("../config/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { Batch } from "../models/batch.model";
import { Course } from "../models/course.model";
import { Student } from "../models/student.model";
import { BatchService } from "./batch.service";
import { WorkerAttendanceService } from "./worker-attendance.service";
import { verifyStudentAttendanceFace } from "./student-face-gate.service";
import { StudentAttendanceAttemptModel } from "../models/student-attendance-attempt.model";
import { QRAttendanceService } from "./qr-attendance.service";

const batch = {
  _id: "batch-1",
  code: "DA-001",
  courseId: "course-1",
  ownerId: "owner-1",
  learnerIds: ["student-1"],
  startTime: "08:00",
  endTime: "17:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Batch.findById).mockResolvedValue(batch as any);
  vi.mocked(Course.findById).mockResolvedValue({ title: "Du an" } as any);
});

describe("QR worker attendance sessions", () => {
  it("does not save class attendance records when closing a worker session", async () => {
    const session = await QRAttendanceService.createSession("batch-1", "2026-08-03", 60, "owner-1", {
      shared: true,
      mode: "worker",
    });

    await QRAttendanceService.closeSession(session.sessionId);

    expect(BatchService.saveAttendanceSession).not.toHaveBeenCalled();
  });

  it("returns the worker mark kind after a shared QR checkin", async () => {
    const session = await QRAttendanceService.createSession("batch-1", "2026-08-03", 60, "owner-1", {
      shared: true,
      mode: "worker",
    });
    const decoded = jwt.decode(session.token) as { sid: string; bid: string; nonce: string; exp?: number; iat?: number };
    delete decoded.exp;
    delete decoded.iat;
    const secondToken = jwt.sign(decoded, "test-secret", { expiresIn: "60m" });

    vi.mocked(Student.findOne).mockResolvedValue({
      _id: { toString: () => "student-1" },
      fullName: "Nguyen Van A",
      phone: "0900000000",
      faceEnrollment: { registered: true, insightFaceUserId: "face-1" },
    } as any);
    vi.mocked(verifyStudentAttendanceFace).mockResolvedValue({
      accepted: true,
      reasonCode: "accepted",
      verification: {},
    } as any);
    vi.mocked(WorkerAttendanceService.mark).mockResolvedValue({
      kind: "check-in",
      date: "2026-08-03",
      status: "missing-checkout",
    } as any);

    const result = await QRAttendanceService.checkin(
      secondToken,
      "0900000000",
      "device-1",
      Buffer.from("image"),
      "image/jpeg",
      21.0278,
      105.8342
    );

    expect(result.kind).toBe("check-in");
    expect(StudentAttendanceAttemptModel.create).toHaveBeenCalledWith(expect.objectContaining({ outcome: "accepted" }));
  });
});


