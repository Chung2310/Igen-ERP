import assert from "node:assert/strict";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../services/auth.service", () => ({
  AuthService: { getUserProfile: vi.fn(async () => ({ isActive: true, companyCode: "acme", branchId: "branch-a", displayName: "Quan ly" })) },
}));
vi.mock("../../../model/branch.model", () => ({ BranchModel: { exists: vi.fn(async () => ({ _id: "branch-a" })) } }));
vi.mock("../models/user.model", () => ({
  User: {
    exists: vi.fn(async () => ({ _id: "admin-1" })),
    find: vi.fn(() => ({ select: async () => [] })),
  },
}));
vi.mock("../models/partner.model", () => ({ Partner: { findOne: vi.fn(() => ({ select: async () => null })) } }));
vi.mock("../utils/custom-field.util", () => ({ resolveCustomFieldTenantForOwner: vi.fn(async () => "acme") }));
vi.mock("../services/module-settings.service", () => ({
  ModuleSettingsService: class { async get() { return { entityPreset: "worker" }; } },
}));
vi.mock("../utils/public-register-fields.util", () => ({
  findMissingPublicRegisterFields: vi.fn(async () => []),
  resolvePublicRegisterFields: vi.fn(async () => []),
}));
vi.mock("../services/public-registration-context.service", () => ({
  createPublicRegistrationToken: vi.fn(() => "signed-token"),
  verifyPublicRegistrationToken: vi.fn((token: unknown) => {
    if (token !== "signed-token") throw new Error("Invalid registration token");
    return { teacherId: "teacher-1", companyCode: "ACME", branchId: "branch-a", entityPreset: "worker" };
  }),
}));
vi.mock("../../../service/source-upload-finalizer.service", () => ({
  sourceUploadFinalizer: { finalize: vi.fn(async () => undefined) },
}));
vi.mock("../../worker-management/services/worker.service", () => ({
  WorkerService: { create: vi.fn(async () => ({ _id: "worker-1", fullName: "Nguyen Van A", registrationDate: "22/08/2026" })) },
}));
vi.mock("../../worker-management/labor-partners/models/labor-partner.model", () => ({
  LaborPartnerModel: { exists: vi.fn() },
}));
vi.mock("../../worker-management/labor-partners/services/worker-referral.service", () => ({
  WorkerReferralService: { createForImportedWorker: vi.fn() },
}));

import { StudentController } from "./student.controller";
import { WorkerService } from "../../worker-management/services/worker.service";
import { LaborPartnerModel } from "../../worker-management/labor-partners/models/labor-partner.model";
import { WorkerReferralService } from "../../worker-management/labor-partners/services/worker-referral.service";
import { BranchModel } from "../../../model/branch.model";
import { Partner } from "../models/partner.model";
import { StudentService } from "../services/student.service";
import { ModuleSettingsService } from "../services/module-settings.service";
import { createPublicRegistrationToken, verifyPublicRegistrationToken } from "../services/public-registration-context.service";

function buildRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (payload: unknown) => { res.body = payload; return res; };
  return res;
}

const body = { registrationToken: "signed-token", fullName: "Nguyen Van A", phone: "0900000000" };

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

it("gắn đối tác giới thiệu khi mã hợp lệ", async () => {
  vi.mocked(LaborPartnerModel.exists).mockResolvedValue({ _id: "partner-1" } as any);
  vi.mocked(WorkerReferralService.createForImportedWorker).mockResolvedValue({} as any);
  const res = buildRes();

  await StudentController.publicRegister({ body: { ...body, partnerCode: "dt-01" } } as any, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.warning, undefined);
  const referralCall = vi.mocked(WorkerReferralService.createForImportedWorker).mock.calls[0];
  assert.deepEqual(referralCall?.[0], { companyCode: "ACME", branchId: "branch-a" });
  assert.equal((referralCall?.[1] as any).partnerCode, "DT-01");
  assert.equal((referralCall?.[1] as any).workerId, "worker-1");
  assert.equal(vi.mocked(WorkerService.create).mock.calls[0]?.[0].companyCode, "ACME");
  assert.equal(vi.mocked(WorkerService.create).mock.calls[0]?.[0].branchId, "branch-a");
});

