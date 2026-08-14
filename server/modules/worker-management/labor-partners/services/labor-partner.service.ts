import { Types } from "mongoose";
import { LaborPartnerModel } from "../models/labor-partner.model";
import { WorkerReferralModel } from "../models/worker-referral.model";
import { CommissionPolicyModel } from "../models/commission-policy.model";
import { LaborPartnerSettlementModel } from "../models/settlement.model";
import { LaborPartnerPayoutModel } from "../models/payout.model";
import { LaborPartnerError, normalizeText, requiredObjectId, scopeQuery, type LaborPartnerScope } from "../contracts";
import { normalizeWorkerPhone } from "../../services/worker.service";

type PartnerInput = Record<string, unknown>;

function normalizePartnerInput(input: PartnerInput) {
  const code = normalizeText(input.code).toUpperCase();
  const name = normalizeText(input.name);
  const phone = normalizeWorkerPhone(input.phone);
  if (!code) throw new LaborPartnerError("LABOR_PARTNER_CODE_REQUIRED", "Mã đối tác là bắt buộc.");
  if (!name) throw new LaborPartnerError("LABOR_PARTNER_NAME_REQUIRED", "Tên đối tác là bắt buộc.");
  if (!phone) throw new LaborPartnerError("LABOR_PARTNER_PHONE_REQUIRED", "Số điện thoại đối tác là bắt buộc.");
  return {
    code, name, phone,
    email: normalizeText(input.email).toLowerCase(), taxCode: normalizeText(input.taxCode), representative: normalizeText(input.representative), address: normalizeText(input.address),
    bankName: normalizeText(input.bankName), bankAccountNo: normalizeText(input.bankAccountNo), bankAccountName: normalizeText(input.bankAccountName),
    ...(input.defaultPolicyId === undefined ? {} : { defaultPolicyId: input.defaultPolicyId ? requiredObjectId(input.defaultPolicyId) : null }),
    ...(input.status === undefined ? {} : { status: input.status === "inactive" ? "inactive" : "active" }),
    note: normalizeText(input.note),
  };
}

async function assertPolicyInScope(scope: LaborPartnerScope, policyId: Types.ObjectId | null | undefined) {
  if (!policyId) return;
  const policy = await CommissionPolicyModel.findOne({ _id: policyId, ...scopeQuery(scope) }).lean();
  if (!policy) throw new LaborPartnerError("POLICY_NOT_FOUND", "Không tìm thấy chính sách hoa hồng.", 404);
}

export const LaborPartnerService = {
  async list(scope: LaborPartnerScope, input: Record<string, unknown> = {}) {
    const page = Math.max(1, Number(input.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(input.pageSize) || 20));
    const search = normalizeText(input.search);
    const query: Record<string, unknown> = { ...scopeQuery(scope), deletedAt: null, ...(input.status ? { status: input.status } : {}) };
    if (search) query.$or = [{ name: { $regex: search, $options: "i" } }, { code: { $regex: search, $options: "i" } }, { phone: { $regex: search, $options: "i" } }];
    const [items, total] = await Promise.all([
      LaborPartnerModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      LaborPartnerModel.countDocuments(query),
    ]);
    return { items, page, pageSize, total };
  },
  async get(scope: LaborPartnerScope, id: string) {
    const partner = await LaborPartnerModel.findOne({ _id: requiredObjectId(id), ...scopeQuery(scope), deletedAt: null }).lean();
    if (!partner) return null;
    const [activeReferrals, totalReferrals] = await Promise.all([
      WorkerReferralModel.countDocuments({ partnerId: partner._id, ...scopeQuery(scope), status: { $in: ["pending", "active"] } }),
      WorkerReferralModel.countDocuments({ partnerId: partner._id, ...scopeQuery(scope) }),
    ]);
    return { ...partner, referralSummary: { active: activeReferrals, total: totalReferrals } };
  },
  async overview(scope: LaborPartnerScope, id: string) {
    const partner = await this.get(scope, id);
    if (!partner) return null;
    const partnerId = requiredObjectId(id);
    const [referrals, settlements, payouts] = await Promise.all([
      WorkerReferralModel.find({ partnerId, ...scopeQuery(scope) }).populate("workerId", "code fullName phone").populate("policyId", "name version").sort({ effectiveFrom: -1 }).lean(),
      (LaborPartnerSettlementModel as any).find({ partnerId, ...scopeQuery(scope) }).sort({ periodStart: -1, createdAt: -1 }).lean(),
      (LaborPartnerPayoutModel as any).find({ partnerId, ...scopeQuery(scope) }).sort({ paidAt: -1, createdAt: -1 }).lean(),
    ]);
    const nonVoidSettlements = settlements.filter((item: any) => item.status !== "void");
    return { partner, referrals, settlements, payouts, totals: {
      accruedAmount: nonVoidSettlements.reduce((sum: number, item: any) => sum + Number(item.totalAmount || 0), 0),
      paidAmount: nonVoidSettlements.reduce((sum: number, item: any) => sum + Number(item.paidAmount || 0), 0),
      balanceAmount: nonVoidSettlements.reduce((sum: number, item: any) => sum + Number(item.balanceAmount || 0), 0),
    } };
  },
  async create(scope: LaborPartnerScope, input: PartnerInput) {
    const data = normalizePartnerInput(input);
    await assertPolicyInScope(scope, data.defaultPolicyId as Types.ObjectId | undefined);
    const existing = await LaborPartnerModel.findOne({ ...scopeQuery(scope), code: data.code, deletedAt: null }).lean();
    if (existing) throw new LaborPartnerError("LABOR_PARTNER_CODE_EXISTS", "Mã đối tác đã tồn tại.", 409);
    return LaborPartnerModel.create({ ...data, companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}) } as any);
  },
  async update(scope: LaborPartnerScope, id: string, input: PartnerInput) {
    const current = await LaborPartnerModel.findOne({ _id: requiredObjectId(id), ...scopeQuery(scope), deletedAt: null });
    if (!current) throw new LaborPartnerError("LABOR_PARTNER_NOT_FOUND", "Không tìm thấy đối tác lao động.", 404);
    const data = normalizePartnerInput({ ...current.toObject(), ...input });
    await assertPolicyInScope(scope, data.defaultPolicyId as Types.ObjectId | undefined);
    const duplicate = await LaborPartnerModel.findOne({ ...scopeQuery(scope), _id: { $ne: current._id }, code: data.code, deletedAt: null }).lean();
    if (duplicate) throw new LaborPartnerError("LABOR_PARTNER_CODE_EXISTS", "Mã đối tác đã tồn tại.", 409);
    Object.assign(current, data);
    return current.save();
  },
  async remove(scope: LaborPartnerScope, id: string) {
    const partner = await LaborPartnerModel.findOne({ _id: requiredObjectId(id), ...scopeQuery(scope), deletedAt: null });
    if (!partner) throw new LaborPartnerError("LABOR_PARTNER_NOT_FOUND", "Không tìm thấy đối tác lao động.", 404);
    const activeReferral = await WorkerReferralModel.exists({ partnerId: partner._id, ...scopeQuery(scope), status: { $in: ["pending", "active"] } });
    if (activeReferral) throw new LaborPartnerError("LABOR_PARTNER_HAS_ACTIVE_REFERRALS", "Không thể xóa đối tác đang có lao động giới thiệu hiệu lực.", 409);
    partner.deletedAt = new Date();
    return partner.save();
  },
};
