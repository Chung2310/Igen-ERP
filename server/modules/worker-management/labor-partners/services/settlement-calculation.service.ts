import mongoose from "mongoose";
import { WorkerAttendanceLogModel } from "../../models/worker-attendance-log.model";
import { WorkerLaborContractModel } from "../../models/worker-labor-contract.model";
import { LaborPartnerModel } from "../models/labor-partner.model";
import { WorkerReferralModel } from "../models/worker-referral.model";
import { LaborPartnerSettlementModel } from "../models/settlement.model";
import { LaborPartnerCommissionLineModel } from "../models/commission-line.model";
import { LaborPartnerError, actorSnapshot, normalizeDate, requiredObjectId, scopeQuery, type LaborPartnerScope } from "../contracts";
import { runInTransaction } from "../../../../config/database";
import { mergeAttendanceIntervals } from "./calculation/attendance-interval-merger";
import { calculateOfficialMilestones } from "./calculation/official-calculator";
import { calculateSeasonalCommission } from "./calculation/seasonal-calculator";
import { resolveSettlementPeriod } from "./calculation/date-cycle";
import { supportsCommissionScheme } from "./policy-compatibility";

type ManualSettlementEntry = { referralId: string; officialMonths?: number; seasonalHours?: number };
type CalculateInput = { partnerId: string; periodAnchor: string; manualEntries?: ManualSettlementEntry[]; force?: boolean };
type AttendanceRow = { _id: unknown; workerId: unknown; projectId: unknown; date: string; checkIn?: { time?: Date } | null; checkOut?: { time?: Date } | null; workedMinutes?: number };

const id = (value: unknown) => String(value || "");
const activeAt = (referral: any, date: string) => referral.effectiveFrom <= date && (!referral.effectiveTo || referral.effectiveTo >= date);

