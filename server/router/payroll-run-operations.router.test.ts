import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const permissionGuards = vi.hoisted(() => new Map<any, string | string[]>());
const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
  runFindOneAndUpdate: vi.fn(),
  runCreate: vi.fn(),
  reservationFindOneAndUpdate: vi.fn(),
  attendanceFind: vi.fn(),
  snapshotCreate: vi.fn(),
  jobFindOne: vi.fn(),
  jobCreate: vi.fn(),
  jobFindOneAndUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("../middleware/auth", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    requirePermission: (permission: string | string[]) => {
      const guard = (_req: any, _res: any, next: any) => next();
      permissionGuards.set(guard, permission);
      return guard;
    },
  };
});

vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: {
    findOne: mocks.runFindOne,
    findOneAndUpdate: mocks.runFindOneAndUpdate,
    create: mocks.runCreate,
  },
}));
vi.mock("../model/payroll-run-scope-reservation.model", () => ({
  PayrollRunScopeReservationModel: {
    findOneAndUpdate: mocks.reservationFindOneAndUpdate,
  },
}));
vi.mock("../model/attendance-period-result.model", () => ({
  AttendancePeriodResultModel: { find: mocks.attendanceFind },
}));
vi.mock("../model/payroll-attendance-snapshot.model", () => ({
  PayrollAttendanceSnapshotModel: { create: mocks.snapshotCreate },
}));
vi.mock("../model/payroll-operation-job.model", () => ({
  PayrollOperationJobModel: {
    findOne: mocks.jobFindOne,
    create: mocks.jobCreate,
    findOneAndUpdate: mocks.jobFindOneAndUpdate,
  },
}));
vi.mock("../model/payroll-audit.model", () => ({
  PayrollAuditModel: { create: mocks.auditCreate },
}));

import { payrollController } from "../controller/payroll.controller";
import { payrollRouter } from "./payroll.router";
import {
  createRun,
  listIssues,
  lockAttendance,
  syncAttendance,
} from "../service/payroll-run-operations.service";
import {
  createOperationalRunSchema,
  lockAttendanceSchema,
  syncAttendanceHeadersSchema,
  syncAttendanceSchema,
} from "../validation/payroll-run.validation";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const lean = <T>(value: T) => ({ lean: vi.fn().mockResolvedValue(value) });
const sortedLean = <T>(value: T) => ({
  sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) }),
});
const request = (body: Record<string, unknown>, headers: Record<string, string> = {}) => ({
  body,
  params: { id: "run-a" },
  headers,
  get: (name: string) => headers[name.toLowerCase()],
  user: { id: "actor-a", email: "a@example.com", role: "admin", ...scope },
}) as any;
const response = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};
const permissionOf = (method: string, path: string) => {
  const layer = (payrollRouter as any).stack.find((item: any) => (
    item.route?.path === path && item.route?.methods?.[method.toLowerCase()]
  ));
  if (!layer) return undefined;
  return layer.route.stack
    .map((handler: any) => permissionGuards.get(handler.handle))
    .find((permission: string | undefined) => permission !== undefined);
};

