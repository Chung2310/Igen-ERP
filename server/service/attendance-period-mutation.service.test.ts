import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reserve: vi.fn(),
  attendanceFindOne: vi.fn(),
  payrollFindOne: vi.fn(),
  payrollUpdate: vi.fn(),
  transaction: vi.fn(),
  lockedResult: null as any,
  finalizedRun: null as any,
  draftRun: null as any,
  guardedRun: null as any,
}));

vi.mock("../model/attendance-period-result.model", () => ({
  AttendancePeriodResultModel: { findOne: mocks.attendanceFindOne },
}));
vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: { findOne: mocks.payrollFindOne, findOneAndUpdate: mocks.payrollUpdate },
}));
vi.mock("../model/payroll-run-scope-reservation.model", () => ({
  PayrollRunScopeReservationModel: { findOneAndUpdate: mocks.reserve },
}));
vi.mock("./payroll-transaction.service", () => ({
  runPayrollAtomicTransaction: mocks.transaction,
}));

import { runAttendancePeriodMutation } from "./attendance-period-mutation.service";

const session = { id: "session-1" } as any;
const query = (value: any) => ({
  session: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

describe("runAttendancePeriodMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lockedResult = null;
    mocks.finalizedRun = null;
    mocks.draftRun = null;
    mocks.guardedRun = { _id: "run-1" };
    mocks.reserve.mockResolvedValue({});
    mocks.attendanceFindOne.mockImplementation(() => query(mocks.lockedResult));
    mocks.payrollFindOne.mockImplementation((filter) => query(
      filter.status?.$ne === "draft" ? mocks.finalizedRun : mocks.draftRun,
    ));
    mocks.payrollUpdate.mockImplementation(() => query(mocks.guardedRun));
    mocks.transaction.mockImplementation((operation) => operation(session));
  });

  it("reserves the branch and invalidates a draft payroll calculation in the same transaction", async () => {
    mocks.draftRun = { _id: "run-1", version: 7 };
    const operation = vi.fn().mockResolvedValue("saved");

    await expect(runAttendancePeriodMutation({ companyCode: "ACME", branchId: "branch-a" }, "2026-11", operation))
      .resolves.toBe("saved");

    expect(mocks.reserve).toHaveBeenCalledWith(
      { scopeKey: JSON.stringify(["ACME", "branch-a"]) },
      { $setOnInsert: { companyCode: "ACME", branchId: "branch-a" }, $inc: { revision: 1 } },
      expect.objectContaining({ upsert: true, session }),
    );
    expect(mocks.payrollUpdate).toHaveBeenCalledWith(
      { _id: "run-1", companyCode: "ACME", branchId: "branch-a", periodKey: "2026-11", type: "regular", status: "draft", version: 7 },
      { $set: { needsInputRefresh: true }, $inc: { version: 1 } },
      expect.objectContaining({ session }),
    );
    expect(operation).toHaveBeenCalledWith(session);
  });

  it("blocks edits after attendance has been locked", async () => {
    mocks.lockedResult = { _id: "locked-attendance" };
    const operation = vi.fn();

    await expect(runAttendancePeriodMutation({ companyCode: "ACME", branchId: "branch-a" }, "2026-11", operation))
      .rejects.toMatchObject({ statusCode: 409, code: "ATTENDANCE_PERIOD_LOCKED" });
    expect(operation).not.toHaveBeenCalled();
    expect(mocks.payrollFindOne).not.toHaveBeenCalled();
  });

  it("blocks edits as soon as a payroll run leaves draft", async () => {
    mocks.finalizedRun = { _id: "review-run", status: "review" };
    const operation = vi.fn();

    await expect(runAttendancePeriodMutation({ companyCode: "ACME", branchId: "branch-a" }, "2026-11", operation))
      .rejects.toMatchObject({ statusCode: 409, code: "ATTENDANCE_PERIOD_LOCKED" });
    expect(operation).not.toHaveBeenCalled();
    expect(mocks.payrollUpdate).not.toHaveBeenCalled();
  });

  it("does not proceed if the draft payroll run changes while the correction is being reserved", async () => {
    mocks.draftRun = { _id: "run-1", version: 7 };
    mocks.guardedRun = null;
    const operation = vi.fn();

    await expect(runAttendancePeriodMutation({ companyCode: "ACME", branchId: "branch-a" }, "2026-11", operation))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(operation).not.toHaveBeenCalled();
  });
});
