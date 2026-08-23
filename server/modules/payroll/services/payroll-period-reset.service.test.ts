import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
  runExists: vi.fn(),
  runDeleteOne: vi.fn(),
  reservationFindOneAndUpdate: vi.fn(),
  attendanceDeleteMany: vi.fn(),
  adjustmentDeleteMany: vi.fn(),
  overrideDeleteMany: vi.fn(),
  auditDeleteMany: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("../models/payroll-run.model", () => ({
  PayrollRunModel: {
    findOne: mocks.runFindOne,
    exists: mocks.runExists,
    deleteOne: mocks.runDeleteOne,
  },
}));
vi.mock("../models/payroll-run-scope-reservation.model", () => ({
  PayrollRunScopeReservationModel: {
    findOneAndUpdate: mocks.reservationFindOneAndUpdate,
  },
}));
vi.mock("../../../model/attendance-period-result.model", () => ({
  AttendancePeriodResultModel: { deleteMany: mocks.attendanceDeleteMany },
}));
vi.mock("../models/payroll-adjustment.model", () => ({
  PayrollAdjustmentModel: { deleteMany: mocks.adjustmentDeleteMany },
}));
vi.mock("../models/payroll-line-override.model", () => ({
  PayrollLineOverrideModel: { deleteMany: mocks.overrideDeleteMany },
}));
vi.mock("../models/payroll-audit.model", () => ({
  PayrollAuditModel: { deleteMany: mocks.auditDeleteMany, create: mocks.auditCreate },
}));

import { createPayrollPeriodResetService } from "./payroll-period-reset.service";
import { projectPayrollRevisionWithOverrides } from "./payroll-run-calculate-operations.service";
import type { PayrollTransactionRunner } from "./payroll-transaction.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const periodKey = "2026-07";
const session = { id: "session-a" } as any;
const sessionQuery = <T>(value: T) => {
  const query: any = {
    sort: vi.fn(),
    session: vi.fn(),
    lean: vi.fn().mockResolvedValue(value),
  };
  query.sort.mockReturnValue(query);
  query.session.mockReturnValue(query);
  return query;
};

const injectedRunner = () => {
  let calls = 0;
  const runner: PayrollTransactionRunner = async <T,>(operation: (received: any) => Promise<T>) => {
    calls += 1;
    return operation(session);
  };
  return { runner, calls: () => calls };
};