describe("operational payroll request validation", () => {
  it("requires date-only ISO boundaries, period key, and run type", () => {
    expect(createOperationalRunSchema.validate({
      periodKey: "2026-07",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      type: "regular",
    }).error).toBeUndefined();

    expect(createOperationalRunSchema.validate({ periodKey: "2026-07", type: "regular" }).error).toBeDefined();
    expect(createOperationalRunSchema.validate({
      periodKey: "2026-07", startDate: "07/01/2026", endDate: "2026-07-31", type: "regular",
    }).error).toBeDefined();
    for (const periodKey of ["2026-00", "2026-13"]) {
      expect(createOperationalRunSchema.validate({
        periodKey, startDate: "2026-07-01", endDate: "2026-07-31", type: "regular",
      }).error).toBeDefined();
    }
    for (const periodKey of ["2026-01", "2026-12"]) {
      expect(createOperationalRunSchema.validate({
        periodKey, startDate: "2026-07-01", endDate: "2026-07-31", type: "regular",
      }).error).toBeUndefined();
    }
  });

  it("requires a parent run or nonblank reason for supplemental runs", () => {
    const base = { periodKey: "2026-07", startDate: "2026-07-01", endDate: "2026-07-31", type: "supplemental" };

    expect(createOperationalRunSchema.validate(base).error).toBeDefined();
    expect(createOperationalRunSchema.validate({ ...base, supplementalReason: "  " }).error).toBeDefined();
    expect(createOperationalRunSchema.validate({ ...base, parentRunId: "regular-run" }).error).toBeUndefined();
  });

  it("requires optimistic versions and the sync idempotency header", () => {
    expect(syncAttendanceSchema.validate({ expectedVersion: 0 }).error).toBeUndefined();
    expect(syncAttendanceSchema.validate({}).error).toBeDefined();
    expect(lockAttendanceSchema.validate({}).error).toBeDefined();
    expect(syncAttendanceHeadersSchema.validate({ "idempotency-key": "sync-1" }).error).toBeUndefined();
    expect(syncAttendanceHeadersSchema.validate({}).error).toBeDefined();
  });
});

