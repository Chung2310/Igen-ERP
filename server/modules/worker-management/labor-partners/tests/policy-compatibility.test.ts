import { describe, expect, it } from "vitest";
import { supportsCommissionScheme } from "../services/policy-compatibility";

describe("policy and commission scheme compatibility", () => {
  it("allows official only when the policy enables official", () => {
    expect(supportsCommissionScheme({ official: { enabled: true }, seasonal: { enabled: false } }, "official_monthly")).toBe(true);
    expect(supportsCommissionScheme({ official: { enabled: true }, seasonal: { enabled: false } }, "seasonal_hourly")).toBe(false);
  });
  it("allows seasonal only when the policy enables seasonal", () => {
    expect(supportsCommissionScheme({ official: { enabled: false }, seasonal: { enabled: true } }, "seasonal_hourly")).toBe(true);
    expect(supportsCommissionScheme({ official: { enabled: false }, seasonal: { enabled: true } }, "official_monthly")).toBe(false);
  });
});