describe("payroll period reset", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.runFindOne.mockReturnValue(sessionQuery({ _id: "run-a", status: "draft" }));
    mocks.runExists.mockReturnValue(sessionQuery(null));
    mocks.reservationFindOneAndUpdate.mockResolvedValue({ _id: "reservation-a" });
    mocks.runDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mocks.attendanceDeleteMany.mockResolvedValue({ deletedCount: 2 });
    mocks.adjustmentDeleteMany.mockResolvedValue({ deletedCount: 3 });
    mocks.overrideDeleteMany.mockResolvedValue({ deletedCount: 1 });
    mocks.auditDeleteMany.mockResolvedValue({ deletedCount: 4 });
    mocks.auditCreate.mockResolvedValue({});
  });

  it("deletes the canonical branch period sequentially and writes reset audit in the same transaction", async () => {
    let mutationInFlight = false;
    const sequentialMutation = <T>(value: T) => async () => {
      if (mutationInFlight) throw new Error("reset mutations ran in parallel");
      mutationInFlight = true;
      await Promise.resolve();
      mutationInFlight = false;
      return value;
    };
    mocks.runDeleteOne.mockImplementation(sequentialMutation({ deletedCount: 1 }));
    mocks.attendanceDeleteMany.mockImplementation(sequentialMutation({ deletedCount: 2 }));
    mocks.adjustmentDeleteMany.mockImplementation(sequentialMutation({ deletedCount: 3 }));
    mocks.overrideDeleteMany.mockImplementation(sequentialMutation({ deletedCount: 1 }));
    mocks.auditDeleteMany.mockImplementation(sequentialMutation({ deletedCount: 4 }));
    mocks.auditCreate.mockImplementation(sequentialMutation({}));
    const query = sessionQuery({ _id: "run-a", status: "draft" });
    mocks.runFindOne.mockReturnValue(query);
    const transaction = injectedRunner();
    const reset = createPayrollPeriodResetService({ transactionRunner: transaction.runner });

    const result = await reset(scope, periodKey, "actor-a");

    const periodFilter = { ...scope, periodKey };
    expect(mocks.reservationFindOneAndUpdate).toHaveBeenCalledWith(
      { scopeKey: JSON.stringify(["ACME", "branch-a"]) },
      {
        $setOnInsert: scope,
        $inc: { revision: 1 },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, session },
    );
    expect(mocks.runExists).toHaveBeenCalledWith({
      ...periodFilter,
      activeRevisionId: { $exists: true },
    });
    expect(mocks.runFindOne).toHaveBeenCalledWith({ ...periodFilter, type: "regular" });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: 1, _id: 1 });
    expect(query.session).toHaveBeenCalledWith(session);
    expect(mocks.runDeleteOne).toHaveBeenCalledWith(
      { _id: "run-a", ...periodFilter, type: "regular" },
      { session },
    );
    expect(mocks.attendanceDeleteMany).toHaveBeenCalledWith(periodFilter, { session });
    expect(mocks.adjustmentDeleteMany).toHaveBeenCalledWith(periodFilter, { session });
    expect(mocks.overrideDeleteMany).toHaveBeenCalledWith(periodFilter, { session });
    expect(mocks.auditDeleteMany).toHaveBeenCalledWith(periodFilter, { session });
    expect(mocks.auditCreate).toHaveBeenCalledWith([
      expect.objectContaining({
        ...periodFilter,
        action: "reset",
        actorId: "actor-a",
        metadata: expect.objectContaining({
          hadRun: true,
          results: 2,
          adjustments: 3,
          overrides: 1,
          auditsRemoved: 4,
        }),
      }),
    ], { session });
    expect(result.deleted).toEqual({ run: 1, results: 2, adjustments: 3, overrides: 1, audits: 4 });
    expect(transaction.calls()).toBe(1);
  });

  it("cleans orphan branch-period data and overrides when no run exists", async () => {
    mocks.runFindOne.mockReturnValue(sessionQuery(null));
    const reset = createPayrollPeriodResetService({ transactionRunner: injectedRunner().runner });

    const result = await reset(scope, periodKey, "actor-a");

    const periodFilter = { ...scope, periodKey };
    expect(mocks.runDeleteOne).not.toHaveBeenCalled();
    expect(mocks.attendanceDeleteMany).toHaveBeenCalledWith(periodFilter, { session });
    expect(mocks.adjustmentDeleteMany).toHaveBeenCalledWith(periodFilter, { session });
    expect(mocks.overrideDeleteMany).toHaveBeenCalledWith(periodFilter, { session });
    expect(mocks.auditDeleteMany).toHaveBeenCalledWith(periodFilter, { session });
    expect(mocks.auditCreate).toHaveBeenCalledWith([
      expect.objectContaining({
        ...periodFilter,
        action: "reset",
        metadata: expect.objectContaining({ hadRun: false }),
      }),
    ], { session });
    expect(result.deleted.run).toBe(0);
  });

  it("retries a first-writer reservation collision before running reset mutations", async () => {
    let attempts = 0;
    const transactionRunner: PayrollTransactionRunner = async <T,>(operation: (received: any) => Promise<T>) => {
      attempts += 1;
      if (attempts === 1) {
        throw Object.assign(new Error("reservation collision"), { code: 11000 });
      }
      return operation(session);
    };
    const reset = createPayrollPeriodResetService({ transactionRunner });

    await expect(reset(scope, periodKey, "actor-a")).resolves.toMatchObject({
      deleted: { run: 1, overrides: 1, audits: 4 },
    });

    expect(attempts).toBe(2);
    expect(mocks.runDeleteOne).toHaveBeenCalledOnce();
    expect(mocks.overrideDeleteMany).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("returns a stable conflict when branch reservation collisions persist", async () => {
    const transactionRunner = vi.fn(async () => {
      throw Object.assign(new Error("reservation collision"), { code: 11000 });
    });
    const reset = createPayrollPeriodResetService({ transactionRunner: transactionRunner as any });

    await expect(reset(scope, periodKey, "actor-a")).rejects.toMatchObject({
      code: "PAYROLL_RUN_RESERVATION_CONFLICT",
      status: 409,
    });

    expect(transactionRunner).toHaveBeenCalledTimes(2);
    expect(mocks.runDeleteOne).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("refuses to reset a revision-backed operational run before deleting anything", async () => {
    mocks.runFindOne.mockReturnValue(sessionQuery({
      _id: "run-a",
      status: "draft",
      activeRevisionId: "revision-a",
    }));
    const reset = createPayrollPeriodResetService({ transactionRunner: injectedRunner().runner });

    await expect(reset(scope, periodKey, "actor-a")).rejects.toMatchObject({
      code: "PAYROLL_OPERATIONAL_RUN",
      status: 409,
    });

    expect(mocks.runDeleteOne).not.toHaveBeenCalled();
    expect(mocks.attendanceDeleteMany).not.toHaveBeenCalled();
    expect(mocks.adjustmentDeleteMany).not.toHaveBeenCalled();
    expect(mocks.overrideDeleteMany).not.toHaveBeenCalled();
    expect(mocks.auditDeleteMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("refuses reset when any regular run is revision-backed even if the canonical run is legacy", async () => {
    mocks.runFindOne.mockReturnValue(sessionQuery({
      _id: "legacy-run",
      status: "draft",
    }));
    mocks.runExists.mockReturnValue(sessionQuery({ _id: "newer-operational-run" }));
    const reset = createPayrollPeriodResetService({ transactionRunner: injectedRunner().runner });

    await expect(reset(scope, periodKey, "actor-a")).rejects.toMatchObject({
      code: "PAYROLL_OPERATIONAL_RUN",
      status: 409,
    });

    expect(mocks.runDeleteOne).not.toHaveBeenCalled();
    expect(mocks.attendanceDeleteMany).not.toHaveBeenCalled();
    expect(mocks.overrideDeleteMany).not.toHaveBeenCalled();
  });

  it("refuses reset when a revision-backed supplemental run shares the period", async () => {
    mocks.runExists.mockImplementation((filter) => sessionQuery(
      filter.type === undefined ? { _id: "supplemental-run" } : null,
    ));
    const reset = createPayrollPeriodResetService({ transactionRunner: injectedRunner().runner });

    await expect(reset(scope, periodKey, "actor-a")).rejects.toMatchObject({
      code: "PAYROLL_OPERATIONAL_RUN",
      status: 409,
    });

    expect(mocks.runExists).toHaveBeenCalledWith({
      ...scope,
      periodKey,
      activeRevisionId: { $exists: true },
    });
    expect(mocks.runFindOne).not.toHaveBeenCalled();
    expect(mocks.runDeleteOne).not.toHaveBeenCalled();
    expect(mocks.attendanceDeleteMany).not.toHaveBeenCalled();
    expect(mocks.overrideDeleteMany).not.toHaveBeenCalled();
    expect(mocks.auditDeleteMany).not.toHaveBeenCalled();
  });

  it("keeps all reset state when reset audit insertion fails", async () => {
    const initialState = {
      run: 1,
      results: 2,
      adjustments: 3,
      overrides: 1,
      audits: 4,
    };
    let state = structuredClone(initialState);
    mocks.runDeleteOne.mockImplementation(async () => {
      const deletedCount = state.run;
      state.run = 0;
      return { deletedCount };
    });
    mocks.attendanceDeleteMany.mockImplementation(async () => {
      const deletedCount = state.results;
      state.results = 0;
      return { deletedCount };
    });
    mocks.adjustmentDeleteMany.mockImplementation(async () => {
      const deletedCount = state.adjustments;
      state.adjustments = 0;
      return { deletedCount };
    });
    mocks.overrideDeleteMany.mockImplementation(async () => {
      const deletedCount = state.overrides;
      state.overrides = 0;
      return { deletedCount };
    });
    mocks.auditDeleteMany.mockImplementation(async () => {
      const deletedCount = state.audits;
      state.audits = 0;
      return { deletedCount };
    });
    mocks.auditCreate.mockRejectedValue(new Error("reset audit unavailable"));
    const transactionRunner = async <T,>(operation: (received: any) => Promise<T>): Promise<T> => {
      const snapshot = structuredClone(state);
      try {
        return await operation(session);
      } catch (error) {
        state = snapshot;
        throw error;
      }
    };
    const reset = createPayrollPeriodResetService({ transactionRunner });

    await expect(reset(scope, periodKey, "actor-a")).rejects.toThrow("reset audit unavailable");

    expect(mocks.runDeleteOne).toHaveBeenCalledOnce();
    expect(mocks.overrideDeleteMany).toHaveBeenCalledOnce();
    expect(mocks.auditDeleteMany).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
    expect(state).toEqual(initialState);
  });

  it("does not resurrect a prior override after reset and recreation of the same period", async () => {
    let overrides: any[] = [{ employeeId: "employee-a", adjustedBase: 1, version: 9 }];
    mocks.overrideDeleteMany.mockImplementation(async () => {
      const deletedCount = overrides.length;
      overrides = [];
      return { deletedCount };
    });
    const reset = createPayrollPeriodResetService({
      transactionRunner: async (operation) => operation(session),
    });

    await reset(scope, periodKey, "actor-a");
    const recreated: any = projectPayrollRevisionWithOverrides({
      lines: [{
        employeeId: "employee-a",
        calculation: { monthlySalary: 10_000, adjustedBase: 9_000, gross: 9_000, net: 9_000 },
      }],
    }, overrides);

    expect(recreated.effectiveLines[0]).toMatchObject({
      overrideVersion: 0,
      overrideValues: {},
      effectiveValues: { adjustedBase: 9_000 },
    });
  });
});
