import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ run: vi.fn(), publication: vi.fn(), existing: vi.fn(), create: vi.fn(), load: vi.fn(), resolve: vi.fn() }));
vi.mock("../model/payroll-run.model", () => ({ PayrollRunModel: { findOne: mocks.run } }));
vi.mock("../model/payslip-publication.model", () => ({ PayslipPublicationModel: { findOne: mocks.publication } }));
vi.mock("../model/payslip-review-request.model", () => ({ PayslipReviewRequestModel: { findOne: mocks.existing, create: mocks.create, findOneAndUpdate: mocks.resolve } }));
vi.mock("./payroll-effective-line.service", () => ({ loadAuthoritativePayrollLines: mocks.load }));

import { requestPublishedPayslipReview, resolvePublishedPayslipReview } from "./payroll-payslip-review.service";

const scope = { companyCode: "ACME", branchId: "B1" };
const runId = "507f1f77bcf86cd799439011";
const requestId = "507f1f77bcf86cd799439012";
const query = (value: unknown) => ({ lean: vi.fn().mockResolvedValue(value) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.run.mockReturnValue(query({ _id: runId, ...scope, status: "closed", periodKey: "2026-09" }));
  mocks.publication.mockReturnValue(query({ revisionChecksum: "checksum", status: "published" }));
  mocks.load.mockResolvedValue({ effectiveChecksum: "checksum", effectiveLines: [{ employeeId: "e1", employeeName: "An" }] });
  mocks.existing.mockReturnValue(query(null));
  mocks.create.mockImplementation(async (value) => ({ _id: requestId, ...value }));
});

describe("published payslip review requests", () => {
  it("accepts only the authenticated employee's published, current payslip", async () => {
    const result = await requestPublishedPayslipReview(scope, "e1", runId, "  Cần kiểm tra phụ cấp  ");
    expect(result.message).toBe("Cần kiểm tra phụ cấp");
    expect(mocks.publication).toHaveBeenCalledWith({ ...scope, runId, employeeId: "e1", status: "published" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ ...scope, runId, employeeId: "e1", status: "open" }));
  });

  it("rejects an unpublished or stale payslip", async () => {
    mocks.publication.mockReturnValueOnce(query(null));
    await expect(requestPublishedPayslipReview(scope, "e1", runId, "Kiểm tra lương")).rejects.toMatchObject({ code: "PAYSLIP_NOT_PUBLISHED" });
    mocks.publication.mockReturnValueOnce(query({ revisionChecksum: "old" }));
    await expect(requestPublishedPayslipReview(scope, "e1", runId, "Kiểm tra lương")).rejects.toMatchObject({ code: "PAYSLIP_REVISION_CHANGED" });
  });

  it("allows one open request and scopes manager resolution", async () => {
    mocks.existing.mockReturnValueOnce(query({ _id: requestId }));
    await expect(requestPublishedPayslipReview(scope, "e1", runId, "Kiểm tra lương")).rejects.toMatchObject({ status: 409 });
    mocks.resolve.mockResolvedValue({ _id: requestId, runId, employeeId: "e1", status: "resolved", response: "Đã kiểm tra" });
    await resolvePublishedPayslipReview(scope, runId, requestId, "manager", "Đã kiểm tra");
    expect(mocks.resolve).toHaveBeenCalledWith(
      { _id: requestId, ...scope, runId, status: "open" },
      expect.objectContaining({ $set: expect.objectContaining({ status: "resolved", resolvedBy: "manager" }) }),
      expect.anything(),
    );
  });
});
