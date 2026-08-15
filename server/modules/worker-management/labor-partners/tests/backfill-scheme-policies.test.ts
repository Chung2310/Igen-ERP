import { describe, expect, it } from "vitest";
import { resolveSchemePolicyBackfill } from "../services/scheme-policy-backfill";

describe("legacy partner scheme policy backfill", () => {
  it("maps a dual-scheme policy to both defaults", () => {
    expect(resolveSchemePolicyBackfill({ _id: "policy-1", status: "active", official: { enabled: true }, seasonal: { enabled: true } })).toEqual({
      set: { defaultOfficialPolicyId: "policy-1", defaultSeasonalPolicyId: "policy-1" },
      category: "both",
    });
  });

  it("maps only the enabled scheme and leaves unresolved policies untouched", () => {
    expect(resolveSchemePolicyBackfill({ _id: "policy-2", status: "active", official: { enabled: true }, seasonal: { enabled: false } })).toMatchObject({ category: "official" });
    expect(resolveSchemePolicyBackfill({ _id: "policy-3", status: "draft", official: { enabled: true } })).toMatchObject({ category: "unresolved", reason: "policy_not_active" });
    expect(resolveSchemePolicyBackfill(null)).toMatchObject({ category: "unresolved", reason: "policy_not_found" });
  });

  it("does not overwrite an already backfilled default", () => {
    expect(resolveSchemePolicyBackfill({ _id: "policy-4", status: "active", official: { enabled: true }, seasonal: { enabled: true } }, { defaultOfficialPolicyId: "existing" })).toEqual({
      set: { defaultSeasonalPolicyId: "policy-4" },
      category: "both",
    });
  });
});
