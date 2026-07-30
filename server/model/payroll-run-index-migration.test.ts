import { describe, expect, it, vi } from "vitest";
import { dropLegacyPayrollRunPeriodIndex } from "./payroll-run-index-migration";

const legacyKeys = { companyCode: 1, periodKey: 1 };

describe("dropLegacyPayrollRunPeriodIndex", () => {
  it("drops only the discovered legacy unique period index", async () => {
    const dropIndex = vi.fn().mockResolvedValue(undefined);
    const collection = {
      indexes: vi.fn().mockResolvedValue([
        { name: "_id_", key: { _id: 1 } },
        { name: "company_period_legacy", key: legacyKeys, unique: true },
        { name: "company_branch_period", key: { companyCode: 1, branchId: 1, periodKey: 1 }, unique: true },
      ]),
      dropIndex,
    };

    await expect(dropLegacyPayrollRunPeriodIndex(collection)).resolves.toBe(true);
    expect(dropIndex).toHaveBeenCalledTimes(1);
    expect(dropIndex).toHaveBeenCalledWith("company_period_legacy");
  });

  it("is a no-op when the legacy index is absent", async () => {
    const dropIndex = vi.fn();
    const collection = {
      indexes: vi.fn().mockResolvedValue([{ name: "company_period_non_unique", key: legacyKeys }]),
      dropIndex,
    };

    await expect(dropLegacyPayrollRunPeriodIndex(collection)).resolves.toBe(false);
    expect(dropIndex).not.toHaveBeenCalled();
  });

  it("is idempotent when another instance already removed the discovered index", async () => {
    const error = Object.assign(new Error("index not found"), { code: 27 });
    const collection = {
      indexes: vi.fn().mockResolvedValue([{ name: "company_period_legacy", key: legacyKeys, unique: true }]),
      dropIndex: vi.fn().mockRejectedValue(error),
    };

    await expect(dropLegacyPayrollRunPeriodIndex(collection)).resolves.toBe(false);
  });
});
