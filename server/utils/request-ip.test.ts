import { describe, expect, it } from "vitest";
import { normalizePublicIp } from "./request-ip";

describe("normalizePublicIp", () => {
  it("normalizes IPv4-mapped IPv6 and strips ports", () => {
    expect(normalizePublicIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(normalizePublicIp("203.0.113.7:443")).toBe("203.0.113.7");
  });

  it("keeps IPv6 addresses without a bracketed port", () => {
    expect(normalizePublicIp("[2001:db8::1]:443")).toBe("2001:db8::1");
  });
});
