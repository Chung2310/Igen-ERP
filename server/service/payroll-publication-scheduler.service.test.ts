import { describe, expect, it, vi } from "vitest";
import { runPayrollPublicationScan } from "./payroll-publication-scheduler.service";
const now = new Date("2026-09-15T03:00:00Z");
const schedule = { companyCode: "ACME", branchId: "b1", enabled: true, day: 15, hour: 9, minute: 0, periodOffset: -1, effectiveFrom: "2026-09-01T00:00:00Z", version: 3 };
describe("automatic provisional publication", () => {
  it("passes the scoped run and configuration version to the atomic publication service", async () => {
    const deps = { listSchedules: vi.fn(async () => [schedule]), listRuns: vi.fn(async () => [{ _id: "r1", version: 4 }]), publish: vi.fn(async () => ({ employeeCount: 2 })), onError: vi.fn() };
    expect(await runPayrollPublicationScan(now, deps)).toEqual({ published: 1 });
    expect(deps.listRuns).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "b1" }, ["2026-08"]);
    expect(deps.publish).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "b1" }, "r1", "system:payroll-publication", 4, { version: 3, now });
  });
  it("isolates errors and retries failed runs on the next scan", async () => {
    const deps = { listSchedules: vi.fn(async () => [schedule]), listRuns: vi.fn(async () => [{ _id: "r1", version: 4 }, { _id: "r2", version: 1 }]), publish: vi.fn().mockRejectedValueOnce(new Error("not ready")).mockResolvedValue({ employeeCount: 2 }), onError: vi.fn() };
    expect(await runPayrollPublicationScan(now, deps)).toEqual({ published: 1 });
    expect(deps.onError).toHaveBeenCalledOnce();
    expect(await runPayrollPublicationScan(now, deps)).toEqual({ published: 2 });
  });
  it("does not scan runs before the schedule is due", async () => {
    const deps = { listSchedules: vi.fn(async () => [schedule]), listRuns: vi.fn(), publish: vi.fn(), onError: vi.fn() };
    await runPayrollPublicationScan(new Date("2026-09-14T23:00:00Z"), deps);
    expect(deps.listRuns).not.toHaveBeenCalled();
  });
});
