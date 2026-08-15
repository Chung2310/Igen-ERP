import { afterEach, describe, expect, it, vi } from "vitest";
import { PayrollRunModel } from "../model/payroll-run.model";
import { calculatePayrollChecksum } from "./payroll-checksum.service";
import {
  calculateEffectivePayrollChecksum,
  createPayrollEffectiveLineLoader,
} from "./payroll-effective-line.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const lines = [{
  employeeId: "employee-a",
  employeeName: "Employee A",
  sourceIds: ["contract-a"],
  effectiveSegments: [{ sourceId: "contract-a", start: "2026-07-01", end: "2026-07-15" }],
  calculation: {
    monthlySalary: 6_000,
    adjustedBase: 5_000,
    overtime: 500,
    bonuses: 200,
    allowances: 300,
    gross: 6_000,
    otherDeductions: 100,
    deductions: 100,
    net: 5_900,
  },
  attendance: { workedDays: 10 },
  vietnam: { income: { totalIncome: 6_000 }, deductions: { other: 100, total: 100 }, netPay: 5_900 },
  formulaVersion: "vietnam-payroll-1",
  warnings: [],
  periodInput: { version: 2, values: { agreedSalary: 6_000, sales: 125 }, provenance: {} },
}, {
  employeeId: "employee-a",
  employeeName: "Employee A",
  sourceIds: ["contract-b"],
  effectiveSegments: [{ sourceId: "contract-b", start: "2026-07-16", end: "2026-07-31" }],
  calculation: {
    monthlySalary: 4_000,
    adjustedBase: 3_000,
    overtime: 200,
    bonuses: 100,
    allowances: 200,
    gross: 3_500,
    otherDeductions: 50,
    deductions: 50,
    net: 3_450,
  },
  attendance: { workedDays: 11 },
  vietnam: { income: { totalIncome: 3_500 }, deductions: { other: 50, total: 50 }, netPay: 3_450 },
  formulaVersion: "vietnam-payroll-1",
  warnings: [],
  periodInput: { version: 3, values: { agreedSalary: 4_000, sales: 275 }, provenance: {} },
}];
const totals = { grossPay: 9_500, deductions: 150, netPay: 9_350 };
const sourceChecksum = calculatePayrollChecksum({ lines, totals });
const revision = { _id: "revision-a", runId: "run-a", status: "completed", lines, totals, checksum: sourceChecksum };
const run = (changes: Record<string, unknown> = {}) => ({
  _id: "run-a",
  ...scope,
  periodKey: "2026-07",
  type: "regular",
  status: "draft",
  activeRevisionId: "revision-a",
  activeRevisionChecksum: sourceChecksum,
  ...changes,
});

