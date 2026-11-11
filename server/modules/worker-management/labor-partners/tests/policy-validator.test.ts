import { describe, expect, it } from "vitest";
import { validatePolicyConfiguration } from "../services/commission-policy.service";

const valid = () => ({ name: "Policy A", effectiveFrom: "2026-08-01", settlementCycle: { type: "calendar_month" }, official: { enabled: true, maxMonths: 1, milestones: [{ month: 1, amount: 1, eligibilityRule: "contract_active" }] }, seasonal: { enabled: false } });

describe("labor partner policy validation", () => {
  it("does not inject a price and preserves the configured amount", () => expect(validatePolicyConfiguration(valid()).official.milestones[0].amount).toBe(1));
  it("rejects a time-based policy with gaps between configurable tiers", () => expect(() => validatePolicyConfiguration({ ...valid(), official: { enabled: false }, seasonal: { enabled: true, aggregationScope: "partner_period", tierMode: "flat", hourRounding: { unitMinutes: 1, mode: "nearest" }, moneyRounding: { unitVnd: 1, mode: "nearest" }, tiers: [{ minHours: 0, maxHours: 10, hourlyRate: 1 }, { minHours: 11, maxHours: null, hourlyRate: 2 }] } })).toThrow(/liên tục/));
  it("allows arbitrary configured seasonal rates", () => expect(validatePolicyConfiguration({ ...valid(), official: { enabled: false }, seasonal: { enabled: true, aggregationScope: "partner_period", tierMode: "progressive", hourRounding: { unitMinutes: 15, mode: "ceil" }, moneyRounding: { unitVnd: 100, mode: "floor" }, tiers: [{ minHours: 0, maxHours: null, hourlyRate: 739 }] } }).seasonal.tiers[0].hourlyRate).toBe(739));
  it("allows the first seasonal tier to start at the configured monthly minimum", () => expect(validatePolicyConfiguration({ ...valid(), official: { enabled: false }, seasonal: { enabled: true, aggregationScope: "partner_period", tierMode: "flat", minHoursPerWorker: 150, maxEligibleHoursPerWorker: 600, hourRounding: { unitMinutes: 1, mode: "nearest" }, moneyRounding: { unitVnd: 1, mode: "nearest" }, tiers: [{ minHours: 150, maxHours: 300, hourlyRate: 2000 }, { minHours: 300, maxHours: 500, hourlyRate: 2500 }, { minHours: 500, maxHours: null, hourlyRate: 3000 }] } }).seasonal.tiers[0].minHours).toBe(150));
});
