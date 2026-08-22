import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyCustomerTier: vi.fn(),
  getCustomerTiers: vi.fn(),
  getResolvedRetailSettings: vi.fn(),
  jobFindOneAndUpdate: vi.fn(),
  jobUpdateOne: vi.fn(),
  orderFind: vi.fn(),
  historyFindOne: vi.fn(),
  historyUpdateOne: vi.fn(),
}));

vi.mock("../../customer-management/contracts", () => ({
  applyCustomerTier: mocks.applyCustomerTier,
  getCustomerTiers: mocks.getCustomerTiers,
}));
vi.mock("./retail-settings.service", () => ({ getResolvedRetailSettings: mocks.getResolvedRetailSettings }));
vi.mock("../models/retail-customer-tier-job.model", () => ({
  RetailCustomerTierJobModel: { findOneAndUpdate: mocks.jobFindOneAndUpdate, updateOne: mocks.jobUpdateOne },
}));
vi.mock("../models/retail-customer-tier-history.model", () => ({
  RetailCustomerTierHistoryModel: { findOne: mocks.historyFindOne, updateOne: mocks.historyUpdateOne },
}));
vi.mock("../models/retail-order.model", () => ({ RetailOrderModel: { find: mocks.orderFind } }));

const { processTierRefreshJob } = await import("./retail-customer-tier.service");

const JOB_ID = "64b7f2d3c1a2b3c4d5e6f7a8";
const tiers = [
  { code: "standard", name: "Thành viên", minSpend: 0 },
  { code: "silver", name: "Bạc", minSpend: 5_000_000 },
  { code: "gold", name: "Vàng", minSpend: 20_000_000 },
];

describe("processTierRefreshJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.jobFindOneAndUpdate.mockReturnValue({ _id: JOB_ID, companyCode: "ACME", branchId: "B1", customerId: "C1", sourceKey: "k1" });
    mocks.getResolvedRetailSettings.mockResolvedValue({ tierEvaluationWindow: { type: "lifetime" } });
    mocks.getCustomerTiers.mockResolvedValue(tiers);
    mocks.historyFindOne.mockReturnValue({ sort: () => ({ lean: async () => null }) });
    mocks.historyUpdateOne.mockResolvedValue({});
    mocks.jobUpdateOne.mockResolvedValue({});
  });

  const withOrders = (orders: any[]) => mocks.orderFind.mockReturnValue({ select: () => ({ lean: async () => orders }) });

  it("writes the earned tier and net spend onto the customer profile", async () => {
    withOrders([{ status: "completed", grandTotal: 21_000_000, refundedAmount: 0 }]);
    await processTierRefreshJob(JOB_ID);
    expect(mocks.applyCustomerTier).toHaveBeenCalledWith("ACME", "C1", tiers[2], 21_000_000);
  });

  it("takes tier bands from customer settings, not retail settings", async () => {
    withOrders([{ status: "completed", grandTotal: 6_000_000, refundedAmount: 0 }]);
    await processTierRefreshJob(JOB_ID);
    expect(mocks.getCustomerTiers).toHaveBeenCalledWith("ACME");
    expect(mocks.applyCustomerTier.mock.calls[0][2]).toEqual(tiers[1]);
  });

  it("still refreshes the profile when the tier itself did not change", async () => {
    mocks.historyFindOne.mockReturnValue({ sort: () => ({ lean: async () => ({ toTierCode: "silver", toTierName: "Bạc" }) }) });
    withOrders([{ status: "completed", grandTotal: 7_000_000, refundedAmount: 0 }]);
    await processTierRefreshJob(JOB_ID);
    expect(mocks.historyUpdateOne).not.toHaveBeenCalled();
    expect(mocks.applyCustomerTier).toHaveBeenCalledWith("ACME", "C1", tiers[1], 7_000_000);
  });

  it("subtracts refunds so a refunded customer drops back down", async () => {
    withOrders([{ status: "completed", grandTotal: 21_000_000, refundedAmount: 20_000_000 }]);
    await processTierRefreshJob(JOB_ID);
    expect(mocks.applyCustomerTier.mock.calls[0][2]).toEqual(tiers[0]);
  });
});
