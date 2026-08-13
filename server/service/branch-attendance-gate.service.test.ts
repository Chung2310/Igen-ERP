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

  it("accepts different device IPv6 addresses on the same /64 network", () => {
    const ipv6Branch = { locationConfig: { ...branch.locationConfig,
      allowedPublicIps: ["2405:4802:219a:9eb0:8002:e332:b128:462b"] } };
    expect(validateBranchAttendance({ branch: ipv6Branch, latitude: 10, longitude: 106,
      requestIp: "2405:4802:219a:9eb0:a421:7cff:fe12:3456" }).distance).toBe(0);
  });

  it("rejects an IPv6 address from another /64 network", () => {
    const ipv6Branch = { locationConfig: { ...branch.locationConfig,
      allowedPublicIps: ["2405:4802:219a:9eb0::/64"] } };
    expect(() => validateBranchAttendance({ branch: ipv6Branch, latitude: 10, longitude: 106,
      requestIp: "2405:4802:219a:9eb1::2" }))
      .toThrowError(expect.objectContaining({ reasonCode: "network_not_allowed" }));
  });
});
