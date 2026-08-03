import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("../models/worker-project.model", () => ({
  WorkerProjectModel: { findById: vi.fn() },
}));
vi.mock("../models/worker.model", () => ({
  WorkerModel: { findOne: vi.fn() },
}));
vi.mock("./worker-attendance.service", () => ({
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
  code: "DA-001",
  name: "Dự án xây dựng cầu vượt",
  ownerId: "owner-1",
  workerIds: ["worker-1"],
  startTime: "08:00",
  endTime: "17:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(WorkerProjectModel.findById).mockResolvedValue(project as any);
});

describe("worker QR attendance sessions", () => {
  it("creates session and closes it", async () => {
    const session = await WorkerQrAttendanceService.createSession("project-1", "2026-08-03", 60, "owner-1");
    expect(session.closed).toBe(false);
    expect(session.projectName).toBe("Dự án xây dựng cầu vượt");

    await WorkerQrAttendanceService.closeSession(session.id);
  });

  it("checks in worker successfully and returns check-in kind", async () => {
    const session = await WorkerQrAttendanceService.createSession("project-1", "2026-08-03", 60, "owner-1");
    const decoded = jwt.decode(session.currentToken) as any;
    delete decoded.exp;
    delete decoded.iat;
    const token = jwt.sign(decoded, "test-secret", { expiresIn: "60m" });

    vi.mocked(WorkerModel.findOne).mockResolvedValue({
      _id: "worker-1",
      fullName: "Nguyen Van A",
      phone: "0900000000",
    } as any);

    vi.mocked(WorkerAttendanceService.mark).mockResolvedValue({
      kind: "check-in",
      date: "2026-08-03",
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
});