describe("authoritative effective payroll line loader", () => {
  afterEach(() => vi.restoreAllMocks());

  it("validates the scoped active revision and materializes one override-aware compatible employee line", async () => {
    const getRevision = vi.fn(async () => revision);
    const getOverrides = vi.fn(async () => [{
      employeeId: "employee-a",
      adjustedBase: 7_000,
      bonusTotal: 0,
      customValues: { sales: 900 },
      version: 4,
    }]);
    const loader = createPayrollEffectiveLineLoader({ getRevision, getOverrides });

    const loaded = await loader.load(scope, run());

    expect(getRevision).toHaveBeenCalledWith(scope, "revision-a", "run-a", undefined);
    expect(getOverrides).toHaveBeenCalledWith(scope, "2026-07", ["employee-a"], undefined);
    expect(loaded.sourceLines).toEqual(lines);
    expect(loaded.sourceTotals).toEqual(totals);
    expect(loaded.sourceRevisionChecksum).toBe(sourceChecksum);
    expect(loaded.effectiveChecksum).not.toBe(sourceChecksum);
    expect(loaded.effectiveLines).toHaveLength(1);
    expect(loaded.effectiveLines[0]).toMatchObject({
      employeeId: "employee-a",
      overrideVersion: 4,
      effectiveValues: { adjustedBase: 7_000, bonusTotal: 0, customValues: { sales: 900 } },
      calculation: { adjustedBase: 7_000, bonusTotal: 0, deductions: 150, net: 8_050 },
      attendance: { workedDays: 10 },
      vietnam: expect.any(Object),
    });
  });

  it("pins override versions and values in a checksum while keeping the source revision checksum unchanged", async () => {
    const loader = createPayrollEffectiveLineLoader({
      getRevision: async () => revision,
      getOverrides: async () => [{ employeeId: "employee-a", adjustedBase: 7_000, version: 4 }],
    });
    const snapshot = await loader.createSnapshot(scope, run());

    expect(snapshot.sourceRevisionId).toBe("revision-a");
    expect(snapshot.sourceRevisionChecksum).toBe(sourceChecksum);
    expect(snapshot.checksum).toBe(calculateEffectivePayrollChecksum(sourceChecksum, snapshot.lines));
    expect(calculateEffectivePayrollChecksum(sourceChecksum, snapshot.lines)).not.toBe(
      calculateEffectivePayrollChecksum(sourceChecksum, snapshot.lines.map((line: any) => ({ ...line, overrideVersion: 5 }))),
    );
    expect(revision.checksum).toBe(sourceChecksum);
  });

  it("uses and verifies the pinned snapshot after review instead of reading mutable override rows", async () => {
    const getOverrides = vi.fn(async () => [{ employeeId: "employee-a", adjustedBase: 1, version: 99 }]);
    const loader = createPayrollEffectiveLineLoader({ getRevision: async () => revision, getOverrides });
    const snapshot = await loader.createSnapshot(scope, run());
    getOverrides.mockClear();

    const loaded = await loader.load(scope, run({ status: "closed", effectiveSnapshot: snapshot }));

    expect(loaded.pinned).toBe(true);
    expect(loaded.effectiveLines).toEqual(snapshot.lines);
    expect(loaded.effectiveChecksum).toBe(snapshot.checksum);
    expect(getOverrides).not.toHaveBeenCalled();
  });

  it("verifies a newly pinned snapshot after PayrollRun persistence conversion", async () => {
    const loader = createPayrollEffectiveLineLoader({
      getRevision: async () => revision,
      getOverrides: async () => [{
        employeeId: "employee-a",
        adjustedBase: 7_000,
        customValues: {},
        version: 1,
      }],
    });
    const snapshot = await loader.createSnapshot(scope, run());
    const document = new PayrollRunModel({
      ...run({ status: "review" }),
      createdBy: "manager-a",
      effectiveSnapshot: snapshot,
    });
    const storedSnapshot = document.toObject().effectiveSnapshot;

    const loaded = await loader.load(scope, run({
      status: "review",
      effectiveSnapshot: storedSnapshot,
    }));

    expect(storedSnapshot.lines).toEqual(snapshot.lines);
    expect(loaded.pinned).toBe(true);
    expect(loaded.effectiveChecksum).toBe(snapshot.checksum);
  });

  it("fails closed when the active revision checksum or pinned effective checksum is invalid", async () => {
    const loader = createPayrollEffectiveLineLoader({
      getRevision: async () => revision,
      getOverrides: async () => [],
    });

    await expect(loader.load(scope, run({ activeRevisionChecksum: "stale" })))
      .rejects.toMatchObject({ code: "PAYROLL_CHECKSUM_MISMATCH", status: 409 });

    const snapshot = await loader.createSnapshot(scope, run());
    await expect(loader.load(scope, run({
      status: "closed",
      effectiveSnapshot: { ...snapshot, checksum: "tampered" },
    }))).rejects.toMatchObject({ code: "PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH", status: 409 });
  });

  it("logs run context when the pinned source checksum no longer matches", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const loader = createPayrollEffectiveLineLoader({
      getRevision: async () => revision,
      getOverrides: async () => [],
    });
    const snapshot = await loader.createSnapshot(scope, run());

    await expect(loader.load(scope, run({
      status: "review",
      effectiveSnapshot: { ...snapshot, sourceRevisionChecksum: "stale-source" },
    }))).rejects.toMatchObject({ code: "PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH" });

    expect(errorLog).toHaveBeenCalledWith(
      "[Payroll] Effective snapshot mismatch",
      expect.objectContaining({
        stage: "source-checksum",
        runId: "run-a",
        periodKey: "2026-07",
        snapshotSourceRevisionChecksum: "stale-source",
      }),
    );
    errorLog.mockRestore();
  });

  it("logs run context when the pinned effective checksum is invalid", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const loader = createPayrollEffectiveLineLoader({
      getRevision: async () => revision,
      getOverrides: async () => [],
    });
    const snapshot = await loader.createSnapshot(scope, run());

    await expect(loader.load(scope, run({
      status: "review",
      effectiveSnapshot: { ...snapshot, checksum: "tampered" },
    }))).rejects.toMatchObject({ code: "PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH" });

    expect(errorLog).toHaveBeenCalledWith(
      "[Payroll] Effective snapshot mismatch",
      expect.objectContaining({
        stage: "effective-checksum",
        runId: "run-a",
        periodKey: "2026-07",
        recomputedChecksum: snapshot.checksum,
        snapshotChecksum: "tampered",
      }),
    );
    errorLog.mockRestore();
  });

  it("keeps pre-upgrade reviewed runs readable when no manual override ever existed", async () => {
    const getOverrides = vi.fn(async () => []);
    const loader = createPayrollEffectiveLineLoader({
      getRevision: async () => revision,
      getOverrides,
    });

    const loaded = await loader.load(scope, run({ status: "closed", effectiveSnapshot: undefined }));

    expect(loaded.legacyUnpinned).toBe(true);
    expect(loaded.pinned).toBe(false);
    expect(loaded.effectiveLines).toHaveLength(1);
    expect(getOverrides).toHaveBeenCalledOnce();
  });

  it("fails closed when an unpinned reviewed run has manual overrides", async () => {
    const getOverrides = vi.fn(async () => [{
      employeeId: "employee-a",
      adjustedBase: 7_000,
      version: 1,
    }]);
    const loader = createPayrollEffectiveLineLoader({
      getRevision: async () => revision,
      getOverrides,
    });

    await expect(loader.load(scope, run({ status: "review", effectiveSnapshot: undefined })))
      .rejects.toMatchObject({
        code: "PAYROLL_EFFECTIVE_SNAPSHOT_MISSING",
        status: 409,
      });
  });

  it("keeps a pre-upgrade non-revision closed run immutable and readable", async () => {
    const getOverrides = vi.fn(async () => []);
    const loader = createPayrollEffectiveLineLoader({
      getRevision: vi.fn(),
      getOverrides,
    });
    const legacyRun = {
      _id: "legacy-run",
      ...scope,
      periodKey: "2026-07",
      type: "regular",
      status: "closed",
      lines,
      totals,
    };

    const loaded = await loader.load(scope, legacyRun);

    expect(loaded.legacyUnpinned).toBe(true);
    expect(loaded.sourceRevisionId).toBeUndefined();
    expect(loaded.effectiveLines).toHaveLength(1);
  });

  it("never applies a mutable override to an unpinned closed legacy run", async () => {
    const loader = createPayrollEffectiveLineLoader({
      getRevision: vi.fn(),
      getOverrides: async () => [{ employeeId: "employee-a", adjustedBase: 1, version: 2 }],
    });

    await expect(loader.load(scope, {
      _id: "legacy-run",
      ...scope,
      periodKey: "2026-07",
      type: "regular",
      status: "closed",
      lines,
      totals,
    })).rejects.toMatchObject({
      code: "PAYROLL_EFFECTIVE_SNAPSHOT_MISSING",
      status: 409,
    });
  });

  it("ignores a metadata-only override tombstone on a pre-upgrade closed run", async () => {
    const loader = createPayrollEffectiveLineLoader({
      getRevision: vi.fn(),
      getOverrides: async () => [{
        employeeId: "employee-a",
        reason: "Restored every field",
        updatedBy: "manager-a",
        version: 7,
        customValues: {},
      }],
    });

    const loaded = await loader.load(scope, {
      _id: "legacy-run",
      ...scope,
      periodKey: "2026-07",
      type: "regular",
      status: "closed",
      lines,
      totals,
    });

    expect(loaded.legacyUnpinned).toBe(true);
    expect(loaded.overrideCount).toBe(0);
    expect(loaded.effectiveLines[0].overrideVersion).toBe(0);
  });

  it("recomputes and validates a legacy source checksum instead of trusting its stored value", async () => {
    const loader = createPayrollEffectiveLineLoader({
      getRevision: vi.fn(),
      getOverrides: async () => [],
    });
    const legacyRun = {
      _id: "legacy-run",
      ...scope,
      periodKey: "2026-07",
      type: "regular",
      status: "draft",
      lines,
      totals,
      activeRevisionChecksum: "stale-checksum",
    };

    await expect(loader.load(scope, legacyRun)).rejects.toMatchObject({
      code: "PAYROLL_CHECKSUM_MISMATCH",
      status: 409,
    });
  });
});
