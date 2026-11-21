import assert from "node:assert/strict";
import { afterEach, beforeEach, it, vi } from "vitest";

vi.mock("../services/auth.service", () => ({
  AuthService: { getUserProfile: vi.fn(async () => ({ isActive: true, companyCode: "acme", branchId: "branch-a", displayName: "Quan ly" })) },
}));
vi.mock("../utils/custom-field.util", () => ({ resolveCustomFieldTenantForOwner: vi.fn(async () => "acme") }));
vi.mock("../services/module-settings.service", () => ({
  ModuleSettingsService: class { async get() { return { entityPreset: "worker" }; } },
}));
vi.mock("../utils/public-register-fields.util", () => ({
  findMissingPublicRegisterFields: vi.fn(async () => []),
  resolvePublicRegisterFields: vi.fn(async () => []),
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

function buildRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (payload: unknown) => { res.body = payload; return res; };
  return res;
}

const body = { teacherId: "teacher-1", entityPreset: "worker", fullName: "Nguyen Van A", phone: "0900000000" };

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
  assert.deepEqual(referralCall?.[0], { companyCode: "acme", branchId: "branch-a" });
  assert.equal((referralCall?.[1] as any).partnerCode, "DT-01");
  assert.equal((referralCall?.[1] as any).workerId, "worker-1");
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
