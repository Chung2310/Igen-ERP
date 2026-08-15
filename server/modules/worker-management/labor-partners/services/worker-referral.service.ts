import mongoose from "mongoose";
import { WorkerModel } from "../../models/worker.model";
import { LaborPartnerModel } from "../models/labor-partner.model";
import { WorkerReferralModel } from "../models/worker-referral.model";
import { CommissionPolicyModel } from "../models/commission-policy.model";
import { LaborPartnerError, actorSnapshot, normalizeDate, normalizeText, requiredObjectId, scopeQuery, type CommissionScheme, type LaborPartnerScope } from "../contracts";
import { buildWorkerQuery } from "../../services/worker.service";
import { runInTransaction } from "../../../../config/database";
import { supportsCommissionScheme } from "./policy-compatibility";

type ReferralInput = Record<string, unknown>;

function normalizeReferralInput(input: ReferralInput) {
  const effectiveFrom = normalizeDate(input.effectiveFrom, "Ngày hiệu lực");
  const effectiveTo = input.effectiveTo ? normalizeDate(input.effectiveTo, "Ngày hết hiệu lực") : null;
  if (effectiveTo && effectiveTo < effectiveFrom) throw new LaborPartnerError("INVALID_DATE", "Ngày hết hiệu lực phải sau ngày hiệu lực.");
  const commissionScheme = String(input.commissionScheme || "");
  if (commissionScheme !== "official_monthly" && commissionScheme !== "seasonal_hourly") throw new LaborPartnerError("INVALID_COMMISSION_SCHEME", "Cơ chế hoa hồng không hợp lệ.");
  return { workerId: requiredObjectId(input.workerId), policyId: requiredObjectId(input.policyId), commissionScheme: commissionScheme as CommissionScheme, referredAt: normalizeDate(input.referredAt, "Ngày giới thiệu"), employmentStartDate: normalizeDate(input.employmentStartDate, "Ngày bắt đầu làm"), effectiveFrom, effectiveTo, confirmationSource: (["contract", "manual", "attendance"].includes(String(input.confirmationSource)) ? String(input.confirmationSource) : "manual") as "contract" | "manual" | "attendance", note: normalizeText(input.note) };
}

