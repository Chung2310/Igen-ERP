import { describe, expect, it } from "vitest";
import { isRequestIpAllowed, normalizeAllowedNetwork, normalizePublicIp } from "./request-ip";

describe("normalizePublicIp", () => {
  it("normalizes IPv4-mapped IPv6 and strips ports", () => {
    expect(normalizePublicIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(normalizePublicIp("203.0.113.7:443")).toBe("203.0.113.7");
  });

  it("keeps IPv6 addresses without a bracketed port", () => {
    expect(normalizePublicIp("[2001:db8::1]:443")).toBe("2001:db8::1");
  });
});

describe("IPv6 attendance networks", () => {
  it("normalizes full and compressed IPv6 values to the same /64 network", () => {
    expect(normalizeAllowedNetwork("2405:4802:219a:9eb0:8002:e332:b128:462b"))
      .toBe("2405:4802:219a:9eb0::/64");
    expect(normalizeAllowedNetwork("2405:4802:219a:9eb0::1234/64"))
      .toBe("2405:4802:219a:9eb0::/64");
  });

  it("allows only IPv6 addresses in the same /64 while keeping IPv4 exact", () => {
    expect(isRequestIpAllowed("2405:4802:219a:9eb0:a421::2", "2405:4802:219a:9eb0:8002::1")).toBe(true);
    expect(isRequestIpAllowed("2405:4802:219a:9eb1::2", "2405:4802:219a:9eb0::/64")).toBe(false);
    expect(isRequestIpAllowed("203.0.113.8", "203.0.113.7")).toBe(false);
  });
});
