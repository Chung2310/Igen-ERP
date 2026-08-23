import { describe, expect, it, vi } from "vitest";
import { createPayrollEffectiveSnapshotRepairer } from "./payroll-effective-snapshot-repair.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const reviewRun = {
  _id: "run-a",
  ...scope,
  periodKey: "2026-08",
  status: "review",
  version: 3,
  activeRevisionId: "revision-a",
  activeRevisionChecksum: "source-checksum",
  effectiveSnapshot: { checksum: "stale-checksum" },
};
const replacement = {
  sourceRevisionId: "revision-a",
  sourceRevisionChecksum: "source-checksum",
  checksum: "replacement-checksum",
  lines: [{ employeeId: "employee-a" }],
};

const arrange = (overrides: Record<string, unknown> = {}) => {
  const dependencies = {
    transactionRunner: async (operation: any) => operation(undefined),
    getRun: vi.fn(async () => reviewRun),
    createSnapshot: vi.fn(async () => replacement),
    updateRun: vi.fn(async () => ({ ...reviewRun, version: 4, effectiveSnapshot: replacement })),
    verifyRun: vi.fn(async () => true),
    createAudit: vi.fn(async () => undefined),
    log: vi.fn(),
    ...overrides,
  };
  return { dependencies, repair: createPayrollEffectiveSnapshotRepairer(dependencies as any) };
};

describe("effective payroll snapshot repair", () => {
  it("atomically replaces and audits a mismatched review snapshot", async () => {
    const { dependencies, repair } = arrange();

    const repaired = await repair(scope, "run-a", "manager-a", 3, "request-a");

    expect(dependencies.updateRun).toHaveBeenCalledWith(
      scope,
      "run-a",
      3,
      replacement,
      undefined,
    );
    expect(dependencies.verifyRun).toHaveBeenCalledWith(scope, expect.objectContaining({ version: 4 }), undefined);
    expect(dependencies.createAudit).toHaveBeenCalledWith(expect.objectContaining({
      ...scope,
      periodKey: "2026-08",
      action: "effective_snapshot_repaired",
      actorId: "manager-a",
      metadata: {
        runId: "run-a",
        previousChecksum: "stale-checksum",
        replacementChecksum: "replacement-checksum",
        sourceRevisionChecksum: "source-checksum",
        previousVersion: 3,
        replacementVersion: 4,
        correlationId: "request-a",
      },
    }), undefined);
    expect(repaired).toMatchObject({ version: 4, effectiveSnapshot: replacement });
  });

  it.each(["closed", "paid"])("refuses to mutate a %s run", async (status) => {
    const { dependencies, repair } = arrange({ getRun: vi.fn(async () => ({ ...reviewRun, status })) });

    await expect(repair(scope, "run-a", "manager-a", 3)).rejects.toMatchObject({
      code: "PAYROLL_EFFECTIVE_REPAIR_REFUSED",
      status: 409,
    });
    expect(dependencies.updateRun).not.toHaveBeenCalled();
    expect(dependencies.createAudit).not.toHaveBeenCalled();
  });

  it("accepts a concurrent winner only after its snapshot verifies", async () => {
    const winner = { ...reviewRun, version: 4, effectiveSnapshot: replacement };
    const getRun = vi.fn().mockResolvedValueOnce(reviewRun).mockResolvedValueOnce(winner);
    const { dependencies, repair } = arrange({
      getRun,
      updateRun: vi.fn(async () => null),
      verifyRun: vi.fn(async () => true),
    });

    await expect(repair(scope, "run-a", "manager-a", 3)).resolves.toBe(winner);
    expect(dependencies.verifyRun).toHaveBeenCalledWith(scope, winner, undefined);
    expect(dependencies.createAudit).not.toHaveBeenCalled();
  });

  it("returns a version conflict when the concurrent winner is invalid", async () => {
    const winner = { ...reviewRun, version: 4, effectiveSnapshot: replacement };
    const getRun = vi.fn().mockResolvedValueOnce(reviewRun).mockResolvedValueOnce(winner);
    const { repair } = arrange({
      getRun,
      updateRun: vi.fn(async () => null),
      verifyRun: vi.fn(async () => false),
    });

    await expect(repair(scope, "run-a", "manager-a", 3)).rejects.toMatchObject({
      code: "PAYROLL_VERSION_CONFLICT",
      status: 409,
    });
  });
});