describe("payroll run operations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auditCreate.mockResolvedValue({});
  });

  it("scopes regular overlap detection by company and branch", async () => {
    mocks.runFindOne.mockReturnValue(lean({ _id: "existing-run" }));

    await expect(createRun(scope, "actor-a", {
      periodKey: "2026-07", startDate: "2026-07-01", endDate: "2026-07-31", type: "regular",
    })).rejects.toMatchObject({ code: "PAYROLL_PERIOD_OVERLAP", status: 409 });

    expect(mocks.runFindOne).toHaveBeenCalledWith({
      companyCode: "ACME",
      branchId: "branch-a",
      type: "regular",
      startDate: { $lte: new Date("2026-07-31T23:59:59.999Z") },
      endDate: { $gte: new Date("2026-07-01T00:00:00.000Z") },
    });
    expect(mocks.runCreate).not.toHaveBeenCalled();
  });

  it("serializes concurrent overlapping regular creates with a transaction scope reservation", async () => {
    const priorReadyState = mongoose.connection.readyState;
    const storedRuns: any[] = [];
    let reservationTail = Promise.resolve();
    const sessions: any[] = [];
    (mongoose.connection as any).readyState = 1;
    const startSession = vi.spyOn(mongoose, "startSession").mockImplementation(async () => {
      const session: any = {
        releaseReservation: undefined,
        endSession: vi.fn(),
      };
      session.withTransaction = vi.fn(async (callback: () => Promise<unknown>) => {
        try {
          return await callback();
        } finally {
          session.releaseReservation?.();
        }
      });
      sessions.push(session);
      return session;
    });
    mocks.reservationFindOneAndUpdate.mockImplementation(async (_filter, _update, options) => {
      const previous = reservationTail;
      let release!: () => void;
      reservationTail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      options.session.releaseReservation = release;
      return {};
    });
    mocks.runFindOne.mockImplementation((filter) => {
      const query: any = {
        session: vi.fn(() => query),
        lean: vi.fn(async () => {
          const snapshot = storedRuns.find((run) => (
            run.companyCode === filter.companyCode
            && run.branchId === filter.branchId
            && run.type === filter.type
            && run.startDate <= filter.startDate.$lte
            && run.endDate >= filter.endDate.$gte
          )) || null;
          await Promise.resolve();
          return snapshot;
        }),
      };
      return query;
    });
    mocks.runCreate.mockImplementation(async (value) => {
      const run = Array.isArray(value) ? value[0] : value;
      const stored = { ...run, _id: `run-${storedRuns.length + 1}` };
      storedRuns.push(stored);
      return Array.isArray(value) ? [stored] : stored;
    });
    mocks.auditCreate.mockImplementation(async (value) => (
      Array.isArray(value) ? [value[0]] : value
    ));
    const input = {
      periodKey: "2026-07", startDate: "2026-07-01", endDate: "2026-07-31", type: "regular" as const,
    };

    try {
      const outcomes = await Promise.allSettled([
        createRun(scope, "actor-a", input),
        createRun(scope, "actor-b", { ...input, startDate: "2026-07-15", endDate: "2026-08-14" }),
      ]);

      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === "rejected")).toEqual([
        expect.objectContaining({ reason: expect.objectContaining({ code: "PAYROLL_PERIOD_OVERLAP" }) }),
      ]);
      expect(mocks.reservationFindOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(sessions.every((session) => session.withTransaction.mock.calls.length === 1)).toBe(true);
      expect(storedRuns).toHaveLength(1);
    } finally {
      startSession.mockRestore();
      (mongoose.connection as any).readyState = priorReadyState;
    }
  });

  it("retries the whole create transaction after a first-use reservation duplicate and returns overlap", async () => {
    const priorReadyState = mongoose.connection.readyState;
    (mongoose.connection as any).readyState = 1;
    const sessions: any[] = [];
    const startSession = vi.spyOn(mongoose, "startSession").mockImplementation(async () => {
      const session = {
        withTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
        endSession: vi.fn(),
      };
      sessions.push(session);
      return session as any;
    });
    mocks.reservationFindOneAndUpdate
      .mockRejectedValueOnce(Object.assign(new Error("duplicate scope key"), { code: 11000 }))
      .mockResolvedValueOnce({ revision: 2 });
    const overlapQuery: any = lean({ _id: "winning-overlap" });
    overlapQuery.session = vi.fn(() => overlapQuery);
    mocks.runFindOne.mockReturnValue(overlapQuery);

    try {
      await expect(createRun(scope, "actor-b", {
        periodKey: "2026-07", startDate: "2026-07-15", endDate: "2026-08-14", type: "regular",
      })).rejects.toMatchObject({ code: "PAYROLL_PERIOD_OVERLAP", status: 409 });

      expect(startSession).toHaveBeenCalledTimes(2);
      expect(mocks.reservationFindOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(mocks.runFindOne).toHaveBeenCalledOnce();
      expect(mocks.runCreate).not.toHaveBeenCalled();
      expect(sessions.every((session) => session.endSession.mock.calls.length === 1)).toBe(true);
    } finally {
      startSession.mockRestore();
      (mongoose.connection as any).readyState = priorReadyState;
    }
  });

  it("permits multiple same-range supplemental runs", async () => {
    mocks.runCreate
      .mockResolvedValueOnce({ _id: "supplemental-1", version: 0 })
      .mockResolvedValueOnce({ _id: "supplemental-2", version: 0 });
    const input = {
      periodKey: "2026-07", startDate: "2026-07-01", endDate: "2026-07-31",
      type: "supplemental" as const, supplementalReason: "Late overtime approval",
    };

    await createRun(scope, "actor-a", input);
    await createRun(scope, "actor-a", input);

    expect(mocks.runFindOne).not.toHaveBeenCalled();
    expect(mocks.reservationFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.runCreate).toHaveBeenCalledTimes(2);
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: "create_run" }));
  });

  it("enforces the supplemental parent-or-reason invariant in the service", async () => {
    await expect(createRun(scope, "actor-a", {
      periodKey: "2026-07", startDate: "2026-07-01", endDate: "2026-07-31", type: "supplemental",
    })).rejects.toMatchObject({ code: "PAYROLL_SUPPLEMENTAL_REFERENCE_REQUIRED", status: 400 });
    await expect(createRun(scope, "actor-a", {
      periodKey: "2026-07", startDate: "2026-07-01", endDate: "2026-07-31",
      type: "supplemental", parentRunId: " ",
    })).rejects.toMatchObject({ code: "PAYROLL_SUPPLEMENTAL_REFERENCE_REQUIRED", status: 400 });

    expect(mocks.runCreate).not.toHaveBeenCalled();
  });

  it("normalizes branch-scoped attendance and exposes unresolved approvals as blocking issues", async () => {
    mocks.runFindOne.mockReturnValue(lean({
      _id: "run-a", ...scope, periodKey: "2026-07", status: "draft", version: 0, issues: [],
    }));
    mocks.jobFindOne.mockReturnValue(lean(null));
    mocks.jobCreate.mockResolvedValue({ _id: "job-a" });
    mocks.attendanceFind.mockReturnValue(lean([{
      _id: "attendance-a",
      version: 3,
      employeeId: "employee-a",
      employeeName: "A",
      standardHours: 176,
      standardDays: 22,
      workedMinutes: 9600,
      shortageMinutes: 0,
      paidLeaveMinutesByRate: [],
      overtime: [],
      status: "draft",
      needsRecalculation: false,
    }]));
    mocks.runFindOneAndUpdate.mockResolvedValue({ _id: "run-a", version: 1 });
    mocks.jobFindOneAndUpdate.mockResolvedValue({
      _id: "job-a", status: "succeeded", result: { employeeCount: 1, blockingIssueCount: 1 },
    });

    const result = await syncAttendance(scope, "run-a", "actor-a", 0, "sync-1");

    expect(mocks.attendanceFind).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "branch-a", periodKey: "2026-07" });
    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "run-a", ...scope, status: "draft", version: 0 },
      expect.objectContaining({
        $set: { issues: [expect.objectContaining({ code: "ATTENDANCE_APPROVAL_PENDING", severity: "blocking" })] },
        $inc: { version: 1 },
      }),
      expect.objectContaining({ new: true, runValidators: true }),
    );
    expect(result.job.status).toBe("succeeded");
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: "sync_attendance" }));
  });

  it("replays a completed sync idempotently without reading attendance again", async () => {
    const prior = {
      _id: "job-a", companyCode: "ACME", branchId: "branch-a", runId: "run-a",
      operation: "sync-attendance", idempotencyKey: "sync-1", status: "succeeded",
      payload: { expectedVersion: 0 }, result: { employeeCount: 2, runVersion: 1 },
    };
    mocks.jobFindOne.mockReturnValue(lean(prior));

    const result = await syncAttendance(scope, "run-a", "actor-a", 0, "sync-1");

    expect(result).toEqual({ job: prior, runVersion: 1 });
    expect(mocks.jobFindOne).toHaveBeenCalledWith({
      companyCode: "ACME", branchId: "branch-a", idempotencyKey: "sync-1", operation: "sync-attendance",
    });
    expect(mocks.runFindOne).not.toHaveBeenCalled();
    expect(mocks.attendanceFind).not.toHaveBeenCalled();
    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("replays the winning sync when a concurrent idempotency reservation collides", async () => {
    const winner = {
      _id: "job-winner", ...scope, runId: "run-a", operation: "sync-attendance",
      idempotencyKey: "sync-race", status: "succeeded",
      payload: { expectedVersion: 0 }, result: { employeeCount: 2, runVersion: 1 },
    };
    mocks.jobFindOne
      .mockReturnValueOnce(lean(null))
      .mockReturnValueOnce(lean(winner));
    mocks.runFindOne.mockReturnValue(lean({
      _id: "run-a", ...scope, periodKey: "2026-07", status: "draft", version: 0, issues: [],
    }));
    mocks.jobCreate.mockRejectedValue(Object.assign(new Error("duplicate key"), { code: 11000 }));

    await expect(syncAttendance(scope, "run-a", "actor-a", 0, "sync-race")).resolves.toEqual({
      job: winner, runVersion: 1,
    });
  });

  it("returns the current version when the atomic sync update loses a race", async () => {
    mocks.jobFindOne.mockReturnValue(lean(null));
    mocks.runFindOne
      .mockReturnValueOnce(lean({
        _id: "run-a", ...scope, periodKey: "2026-07", status: "draft", version: 1, issues: [],
      }))
      .mockReturnValueOnce(lean({
        _id: "run-a", ...scope, periodKey: "2026-07", status: "draft", version: 2, issues: [],
      }));
    mocks.jobCreate.mockResolvedValue({ _id: "job-a" });
    mocks.attendanceFind.mockReturnValue(lean([{
      _id: "attendance-a", employeeId: "employee-a", standardHours: 176, standardDays: 22,
      workedMinutes: 9600, shortageMinutes: 0, paidLeaveMinutesByRate: [], overtime: [],
      status: "locked", needsRecalculation: false,
    }]));
    mocks.runFindOneAndUpdate.mockResolvedValue(null);

    await expect(syncAttendance(scope, "run-a", "actor-a", 1, "sync-race")).rejects.toMatchObject({
      code: "PAYROLL_VERSION_CONFLICT", status: 409, currentVersion: 2,
    });
  });

  it("lists issues only from the requested company and branch", async () => {
    mocks.runFindOne.mockReturnValue(lean({ issues: [{ code: "A" }] }));

    await expect(listIssues(scope, "run-a")).resolves.toEqual([{ code: "A" }]);
    expect(mocks.runFindOne).toHaveBeenCalledWith({ _id: "run-a", ...scope });
  });

  it("refuses to lock attendance while blocking issues remain", async () => {
    mocks.runFindOne.mockReturnValue(lean({
      _id: "run-a", ...scope, periodKey: "2026-07", status: "draft", version: 1,
      issues: [{ code: "ATTENDANCE_APPROVAL_PENDING", severity: "blocking" }],
    }));

    await expect(lockAttendance(scope, "run-a", "actor-a", 1)).rejects.toMatchObject({
      code: "PAYROLL_BLOCKING_ISSUES", status: 409,
    });
    expect(mocks.snapshotCreate).not.toHaveBeenCalled();
  });

  it("persists the synced attendance snapshot and atomically locks the run", async () => {
    mocks.runFindOne.mockReturnValue(lean({
      _id: "run-a", ...scope, periodKey: "2026-07", status: "draft", version: 1, issues: [],
    }));
    mocks.jobFindOne.mockReturnValue(sortedLean({
      _id: "job-a", status: "succeeded", result: { employees: [{
        employeeId: "employee-a", standardHours: 176, standardDays: 22,
        workedMinutes: 9600, shortageMinutes: 0, paidLeaveMinutesByRate: [], overtime: [],
        sourceResultId: "attendance-a", sourceVersion: 3,
      }] },
    }));
    mocks.snapshotCreate.mockResolvedValue({ _id: "snapshot-a", runId: "run-a" });
    mocks.runFindOneAndUpdate.mockResolvedValue({ _id: "run-a", status: "draft", version: 2 });

    const result = await lockAttendance(scope, "run-a", "actor-a", 1);

    expect(mocks.snapshotCreate).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME", branchId: "branch-a", runId: "run-a", periodKey: "2026-07",
      lockedBy: "actor-a", employees: [expect.objectContaining({ sourceResultId: "attendance-a", sourceVersion: 3 })],
    }));
    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "run-a", ...scope, status: "draft", version: 1 },
      { $inc: { version: 1 } },
      expect.objectContaining({ new: true, runValidators: true }),
    );
    expect(result.run.version).toBe(2);
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      branchId: "branch-a", action: "lock_attendance",
    }));
    expect(mocks.runFindOneAndUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.snapshotCreate.mock.invocationCallOrder[0],
    );
  });

  it.each([
    {
      name: "ignores a newer sync from another run version",
      candidates: [
        { _id: "job-old", createdAt: "2026-07-01T00:00:00.000Z", result: { runVersion: 1, employees: [{ employeeId: "expected-old", standardHours: 1, standardDays: 1, workedMinutes: 1, shortageMinutes: 0, paidLeaveMinutesByRate: [], overtime: [] }] } },
        { _id: "job-new", createdAt: "2026-07-02T00:00:00.000Z", result: { runVersion: 2, employees: [{ employeeId: "wrong-new", standardHours: 1, standardDays: 1, workedMinutes: 1, shortageMinutes: 0, paidLeaveMinutesByRate: [], overtime: [] }] } },
      ],
      expectedEmployee: "expected-old",
    },
    {
      name: "uses descending id when matching sync jobs share createdAt",
      candidates: [
        { _id: "job-a", createdAt: "2026-07-01T00:00:00.000Z", result: { runVersion: 1, employees: [{ employeeId: "wrong-a", standardHours: 1, standardDays: 1, workedMinutes: 1, shortageMinutes: 0, paidLeaveMinutesByRate: [], overtime: [] }] } },
        { _id: "job-b", createdAt: "2026-07-01T00:00:00.000Z", result: { runVersion: 1, employees: [{ employeeId: "expected-b", standardHours: 1, standardDays: 1, workedMinutes: 1, shortageMinutes: 0, paidLeaveMinutesByRate: [], overtime: [] }] } },
      ],
      expectedEmployee: "expected-b",
    },
  ])("selects a version-matched sync deterministically: $name", async ({ candidates, expectedEmployee }) => {
    mocks.runFindOne.mockReturnValue(lean({
      _id: "run-a", ...scope, periodKey: "2026-07", status: "draft", version: 1, issues: [],
    }));
    const sort = vi.fn((order) => ({
      lean: vi.fn().mockResolvedValue(candidates
        .filter((candidate) => candidate.result.runVersion === 1)
        .sort((left, right) => {
          const dateOrder = String(right.createdAt).localeCompare(String(left.createdAt));
          return dateOrder || String(right._id).localeCompare(String(left._id));
        })[0] || null),
    }));
    mocks.jobFindOne.mockImplementation((filter) => {
      const matching = candidates.filter((candidate) => (
        candidate.result.runVersion === filter["result.runVersion"]
      ));
      return {
        sort: vi.fn((order) => {
          sort(order);
          return {
            lean: vi.fn().mockResolvedValue(matching.sort((left, right) => {
              const dateOrder = String(right.createdAt).localeCompare(String(left.createdAt));
              return dateOrder || String(right._id).localeCompare(String(left._id));
            })[0] || null),
          };
        }),
      };
    });
    mocks.runFindOneAndUpdate.mockResolvedValue({ _id: "run-a", status: "draft", version: 2 });
    mocks.snapshotCreate.mockImplementation(async (value) => ({ ...(Array.isArray(value) ? value[0] : value), _id: "snapshot-a" }));

    await lockAttendance(scope, "run-a", "actor-a", 1);

    expect(mocks.jobFindOne).toHaveBeenCalledWith({
      ...scope,
      runId: "run-a",
      operation: "sync-attendance",
      status: "succeeded",
      "result.runVersion": 1,
    });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(mocks.snapshotCreate).toHaveBeenCalledWith(expect.objectContaining({
      employees: [expect.objectContaining({ employeeId: expectedEmployee })],
    }));
  });
});