export const LaborPartnerSettlementCalculationService = {
  async recalculate(scope: LaborPartnerScope, settlementId: string, actor?: Record<string, unknown>) {
    const current = await (LaborPartnerSettlementModel as any).findOne({ _id: requiredObjectId(settlementId), ...scopeQuery(scope) }).lean();
    if (!current) throw new LaborPartnerError("CROSS_SCOPE_RESOURCE_NOT_FOUND", "Không tìm thấy kỳ đối soát.", 404);
    if (!["draft", "calculated"].includes(String(current.status))) throw new LaborPartnerError("SETTLEMENT_NOT_EDITABLE", "Chỉ có thể tính lại kỳ chưa duyệt và chưa chi trả.", 409);
    return this.calculate(scope, { partnerId: String(current.partnerId), periodAnchor: current.periodStart, manualEntries: current.manualEntries || [], force: true }, actor);
  },
  async calculate(scope: LaborPartnerScope, input: CalculateInput, actor?: Record<string, unknown>) {
    const partnerId = requiredObjectId(input.partnerId);
    const anchor = normalizeDate(input.periodAnchor, "Ngày kỳ đối soát");
    const partner = await LaborPartnerModel.findOne({ _id: partnerId, ...scopeQuery(scope), deletedAt: null }).lean();
    if (!partner) throw new LaborPartnerError("LABOR_PARTNER_NOT_FOUND", "Không tìm thấy đối tác lao động.", 404);
    const referrals = await WorkerReferralModel.find({ partnerId, ...scopeQuery(scope), status: "active" }).populate("policyId").lean() as any[];
    if (!referrals.length) throw new LaborPartnerError("SETTLEMENT_HAS_NO_ELIGIBLE_LINES", "Đối tác chưa có referral đang hiệu lực.", 409);

    const policyPeriods = new Map<string, { policy: any; start: string; end: string }>();
    for (const referral of referrals) {
      const policy: any = referral.policyId;
      if (!policy) throw new LaborPartnerError("POLICY_NOT_ACTIVE", "Nguồn giới thiệu chưa có chính sách hoa hồng.", 409, { referralId: id(referral._id), scheme: referral.commissionScheme });
      const period = resolveSettlementPeriod(anchor, policy.settlementCycle);
      if (!activeAt(referral, period.start) && !activeAt(referral, period.end)) continue;
      if (policy.status !== "active") throw new LaborPartnerError("POLICY_NOT_ACTIVE", "Nguồn giới thiệu đang gắn chính sách chưa hoạt động.", 409, { referralId: id(referral._id), scheme: referral.commissionScheme });
      if (!supportsCommissionScheme(policy, referral.commissionScheme)) throw new LaborPartnerError("POLICY_SCHEME_MISMATCH", "Nguồn giới thiệu đang gắn chính sách không phù hợp với cơ chế hoa hồng.", 409, { referralId: id(referral._id), scheme: referral.commissionScheme, policyId: id(policy._id) });
      const existingPeriod = [...policyPeriods.values()][0];
      if (existingPeriod && (existingPeriod.start !== period.start || existingPeriod.end !== period.end)) {
        throw new LaborPartnerError("MIXED_SETTLEMENT_CYCLE", "Các chính sách của đối tác có kỳ đối soát khác nhau; hãy dùng cùng kỳ hoặc tách đối soát.", 409, { existingPeriod: { start: existingPeriod.start, end: existingPeriod.end }, conflictingPeriod: period, referralId: id(referral._id), policyId: id(policy._id) });
      }
      policyPeriods.set(id(policy._id), { policy, ...period });
    }
    if (!policyPeriods.size) throw new LaborPartnerError("SETTLEMENT_HAS_NO_ELIGIBLE_LINES", "Không có policy hiệu lực cho kỳ đối soát này.", 409);
    const periodStart = [...policyPeriods.values()].map((item) => item.start).sort()[0];
    const periodEnd = [...policyPeriods.values()].map((item) => item.end).sort().at(-1)!;
    const key = `${scope.companyCode}:${scope.branchId || "all"}:${partnerId}:${periodStart}:${periodEnd}`;
    const existing = await (LaborPartnerSettlementModel as any).findOne({ settlementKey: key, revision: 1 }).lean();
    if (existing && !input.force) return { settlement: existing, reused: true };
    const manualEntries = Array.isArray(input.manualEntries) ? input.manualEntries : [];
    const manualByReferral = new Map(manualEntries.map((entry) => [id(entry.referralId), entry]));
    if (!manualEntries.length) throw new LaborPartnerError("MANUAL_ENTRY_REQUIRED", "Cần nhập số tháng hoặc số giờ thực tế trước khi tính kỳ đối soát.", 400);
    if (existing && !["draft", "calculated"].includes(String(existing.status))) throw new LaborPartnerError("SETTLEMENT_NOT_EDITABLE", "Chỉ có thể tính lại kỳ chưa duyệt và chưa chi trả.", 409);

    const workerIds = [...new Set(referrals.map((item) => id(item.workerId)))].filter(Boolean);
    const [attendance, contracts, approvedOfficial] = await Promise.all([
      WorkerAttendanceLogModel.find({ companyCode: scope.companyCode, workerId: { $in: workerIds.map((value) => new mongoose.Types.ObjectId(value)) }, date: { $gte: periodStart, $lt: periodEnd }, "checkIn.time": { $exists: true }, "checkOut.time": { $exists: true } }).lean() as Promise<AttendanceRow[]>,
      WorkerLaborContractModel.find({ companyCode: scope.companyCode, workerId: { $in: workerIds.map((value) => new mongoose.Types.ObjectId(value)) }, deletedAt: null }).lean() as Promise<any[]>,
      (LaborPartnerCommissionLineModel as any).find({ partnerId, scheme: "official_monthly", status: "approved" }).select("referralId officialMilestone").lean(),
    ]);
    const attendanceByWorker = new Map<string, AttendanceRow[]>();
    for (const row of attendance) attendanceByWorker.set(id(row.workerId), [...(attendanceByWorker.get(id(row.workerId)) || []), row]);
    const contractsByWorker = new Map<string, any[]>();
    for (const contract of contracts) contractsByWorker.set(id(contract.workerId), [...(contractsByWorker.get(id(contract.workerId)) || []), contract]);
    const approvedByReferral = new Map<string, number[]>();
    for (const line of approvedOfficial as any[]) approvedByReferral.set(id(line.referralId), [...(approvedByReferral.get(id(line.referralId)) || []), Number(line.officialMilestone)]);

    const lines: any[] = [];
    const warnings: any[] = [];
    for (const referral of referrals.filter((item) => item.commissionScheme === "official_monthly")) {
      const current = policyPeriods.get(id((referral.policyId as any)._id));
      if (!current || !current.policy.official.enabled) continue;
      const manual = manualByReferral.get(id(referral._id));
      if (manual?.officialMonths != null) {
        const requestedMonths = Number(manual.officialMonths);
        if (!Number.isInteger(requestedMonths) || requestedMonths < 0 || requestedMonths > Number(current.policy.official.maxMonths || 0)) {
          throw new LaborPartnerError("MANUAL_ENTRY_INVALID", "Số tháng chính thức nhập tay không hợp lệ.", 400);
        }
        const approvedMonths = new Set(approvedByReferral.get(id(referral._id)) || []);
        for (const milestone of current.policy.official.milestones.filter((item: any) => item.month <= requestedMonths && !approvedMonths.has(item.month))) {
          lines.push({ referralId: referral._id, workerId: referral.workerId, scheme: "official_monthly", officialMilestone: milestone.month, amount: milestone.amount, sourceContractId: null, eligibleMinutes: null, hourlyRate: null, policySnapshot: current.policy, explanation: `Nhập tay: đạt mốc tháng ${milestone.month}.`, lineKey: `official:${referral._id}:${milestone.month}` });
        }
        continue;
      }
      const referralAttendance = attendanceByWorker.get(id(referral.workerId)) || [];
      const officialLines = calculateOfficialMilestones({ employmentStartDate: referral.employmentStartDate, periodStart: current.start, periodEnd: current.end, milestones: current.policy.official.milestones, alreadyApprovedMonths: approvedByReferral.get(id(referral._id)) || [], isEligible: (milestone, dueDate) => {
        if (milestone.eligibilityRule === "manual_confirmation") return Boolean(referral.confirmedAt);
        if (milestone.eligibilityRule === "contract_active") return (contractsByWorker.get(id(referral.workerId)) || []).some((contract) => contract.status === "active" && contract.startDate <= dueDate && contract.endDate >= dueDate);
        const minutes = referralAttendance.filter((row) => row.date >= current.start && row.date < current.end).reduce((total, row) => total + Number(row.workedMinutes || 0), 0);
        const days = new Set(referralAttendance.filter((row) => row.date >= current.start && row.date < current.end).map((row) => row.date)).size;
        return (milestone.minWorkedDays == null || days >= milestone.minWorkedDays) && (milestone.minWorkedHours == null || minutes >= milestone.minWorkedHours * 60);
      } });
      for (const line of officialLines) lines.push({ referralId: referral._id, workerId: referral.workerId, scheme: "official_monthly", officialMilestone: line.month, amount: line.amount, sourceContractId: null, eligibleMinutes: null, hourlyRate: null, policySnapshot: current.policy, explanation: `Mốc tháng ${line.month} đến hạn ${line.dueDate}.`, lineKey: `official:${referral._id}:${line.month}` });
    }

    const seasonalGroups = new Map<string, any[]>();
    for (const referral of referrals.filter((item) => item.commissionScheme === "seasonal_hourly")) {
      const current = policyPeriods.get(id((referral.policyId as any)._id));
      if (current?.policy.seasonal.enabled) seasonalGroups.set(id((referral.policyId as any)._id), [...(seasonalGroups.get(id((referral.policyId as any)._id)) || []), referral]);
    }
    for (const [policyId, group] of seasonalGroups) {
      const current = policyPeriods.get(policyId)!;
      if (manualEntries.length) {
        const manualWorkers = group.map((referral) => ({ referral, minutes: Math.round(Number(manualByReferral.get(id(referral._id))?.seasonalHours || 0) * 60) })).filter((item) => item.minutes > 0);
        const totalMinutes = manualWorkers.reduce((total, item) => total + item.minutes, 0);
        if (!totalMinutes) {
          warnings.push({ code: "NO_MANUAL_SEASONAL_HOURS", policyId, message: "Chưa nhập số giờ thời vụ cho kỳ này." });
          continue;
        }
        const result = calculateSeasonalCommission(totalMinutes, current.policy.seasonal);
        let allocated = 0;
        manualWorkers.forEach((item, index) => {
          const rawAmount = index === manualWorkers.length - 1 ? result.amount - allocated : Math.round(result.amount * item.minutes / totalMinutes);
          allocated += rawAmount;
          lines.push({ referralId: item.referral._id, workerId: item.referral.workerId, scheme: "seasonal_hourly", amount: rawAmount, eligibleMinutes: item.minutes, hourlyRate: result.hourlyRate, sourceAttendanceLogIds: [], policySnapshot: current.policy, explanation: `Nhập tay: ${item.minutes / 60} giờ trong tổng ${totalMinutes / 60} giờ thời vụ.`, lineKey: `seasonal:${item.referral._id}:${current.start}:${current.end}` });
        });
        continue;
      }
      const intervals = group.flatMap((referral) => (attendanceByWorker.get(id(referral.workerId)) || []).filter((row) => row.date >= current.start && row.date < current.end && activeAt(referral, row.date)).map((row) => ({ workerId: id(referral.workerId), projectId: id(row.projectId), sourceLogId: id(row._id), start: new Date(row.checkIn!.time!), end: new Date(row.checkOut!.time!) })));
      const merged = mergeAttendanceIntervals(intervals, current.policy.seasonal.aggregationScope === "partner_project_period");
      const minutesByWorker = new Map<string, { minutes: number; sourceIds: string[] }>();
      for (const row of merged) { const previous = minutesByWorker.get(row.workerId) || { minutes: 0, sourceIds: [] }; minutesByWorker.set(row.workerId, { minutes: previous.minutes + row.minutes, sourceIds: [...previous.sourceIds, ...row.sourceLogIds] }); }
      const totalMinutes = [...minutesByWorker.values()].reduce((total, value) => total + value.minutes, 0);
      const result = calculateSeasonalCommission(totalMinutes, current.policy.seasonal);
      let allocated = 0;
      const referredWorkers = group.filter((item) => (minutesByWorker.get(id(item.workerId))?.minutes || 0) > 0);
      referredWorkers.forEach((referral, index) => {
        const source = minutesByWorker.get(id(referral.workerId))!;
        const rawAmount = index === referredWorkers.length - 1 ? result.amount - allocated : Math.round(result.amount * source.minutes / totalMinutes);
        allocated += rawAmount;
        if (rawAmount <= 0) return;
        lines.push({ referralId: referral._id, workerId: referral.workerId, scheme: "seasonal_hourly", amount: rawAmount, eligibleMinutes: result.eligibleMinutes, hourlyRate: result.hourlyRate, sourceAttendanceLogIds: source.sourceIds.map((value) => new mongoose.Types.ObjectId(value)), policySnapshot: current.policy, explanation: `${source.minutes} phút hợp lệ; ${current.policy.seasonal.tierMode} theo policy ${current.policy.name}.`, lineKey: `seasonal:${referral._id}:${current.start}:${current.end}` });
      });
      if (!referredWorkers.length) warnings.push({ code: "NO_SEASONAL_ATTENDANCE", policyId, message: "Không có giờ chấm công hợp lệ cho referral thời vụ trong kỳ." });
    }
    if (!lines.length) throw new LaborPartnerError("SETTLEMENT_HAS_NO_ELIGIBLE_LINES", "Kỳ này chưa có khoản hoa hồng đủ điều kiện.", 409, { warnings });
    const officialAmount = lines.filter((line) => line.scheme === "official_monthly").reduce((total, line) => total + line.amount, 0);
    const seasonalLines = lines.filter((line) => line.scheme === "seasonal_hourly");
    const seasonalAmount = seasonalLines.reduce((total, line) => total + line.amount, 0);
    const seasonalMinutes = seasonalLines.reduce((total, line) => total + Number(line.eligibleMinutes || 0), 0);
    let settlement: any;
    await runInTransaction(async (session) => {
      const next = { periodStart, periodEnd, cutoffAt: new Date(), status: "calculated", manualEntries, officialAmount, seasonalMinutes, seasonalAmount, adjustmentAmount: 0, totalAmount: officialAmount + seasonalAmount, paidAmount: 0, balanceAmount: officialAmount + seasonalAmount, policySnapshots: [...policyPeriods.values()].map((item) => item.policy), warnings, calculatedBy: actorSnapshot(actor), calculatedAt: new Date(), approvedBy: null, approvedAt: null, voidReason: "" };
      const options = session ? { session, ordered: true } : undefined;
      if (existing && input.force) {
        const query = (LaborPartnerSettlementModel as any).findOneAndUpdate({ _id: existing._id, ...scopeQuery(scope), status: { $in: ["draft", "calculated"] } }, { $set: next, $inc: { version: 1 } }, { returnDocument: 'after' });
        if (session) query.session(session);
        settlement = await query;
        if (!settlement) throw new LaborPartnerError("SETTLEMENT_STALE_VERSION", "Kỳ đối soát đã thay đổi, vui lòng tải lại trước khi tính lại.", 409);
        const deleteQuery = (LaborPartnerCommissionLineModel as any).deleteMany({ settlementId: settlement._id });
        if (session) deleteQuery.session(session);
        await deleteQuery;
      } else {
        [settlement] = await LaborPartnerSettlementModel.create([{ companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), partnerId, settlementKey: key, revision: 1, ...next, version: 1 }], options as any);
      }
      await LaborPartnerCommissionLineModel.insertMany(lines.map((line) => ({ ...line, settlementId: settlement._id, partnerId, status: "draft" })), options as any);
    });
    return { settlement, reused: false };
  },
};
