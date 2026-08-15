import type { ClientSession } from "mongoose";
import { PayrollCalculationRevisionModel } from "../model/payroll-calculation-revision.model";
import { PayrollLineOverrideModel } from "../model/payroll-line-override.model";
import { PayrollOperationError, type PayrollOperationScope } from "./payroll-run-operations.service";
import { calculatePayrollChecksum } from "./payroll-checksum.service";
import { projectPayrollRevisionWithOverrides } from "./payroll-run-calculate-operations.service";
import { PAYROLL_LINE_OVERRIDE_FIELDS } from "../interface/payroll-line-override.interface";

type EffectivePayrollLineLoaderDependencies = {
  getRevision: (
    scope: PayrollOperationScope,
    revisionId: string,
    runId: string,
    session?: ClientSession,
  ) => Promise<any>;
  getOverrides: (
    scope: PayrollOperationScope,
    periodKey: string,
    employeeIds: string[],
    session?: ClientSession,
  ) => Promise<any[]>;
};

type PayrollRunForEffectiveLines = {
  _id?: unknown;
  id?: string;
  periodKey: string;
  type?: string;
  status?: string;
  activeRevisionId?: string;
  activeRevisionChecksum?: string;
  lines?: any[];
  totals?: unknown;
  effectiveSnapshot?: any;
};

const fail = (code: string, message: string, status = 409): never => {
  throw new PayrollOperationError(code, message, status);
};

const sessionQuery = (query: any, session?: ClientSession) => (
  session ? query.session(session) : query
);

const defaultDependencies: EffectivePayrollLineLoaderDependencies = {
  getRevision: async (scope, revisionId, runId, session) => sessionQuery(
    PayrollCalculationRevisionModel.findOne({
      _id: revisionId,
      runId,
      ...scope,
    }),
    session,
  ).lean(),
  getOverrides: async (scope, periodKey, employeeIds, session) => sessionQuery(
    PayrollLineOverrideModel.find({
      ...scope,
      periodKey,
      employeeId: { $in: employeeIds },
    }),
    session,
  ).lean(),
};

const effectiveChecksumLines = (lines: any[]) => [...lines]
  .sort((left, right) => String(left.employeeId).localeCompare(String(right.employeeId)))
  .map(({ segmentLines: _segmentLines, ...line }) => line);

const hasMaterialOverride = (override: any) => {
  if (PAYROLL_LINE_OVERRIDE_FIELDS.some((field) => override?.[field] !== undefined)) return true;
  const customValues = override?.customValues;
  return customValues instanceof Map
    ? customValues.size > 0
    : Boolean(customValues && Object.keys(customValues).length);
};

export function calculateEffectivePayrollChecksum(
  sourceRevisionChecksum: string,
  lines: any[],
) {
  return calculatePayrollChecksum({
    sourceRevisionChecksum,
    lines: effectiveChecksumLines(lines),
  });
}

