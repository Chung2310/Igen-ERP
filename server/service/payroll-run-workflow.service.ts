import type { PayrollRunStatus } from "../interface/payroll-operations.interface";
import { calculatePayrollChecksum } from "./payroll-checksum.service";

export type PayrollWorkflowAction = "review" | "approve" | "reject" | "close";

export type PayrollWorkflowFailure = {
  code: string;
  message: string;
  status: number;
  currentVersion?: number;
};

const IMMUTABLE_STATUSES: PayrollRunStatus[] = ["closed", "partially_paid", "paid"];

const RULES: Record<PayrollWorkflowAction, {
  from: PayrollRunStatus[];
  to: PayrollRunStatus;
  auditAction: "review" | "approve" | "reject" | "close";
  requiresReason?: boolean;
  verifiesChecksum?: boolean;
  separatesDuties?: boolean;
  blockedByIssues?: boolean;
  fields: (context: { actorId: string; reason?: string; now: Date }) => Record<string, unknown>;
}> = {
  review: {
    from: ["calculated"],
    to: "reviewed",
    auditAction: "review",
    blockedByIssues: true,
    fields: ({ actorId }) => ({ reviewedBy: actorId }),
  },
  approve: {
    from: ["reviewed"],
    to: "approved",
    auditAction: "approve",
    verifiesChecksum: true,
    separatesDuties: true,
    blockedByIssues: true,
    fields: ({ actorId }) => ({ approvedBy: actorId }),
  },
  reject: {
    from: ["reviewed", "approved"],
    to: "calculated",
    auditAction: "reject",
    requiresReason: true,
    fields: ({ actorId, reason }) => ({ rejectedBy: actorId, rejectionReason: reason, reviewedBy: null, approvedBy: null }),
  },
  close: {
    from: ["approved"],
    to: "closed",
    auditAction: "close",
    verifiesChecksum: true,
    fields: ({ actorId, now }) => ({ closedBy: actorId, closedAt: now }),
  },
};

const failure = (code: string, message: string, status: number, currentVersion?: number): PayrollWorkflowFailure => ({
  code, message, status, ...(currentVersion === undefined ? {} : { currentVersion }),
});

export function payrollWorkflowRule(action: PayrollWorkflowAction) {
  return RULES[action];
}

export async function transitionPayrollRun(args: {
  action: PayrollWorkflowAction;
  actorId: string;
  expectedVersion: number;
  reason?: string;
  correlationId?: string;
  now?: Date;
  run: {
    get: () => Promise<any>;
    apply: (expectedVersion: number, from: PayrollRunStatus, to: PayrollRunStatus, fields: Record<string, unknown>) => Promise<any>;
  };
  revision: { getActive: (revisionId: string) => Promise<any> };
  audit: (entry: { action: "review" | "approve" | "reject" | "close"; metadata: Record<string, unknown> }) => Promise<unknown>;
}): Promise<{ run: any } | PayrollWorkflowFailure> {
  const rule = RULES[args.action];
  if (rule.requiresReason && !args.reason?.trim()) {
    return failure("PAYROLL_REASON_REQUIRED", `A reason is required to ${args.action} a payroll run`, 400);
  }

  const run = await args.run.get();
  if (!run) return failure("PAYROLL_RUN_NOT_FOUND", "Payroll run not found", 404);
  if (run.version !== args.expectedVersion) {
    return failure("PAYROLL_VERSION_CONFLICT", "Payroll run version conflict", 409, run.version);
  }
  if (IMMUTABLE_STATUSES.includes(run.status) && rule.to !== run.status) {
    return failure("PAYROLL_RUN_CLOSED", "A closed payroll run can no longer be changed", 409, run.version);
  }
  if (!rule.from.includes(run.status)) {
    return failure("PAYROLL_INVALID_TRANSITION", `Cannot ${args.action} a payroll run in status ${run.status}`, 409, run.version);
  }
  if (rule.separatesDuties && run.createdBy && String(run.createdBy) === args.actorId) {
    return failure("PAYROLL_SEPARATION_OF_DUTIES", "The payroll run creator cannot approve their own run", 403, run.version);
  }
  if (rule.blockedByIssues && (run.issues ?? []).some((issue: any) => issue.severity === "blocking")) {
    return failure("PAYROLL_BLOCKING_ISSUES", "Resolve every blocking issue before continuing", 409, run.version);
  }

  if (rule.verifiesChecksum) {
    if (!run.activeRevisionId) {
      return failure("PAYROLL_REVISION_MISSING", "The payroll run has no active calculation revision", 409, run.version);
    }
    const revision = await args.revision.getActive(String(run.activeRevisionId));
    if (!revision || revision.status !== "completed") {
      return failure("PAYROLL_REVISION_MISSING", "The active calculation revision is not available", 409, run.version);
    }
    const recomputed = calculatePayrollChecksum({ lines: revision.lines ?? [], totals: revision.totals });
    if (recomputed !== revision.checksum || recomputed !== run.activeRevisionChecksum) {
      return failure("PAYROLL_CHECKSUM_MISMATCH", "Payroll results changed after calculation; recalculate the run", 409, run.version);
    }
  }

  const now = args.now ?? new Date();
  const updated = await args.run.apply(args.expectedVersion, run.status, rule.to, rule.fields({ actorId: args.actorId, reason: args.reason?.trim(), now }));
  if (!updated) {
    return failure("PAYROLL_VERSION_CONFLICT", "Payroll run version conflict", 409);
  }

  await args.audit({
    action: rule.auditAction,
    metadata: {
      operation: args.action,
      runId: String(run._id ?? run.id ?? ""),
      before: { status: run.status, version: run.version },
      after: { status: updated.status, version: updated.version },
      ...(args.reason?.trim() ? { reason: args.reason.trim() } : {}),
      ...(args.correlationId ? { correlationId: args.correlationId } : {}),
    },
  });

  return { run: updated };
}
