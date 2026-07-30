import { describe, expect, it, vi } from "vitest";
import { dropLegacyPayrollRunPeriodKeyUniqueIndex } from "./payroll-run-index-migration";

const legacyKeys = { companyCode: 1, periodKey: 1 };

describe("dropLegacyPayrollRunPeriodKeyUniqueIndex", () => {
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

    await expect(dropLegacyPayrollRunPeriodKeyUniqueIndex(collection)).resolves.toBe(true);
    expect(dropIndex).toHaveBeenCalledTimes(1);
    expect(dropIndex).toHaveBeenCalledWith("company_period_legacy");
  });

  it("is a no-op when the legacy index is absent", async () => {
    const dropIndex = vi.fn();
    const collection = {
      indexes: vi.fn().mockResolvedValue([{ name: "company_period_non_unique", key: legacyKeys }]),
      dropIndex,
    };

    await expect(dropLegacyPayrollRunPeriodKeyUniqueIndex(collection)).resolves.toBe(false);
    expect(dropIndex).not.toHaveBeenCalled();
  });

  it("is idempotent when another instance already removed the discovered index", async () => {
    const error = Object.assign(new Error("index not found"), { code: 27 });
    const collection = {
      indexes: vi.fn().mockResolvedValue([{ name: "company_period_legacy", key: legacyKeys, unique: true }]),
      dropIndex: vi.fn().mockRejectedValue(error),
    };

    await expect(dropLegacyPayrollRunPeriodKeyUniqueIndex(collection)).resolves.toBe(false);
  });

  it("is a no-op when the collection does not exist yet", async () => {
    const error = Object.assign(new Error("namespace missing"), { codeName: "NamespaceNotFound", code: 26 });
    const collection = { indexes: vi.fn().mockRejectedValue(error), dropIndex: vi.fn() };

    await expect(dropLegacyPayrollRunPeriodKeyUniqueIndex(collection)).resolves.toBe(false);
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });
});
