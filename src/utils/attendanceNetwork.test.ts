import { describe, expect, it } from "vitest";
import { toAttendanceNetwork } from "./attendanceNetwork";

describe("toAttendanceNetwork", () => {
  it("converts full and compressed IPv6 to a /64 network", () => {
    expect(toAttendanceNetwork("2405:4802:219a:9eb0:8002:e332:b128:462b"))
      .toBe("2405:4802:219a:9eb0::/64");
    expect(toAttendanceNetwork("2001:db8:0:1::abcd"))
      .toBe("2001:db8:0:1::/64");
  });

  it("keeps IPv4 unchanged", () => {
    expect(toAttendanceNetwork("203.0.113.7")).toBe("203.0.113.7");
  });
});
