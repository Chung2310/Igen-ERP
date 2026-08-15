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
    ...(input.defaultOfficialPolicyId === undefined ? {} : { defaultOfficialPolicyId: input.defaultOfficialPolicyId ? requiredObjectId(input.defaultOfficialPolicyId) : null }),
    ...(input.defaultSeasonalPolicyId === undefined ? {} : { defaultSeasonalPolicyId: input.defaultSeasonalPolicyId ? requiredObjectId(input.defaultSeasonalPolicyId) : null }),
    ...(input.status === undefined ? {} : { status: input.status === "inactive" ? "inactive" : "active" }),
    note: normalizeText(input.note),
  };
}

async function assertPolicyInScope(scope: LaborPartnerScope, policyId: Types.ObjectId | null | undefined, scheme?: "official_monthly" | "seasonal_hourly") {
  if (!policyId) return;
  const policy = await CommissionPolicyModel.findOne({ _id: policyId, ...scopeQuery(scope), ...(scheme ? { status: "active" } : {}) }).lean();
  if (!policy) throw new LaborPartnerError("POLICY_NOT_FOUND", "Không tìm thấy chính sách hoa hồng.", 404);
  if (scheme && (scheme === "official_monthly" ? !policy.official?.enabled : !policy.seasonal?.enabled)) {
    throw new LaborPartnerError("POLICY_SCHEME_MISMATCH", "Chính sách không hỗ trợ đúng cơ chế hoa hồng.", 409);
  }
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
    const partnerIds = items.map((item: any) => item._id);
    const referralCounts = partnerIds.length ? await WorkerReferralModel.aggregate([
      { $match: { partnerId: { $in: partnerIds }, ...scopeQuery(scope) } },
      { $group: { _id: { partnerId: "$partnerId", status: "$status", scheme: "$commissionScheme" }, count: { $sum: 1 } } },
    ]) : [];
    const summary = new Map<string, { active: number; pending: number; official: number; seasonal: number; total: number }>();
    for (const row of referralCounts as any[]) {
      const partnerKey = String(row._id.partnerId);
      const current = summary.get(partnerKey) || { active: 0, pending: 0, official: 0, seasonal: 0, total: 0 };
      const count = Number(row.count || 0);
      current.total += count;
      if (row._id.status === "active") {
        current.active += count;
        if (row._id.scheme === "official_monthly") current.official += count;
        if (row._id.scheme === "seasonal_hourly") current.seasonal += count;
      }
      if (row._id.status === "pending") current.pending += count;
      summary.set(partnerKey, current);
    }
    return { items: items.map((item: any) => ({ ...item, referralSummary: summary.get(String(item._id)) || { active: 0, pending: 0, official: 0, seasonal: 0, total: 0 } })), page, pageSize, total };
  },
  async get(scope: LaborPartnerScope, id: string) {
    const partner = await LaborPartnerModel.findOne({ _id: requiredObjectId(id), ...scopeQuery(scope), deletedAt: null }).lean();
    if (!partner) return null;
    const [activeReferrals, totalReferrals] = await Promise.all([
      WorkerReferralModel.countDocuments({ partnerId: partner._id, ...scopeQuery(scope), status: "active" }),
      WorkerReferralModel.countDocuments({ partnerId: partner._id, ...scopeQuery(scope) }),
    ]);
    const [official, seasonal, pending] = await Promise.all([
      WorkerReferralModel.countDocuments({ partnerId: partner._id, ...scopeQuery(scope), status: "active", commissionScheme: "official_monthly" }),
      WorkerReferralModel.countDocuments({ partnerId: partner._id, ...scopeQuery(scope), status: "active", commissionScheme: "seasonal_hourly" }),
      WorkerReferralModel.countDocuments({ partnerId: partner._id, ...scopeQuery(scope), status: "pending" }),
    ]);
    return { ...partner, referralSummary: { active: activeReferrals, pending, official, seasonal, total: totalReferrals } };
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
    await Promise.all([
      assertPolicyInScope(scope, data.defaultPolicyId as Types.ObjectId | undefined),
      assertPolicyInScope(scope, data.defaultOfficialPolicyId as Types.ObjectId | undefined, "official_monthly"),
      assertPolicyInScope(scope, data.defaultSeasonalPolicyId as Types.ObjectId | undefined, "seasonal_hourly"),
    ]);
    const existing = await LaborPartnerModel.findOne({ ...scopeQuery(scope), code: data.code, deletedAt: null }).lean();
    if (existing) throw new LaborPartnerError("LABOR_PARTNER_CODE_EXISTS", "Mã đối tác đã tồn tại.", 409);
    return LaborPartnerModel.create({ ...data, companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}) } as any);
  },
  async update(scope: LaborPartnerScope, id: string, input: PartnerInput) {
    const current = await LaborPartnerModel.findOne({ _id: requiredObjectId(id), ...scopeQuery(scope), deletedAt: null });
    if (!current) throw new LaborPartnerError("LABOR_PARTNER_NOT_FOUND", "Không tìm thấy đối tác lao động.", 404);
    const data = normalizePartnerInput({ ...current.toObject(), ...input });
    await Promise.all([
      assertPolicyInScope(scope, data.defaultPolicyId as Types.ObjectId | undefined),
      assertPolicyInScope(scope, data.defaultOfficialPolicyId as Types.ObjectId | undefined, "official_monthly"),
      assertPolicyInScope(scope, data.defaultSeasonalPolicyId as Types.ObjectId | undefined, "seasonal_hourly"),
    ]);
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
