import type { PayrollRunStatus } from "../interface/payroll-operations.interface";
import { calculatePayrollChecksum } from "./payroll-checksum.service";

export type PayrollWorkflowAction = "review" | "close" | "reopen" | "markPaid";

export type PayrollWorkflowFailure = {
  code: string;
  message: string;
  status: number;
  currentVersion?: number;
};

const RULES: Record<PayrollWorkflowAction, {
  from: PayrollRunStatus[];
  to: PayrollRunStatus;
  auditAction: "review" | "close" | "reopen" | "mark_paid";
  requiresReason?: boolean;
  verifiesChecksum?: boolean;
  separatesDuties?: boolean;
  blockedByIssues?: boolean;
  fields: (context: { actorId: string; reason?: string; now: Date }) => Record<string, unknown>;
}> = {
  review: {
    from: ["draft"],
    to: "review",
    auditAction: "review",
    blockedByIssues: true,
    fields: ({ actorId }) => ({ reviewedBy: actorId }),
  },
  close: {
    from: ["review"],
    to: "closed",
    auditAction: "close",
    verifiesChecksum: true,
    fields: ({ actorId, now }) => ({ closedBy: actorId, closedAt: now }),
  },
  reopen: {
    from: ["review", "closed"],
    to: "draft",
    auditAction: "reopen",
    requiresReason: true,
    fields: () => ({ closedBy: null, closedAt: null, effectiveSnapshot: null }),
  },
  markPaid: {
    from: ["closed"],
    to: "paid",
    auditAction: "mark_paid",
    fields: ({ actorId, now }) => ({ paidBy: actorId, paidAt: now }),
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
  effective?: {
    pin: (run: any) => Promise<any>;
    verify: (run: any) => Promise<boolean>;
  };
  hasConfirmedPayments?: (run: any) => Promise<boolean>;
  audit: (entry: { action: "review" | "close" | "reopen" | "mark_paid"; metadata: Record<string, unknown> }) => Promise<unknown>;
}): Promise<{ run: any } | PayrollWorkflowFailure> {
  const rule = RULES[args.action];
  if (rule.requiresReason && !args.reason?.trim()) {
    return failure("PAYROLL_REOPEN_REASON_REQUIRED", "Cần nhập lý do để mở lại kỳ lương.", 400);
  }

  const run = await args.run.get();
  if (!run) return failure("PAYROLL_RUN_NOT_FOUND", "Không tìm thấy bảng lương.", 404);
  if (run.version !== args.expectedVersion) {
    return failure("PAYROLL_VERSION_CONFLICT", "Xung đột phiên bản bảng lương.", 409, run.version);
  }
  if (run.status === "paid") {
    return failure("PAYROLL_PAID_RUN_IMMUTABLE", "Kỳ lương đã thanh toán hoàn tất không thể thay đổi.", 409, run.version);
  }
  if (!rule.from.includes(run.status)) {
    return failure("PAYROLL_INVALID_TRANSITION", `Không thể thực hiện thao tác trên kỳ lương đang ở trạng thái "${run.status}".`, 409, run.version);
  }
  if (rule.separatesDuties && run.createdBy && String(run.createdBy) === args.actorId) {
    return failure("PAYROLL_SEPARATION_OF_DUTIES", "Người tạo kỳ lương không thể tự duyệt kỳ lương của mình.", 403, run.version);
  }
  if (rule.blockedByIssues && (run.issues ?? []).some((issue: any) => issue.severity === "blocking")) {
    return failure("PAYROLL_BLOCKING_ISSUES", "Vui lòng xử lý tất cả các vấn đề chặn trước khi tiếp tục.", 409, run.version);
  }
  if (
    args.action === "reopen"
    && args.hasConfirmedPayments
    && await args.hasConfirmedPayments(run)
  ) {
    return failure(
      "PAYROLL_CONFIRMED_PAYMENTS_EXIST",
      "Vui lòng hoàn tác tất cả các khoản thanh toán đã xác nhận trước khi mở lại kỳ lương.",
      409,
      run.version,
    );
  }

  let compatibilitySnapshot: any;
  if (rule.verifiesChecksum) {
    if (!run.activeRevisionId) {
      return failure("PAYROLL_REVISION_MISSING", "Kỳ lương chưa có bản tính toán hợp lệ. Vui lòng thực hiện tính lương trước khi thao tác tiếp.", 409, run.version);
    }
    const revision = await args.revision.getActive(String(run.activeRevisionId));
    if (!revision || revision.status !== "completed") {
      return failure("PAYROLL_REVISION_MISSING", "Bản tính toán đang hoạt động không khả dụng hoặc chưa hoàn thành.", 409, run.version);
    }
    const recomputed = calculatePayrollChecksum({ lines: revision.lines ?? [], totals: revision.totals });
    if (recomputed !== revision.checksum || recomputed !== run.activeRevisionChecksum) {
      return failure("PAYROLL_CHECKSUM_MISMATCH", "Dữ liệu lương đã bị thay đổi sau khi tính toán. Vui lòng tính lại kỳ lương.", 409, run.version);
    }
    if (args.effective) {
      if (!run.effectiveSnapshot) {
        // Upgrade path for reviews created before effective snapshots existed.
        // A review run is already immutable to the override API, so pinning at
        // the close boundary captures the same authoritative values safely.
        compatibilitySnapshot = await args.effective.pin(run);
      } else if (!await args.effective.verify(run)) {
        return failure(
          "PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH",
          "Dữ liệu hiệu lực của kỳ lương đã thay đổi sau khi duyệt. Vui lòng kiểm tra lại.",
          409,
          run.version,
        );
      }
    }
  }

  const now = args.now ?? new Date();
  const transitionFields = rule.fields({ actorId: args.actorId, reason: args.reason?.trim(), now });
  if (args.action === "review" && args.effective) {
    transitionFields.effectiveSnapshot = await args.effective.pin(run);
  }
  if (args.action === "close" && compatibilitySnapshot) {
    transitionFields.effectiveSnapshot = compatibilitySnapshot;
  }
  const updated = await args.run.apply(
    args.expectedVersion,
    run.status,
    rule.to,
    transitionFields,
  );
  if (!updated) {
    return failure("PAYROLL_VERSION_CONFLICT", "Xung đột phiên bản bảng lương.", 409);
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
      ...(updated.effectiveSnapshot?.checksum
        ? { effectiveChecksum: updated.effectiveSnapshot.checksum }
        : {}),
    },
  });

  return { run: updated };
}
