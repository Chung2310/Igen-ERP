import { describe, expect, it, vi } from "vitest";
import { workerAttendanceApi } from "./workerAttendance.api";

const { workerApiFetchMock } = vi.hoisted(() => ({ workerApiFetchMock: vi.fn() }));
vi.mock("./client", () => ({ workerApiFetch: workerApiFetchMock }));

describe("workerAttendanceApi", () => {
  it("uses worker-owned attendance and QR endpoints", async () => {
    workerApiFetchMock.mockResolvedValue({ data: [] });

    await workerAttendanceApi.list("project-1", "2026-08-05");
    await workerAttendanceApi.mark({ projectId: "project-1", workerId: "worker-1" });
    await workerAttendanceApi.adjust("log-1", "project-1", { note: "manual" });
    await workerAttendanceApi.createQrSession("project-1", "2026-08-05");
    await workerAttendanceApi.getQrToken("session-1");
    await workerAttendanceApi.getQrStatus("session-1");
    await workerAttendanceApi.closeQrSession("session-1");

    expect(workerApiFetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/worker-management/attendance",
      "/worker-management/attendance/mark",
      "/worker-management/attendance/log-1",
      "/worker-management/qr-attendance/session",
      "/worker-management/qr-attendance/session/session-1/token",
      "/worker-management/qr-attendance/session/session-1/status",
      "/worker-management/qr-attendance/session/session-1/close",
    ]);
  });
});
