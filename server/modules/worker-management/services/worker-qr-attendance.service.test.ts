import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";

vi.mock("../models/worker-project.model", () => ({
  WorkerProjectModel: { findById: vi.fn(), findOne: vi.fn() },
}));
vi.mock("../models/worker.model", () => ({
  WorkerModel: { findOne: vi.fn() },
}));
vi.mock("./worker-attendance.service", () => ({
  vietnamWorkDate: () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10),
  WorkerAttendanceError: class WorkerAttendanceError extends Error {
    constructor(public readonly reasonCode: string, message: string) {
      super(message);
    }
  },
  WorkerAttendanceService: { mark: vi.fn() },
}));
vi.mock("../../../socket", () => ({ emitToCompany: vi.fn() }));
vi.mock("../../../config/env", () => ({ getJwtAccessSecret: () => "test-secret" }));
vi.mock("../../../config/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { WorkerProjectModel } from "../models/worker-project.model";
import { WorkerModel } from "../models/worker.model";
import { WorkerAttendanceService } from "./worker-attendance.service";
import { WorkerQrAttendanceService } from "./worker-qr-attendance.service";

const project = {
  _id: "project-1",
  companyCode: "owner-1",
  branchId: new Types.ObjectId(),
  code: "DA-001",
  name: "Dự án xây dựng cầu vượt",
  ownerId: "owner-1",
  workerIds: ["worker-1"],
  startTime: "08:00",
  endTime: "17:00",
};

const todayVietnam = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(WorkerProjectModel.findById).mockResolvedValue(project as any);
  vi.mocked(WorkerProjectModel.findOne).mockResolvedValue(project as any);
});

describe("worker QR attendance sessions", () => {
  it("creates session and closes it", async () => {
    const session = await WorkerQrAttendanceService.createSession("project-1", todayVietnam(), 60, "owner-1", project.branchId.toString());
    expect(session.closed).toBe(false);
    expect(session.projectName).toBe("Dự án xây dựng cầu vượt");
    expect(session.date).toBe(todayVietnam());

    expect(() => WorkerQrAttendanceService.getCurrentToken(session.id, "other-company", project.branchId.toString()))
      .toThrowError(/không thuộc phạm vi tài khoản/i);
    expect(() => WorkerQrAttendanceService.getSessionStatus(session.id, "owner-1", new Types.ObjectId().toString()))
      .toThrowError(/không thuộc phạm vi tài khoản/i);
    await WorkerQrAttendanceService.closeSession(session.id, "owner-1", project.branchId.toString());
  });

  it("checks in worker successfully and returns check-in kind", async () => {
    const session = await WorkerQrAttendanceService.createSession("project-1", todayVietnam(), 60, "owner-1", project.branchId.toString());
    const decoded = jwt.decode(session.currentToken) as any;
    delete decoded.exp;
    delete decoded.iat;
    const token = jwt.sign(decoded, "test-secret", { expiresIn: "60m" });

    vi.mocked(WorkerModel.findOne).mockResolvedValue({
      _id: "worker-1",
      branchId: project.branchId.toString(),
      fullName: "Nguyen Van A",
      phone: "0900000000",
    } as any);

    vi.mocked(WorkerAttendanceService.mark).mockResolvedValue({
      kind: "check-in",
      date: todayVietnam(),
      status: "missing-checkout",
    } as any);

    const result = await WorkerQrAttendanceService.checkin(
      token,
      "0900000000",
      "device-1",
      21.0278,
      105.8342
    );

    expect(result.success).toBe(true);
    expect(result.kind).toBe("check-in");
    expect(result.workerName).toBe("Nguyen Van A");
  });

  it("từ chối khi không có số điện thoại lẫn thiết bị đã ghi nhớ", async () => {
    const session = await WorkerQrAttendanceService.createSession("project-1", todayVietnam(), 60, "owner-1", project.branchId.toString());
    await expect(
      WorkerQrAttendanceService.checkin(session.currentToken, "", "fingerprint-1"),
    ).rejects.toMatchObject({ reasonCode: "worker_not_found" });
    expect(WorkerModel.findOne).not.toHaveBeenCalled();
  });

  it("does not open a session for a historical date", async () => {
    const pastDate = "2026-01-01";
    await expect(WorkerQrAttendanceService.createSession("project-1", pastDate, 60, "owner-1"))
      .rejects.toMatchObject({ reasonCode: "session_invalid" });
  });

  it("keeps an active session when a project-scope check fails", async () => {
    const session = await WorkerQrAttendanceService.createSession("project-1", todayVietnam(), 60, "owner-1", project.branchId.toString());
    vi.mocked(WorkerProjectModel.findOne).mockResolvedValueOnce(null);

    await expect(WorkerQrAttendanceService.createSession(
      "project-1",
      todayVietnam(),
      60,
      "other-company",
      project.branchId.toString(),
    )).rejects.toMatchObject({ reasonCode: "project_not_found" });

    expect(WorkerQrAttendanceService.getCurrentToken(session.id, "owner-1", project.branchId.toString()).token)
      .toBe(session.currentToken);
    await WorkerQrAttendanceService.closeSession(session.id, "owner-1", project.branchId.toString());
  });
});
