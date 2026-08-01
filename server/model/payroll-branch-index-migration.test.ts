import { describe, expect, it, vi } from "vitest";
import {
  dropLegacyAttendancePeriodResultUniqueIndex,
  dropLegacyPayrollOperationJobIdempotencyIndex,
} from "./payroll-branch-index-migration";

describe("payroll branch index migration", () => {
  it("drops only the company-wide payroll job idempotency unique index", async () => {
    const dropIndex = vi.fn().mockResolvedValue(undefined);
    const collection = {
      indexes: vi.fn().mockResolvedValue([
        { name: "_id_", key: { _id: 1 } },
        { name: "legacy_job_key", key: { companyCode: 1, idempotencyKey: 1 }, unique: true },
        { name: "branch_job_key", key: { companyCode: 1, branchId: 1, idempotencyKey: 1 }, unique: true },
      ]),
      dropIndex,
    };

    await expect(dropLegacyPayrollOperationJobIdempotencyIndex(collection)).resolves.toBe(true);
    expect(dropIndex).toHaveBeenCalledWith("legacy_job_key");
  });

  it("drops only the company-wide attendance-result unique index", async () => {
    const dropIndex = vi.fn().mockResolvedValue(undefined);
    const collection = {
      indexes: vi.fn().mockResolvedValue([
        { name: "legacy_attendance", key: { companyCode: 1, periodKey: 1, employeeId: 1 }, unique: true },
        { name: "branch_attendance", key: { companyCode: 1, branchId: 1, periodKey: 1, employeeId: 1 }, unique: true },
      ]),
      dropIndex,
    };

    await expect(dropLegacyAttendancePeriodResultUniqueIndex(collection)).resolves.toBe(true);
    expect(dropIndex).toHaveBeenCalledWith("legacy_attendance");
  });
});