it("từ chối trước khi tạo hồ sơ khi mã đối tác không tồn tại", async () => {
  vi.mocked(LaborPartnerModel.exists).mockResolvedValue(null as any);
  const res = buildRes();

  await StudentController.publicRegister({ body: { ...body, partnerCode: "SAI" } } as any, res);

  assert.equal(res.statusCode, 400);
  assert.match(String(res.body.error), /SAI/);
  assert.equal(vi.mocked(WorkerService.create).mock.calls.length, 0);
});

it("vẫn lưu hồ sơ khi gắn đối tác thất bại, trả về cảnh báo", async () => {
  vi.mocked(LaborPartnerModel.exists).mockResolvedValue({ _id: "partner-1" } as any);
  vi.mocked(WorkerReferralService.createForImportedWorker).mockRejectedValue(new Error("Chưa có chính sách hoa hồng."));
  const res = buildRes();

  await StudentController.publicRegister({ body: { ...body, partnerCode: "DT-01" } } as any, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.warning, "Chưa có chính sách hoa hồng.");
});

it("bỏ trống mã đối tác thì không đụng tới đối tác lao động", async () => {
  const res = buildRes();

  await StudentController.publicRegister({ body } as any, res);

  assert.equal(res.statusCode, 201);
  assert.equal(vi.mocked(LaborPartnerModel.exists).mock.calls.length, 0);
  assert.equal(vi.mocked(WorkerReferralService.createForImportedWorker).mock.calls.length, 0);
});

it("tạo token đăng ký dựa trên công ty và chi nhánh đã được kiểm tra", async () => {
  const res = buildRes();
  const branchId = "6a890135119c1c3189d63849";
  await StudentController.createPublicRegistrationLink({
    user: { uid: "teacher-1", role: "manager", companyCode: "ACME", centerId: "ACME", branchId },
    body: { companyCode: "all", branchId, entityPreset: "worker" },
  } as any, res, (() => undefined) as any);

  expect(res.statusCode).toBe(201);
  expect(vi.mocked(BranchModel.exists)).toHaveBeenCalledWith({ _id: branchId, companyCode: "ACME", isActive: true });
  expect(vi.mocked(createPublicRegistrationToken)).toHaveBeenCalledWith({
    teacherId: "teacher-1", companyCode: "ACME", branchId, entityPreset: "worker",
  });
  expect(res.body.data.registrationUrl).toContain("/public/dang-ky?registrationToken=signed-token");
  expect(res.body.data.registrationToken).toBe("signed-token");
});

it("từ chối tạo liên kết nếu người dùng cố chọn công ty khác", async () => {
  const res = buildRes();
  let forwardedError: any;
  await StudentController.createPublicRegistrationLink({
    user: { uid: "teacher-1", role: "manager", companyCode: "ACME", centerId: "ACME", branchId: "branch-a" },
    body: { companyCode: "OTHER", branchId: "branch-a" },
  } as any, res, ((error: unknown) => { forwardedError = error; }) as any);

  expect(forwardedError?.code).toBe("PUBLIC_REGISTRATION_SCOPE_INVALID");
  expect(vi.mocked(BranchModel.exists)).not.toHaveBeenCalled();
});

it("từ chối gửi biểu mẫu nếu token không hợp lệ", async () => {
  const res = buildRes();
  await StudentController.publicRegister({
    body: { ...body, registrationToken: "tampered-token", registrationCompanyCode: "OTHER" },
  } as any, res);

  expect(res.statusCode).toBe(400);
  expect(vi.mocked(WorkerService.create)).not.toHaveBeenCalled();
});

it("không gắn partnerId không thuộc công ty hoặc chi nhánh của link đăng ký", async () => {
  vi.mocked(verifyPublicRegistrationToken).mockReturnValue({
    teacherId: "teacher-1", companyCode: "ACME", branchId: "branch-a", entityPreset: "student",
  });
  vi.spyOn(ModuleSettingsService.prototype, "get").mockResolvedValue({ entityPreset: "student" } as any);
  const createStudent = vi.spyOn(StudentService, "createStudent").mockResolvedValue({ _id: "student-1" } as any);
  const res = buildRes();

  await StudentController.publicRegister({
    body: { registrationToken: "signed-token", fullName: "Nguyen Van A", phone: "0900000000", partnerId: "6a890135119c1c3189d63849" },
  } as any, res);

  expect(res.statusCode).toBe(400);
  expect(vi.mocked(Partner.findOne)).toHaveBeenCalledWith(expect.objectContaining({
    _id: "6a890135119c1c3189d63849", branchId: "branch-a", isActive: true,
  }));
  expect(createStudent).not.toHaveBeenCalled();
});
