import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn() }));
vi.mock("../model/payroll-publication-schedule.model", () => ({ PayrollPublicationScheduleModel: { findOne: mocks.find, findOneAndUpdate: mocks.update } }));
import { getPayrollPublicationSchedule, savePayrollPublicationSchedule } from "./payroll-publication-schedule.service";
const scope = { companyCode: "ACME", branchId: "b1" };
const config = { enabled: true, day: 23, hour: 8, minute: 15, periodOffset: -1, version: 2 };
beforeEach(() => vi.resetAllMocks());
describe("payroll publication configuration persistence", () => {
  it("keeps automation off until explicitly configured", async () => {
    mocks.find.mockReturnValue({ lean: async () => null });
    expect(await getPayrollPublicationSchedule(scope)).toMatchObject({ enabled: false, version: 0 });
    expect(mocks.find).toHaveBeenCalledWith(scope);
  });
  it("saves only validated settings within the authenticated scope and expected version", async () => {
    mocks.update.mockResolvedValue({ ...config, version: 3 });
    expect(await savePayrollPublicationSchedule(scope, "accountant", { ...config, companyCode: "OTHER", branchId: "victim", updatedBy: "fake" })).toMatchObject({ version: 3 });
    expect(mocks.update).toHaveBeenCalledWith({ ...scope, version: 2 }, {
      $set: { enabled: true, day: 23, hour: 8, minute: 15, periodOffset: -1, updatedBy: "accountant", effectiveFrom: expect.any(Date) },
      $inc: { version: 1 }, $setOnInsert: scope,
    }, expect.objectContaining({ upsert: false, runValidators: true }));
  });
  it("rejects stale updates and concurrent first-time saves", async () => {
    mocks.update.mockResolvedValue(null);
    await expect(savePayrollPublicationSchedule(scope, "a", config)).rejects.toMatchObject({ status: 409 });
    mocks.update.mockRejectedValue({ code: 11000 });
    await expect(savePayrollPublicationSchedule(scope, "a", { ...config, version: 0 })).rejects.toMatchObject({ status: 409 });
  });
});