function importDateToIso(value: unknown) {
  const raw = normalizeText(value);
  const display = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (display) return `${display[3]}-${display[2].padStart(2, "0")}-${display[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 10);
}

async function assertReferralResources(scope: LaborPartnerScope, partnerId: mongoose.Types.ObjectId, input: ReturnType<typeof normalizeReferralInput>) {
  const [partner, worker, policy] = await Promise.all([
    LaborPartnerModel.findOne({ _id: partnerId, ...scopeQuery(scope), deletedAt: null }).lean(),
    WorkerModel.findOne({ _id: input.workerId, ...buildWorkerQuery(scope) }).lean(),
    CommissionPolicyModel.findOne({ _id: input.policyId, ...scopeQuery(scope), status: "active" }).lean(),
  ]);
  if (!partner) throw new LaborPartnerError("LABOR_PARTNER_NOT_FOUND", "Không tìm thấy đối tác lao động.", 404);
  if (!worker) throw new LaborPartnerError("CROSS_SCOPE_RESOURCE_NOT_FOUND", "Không tìm thấy người lao động trong phạm vi hiện tại.", 404);
  if (!policy) throw new LaborPartnerError("POLICY_NOT_ACTIVE", "Chính sách hoa hồng chưa hoạt động hoặc không thuộc phạm vi hiện tại.", 409);
  if (!supportsCommissionScheme(policy, input.commissionScheme)) throw new LaborPartnerError("POLICY_SCHEME_MISMATCH", "Chính sách không hỗ trợ đúng cơ chế hoa hồng của nguồn giới thiệu.", 409);
}

function overlapsQuery(scope: LaborPartnerScope, workerId: mongoose.Types.ObjectId, from: string, to: string | null): any {
  return {
    ...scopeQuery(scope), workerId, status: { $in: ["pending", "active"] },
    effectiveFrom: { $lte: to || "9999-12-31" },
    $or: [{ effectiveTo: null }, { effectiveTo: "" }, { effectiveTo: { $gte: from } }],
  };
}

export const WorkerReferralService = {
  async listForPartner(scope: LaborPartnerScope, partnerId: string) {
    const partnerObjectId = requiredObjectId(partnerId);
    const partner = await LaborPartnerModel.exists({ _id: partnerObjectId, ...scopeQuery(scope), deletedAt: null });
    if (!partner) throw new LaborPartnerError("LABOR_PARTNER_NOT_FOUND", "Không tìm thấy đối tác lao động.", 404);
    return WorkerReferralModel.find({ partnerId: partnerObjectId, ...scopeQuery(scope) }).sort({ effectiveFrom: -1 }).lean();
  },
  async getForWorker(scope: LaborPartnerScope, workerId: string) {
    return WorkerReferralModel.find({ workerId: requiredObjectId(workerId), ...scopeQuery(scope) })
      .populate("partnerId", "code name")
      .sort({ effectiveFrom: -1 })
      .lean();
  },
  async create(scope: LaborPartnerScope, partnerId: string, input: ReferralInput, actor?: Record<string, unknown>) {
    const partnerObjectId = requiredObjectId(partnerId);
    const data = normalizeReferralInput(input);
    await assertReferralResources(scope, partnerObjectId, data);
    return runInTransaction(async (session) => {
      const overlapQuery = WorkerReferralModel.exists(overlapsQuery(scope, data.workerId, data.effectiveFrom, data.effectiveTo));
      if (session) overlapQuery.session(session);
      const overlaps = await overlapQuery;
      if (overlaps) throw new LaborPartnerError("WORKER_REFERRAL_OVERLAP", "Người lao động đã có đối tác giới thiệu hiệu lực trong khoảng thời gian này.", 409);
      const document = { ...data, partnerId: partnerObjectId, companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), status: data.confirmationSource === "manual" ? "pending" : "active", ...(data.confirmationSource === "manual" ? {} : { confirmedBy: actorSnapshot(actor).id, confirmedAt: new Date() }) };
      const rows: any = session
        ? await WorkerReferralModel.create([document] as any, { session })
        : await WorkerReferralModel.create([document] as any);
      return rows[0];
    });
  },
  async createForImportedWorker(
    scope: LaborPartnerScope,
    input: { workerId: string; partnerCode: string; laborType?: string; commissionScheme?: string; registrationDate?: string },
    actor?: Record<string, unknown>,
  ) {
    const code = normalizeText(input.partnerCode).toUpperCase();
    const partner = await LaborPartnerModel.findOne({ code, ...scopeQuery(scope), status: "active", deletedAt: null }).lean() as any;
    if (!partner) throw new LaborPartnerError("LABOR_PARTNER_NOT_FOUND", `Không tìm thấy đối tác có mã ${code}.`, 404);

    const explicitScheme = String(input.commissionScheme || "").trim();
    const commissionScheme: CommissionScheme = explicitScheme
      ? explicitScheme === "official_monthly" || explicitScheme === "seasonal_hourly"
        ? explicitScheme
        : (() => { throw new LaborPartnerError("IMPORT_SCHEME_INVALID", "Cơ chế hoa hồng trong file import không hợp lệ.", 400); })()
      : input.laborType === "seasonal" ? "seasonal_hourly" : "official_monthly";
    const compatibleQuery = commissionScheme === "seasonal_hourly" ? { "seasonal.enabled": true } : { "official.enabled": true };
    const policies = await CommissionPolicyModel.find({ ...scopeQuery(scope), status: "active", ...compatibleQuery }).sort({ createdAt: -1 }).lean() as any[];
    const schemeDefault = commissionScheme === "seasonal_hourly" ? partner.defaultSeasonalPolicyId : partner.defaultOfficialPolicyId;
    const legacyDefault = partner.defaultPolicyId ? String(partner.defaultPolicyId) : "";
    const policy = policies.find((item) => String(item._id) === String(schemeDefault || ""))
      || (!schemeDefault ? policies.find((item) => String(item._id) === legacyDefault) : undefined);
    if (!policy) throw new LaborPartnerError("PARTNER_DEFAULT_POLICY_MISSING", `Đối tác ${code} chưa cấu hình chính sách hoa hồng ${commissionScheme === "seasonal_hourly" ? "thời vụ" : "chính thức"} đang hoạt động.`, 409, { partnerCode: code, scheme: commissionScheme });

    const effectiveDate = importDateToIso(input.registrationDate);
    return WorkerReferralService.create(scope, String(partner._id), {
      workerId: input.workerId,
      policyId: String(policy._id),
      commissionScheme,
      referredAt: effectiveDate,
      employmentStartDate: effectiveDate,
      effectiveFrom: effectiveDate,
      confirmationSource: "manual",
    }, actor);
  },
  async confirm(scope: LaborPartnerScope, partnerId: string, referralId: string, actor?: Record<string, unknown>) {
    const referral = await WorkerReferralModel.findOne({ _id: requiredObjectId(referralId), partnerId: requiredObjectId(partnerId), ...scopeQuery(scope), status: "pending" });
    if (!referral) throw new LaborPartnerError("CROSS_SCOPE_RESOURCE_NOT_FOUND", "Không tìm thấy referral cần xác nhận.", 404);
    referral.status = "active";
    referral.confirmedBy = actorSnapshot(actor).id;
    referral.confirmedAt = new Date();
    return referral.save();
  },
  async end(scope: LaborPartnerScope, partnerId: string, referralId: string, effectiveTo: unknown) {
    const referral = await WorkerReferralModel.findOne({ _id: requiredObjectId(referralId), partnerId: requiredObjectId(partnerId), ...scopeQuery(scope), status: { $in: ["pending", "active"] } });
    if (!referral) throw new LaborPartnerError("CROSS_SCOPE_RESOURCE_NOT_FOUND", "Không tìm thấy referral cần kết thúc.", 404);
    const date = normalizeDate(effectiveTo, "Ngày kết thúc");
    if (date < referral.effectiveFrom) throw new LaborPartnerError("INVALID_DATE", "Ngày kết thúc không thể trước ngày hiệu lực.");
    referral.effectiveTo = date;
    referral.status = "ended";
    return referral.save();
  },
};
