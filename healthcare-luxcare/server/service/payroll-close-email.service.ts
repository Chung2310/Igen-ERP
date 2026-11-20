import { logger } from "../config/logger";
import { UserModel } from "../model/user.model";
import { companyEmailService } from "./company-email.service";

type PayrollCloseEmailScope = { companyCode: string; branchId: string };

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character,
  );

/** Notify only employees included in the snapshot of the closed payroll run. */
export async function sendPayrollClosedEmails(
  scope: PayrollCloseEmailScope,
  run: {
    _id?: unknown;
    periodKey: string;
    effectiveSnapshot?: { lines?: Array<{ employeeId: unknown }> };
    lines?: Array<{ employeeId: unknown }>;
  },
) {
  const lines = run.effectiveSnapshot?.lines ?? run.lines ?? [];
  const employeeIds = [...new Set(lines.map((line) => String(line.employeeId)).filter(Boolean))];
  if (!employeeIds.length) return { attempted: 0, sent: 0, failed: 0 };

  const recipients: any[] = await UserModel.find({
    _id: { $in: employeeIds },
    companyCode: scope.companyCode,
    branchId: scope.branchId,
    isActive: { $ne: false },
    email: { $nin: [null, ""] },
  })
    .select("email displayName")
    .lean();

  const periodKey = escapeHtml(run.periodKey);
  const deliveries = await Promise.allSettled(
    recipients.map((recipient) => {
      const employeeName = escapeHtml(recipient.displayName || recipient.email);
      return companyEmailService.send(scope.companyCode, {
        to: recipient.email,
        subject: `Bảng lương kỳ ${run.periodKey} đã được chốt`,
        html: `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><p>Xin chào <strong>${employeeName}</strong>,</p><p>Bảng lương kỳ <strong>${periodKey}</strong> của bạn đã được chốt.</p><p>Vui lòng đăng nhập hệ thống để xem chi tiết phiếu lương.</p><p>Trân trọng.</p></body></html>`,
      });
    }),
  );
  const sent = deliveries.filter((delivery) => delivery.status === "fulfilled").length;
  return { attempted: recipients.length, sent, failed: recipients.length - sent };
}

/** SMTP failures are logged but never roll back an already committed payroll close. */
export async function notifyPayrollClosedBestEffort(
  scope: PayrollCloseEmailScope,
  run: Parameters<typeof sendPayrollClosedEmails>[1],
) {
  try {
    const result = await sendPayrollClosedEmails(scope, run);
    if (result.failed)
      logger.error("[payroll.close-email] Some emails could not be sent", {
        ...scope,
        runId: String(run._id ?? ""),
        ...result,
      });
    return result;
  } catch (error) {
    logger.error("[payroll.close-email] Unable to send payroll close emails", {
      ...scope,
      runId: String(run._id ?? ""),
      error,
    });
    return { attempted: 0, sent: 0, failed: 0 };
  }
}
