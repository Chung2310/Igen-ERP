import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UserModel } from "../model/user.model";
import { PayrollAdjustmentModel } from "../model/payroll-adjustment.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayslipPublicationModel } from "../model/payslip-publication.model";
import { PayslipReviewRequestModel } from "../model/payslip-review-request.model";
import { requestPublishedPayslipReview, resolvePublishedPayslipReview } from "../service/payroll-payslip-review.service";
import { payrollController } from "./payroll.controller";

describe("salary advance with persisted HR employees", () => {
  let database: MongoMemoryServer;
  let managerId: string;
  let otherBranchId: string;
  const response = () => {
    const result: any = { statusCode: 200, body: undefined };
    result.status = (code: number) => { result.statusCode = code; return result; };
    result.json = (body: unknown) => { result.body = body; return result; };
    return result;
  };
  const request = (employeeId: string, date = "2026-10-24") => ({
    user: { id: "payroll-admin", role: "admin", companyCode: "QA_EDU", branchId: "hn" },
    params: { periodKey: "2026-10" },
    body: { employeeId, kind: "advance", amount: 550_000, reason: "Tạm ứng sinh hoạt", advanceDetails: { date, method: "transfer", note: "Chuyển khoản tháng 10" } },
  }) as any;

  beforeAll(async () => {
    database = await MongoMemoryServer.create({ instance: { dbName: "igen_hr_advance_test", launchTimeout: 60_000 } });
    await mongoose.connect(database.getUri());
  }, 120_000);
  beforeEach(async () => {
    await Promise.all([UserModel.deleteMany({}), PayrollAdjustmentModel.deleteMany({}), PayrollRunModel.deleteMany({}), PayrollAuditModel.deleteMany({}), PayslipPublicationModel.deleteMany({}), PayslipReviewRequestModel.deleteMany({})]);
    const manager = await UserModel.create({ email: "manager.hn@example.test", displayName: "Nguyễn An", role: "manager", companyCode: "QA_EDU", branchId: "hn", monthlySalary: 12_000_000 });
    const other = await UserModel.create({ email: "manager.hcm@example.test", displayName: "Trần Bình", role: "manager", companyCode: "QA_EDU", branchId: "hcm", monthlySalary: 13_000_000 });
    managerId = String(manager._id);
    otherBranchId = String(other._id);
  });
  afterAll(async () => { await mongoose.disconnect(); await database?.stop(); });

  it("creates and approves a real advance for an employee in the current branch", async () => {
    const created = response();
    await payrollController.createAdjustment(request(managerId), created);
    expect(created.statusCode).toBe(201);
    const id = String(created.body.data._id);
    expect(await PayrollAdjustmentModel.findById(id).lean()).toMatchObject({ companyCode: "QA_EDU", branchId: "hn", employeeId: managerId, amount: 550_000, kind: "advance", status: "pending", advanceDetails: { date: "2026-10-24", method: "transfer" } });

    const approved = response();
    await payrollController.approveAdjustment({ ...request(managerId), params: { periodKey: "2026-10", adjustmentId: id } } as any, approved);
    expect(approved.statusCode).toBe(200);
    expect((await PayrollAdjustmentModel.findById(id).lean())?.status).toBe("approved");
  });

  it("rejects another branch and an impossible payment date without inserting a record", async () => {
    const otherBranch = response();
    await payrollController.createAdjustment(request(otherBranchId), otherBranch);
    expect(otherBranch.statusCode).toBe(404);
    const invalidDate = response();
    await payrollController.createAdjustment(request(managerId, "2026-02-30"), invalidDate);
    expect(invalidDate.statusCode).toBe(400);
    expect(await PayrollAdjustmentModel.countDocuments()).toBe(0);
  });

  it("keeps a pending advance unchanged when the payroll period is closed", async () => {
    const created = response();
    await payrollController.createAdjustment(request(managerId), created);
    const id = String(created.body.data._id);
    await PayrollRunModel.create({ companyCode: "QA_EDU", branchId: "hn", periodKey: "2026-10", type: "regular", status: "closed", createdBy: "payroll-admin" });
    const approved = response();
    await payrollController.approveAdjustment({ ...request(managerId), params: { periodKey: "2026-10", adjustmentId: id } } as any, approved);
    expect(approved.statusCode).toBe(409);
    expect((await PayrollAdjustmentModel.findById(id).lean())?.status).toBe("pending");
  });

  it("lets an employee request a review only after the official payslip is published", async () => {
    const scope = { companyCode: "QA_EDU", branchId: "hn" };
    const run = await PayrollRunModel.create({ ...scope, periodKey: "2026-10", type: "regular", status: "closed", createdBy: "payroll-admin", lines: [{ employeeId: managerId, employeeName: "Nguyễn An", calculation: { gross: 12_000_000, deductions: 1_000_000, net: 11_000_000 } }] });
    const runId = String(run._id);
    await expect(requestPublishedPayslipReview(scope, managerId, runId, "Xin kiểm tra phụ cấp")).rejects.toMatchObject({ code: "PAYSLIP_NOT_PUBLISHED" });
    await PayslipPublicationModel.create({ ...scope, runId, employeeId: managerId, revisionChecksum: "legacy", status: "published", publishedBy: "payroll-admin", publishedAt: new Date() });

    const request = await requestPublishedPayslipReview(scope, managerId, runId, " Xin kiểm tra phụ cấp ");
    expect(request).toMatchObject({ runId, employeeId: managerId, status: "open", message: "Xin kiểm tra phụ cấp" });
    expect(await PayslipReviewRequestModel.findById(request.id).lean()).toMatchObject({ employeeName: "Nguyễn An", periodKey: "2026-10", status: "open" });
    await expect(requestPublishedPayslipReview(scope, managerId, runId, "Gửi lần hai")).rejects.toMatchObject({ status: 409 });
    await expect(requestPublishedPayslipReview(scope, otherBranchId, runId, "Nhân viên khác")).rejects.toMatchObject({ code: "PAYSLIP_NOT_PUBLISHED" });

    const resolved = await resolvePublishedPayslipReview(scope, runId, request.id, "payroll-admin", "Đã kiểm tra và cập nhật phụ cấp");
    expect(resolved).toMatchObject({ status: "resolved", response: "Đã kiểm tra và cập nhật phụ cấp" });
  });
});
