import { CommissionPolicyModel } from "../models/commission-policy.model";
import { WorkerReferralModel } from "../models/worker-referral.model";
import { LaborPartnerError, actorSnapshot, normalizeDate, normalizeText, normalizeVnd, requiredObjectId, scopeQuery, type LaborPartnerScope } from "../contracts";
import type { CommissionTier, OfficialMilestone } from "../interfaces/commission-policy.interface";

type PolicyInput = Record<string, any>;

export function validatePolicyConfiguration(input: PolicyInput) {
  const official = input.official || {};
  const seasonal = input.seasonal || {};
  if (!official.enabled && !seasonal.enabled) {
    throw new LaborPartnerError("POLICY_EMPTY", "Chính sách phải bật ít nhất một cơ chế hoa hồng.");
  }

  const normalizedOfficial = {
    enabled: Boolean(official.enabled),
    maxMonths: official.enabled ? Number(official.maxMonths) as 1 | 2 | 3 : null,
    milestones: [] as OfficialMilestone[],
  };
  if (normalizedOfficial.enabled) {
    if (![1, 2, 3].includes(normalizedOfficial.maxMonths!)) throw new LaborPartnerError("POLICY_INVALID_OFFICIAL", "Số tháng hoa hồng chính thức phải từ 1 đến 3.");
    const milestones = Array.isArray(official.milestones) ? official.milestones : [];
    if (milestones.length !== normalizedOfficial.maxMonths) throw new LaborPartnerError("POLICY_INVALID_OFFICIAL", "Cần cấu hình đủ từng mốc tháng chính thức.");
    const months = new Set<number>();
    normalizedOfficial.milestones = milestones.map((item: any) => {
      const month = Number(item.month);
      if (!Number.isInteger(month) || month < 1 || month > normalizedOfficial.maxMonths! || months.has(month)) throw new LaborPartnerError("POLICY_INVALID_OFFICIAL", "Các mốc tháng chính thức bị trùng hoặc không hợp lệ.");
      months.add(month);
      const eligibilityRule = String(item.eligibilityRule || "");
      if (!["contract_active", "manual_confirmation", "attendance_threshold"].includes(eligibilityRule)) throw new LaborPartnerError("POLICY_INVALID_OFFICIAL", "Điều kiện mốc chính thức không hợp lệ.");
      const minWorkedDays = item.minWorkedDays == null ? null : Number(item.minWorkedDays);
      const minWorkedHours = item.minWorkedHours == null ? null : Number(item.minWorkedHours);
      if (eligibilityRule === "attendance_threshold" && minWorkedDays == null && minWorkedHours == null) throw new LaborPartnerError("POLICY_INVALID_OFFICIAL", "Điều kiện chấm công cần số ngày hoặc giờ tối thiểu.");
      if ((minWorkedDays != null && (!Number.isInteger(minWorkedDays) || minWorkedDays < 0)) || (minWorkedHours != null && (!Number.isFinite(minWorkedHours) || minWorkedHours < 0))) throw new LaborPartnerError("POLICY_INVALID_OFFICIAL", "Ngưỡng chấm công không hợp lệ.");
      return { month: month as 1 | 2 | 3, amount: normalizeVnd(item.amount, "Tiền hoa hồng"), eligibilityRule: eligibilityRule as any, minWorkedDays, minWorkedHours };
    }).sort((a, b) => a.month - b.month);
  }

  const normalizedSeasonal: Record<string, any> = { enabled: Boolean(seasonal.enabled), aggregationScope: null, tierMode: null, minHoursPerWorker: null, maxEligibleHoursPerWorker: null, hourRounding: { unitMinutes: 1, mode: "nearest" }, moneyRounding: { unitVnd: 1, mode: "nearest" }, tiers: [] };
  if (normalizedSeasonal.enabled) {
    if (!["partner_period", "partner_project_period"].includes(String(seasonal.aggregationScope))) throw new LaborPartnerError("POLICY_TIERS_INVALID", "Phạm vi tổng hợp giờ không hợp lệ.");
    if (!["flat", "progressive"].includes(String(seasonal.tierMode))) throw new LaborPartnerError("POLICY_TIERS_INVALID", "Kiểu tính bậc không hợp lệ.");
    normalizedSeasonal.aggregationScope = seasonal.aggregationScope;
    normalizedSeasonal.tierMode = seasonal.tierMode;
    for (const key of ["minHoursPerWorker", "maxEligibleHoursPerWorker"] as const) {
      const value = seasonal[key];
      if (value != null && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new LaborPartnerError("POLICY_TIERS_INVALID", "Giới hạn giờ mỗi lao động không hợp lệ.");
      normalizedSeasonal[key] = value == null ? null : Number(value);
    }
    if (normalizedSeasonal.maxEligibleHoursPerWorker != null && normalizedSeasonal.minHoursPerWorker != null && normalizedSeasonal.maxEligibleHoursPerWorker < normalizedSeasonal.minHoursPerWorker) throw new LaborPartnerError("POLICY_TIERS_INVALID", "Giờ tối đa phải lớn hơn hoặc bằng giờ tối thiểu.");
    const hourRounding = seasonal.hourRounding || {};
    const moneyRounding = seasonal.moneyRounding || {};
    if (![1, 5, 15, 30, 60].includes(Number(hourRounding.unitMinutes)) || !["floor", "nearest", "ceil"].includes(String(hourRounding.mode))) throw new LaborPartnerError("POLICY_TIERS_INVALID", "Quy tắc làm tròn giờ không hợp lệ.");
    if (!Number.isSafeInteger(Number(moneyRounding.unitVnd)) || Number(moneyRounding.unitVnd) < 1 || !["floor", "nearest", "ceil"].includes(String(moneyRounding.mode))) throw new LaborPartnerError("POLICY_TIERS_INVALID", "Quy tắc làm tròn tiền không hợp lệ.");
    normalizedSeasonal.hourRounding = { unitMinutes: Number(hourRounding.unitMinutes), mode: hourRounding.mode };
    normalizedSeasonal.moneyRounding = { unitVnd: Number(moneyRounding.unitVnd), mode: moneyRounding.mode };
    const tiers = Array.isArray(seasonal.tiers) ? seasonal.tiers : [];
    if (!tiers.length) throw new LaborPartnerError("POLICY_TIERS_INVALID", "Hoa hồng thời vụ cần ít nhất một bậc giờ.");
    const configuredMinHours = normalizedSeasonal.minHoursPerWorker ?? 0;
    let expectedMin: number | null = null;
    normalizedSeasonal.tiers = tiers.map((tier: any, index: number): CommissionTier => {
      const minHours = Number(tier.minHours);
      const maxHours = tier.maxHours == null || tier.maxHours === "" ? null : Number(tier.maxHours);
      const validFirstTierStart = index === 0 && (minHours === 0 || minHours === configuredMinHours);
      if (!Number.isFinite(minHours) || (index === 0 ? !validFirstTierStart : minHours !== expectedMin)) throw new LaborPartnerError("POLICY_TIERS_INVALID", "Các bậc giờ phải liên tục, bắt đầu từ 0 hoặc ngưỡng tối thiểu và không chồng lấn.");
      if (index === tiers.length - 1 && maxHours != null) throw new LaborPartnerError("POLICY_TIERS_INVALID", "Bậc giờ cuối phải không giới hạn.");
      if (index < tiers.length - 1 && (!Number.isFinite(maxHours) || maxHours! <= minHours)) throw new LaborPartnerError("POLICY_TIERS_INVALID", "Giới hạn bậc giờ không hợp lệ.");
      expectedMin = maxHours ?? expectedMin;
      return { minHours, maxHours, hourlyRate: normalizeVnd(tier.hourlyRate, "Đơn giá giờ") };
    });
  }
  const effectiveFrom = normalizeDate(input.effectiveFrom, "Ngày hiệu lực");
  const effectiveTo = input.effectiveTo ? normalizeDate(input.effectiveTo, "Ngày kết thúc hiệu lực") : null;
  if (effectiveTo && effectiveTo < effectiveFrom) throw new LaborPartnerError("INVALID_DATE", "Ngày kết thúc hiệu lực phải sau ngày bắt đầu.");
  const cycle = input.settlementCycle || {};
  if (!["calendar_month", "cutoff_day"].includes(String(cycle.type))) throw new LaborPartnerError("POLICY_INVALID_CYCLE", "Chu kỳ đối soát không hợp lệ.");
  const cutoffDay = cycle.type === "cutoff_day" ? Number(cycle.cutoffDay) : null;
  if (cycle.type === "cutoff_day" && (!Number.isInteger(cutoffDay) || cutoffDay < 1 || cutoffDay > 28)) throw new LaborPartnerError("POLICY_INVALID_CYCLE", "Ngày chốt kỳ phải từ 1 đến 28.");
  return { name: normalizeText(input.name), effectiveFrom, effectiveTo, settlementCycle: { type: cycle.type, cutoffDay }, official: normalizedOfficial, seasonal: normalizedSeasonal };
}

export const CommissionPolicyService = {
  async list(scope: LaborPartnerScope) {
    return CommissionPolicyModel.find(scopeQuery(scope)).sort({ name: 1, version: -1 }).lean();
  },
  async get(scope: LaborPartnerScope, id: string) {
    return CommissionPolicyModel.findOne({ _id: requiredObjectId(id), ...scopeQuery(scope) }).lean();
  },
  async create(scope: LaborPartnerScope, input: PolicyInput, actor?: Record<string, unknown>) {
    const normalized = validatePolicyConfiguration(input);
    if (!normalized.name) throw new LaborPartnerError("POLICY_INVALID_NAME", "Tên chính sách là bắt buộc.");
    const previous = await CommissionPolicyModel.findOne({ ...scopeQuery(scope), name: normalized.name }).sort({ version: -1 }).lean();
    return CommissionPolicyModel.create({ ...normalized, companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), version: Number(previous?.version || 0) + 1, status: "active", createdBy: actorSnapshot(actor), activatedBy: actorSnapshot(actor), activatedAt: new Date() } as any);
  },
  async update(scope: LaborPartnerScope, id: string, input: PolicyInput) {
    const current = await CommissionPolicyModel.findOne({ _id: requiredObjectId(id), ...scopeQuery(scope) });
    if (!current) throw new LaborPartnerError("POLICY_NOT_FOUND", "Không tìm thấy chính sách.", 404);
    // Status is retained for referral compatibility; policy edits are allowed through CRUD.
    const normalized = validatePolicyConfiguration({ ...current.toObject(), ...input });
    current.set(normalized);
    if (current.status !== "active") {
      current.status = "active";
      current.activatedAt = current.activatedAt || new Date();
    }
    return current.save();
  },
  async activate(scope: LaborPartnerScope, id: string, actor?: Record<string, unknown>) {
    const current = await CommissionPolicyModel.findOne({ _id: requiredObjectId(id), ...scopeQuery(scope) });
    if (!current) throw new LaborPartnerError("POLICY_NOT_FOUND", "Không tìm thấy chính sách.", 404);
    if (current.status !== "draft") throw new LaborPartnerError("POLICY_VERSION_IMMUTABLE", "Chỉ có thể kích hoạt phiên bản chính sách đang nháp.", 409);
    validatePolicyConfiguration(current.toObject());
    current.status = "active";
    current.activatedBy = actorSnapshot(actor);
    current.activatedAt = new Date();
    return current.save();
  },
  async retire(scope: LaborPartnerScope, id: string) {
    const current = await CommissionPolicyModel.findOne({ _id: requiredObjectId(id), ...scopeQuery(scope) });
    if (!current) throw new LaborPartnerError("POLICY_NOT_FOUND", "Không tìm thấy chính sách.", 404);
    if (current.status !== "active") throw new LaborPartnerError("POLICY_VERSION_IMMUTABLE", "Chỉ có thể ngừng áp dụng chính sách đang hoạt động.", 409);
    current.status = "retired";
    return current.save();
  },
  async remove(scope: LaborPartnerScope, id: string) {
    const current = await CommissionPolicyModel.findOne({ _id: requiredObjectId(id), ...scopeQuery(scope) });
    if (!current) throw new LaborPartnerError("POLICY_NOT_FOUND", "KhÃ´ng tÃ¬m tháº¥y chÃ­nh sÃ¡ch.", 404);
    // Deletion is protected by referral usage below, regardless of legacy status.
    const used = await WorkerReferralModel.exists({ policyId: current._id, ...scopeQuery(scope) });
    if (used) throw new LaborPartnerError("POLICY_IN_USE", "KhÃ´ng thá»ƒ xÃ³a policy Ä‘Ã£ Ä‘Æ°á»£c dÃ¹ng cho referral.", 409);
    await CommissionPolicyModel.deleteOne({ _id: current._id, ...scopeQuery(scope) });
    return current;
  },
  async clone(scope: LaborPartnerScope, id: string, input: { effectiveFrom: string; name?: string }, actor?: Record<string, unknown>) {
    const source = await CommissionPolicyModel.findOne({ _id: requiredObjectId(id), ...scopeQuery(scope) }).lean();
    if (!source) throw new LaborPartnerError("POLICY_NOT_FOUND", "Không tìm thấy chính sách.", 404);
    return this.create(scope, { ...source, name: normalizeText(input.name) || source.name, effectiveFrom: input.effectiveFrom, effectiveTo: null }, actor);
  },
};
