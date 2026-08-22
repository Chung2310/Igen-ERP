import { LaborPartnerSettlementModel } from "../models/settlement.model";
import { LaborPartnerCommissionLineModel } from "../models/commission-line.model";
import { LaborPartnerPayoutModel } from "../models/payout.model";
import { LaborPartnerError, actorSnapshot, normalizeVnd, requiredObjectId, scopeQuery, type LaborPartnerScope } from "../contracts";
import { runInTransaction } from "../../../../config/database";

export const LaborPartnerSettlementOperationService = {
  async createAdjustment(scope: LaborPartnerScope, sourceSettlementId: string, input: Record<string, unknown>, actor?: Record<string, unknown>) {
    const sourceId = requiredObjectId(sourceSettlementId); const amount = Number(input.amount); const periodAnchor = String(input.periodAnchor || "").trim(); const reason = String(input.reason || "").trim(); const idempotencyKey = String(input.idempotencyKey || "").trim();
    if (!Number.isSafeInteger(amount) || amount === 0) throw new LaborPartnerError("INVALID_MONEY", "Số tiền điều chỉnh phải là số VND nguyên khác 0.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodAnchor) || !reason || !idempotencyKey) throw new LaborPartnerError("INVALID_ADJUSTMENT", "Thiếu kỳ điều chỉnh, lý do hoặc mã chống trùng.");
    const monthStart = `${periodAnchor.slice(0, 7)}-01`; const endDate = new Date(Date.UTC(Number(periodAnchor.slice(0, 4)), Number(periodAnchor.slice(5, 7)), 0)); const monthEnd = endDate.toISOString().slice(0, 10);
    const settlementKey = `${scope.companyCode}:${scope.branchId || "all"}:adjustment:${sourceId}:${periodAnchor}:${idempotencyKey}`;
    let result: any;
    await runInTransaction(async (session) => {
      const options = session ? { session, ordered: true } : undefined;
      const replayQuery = (LaborPartnerSettlementModel as any).findOne({ settlementKey, ...scopeQuery(scope) });
      if (session) replayQuery.session(session);
      const replay = await replayQuery;
      if (replay) { result = { settlement: replay, replay: true }; return; }
      const sourceQuery = (LaborPartnerSettlementModel as any).findOne({ _id: sourceId, ...scopeQuery(scope), status: { $in: ["approved", "partially_paid", "paid"] } });
      if (session) sourceQuery.session(session);
      const source = await sourceQuery;
      if (!source) throw new LaborPartnerError("SETTLEMENT_NOT_EDITABLE", "Chỉ được tạo điều chỉnh từ kỳ đã duyệt.", 409);
      const [settlement] = await (LaborPartnerSettlementModel as any).create([{ companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), partnerId: source.partnerId, sourceSettlementId: source._id, settlementKey, revision: 1, periodStart: monthStart, periodEnd: monthEnd, cutoffAt: new Date(), status: "calculated", officialAmount: 0, seasonalMinutes: 0, seasonalAmount: 0, adjustmentAmount: amount, totalAmount: amount, paidAmount: 0, balanceAmount: amount, policySnapshots: [{ sourceSettlementId: String(source._id), reason }], warnings: [], calculatedBy: actorSnapshot(actor), calculatedAt: new Date(), version: 1 }], options as any);
      await (LaborPartnerCommissionLineModel as any).insertMany([{ settlementId: settlement._id, partnerId: source.partnerId, lineKey: `adjustment:${source._id}:${idempotencyKey}`, scheme: "adjustment", status: "draft", amount, policySnapshot: { sourceSettlementId: String(source._id), reason }, explanation: reason }], options as any);
      result = { settlement, replay: false };
    });
    return result;
  },
  async void(scope: LaborPartnerScope, settlementId: string, expectedVersion: unknown, reason: unknown, actor?: Record<string, unknown>) {
    const id = requiredObjectId(settlementId); const version = Number(expectedVersion);
    if (!Number.isInteger(version) || version < 1) throw new LaborPartnerError("SETTLEMENT_STALE_VERSION", "Thiếu phiên bản đối soát để hủy.", 409);
    let settlement: any;
    await runInTransaction(async (session) => {
      const query = (LaborPartnerSettlementModel as any).findOneAndUpdate({ _id: id, ...scopeQuery(scope), status: { $in: ["draft", "calculated"] }, paidAmount: 0, version }, { $set: { status: "void", balanceAmount: 0, voidReason: String(reason || "").trim(), approvedBy: actorSnapshot(actor), approvedAt: new Date() }, $inc: { version: 1 } }, { returnDocument: 'after' });
      if (session) query.session(session);
      settlement = await query;
      if (!settlement) throw new LaborPartnerError("SETTLEMENT_NOT_EDITABLE", "Chỉ có thể hủy kỳ chưa duyệt, chưa có chi trả và chưa bị thay đổi.", 409);
      const linesQuery = (LaborPartnerCommissionLineModel as any).updateMany({ settlementId: id, status: "draft" }, { $set: { status: "void" } });
      if (session) linesQuery.session(session);
      await linesQuery;
    });
    return settlement;
  },
  async approve(scope: LaborPartnerScope, settlementId: string, expectedVersion: unknown, actor?: Record<string, unknown>) {
    const id = requiredObjectId(settlementId);
    const version = Number(expectedVersion);
    if (!Number.isInteger(version) || version < 1) throw new LaborPartnerError("SETTLEMENT_STALE_VERSION", "Thiếu phiên bản đối soát để duyệt.", 409);
    let settlement: any;
    await runInTransaction(async (session) => {
      const query = (LaborPartnerSettlementModel as any).findOneAndUpdate({ _id: id, ...scopeQuery(scope), status: "calculated", version }, { $set: { status: "approved", approvedBy: actorSnapshot(actor), approvedAt: new Date() }, $inc: { version: 1 } }, { returnDocument: 'after' });
      if (session) query.session(session);
      settlement = await query;
      if (!settlement) throw new LaborPartnerError("SETTLEMENT_STALE_VERSION", "Kỳ đối soát đã thay đổi hoặc chưa sẵn sàng duyệt. Vui lòng tải lại.", 409);
      const linesQuery = (LaborPartnerCommissionLineModel as any).updateMany({ settlementId: id, status: "draft" }, { $set: { status: "approved" } });
      if (session) linesQuery.session(session);
      await linesQuery;
    });
    return settlement;
  },
  async payout(scope: LaborPartnerScope, settlementId: string, input: Record<string, unknown>, actor?: Record<string, unknown>) {
    const id = requiredObjectId(settlementId);
    const amount = normalizeVnd(input.amount, "Số tiền chi trả", false);
    const idempotencyKey = String(input.idempotencyKey || "").trim();
    if (!idempotencyKey) throw new LaborPartnerError("PAYOUT_IDEMPOTENCY_CONFLICT", "Mã chống trùng thanh toán là bắt buộc.");
    const method = String(input.method || "");
    if (method !== "cash" && method !== "bank_transfer") throw new LaborPartnerError("INVALID_PAYOUT_METHOD", "Phương thức chi trả không hợp lệ.");
    let result: any;
    await runInTransaction(async (session) => {
      const options = session ? { session, ordered: true } : undefined;
      const replayQuery = (LaborPartnerPayoutModel as any).findOne({ companyCode: scope.companyCode, idempotencyKey });
      if (session) replayQuery.session(session);
      const replay = await replayQuery;
      if (replay) {
        if (String(replay.settlementId) !== String(id) || Number(replay.amount) !== amount) throw new LaborPartnerError("PAYOUT_IDEMPOTENCY_CONFLICT", "Mã chống trùng đã được dùng cho thanh toán khác.", 409);
        result = { payout: replay, replay: true };
        return;
      }
      const settlementQuery = (LaborPartnerSettlementModel as any).findOne({ _id: id, ...scopeQuery(scope), status: { $in: ["approved", "partially_paid"] } });
      if (session) settlementQuery.session(session);
      const settlement = await settlementQuery;
      if (!settlement) throw new LaborPartnerError("SETTLEMENT_NOT_EDITABLE", "Kỳ đối soát chưa được duyệt hoặc không thể chi trả.", 409);
      if (amount > Number(settlement.balanceAmount)) throw new LaborPartnerError("PAYOUT_EXCEEDS_BALANCE", "Số tiền chi trả vượt quá số dư phải trả.", 409);
      const [payout] = await (LaborPartnerPayoutModel as any).create([{ companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), partnerId: settlement.partnerId, settlementId: settlement._id, amount, paidAt: new Date(), method, reference: String(input.reference || "").trim(), note: String(input.note || "").trim(), idempotencyKey, createdBy: actorSnapshot(actor) }], options as any);
      settlement.paidAmount += amount;
      settlement.balanceAmount -= amount;
      settlement.status = settlement.balanceAmount === 0 ? "paid" : "partially_paid";
      settlement.version += 1;
      if (session) await settlement.save({ session }); else await settlement.save();
      result = { payout, settlement, replay: false };
    });
    return result;
  },
  async reversePayout(scope: LaborPartnerScope, payoutId: string, actor?: Record<string, unknown>) {
    const id = requiredObjectId(payoutId);
    let result: any;
    await runInTransaction(async (session) => {
      const options = session ? { session, ordered: true } : undefined;
      const payoutQuery = (LaborPartnerPayoutModel as any).findOne({ _id: id, ...scopeQuery(scope) });
      if (session) payoutQuery.session(session);
      const payout = await payoutQuery;
      if (!payout) throw new LaborPartnerError("CROSS_SCOPE_RESOURCE_NOT_FOUND", "Không tìm thấy giao dịch chi trả.", 404);
      const existingQuery = (LaborPartnerPayoutModel as any).exists({ reversalOfPayoutId: payout._id });
      if (session) existingQuery.session(session);
      const existing = await existingQuery;
      if (existing) throw new LaborPartnerError("PAYOUT_ALREADY_REVERSED", "Giao dịch này đã được đảo.", 409);
      const settlementQuery = (LaborPartnerSettlementModel as any).findOne({ _id: payout.settlementId, ...scopeQuery(scope) });
      if (session) settlementQuery.session(session);
      const settlement = await settlementQuery;
      if (!settlement) throw new LaborPartnerError("CROSS_SCOPE_RESOURCE_NOT_FOUND", "Không tìm thấy kỳ đối soát của giao dịch.", 404);
      const [reversal] = await (LaborPartnerPayoutModel as any).create([{ companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), partnerId: payout.partnerId, settlementId: payout.settlementId, amount: -Math.abs(Number(payout.amount)), paidAt: new Date(), method: payout.method, reference: `REV:${payout.reference || payout._id}`, note: `Đảo giao dịch ${payout._id}`, idempotencyKey: `reversal:${payout._id}`, createdBy: actorSnapshot(actor), reversalOfPayoutId: payout._id }], options as any);
      settlement.paidAmount -= Math.abs(Number(payout.amount));
      settlement.balanceAmount += Math.abs(Number(payout.amount));
      settlement.status = "partially_paid";
      settlement.version += 1;
      if (session) await settlement.save({ session }); else await settlement.save();
      result = { reversal, settlement };
    });
    return result;
  },
};