export function createPayrollEffectiveLineLoader(
  dependencies: EffectivePayrollLineLoaderDependencies = defaultDependencies,
) {
  const loadSource = async (
    scope: PayrollOperationScope,
    run: PayrollRunForEffectiveLines,
    session?: ClientSession,
  ) => {
    const runId = String(run._id ?? run.id ?? "");
    if (run.activeRevisionId) {
      const revision = await dependencies.getRevision(
        scope,
        String(run.activeRevisionId),
        runId,
        session,
      );
      if (!revision || revision.status !== "completed") {
        fail("PAYROLL_REVISION_MISSING", "The active calculation revision is not available");
      }
      const recomputed = calculatePayrollChecksum({
        lines: revision.lines ?? [],
        totals: revision.totals,
      });
      if (
        recomputed !== revision.checksum
        || revision.checksum !== run.activeRevisionChecksum
      ) {
        fail(
          "PAYROLL_CHECKSUM_MISMATCH",
          "Payroll source revision checksum does not match the active run",
        );
      }
      return {
        sourceLines: revision.lines ?? [],
        sourceTotals: revision.totals,
        sourceRevisionId: String(run.activeRevisionId),
        sourceRevisionChecksum: String(revision.checksum),
      };
    }

    const sourceLines = run.lines ?? [];
    const sourceRevisionChecksum = calculatePayrollChecksum({
      lines: sourceLines,
      totals: run.totals,
    });
    if (
      run.activeRevisionChecksum
      && run.activeRevisionChecksum !== sourceRevisionChecksum
    ) {
      fail(
        "PAYROLL_CHECKSUM_MISMATCH",
        "Legacy payroll source checksum does not match the active run",
      );
    }
    return {
      sourceLines,
      sourceTotals: run.totals,
      sourceRevisionId: undefined,
      sourceRevisionChecksum,
    };
  };

  const loadCurrent = async (
    scope: PayrollOperationScope,
    run: PayrollRunForEffectiveLines,
    session?: ClientSession,
  ) => {
    const source = await loadSource(scope, run, session);
    const employeeIds: string[] = [...new Set<string>(
      source.sourceLines.map((line: any) => String(line.employeeId)),
    )].sort();
    const overrides = run.type === "regular" && employeeIds.length
      ? await dependencies.getOverrides(scope, run.periodKey, employeeIds, session)
      : [];
    const materialOverrides = overrides.filter(hasMaterialOverride);
    const effectiveLines = projectPayrollRevisionWithOverrides(
      { lines: source.sourceLines },
      materialOverrides,
    ).effectiveLines.sort((left: any, right: any) => (
      String(left.employeeId).localeCompare(String(right.employeeId))
    ));
    return {
      ...source,
      effectiveLines,
      effectiveChecksum: calculateEffectivePayrollChecksum(
        source.sourceRevisionChecksum,
        effectiveLines,
      ),
      pinned: false,
      legacyUnpinned: false,
      overrideCount: materialOverrides.length,
    };
  };

  const createSnapshot = async (
    scope: PayrollOperationScope,
    run: PayrollRunForEffectiveLines,
    session?: ClientSession,
  ) => {
    const current = await loadCurrent(scope, run, session);
    return {
      ...(current.sourceRevisionId ? { sourceRevisionId: current.sourceRevisionId } : {}),
      sourceRevisionChecksum: current.sourceRevisionChecksum,
      checksum: current.effectiveChecksum,
      lines: current.effectiveLines,
      pinnedAt: new Date(),
    };
  };

  const load = async (
    scope: PayrollOperationScope,
    run: PayrollRunForEffectiveLines,
    session?: ClientSession,
  ) => {
    const snapshot = run.status !== "draft" ? run.effectiveSnapshot : undefined;
    if (run.status !== "draft" && !snapshot) {
      // Runs closed before effective snapshots were introduced remain safely
      // readable from their immutable source revision only when no override
      // exists. Applying a mutable override here would fabricate a close-time
      // value, so that case still fails closed.
      const legacyCurrent = await loadCurrent(scope, run, session);
      if (legacyCurrent.overrideCount > 0) {
        fail(
          "PAYROLL_EFFECTIVE_SNAPSHOT_MISSING",
          "Reviewed payroll results with manual overrides require a pinned effective snapshot",
        );
      }
      return { ...legacyCurrent, legacyUnpinned: true };
    }
    if (!snapshot) return loadCurrent(scope, run, session);

    const source = await loadSource(scope, run, session);
    if (
      snapshot.sourceRevisionChecksum !== source.sourceRevisionChecksum
      || (snapshot.sourceRevisionId ?? undefined) !== source.sourceRevisionId
    ) {
      console.error("[CHECKSUM DEBUG 1]", {
        snapshotSourceRevisionChecksum: snapshot.sourceRevisionChecksum,
        sourceRevisionChecksum: source.sourceRevisionChecksum,
        snapshotSourceRevisionId: snapshot.sourceRevisionId,
        sourceRevisionId: source.sourceRevisionId,
      });
      fail(
        "PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH",
        "Pinned payroll source no longer matches the active revision",
      );
    }
    const effectiveLines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
    const recomputed = calculateEffectivePayrollChecksum(
      source.sourceRevisionChecksum,
      effectiveLines,
    );
    if (recomputed !== snapshot.checksum) {
      console.error("[CHECKSUM DEBUG 2]", {
        recomputedChecksum: recomputed,
        snapshotChecksum: snapshot.checksum,
      });
      fail(
        "PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH",
        "Pinned effective payroll snapshot checksum is invalid",
      );
    }
    return {
      ...source,
      effectiveLines,
      effectiveChecksum: snapshot.checksum,
      pinned: true,
      legacyUnpinned: false,
      overrideCount: effectiveLines.filter((line: any) => Number(line.overrideVersion ?? 0) > 0).length,
    };
  };

  return {
    load,
    loadSource,
    loadSourceLines: async (
      scope: PayrollOperationScope,
      run: PayrollRunForEffectiveLines,
      session?: ClientSession,
    ) => (await loadSource(scope, run, session)).sourceLines,
    createSnapshot,
    verifySnapshot: async (
      scope: PayrollOperationScope,
      run: PayrollRunForEffectiveLines,
      session?: ClientSession,
    ) => {
      try {
        if (!run.effectiveSnapshot) return false;
        const loaded = await load(scope, { ...run, status: run.status ?? "review" }, session);
        return loaded.pinned;
      } catch {
        return false;
      }
    },
  };
}

const payrollEffectiveLineLoader = createPayrollEffectiveLineLoader();

export const loadAuthoritativePayrollLines = payrollEffectiveLineLoader.load;
export const loadAuthoritativePayrollSourceLines = payrollEffectiveLineLoader.loadSourceLines;
export const createEffectivePayrollSnapshot = payrollEffectiveLineLoader.createSnapshot;
export const verifyEffectivePayrollSnapshot = payrollEffectiveLineLoader.verifySnapshot;