describe("operational payroll controller and routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns HTTP 409 with the current version for stale mutations", async () => {
    mocks.jobFindOne.mockReturnValue(lean(null));
    mocks.runFindOne.mockReturnValue(lean({
      _id: "run-a", ...scope, periodKey: "2026-07", status: "draft", version: 4, issues: [],
    }));
    const res = response();

    await payrollController.syncAttendance(request({ expectedVersion: 3 }, { "idempotency-key": "sync-1" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: "error", code: "PAYROLL_VERSION_CONFLICT", currentVersion: 4,
    }));
  });

  it("mounts the create, sync, issue, lock, and calculate routes", () => {
    const mounted = (payrollRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

    expect(mounted).toEqual(expect.arrayContaining([
      "POST /runs",
      "POST /runs/:id/sync-attendance",
      "POST /runs/:id/lock-attendance",
      "GET /runs/:id/issues",
      "POST /runs/:id/calculate",
      "POST /runs/:id/recalculate",
      "POST /runs/:id/review",
      "POST /runs/:id/reopen",
      "POST /runs/:id/close",
      "GET /runs/:id/audit",
    ]));
  });

  it("guards line override reads and bulk writes with payroll permissions", () => {
    expect(permissionOf("GET", "/periods/:periodKey/line-overrides")).toBe("payroll-period:read");
    expect(permissionOf("PUT", "/periods/:periodKey/line-overrides")).toBe("payroll-period:manage");
  });

  it("never exposes a line override route without a permission guard", () => {
    const lineOverrideRoutes = (payrollRouter as any).stack.filter((item: any) => (
      item.route?.path === "/periods/:periodKey/line-overrides"
    ));

    expect(lineOverrideRoutes).toHaveLength(2);
    expect(lineOverrideRoutes.every((item: any) => (
      item.route.stack.some((handler: any) => permissionGuards.has(handler.handle))
    ))).toBe(true);
  });
});
