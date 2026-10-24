import { PayslipReviewRequestModel } from "../model/payslip-review-request.model";
import { PayslipPublicationModel } from "../model/payslip-publication.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { loadAuthoritativePayrollLines } from "./payroll-effective-line.service";
import { publicationMatchesEffectivePayroll } from "./payroll-payslip.service";
import type { PayslipReviewRequest } from "../../src/shared/payrollPayslipReview";

type Scope = { companyCode: string; branchId: string };

export const payslipReviewError = (message: string, status = 409, code = "PAYSLIP_REVIEW_BLOCKED") =>
  Object.assign(new Error(message), { status, code });

const validId = (value: string) => /^[\da-f]{24}$/i.test(value);
const cleanMessage = (value: unknown, maxLength: number) => {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message || message.length > maxLength) {
    throw payslipReviewError(`Nội dung phải từ 1 đến ${maxLength.toLocaleString("vi-VN")} ký tự.`, 400);
  }
  return message;
};
const view = (record: any): PayslipReviewRequest => ({
  id: String(record._id),
  runId: record.runId,
  employeeId: record.employeeId,
  employeeName: record.employeeName,
  periodKey: record.periodKey,
  revisionChecksum: record.revisionChecksum,
  message: record.message,
  status: record.status,
  response: record.response,
  createdAt: record.createdAt?.toISOString?.(),
  resolvedAt: record.resolvedAt?.toISOString?.(),
});

export async function requestPublishedPayslipReview(scope: Scope, employeeId: string, runId: string, body: unknown) {
  if (!validId(runId)) throw payslipReviewError("Kỳ lương không hợp lệ.", 400);
  const message = cleanMessage(body, 2000);
  const run: any = await PayrollRunModel.findOne({ _id: runId, ...scope }).lean();
  if (!run || !["closed", "paid"].includes(run.status)) {
    throw payslipReviewError("Phiếu lương chính thức chưa được phát hành.", 404, "PAYSLIP_NOT_PUBLISHED");
  }
  const publication: any = await PayslipPublicationModel.findOne({ ...scope, runId, employeeId, status: "published" }).lean();
  if (!publication) throw payslipReviewError("Phiếu lương chính thức chưa được phát hành.", 404, "PAYSLIP_NOT_PUBLISHED");

  const effective = await loadAuthoritativePayrollLines(scope, run);
  if (!publicationMatchesEffectivePayroll(publication.revisionChecksum, run, effective)) {
    throw payslipReviewError("Phiếu lương đã thay đổi. Vui lòng chờ bản phát hành mới.", 409, "PAYSLIP_REVISION_CHANGED");
  }
  const line = effective.effectiveLines.find((item: any) => String(item.employeeId) === employeeId);
  if (!line) throw payslipReviewError("Không tìm thấy phiếu lương của bạn.", 404, "PAYSLIP_NOT_FOUND");

  const existing = await PayslipReviewRequestModel.findOne({ ...scope, runId, employeeId, status: "open" }).lean();
  if (existing) throw payslipReviewError("Bạn đã gửi yêu cầu cho kỳ lương này. Vui lòng chờ phản hồi.");
  try {
    const created = await PayslipReviewRequestModel.create({
      ...scope,
      runId,
      employeeId,
      employeeName: line.employeeName || employeeId,
      periodKey: run.periodKey,
      revisionChecksum: publication.revisionChecksum,
      message,
      status: "open",
    });
    return view(created);
  } catch (error: any) {
    if (error?.code === 11000) throw payslipReviewError("Bạn đã gửi yêu cầu cho kỳ lương này. Vui lòng chờ phản hồi.");
    throw error;
  }
}

export async function listMyPublishedPayslipReviews(scope: Scope, employeeId: string) {
  const records = await PayslipReviewRequestModel.find({ ...scope, employeeId }).sort({ createdAt: -1 }).limit(100).lean();
  return records.map(view);
}

export async function listRunPublishedPayslipReviews(scope: Scope, runId: string) {
  if (!validId(runId)) throw payslipReviewError("Kỳ lương không hợp lệ.", 400);
  const records = await PayslipReviewRequestModel.find({ ...scope, runId }).sort({ createdAt: -1 }).lean();
  return records.map(view);
}

export async function resolvePublishedPayslipReview(scope: Scope, runId: string, requestId: string, actorId: string, body: unknown) {
  if (!validId(runId) || !validId(requestId)) throw payslipReviewError("Yêu cầu không hợp lệ.", 400);
  const response = cleanMessage(body, 4000);
  const updated = await PayslipReviewRequestModel.findOneAndUpdate(
    { _id: requestId, ...scope, runId, status: "open" },
    { $set: { status: "resolved", response, resolvedBy: actorId, resolvedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) throw payslipReviewError("Không tìm thấy yêu cầu đang chờ xử lý.", 404, "PAYSLIP_REVIEW_NOT_FOUND");
  return view(updated);
}
