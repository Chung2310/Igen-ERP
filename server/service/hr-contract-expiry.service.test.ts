import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateMany: vi.fn(), find: vi.fn(), countDocuments: vi.fn() }));
vi.mock("../model/hr-contract.model", () => ({ HRContractModel: mocks }));

import { daysUntilContractExpiry, hrContractService, startOfVietnamDay } from "./hr-contract.service";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.updateMany.mockResolvedValue({ modifiedCount: 0 });
  mocks.countDocuments.mockResolvedValue(28);
  const query: any = { select: vi.fn(), sort: vi.fn(), limit: vi.fn(), lean: vi.fn() };
  query.select.mockReturnValue(query);
  query.sort.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.lean.mockResolvedValue([{ _id: "contract-1", contractType: "Xác định thời hạn", employeeId: "e1", employeeName: "An", endDate: new Date("2026-10-21T00:00:00Z") }]);
  mocks.find.mockReturnValue(query);
});

describe("HR contract expiry alerts", () => {
  const now = new Date("2026-10-21T03:00:00Z");

  it("keeps a contract active through its final Vietnam calendar day", async () => {
    expect(startOfVietnamDay(now).toISOString()).toBe("2026-10-20T17:00:00.000Z");
    expect(daysUntilContractExpiry("2026-10-21T00:00:00Z", now)).toBe(0);
    await hrContractService.updateExpiredStatus("ACME", now);
    expect(mocks.updateMany).toHaveBeenCalledWith(
      { companyCode: "ACME", status: "active", endDate: { $lt: startOfVietnamDay(now) } },
      { $set: { status: "expired" } },
    );
  });

  it("counts expiring contracts across all pages within the selected branch", async () => {
    const result = await hrContractService.listExpiryAlerts({ companyCode: "ACME", branchId: "branch-1", now });
    expect(result.total).toBe(28);
    expect(result.items).toMatchObject([{ employeeName: "An", daysRemaining: 0 }]);
    expect(mocks.find).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "branch-1", status: "active", endDate: { $gte: startOfVietnamDay(now), $lt: new Date(startOfVietnamDay(now).getTime() + 21 * 86_400_000) } });
  });
});
