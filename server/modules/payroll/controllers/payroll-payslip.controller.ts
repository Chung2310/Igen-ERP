import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { getEffectivePermissions } from "../../../middleware/auth";
import { PayrollRunModel } from "../models/payroll-run.model";
import { PayrollPaymentModel } from "../models/payroll-payment.model";
import { PayslipPublicationModel } from "../../../model/payslip-publication.model";
import { PayrollExportJobModel } from "../models/payroll-export-job.model";
import { buildPayslip } from "../services/payroll-payslip.service";
import { buildPayrollWorkbook, workbookBuffer } from "../services/payroll-export.service";
import { calculatePayrollChecksum } from "../services/payroll-checksum.service";
import { loadAuthoritativePayrollLines } from "../services/payroll-effective-line.service";
import {
  tenant,
  operationalScope,
  validationFailure,
  operationFailure,
  runWithEffectiveChecksum,
  publicationMatchesEffectivePayroll,
} from "./shared";

export const payrollPayslipController = {
  async publishPayslips(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req); if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const run = await PayrollRunModel.findOne({ _id: req.params.id, ...scope }).lean();
    if (!run || !["closed", "paid"].includes(run.status)) return res.status(409).json({ status: "error", code: "PAYROLL_RUN_NOT_CLOSED" });
    let effective;
    try {
      effective = await loadAuthoritativePayrollLines(scope, run);
    } catch (error) {
      return operationFailure(res, error);
    }
    const eligibleEmployeeIds = new Set(effective.effectiveLines.map((line: any) => String(line.employeeId)));
    const requestedEmployeeIds = Array.isArray(req.body?.employeeIds)
      ? req.body.employeeIds.map(String)
      : [...eligibleEmployeeIds];
    const employeeIds = [...new Set(requestedEmployeeIds.filter((employeeId: string) => eligibleEmployeeIds.has(employeeId)))];
    const revisionChecksum = effective.effectiveChecksum;
    const docs = await Promise.all(employeeIds.map((employeeId: string) => PayslipPublicationModel.findOneAndUpdate({ ...scope, runId: String(run._id), employeeId }, { $set: { ...scope, runId: String(run._id), employeeId, revisionChecksum, status: "published", publishedBy: req.user!.id, publishedAt: new Date() } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true })));
    return res.json({ status: "success", data: docs });
  },
  async withdrawPayslip(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req); if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const doc = await PayslipPublicationModel.findOneAndUpdate({ ...scope, runId: req.params.id, employeeId: req.params.employeeId, status: "published" }, { $set: { status: "withdrawn", withdrawnBy: req.user!.id, withdrawnAt: new Date() } }, { returnDocument: 'after' });
    if (!doc) return res.status(404).json({ status: "error", code: "PAYSLIP_NOT_FOUND" }); return res.json({ status: "success", data: doc });
  },
  async listEmployeePayslips(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req); if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const publications = await PayslipPublicationModel.find({ ...scope, employeeId: req.user!.id, status: "published" }).lean();
    try {
      const data = await Promise.all(publications.map(async (publication) => {
        const run = await PayrollRunModel.findOne({ _id: publication.runId, ...scope }).lean();
        if (!run || !["closed", "paid"].includes(run.status)) return null;
        const effective = await loadAuthoritativePayrollLines(scope, run);
        // A publication from before reopen/re-review is stale, not a reason to
        // fail the employee's entire payslip list. Hide it until republished.
        if (!publicationMatchesEffectivePayroll(publication.revisionChecksum, run, effective)) return null;
        const line = effective.effectiveLines.find((item: any) => String(item.employeeId) === req.user!.id);
        return line ? buildPayslip(
          runWithEffectiveChecksum(run, effective.effectiveChecksum),
          line as any,
          await PayrollPaymentModel.find({ ...scope, runId: publication.runId }).lean() as any,
        ) : null;
      }));
      return res.json({ status: "success", data: data.filter(Boolean) });
    } catch (error) {
      return operationFailure(res, error);
    }
  },
  async printPayslip(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req); if (!scope) return validationFailure(res, "Authenticated company and branch are required");

    // Check permission: must have payroll-period:read/manage, OR be printing their own payslip
    const permissions = await getEffectivePermissions(req.user!.id, req.user!.role, tenant(req));
    const canReadAny = permissions.has("*") || permissions.has("payroll-payment:read") || permissions.has("payroll-payment:manage");
    if (!canReadAny && req.user!.id !== req.params.employeeId) {
      return res.status(403).json({ status: "error", code: "PAYROLL_PERMISSION_DENIED", message: "Bạn chỉ có thể xem phiếu lương của chính mình." });
    }

    const publication = await PayslipPublicationModel.findOne({ ...scope, runId: req.params.id, employeeId: req.params.employeeId, status: "published" }).lean();
    if (!publication) return res.status(404).json({ status: "error", code: "PAYSLIP_NOT_PUBLISHED" });
    const run = await PayrollRunModel.findOne({ _id: req.params.id, ...scope }).lean();
    if (!run) return res.status(404).json({ status: "error", code: "PAYROLL_LINE_NOT_FOUND" });
    if (!["closed", "paid"].includes(run.status)) {
      return res.status(409).json({ status: "error", code: "PAYROLL_RUN_NOT_CLOSED" });
    }
    let effective;
    try {
      effective = await loadAuthoritativePayrollLines(scope, run);
    } catch (error) {
      return operationFailure(res, error);
    }
    const line = effective.effectiveLines.find((item: any) => String(item.employeeId) === req.params.employeeId);
    if (!line) return res.status(404).json({ status: "error", code: "PAYROLL_LINE_NOT_FOUND" });
    if (!publicationMatchesEffectivePayroll(publication.revisionChecksum, run, effective)) return res.status(409).json({ status: "error", code: "PAYROLL_CHECKSUM_MISMATCH" });
    const payslip = buildPayslip(
      runWithEffectiveChecksum(run, effective.effectiveChecksum),
      line as any,
      await PayrollPaymentModel.find({ ...scope, runId: req.params.id }).lean() as any,
    );
    const esc = (value: unknown) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char));
    res.type("html").set("Content-Disposition", `inline; filename=payslip-${run.periodKey}-${payslip.employeeId}.html`); return res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${esc(run.periodKey)}</title><style>body{font:14px Arial;max-width:760px;margin:40px auto;color:#172033}h1{font-size:24px;border-bottom:2px solid #172033;padding-bottom:12px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #ddd}.total{font-size:18px;font-weight:bold}@media print{body{margin:0}}</style></head><body><h1>Payslip ${esc(run.periodKey)}</h1><div class="row"><b>Nhân viên</b><span>${esc(payslip.employeeName || payslip.employeeId)}</span></div><div class="row"><b>Tổng thu nhập</b><span>${payslip.calculation.gross ?? 0}</span></div><div class="row"><b>Các khoản khấu trừ</b><span>${payslip.calculation.deductions ?? 0}</span></div><div class="row total"><b>Thực nhận</b><span>${payslip.netPay}</span></div><div class="row"><b>Đã thanh toán</b><span>${payslip.paidAmount}</span></div><div class="row"><b>Còn lại</b><span>${payslip.balance}</span></div><p>Mã kiểm tra: ${esc(payslip.checksum)}</p><script>window.print()</script></body></html>`);
  },
  async exportPayroll(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req); if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const type = req.body?.type; if (!["detailed", "insurance", "pit", "bank_transfer"].includes(type)) return validationFailure(res, "Invalid export type");
    if (type === "bank_transfer") { const permissions = await getEffectivePermissions(req.user!.id, req.user!.role, tenant(req)); if (!permissions.has("*") && !permissions.has("payroll-payment:manage")) return res.status(403).json({ status: "error", code: "PAYROLL_PERMISSION_DENIED", message: "Bank transfer export requires payroll-payment:manage" }); }
    const run = await PayrollRunModel.findOne({ _id: req.params.id, ...scope }).lean();
    if (!run || !["closed", "paid"].includes(run.status)) return res.status(409).json({ status: "error", code: "PAYROLL_RUN_NOT_CLOSED" });
    let effective;
    try {
      effective = await loadAuthoritativePayrollLines(scope, run);
    } catch (error) {
      return operationFailure(res, error);
    }
    const revisionChecksum = effective.effectiveChecksum;
    const buffer = workbookBuffer(buildPayrollWorkbook(type, effective.effectiveLines as any)); const checksum = calculatePayrollChecksum(buffer.toString("base64"));
    const job = await PayrollExportJobModel.create({ ...scope, runId: String(run._id), type, revisionChecksum, status: "completed", createdBy: req.user!.id, output: { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: buffer.length, checksum }, completedAt: new Date() });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.setHeader("Content-Disposition", `attachment; filename=payroll-${run.periodKey}-${type}.xlsx`); return res.send(buffer);
  },
};
