import { describe, expect, it } from "vitest";
import { allowedPublicIpSchema } from "./auth.router";

describe("branch allowed public IP validation", () => {
  it.each([
    "203.0.113.7",
    "2405:4802:219a:9eb0:8002:e332:b128:462b",
    "2405:4802:219a:9eb0::/64",
  ])("accepts %s", (value) => {
    expect(allowedPublicIpSchema.validate(value).error).toBeUndefined();
  });

  it.each([
    "2405:4802:219a:9eb0::/48",
    "2405:4802:219a:9eb0::/96",
    "not-an-ip",
  ])("rejects %s", (value) => {
    expect(allowedPublicIpSchema.validate(value).error).toBeTruthy();
  });
});
