import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  countDocuments: vi.fn(),
  find: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("./models/customer.model", () => ({ CustomerModel: {
  aggregate: mocks.aggregate,
  countDocuments: mocks.countDocuments,
  find: mocks.find,
} }));
vi.mock("./services/customer-settings.service", () => ({ CustomerSettingsService: { getSettings: mocks.getSettings } }));

import { customerTierCounts, upcomingCustomerBirthdays } from "./customer-assistant-reports.service";

describe("customer assistant reports", () => {
  beforeEach(() => {
    mocks.aggregate.mockReset();
    mocks.countDocuments.mockReset();
    mocks.find.mockReset();
    mocks.getSettings.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("counts configured customer tiers, including empty tiers and unranked profiles", async () => {
    mocks.getSettings.mockResolvedValue({ customerTiers: [
      { code: "silver", name: "Bạc" }, { code: "gold", name: "Vàng" }, { code: "vip", name: "VIP" },
    ] });
    mocks.aggregate.mockResolvedValue([
      { _id: "silver", name: "Bạc", count: 4 },
      { _id: "GOLD", name: "Vàng", count: 2 },
      { _id: "vip", name: "VIP", count: 1 },
      { _id: null, count: 3 },
    ]);

    const result = await customerTierCounts("qa_edu");
    expect(mocks.getSettings).toHaveBeenCalledWith("QA_EDU");
    expect(mocks.aggregate.mock.calls[0][0][0]).toEqual({ $match: { companyCode: "QA_EDU" } });
    expect(result).toEqual({
      total: 10,
      tiers: [
        { code: "silver", name: "Bạc", count: 4 },
        { code: "gold", name: "Vàng", count: 2 },
        { code: "vip", name: "VIP", count: 1 },
      ],
      unranked: 3,
    });
  });

  it("lists only active customers with birthdays in the requested window and hides birth years", async () => {
    const rows = [
      { name: "Minh", customerCode: "KH-002", dateOfBirth: new Date("2000-03-01T00:00:00.000Z") },
      { name: "An", customerCode: "KH-001", dateOfBirth: new Date("2000-02-29T00:00:00.000Z") },
    ];
    mocks.countDocuments.mockResolvedValue(2);
    mocks.find.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(rows),
    });

    const result = await upcomingCustomerBirthdays("qa_edu", "2027-02-28", "2027-03-01");
    expect(mocks.countDocuments.mock.calls[0][0]).toMatchObject({ companyCode: "QA_EDU", status: "active" });
    expect(mocks.countDocuments.mock.calls[0][0].$expr.$in[1]).toEqual(["02-28", "02-29", "03-01"]);
    expect(result).toEqual({
      from: "2027-02-28", to: "2027-03-01", total: 2, truncated: false,
      items: [
        { name: "An", customerCode: "KH-001", birthdayDate: "2027-02-28" },
        { name: "Minh", customerCode: "KH-002", birthdayDate: "2027-03-01" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("2000");
  });

  it("rejects birthday windows longer than 90 days", async () => {
    await expect(upcomingCustomerBirthdays("QA_EDU", "2026-01-01", "2026-04-01"))
      .rejects.toThrow(/tối đa là 90 ngày/);
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
