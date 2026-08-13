import { describe, expect, it } from "vitest";
import { validateBranchAttendance } from "./branch-attendance-gate.service";

const branch = { locationConfig: { latitude: 10, longitude: 106, allowedRadius: 100, allowedPublicIps: ["203.0.113.7"] } };

describe("validateBranchAttendance", () => {
  it("accepts an allowed IP inside the radius", () => {
    expect(validateBranchAttendance({ branch, latitude: 10, longitude: 106, requestIp: "::ffff:203.0.113.7" }).distance).toBe(0);
  });

  it("rejects missing config, outside radius, and wrong network", () => {
    expect(() => validateBranchAttendance({ branch: {}, latitude: 10, longitude: 106, requestIp: "203.0.113.7" })).toThrowError(expect.objectContaining({ reasonCode: "branch_attendance_not_configured" }));
    expect(() => validateBranchAttendance({ branch, latitude: 11, longitude: 106, requestIp: "203.0.113.7" })).toThrowError(expect.objectContaining({ reasonCode: "outside_radius" }));
    expect(() => validateBranchAttendance({ branch, latitude: 10, longitude: 106, requestIp: "198.51.100.8" })).toThrowError(expect.objectContaining({ reasonCode: "network_not_allowed" }));
  });
});
