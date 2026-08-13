import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../model/attendance-attempt.model", () => ({
  AttendanceAttemptModel: { create: mocks.create },
}));

import { ATTENDANCE_FACE_CHECK_ENABLED } from "../../src/config/attendanceFaceCheck";
import { attendanceFaceGate } from "./attendance-face-gate";

describe("attendanceFaceGate while face checking is disabled", () => {
  it("continues without an image or face verification", async () => {
    const next = vi.fn();
    const status = vi.fn();
    const json = vi.fn();
    status.mockReturnValue({ json });
    const req = {
      user: { id: "user-1", companyCode: "ACME", branchId: "branch-1" },
      body: { latitude: 10.7, longitude: 106.6 },
      path: "/check-in",
      headers: {},
      socket: { remoteAddress: "203.0.113.7" },
    };

    await attendanceFaceGate(req as never, { status } as never, next);

    expect(ATTENDANCE_FACE_CHECK_ENABLED).toBe(false);
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
