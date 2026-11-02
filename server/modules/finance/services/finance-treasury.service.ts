import { Types } from "mongoose";
import type { FinanceBranchScope } from "../contracts";
import { FinanceCashAccountModel as Account, FinanceCashVoucherModel as Voucher, FinanceCashReconciliationModel as Reconciliation, FinanceBankLineModel as BankLine, FinanceClosedPeriodModel as Period } from "../models/finance-treasury.model";
import { FinanceDebtModel } from "../models/financial-reporting.model";
import { financeTransaction, assertCashPeriodOpen } from "./finance-posting.service";
import { financeCashSources } from "./finance-cash-sources.service";
import { financialReportingService } from "./financial-reporting.service";
import { financeToday, financeRange, validDay, moneyInput, invalid, DAY } from "./financial-calculations";
const required = (v: unknown) => { const s = String(v || "").trim(); if (!s || s.length > 500) throw invalid("Nội dung bắt buộc, tối đa 500 ký tự."); return s; };
const objectId = (v: unknown) => { if (!Types.ObjectId.isValid(String(v))) throw invalid("Mã chứng từ không hợp lệ."); return String(v); };
const occurred = (v: unknown) => { const day = validDay(v); if (day > financeToday()) throw invalid("Ngày ghi sổ không được trong tương lai."); return day; };
const conflict = () => invalid("Chứng từ đã thay đổi hoặc không tồn tại. Vui lòng tải lại.", 409);
export const financeTreasuryService = {
  async overview(scope: FinanceBranchScope, query: any = {}) {
    const days = Number(query.days || 30); if (![7, 14, 30].includes(days)) throw invalid("Chọn dự báo 7, 14 hoặc 30 ngày.");
    const [accounts, vouchers, sources, debts, reconciliations, bankLines, periods] = await Promise.all([
      Account.find(scope).sort({ name: 1 }).lean(), Voucher.find(scope).sort({ occurredOn: -1, createdAt: -1 }).lean(), financeCashSources(scope), financialReportingService.debts(scope), Reconciliation.find(scope).sort({ createdAt: -1 }).limit(100).lean(), BankLine.find(scope).sort({ occurredOn: -1 }).lean(), Period.find(scope).sort({ month: -1 }).lean(),
    ]);
    const recorded = new Set(vouchers.map(v => v.sourceKey));
    const unassigned = sources.filter(s => !recorded.has(s.key));
    const sourceChanges = vouchers.filter(v => v.status === "posted" && v.sourceKey && !sources.some(s => s.key === v.sourceKey && Math.abs(s.amount) === v.amount && s.occurredOn === v.occurredOn && (s.amount > 0 ? "receipt" : "payment") === v.kind)).map(v => ({ id: String(v._id), description: v.description, sourceKey: v.sourceKey }));
    const today = financeToday(), balance = accounts.reduce((s, a) => s + a.balance, 0);
    let projected = balance, conservative = balance;
    const forecast = Array.from({ length: days }, (_, i) => {
      const date = new Date(+new Date(today) + i * DAY).toISOString().slice(0, 10);
      const due = debts.items.filter(d => d.dueOn && (d.dueOn === date || (i === 0 && d.dueOn < today)));
      const incoming = due.filter(d => d.direction === "receivable").reduce((s, d) => s + d.balance, 0);
      const outgoing = due.filter(d => d.direction === "payable").reduce((s, d) => s + d.balance, 0);
      projected += incoming - outgoing; conservative -= outgoing;
      return { date, incoming, outgoing, projected, conservative, references: due.map(d => d.reference) };
    });
    return { accounts, vouchers, unassigned, sourceChanges, debts: debts.items, reconciliations, bankLines, periods, balance, forecast, unscheduledDebt: debts.items.filter(d => !d.dueOn), unrecordedReceipts: debts.unrecordedReceipts, forecastNote: "Dự báo theo hạn trả của công nợ đã ghi nhận; nợ quá hạn đưa vào hôm nay. Chưa gồm lương, thuê nhà, thuế và kế hoạch chưa lập công nợ. Thu dự kiến không phải tiền chắc chắn thu được. Phiếu chờ duyệt chưa tác động số dư." };
  },
  async createAccount(scope: FinanceBranchScope, input: any, actor: string) {
    if (!["cash", "bank"].includes(input.kind)) throw invalid("Loại quỹ không hợp lệ.");
    const openingOn = occurred(input.openingOn), openingBalance = moneyInput(input.openingBalance);
    return financeTransaction(scope, async session => { await assertCashPeriodOpen(scope, openingOn, session); return (await Account.create([{ ...scope, name: required(input.name), kind: input.kind, openingOn, openingBalance, balance: openingBalance, createdBy: actor }], { session }))[0]; });
  },
  async createVoucher(scope: FinanceBranchScope, input: any, actor: string) {
    const key = required(input.key);
    let kind = String(input.kind), amount = moneyInput(input.amount), occurredOn = occurred(input.occurredOn), description = required(input.description);
    let source: any;
    if (input.sourceKey) {
      source = (await financeCashSources(scope)).find(s => s.key === input.sourceKey);
      if (!source) throw invalid("Không tìm thấy giao dịch nguồn.");
      kind = source.amount > 0 ? "receipt" : "payment"; amount = Math.abs(source.amount); occurredOn = occurred(source.occurredOn); description = source.description;
    }
    if (!["receipt", "payment", "transfer"].includes(kind) || amount <= 0 || (source && input.debtId)) throw invalid("Phiếu thu/chi không hợp lệ.");
    const accountId = objectId(input.accountId), destinationAccountId = kind === "transfer" ? objectId(input.destinationAccountId) : undefined;
    if (accountId === destinationAccountId) throw invalid("Hai quỹ chuyển tiền phải khác nhau.");
    const debtId = input.debtId ? objectId(input.debtId) : undefined;
    const values = { kind: kind as "receipt" | "payment" | "transfer", amount, occurredOn, description, accountId, destinationAccountId, debtId, reference: String(input.reference || "").slice(0, 240), sourceKey: source?.key || (debtId ? `debt:${debtId}:${key}` : undefined), sourceType: source?.sourceType || (debtId ? "debt" : undefined), sourceId: source?.sourceId || debtId };
    return financeTransaction(scope, async session => {
      const existing = await Voucher.findOne({ ...scope, key }).session(session);
      if (existing) {
        // Repair linkage is added after posting; preserve replay of the original manual voucher.
        const linkedRepair = existing.status === "posted" && existing.sourceType === "repair-refund" && !input.sourceKey && !input.debtId;
        if (Object.entries(values).some(([k, v]) => !(linkedRepair && ["sourceKey", "sourceType", "sourceId"].includes(k)) && (existing as any)[k] !== v)) throw conflict();
        return existing;
      }
      await assertCashPeriodOpen(scope, occurredOn, session);
      for (const id of [accountId, destinationAccountId].filter(Boolean)) { const a = await Account.findOne({ ...scope, _id: id }).session(session); if (!a || a.openingOn > occurredOn) throw invalid("Quỹ không tồn tại hoặc giao dịch trước ngày số dư đầu kỳ."); }
      if (debtId) { const debt = await FinanceDebtModel.findOne({ ...scope, _id: debtId }).session(session); if (!debt || debt.balance < amount || occurredOn < debt.occurredOn || kind !== (debt.direction === "payable" ? "payment" : "receipt")) throw invalid("Công nợ không phù hợp hoặc số tiền vượt dư nợ."); }
      return (await Voucher.create([{ ...scope, key, ...values, createdBy: actor }], { session }))[0];
    });
  },
  async decide(scope: FinanceBranchScope, id: string, input: any, actor: string) {
    if (!["approve", "reject"].includes(input.action) || !Number.isSafeInteger(input.version)) throw invalid("Thao tác không hợp lệ.");
    return financeTransaction(scope, async session => {
      const v = await Voucher.findOne({ ...scope, _id: objectId(id) }).session(session);
      if (!v) throw conflict();
      if (v.status === (input.action === "approve" ? "posted" : "rejected")) return v;
      if (v.status !== "pending" || v.version !== input.version) throw conflict();
      await assertCashPeriodOpen(scope, v.occurredOn, session);
      if (input.action === "reject") { v.status = "rejected"; v.rejectionReason = required(input.reason); v.sourceKey = undefined; }
      else {
        if (v.sourceKey && !v.debtId) { const original = (await financeCashSources(scope)).find(s => s.key === v.sourceKey); if (!original || Math.abs(original.amount) !== v.amount || original.occurredOn !== v.occurredOn || (original.amount > 0 ? "receipt" : "payment") !== v.kind) throw invalid("Giao dịch nguồn đã thay đổi. Hãy từ chối và lập lại phiếu.", 409); }
        const account = await Account.findOne({ ...scope, _id: v.accountId }).session(session); if (!account) throw conflict();
        const delta = v.kind === "receipt" ? v.amount : -v.amount;
        if (!Number.isSafeInteger(account.balance + delta) || account.balance + delta < 0) throw invalid("Quỹ không đủ tiền hoặc số dư vượt giới hạn.");
        account.balance += delta; account.version++; await account.save({ session });
        if (v.kind === "transfer") { const dest = await Account.findOne({ ...scope, _id: v.destinationAccountId }).session(session); if (!dest || !Number.isSafeInteger(dest.balance + v.amount)) throw conflict(); dest.balance += v.amount; dest.version++; await dest.save({ session }); }
        if (v.debtId) {
          const debt = await FinanceDebtModel.findOneAndUpdate({ ...scope, _id: v.debtId, balance: { $gte: v.amount }, "payments.key": { $ne: v.key } }, { $inc: { balance: -v.amount, version: 1 }, $push: { payments: { key: v.key, amount: v.amount, at: new Date(`${v.occurredOn}T12:00:00+07:00`), reference: v.reference, actorId: actor } } }, { session, returnDocument: "after" });
          if (!debt) throw invalid("Công nợ đã được thanh toán hoặc số tiền vượt dư nợ.", 409);
        }
        v.status = "posted";
      }
      v.approvedBy = actor; v.approvedAt = new Date(); v.version++; await v.save({ session }); return v;
    });
  },
  async reconcile(scope: FinanceBranchScope, input: any, actor: string) {
    if (!Number.isSafeInteger(input.version) || input.version < 0) throw conflict();
    const actual = moneyInput(input.actual), key = required(input.key), note = required(input.note), accountId = objectId(input.accountId);
    return financeTransaction(scope, async session => {
      const previous = await Reconciliation.findOne({ ...scope, key }).session(session); if (previous) { if (previous.actual !== actual || previous.accountId !== accountId || previous.note !== note) throw conflict(); return previous; }
      const account = await Account.findOne({ ...scope, _id: accountId, version: input.version }).session(session); if (!account) throw conflict();
      return (await Reconciliation.create([{ ...scope, key, accountId, actual, expected: account.balance, difference: actual - account.balance, note, accountVersion: account.version, createdBy: actor }], { session }))[0];
    });
  },
  async bankLine(scope: FinanceBranchScope, input: any, actor: string) {
    const accountId = objectId(input.accountId), amount = moneyInput(input.amount, true), bankKey = required(input.bankKey), occurredOn = occurred(input.occurredOn);
    if (!amount || !await Account.exists({ ...scope, _id: accountId, kind: "bank" })) throw invalid("Giao dịch ngân hàng không hợp lệ.");
    const existing = await BankLine.findOne({ ...scope, accountId, bankKey });
    if (existing) { if (existing.amount !== amount || existing.occurredOn !== occurredOn) throw conflict(); return existing; }
    return BankLine.create({ ...scope, accountId, bankKey, amount, occurredOn, description: required(input.description), createdBy: actor });
  },
  async matchBankLine(scope: FinanceBranchScope, id: string, input: any, actor: string) {
    return financeTransaction(scope, async session => {
      const line = await BankLine.findOne({ ...scope, _id: objectId(id) }).session(session);
      const v = await Voucher.findOne({ ...scope, _id: objectId(input.voucherId), status: "posted" }).session(session);
      if (!line || !v || (line.voucherId && line.voucherId !== String(v._id))) throw conflict();
      if (line.voucherId === String(v._id)) return line;
      const amount = v.accountId === line.accountId ? (v.kind === "receipt" ? v.amount : -v.amount) : v.kind === "transfer" && v.destinationAccountId === line.accountId ? v.amount : null;
      if (amount !== line.amount) throw invalid("Số tiền hoặc tài khoản không khớp chứng từ.");
      line.voucherId = String(v._id); line.matchedBy = actor; line.matchedAt = new Date(); await line.save({ session }); return line;
    });
  },
  async period(scope: FinanceBranchScope, input: any, actor: string) {
    const month = String(input.month); if (!/^\d{4}-\d{2}$/.test(month)) throw invalid("Tháng không hợp lệ.");
    financeRange({ period: month }); if (month > financeToday().slice(0, 7)) throw invalid("Không chốt tháng tương lai."); const reason = required(input.reason);
    if (!["close", "reopen"].includes(input.action) || !Number.isSafeInteger(input.version)) throw invalid("Thao tác kỳ không hợp lệ.");
    return financeTransaction(scope, async session => {
      const previous = await Period.findOne({ ...scope, month }).session(session);
      if ((previous?.version || 0) !== input.version) throw conflict();
      if (input.action === "close" && previous?.status === "closed" || input.action === "reopen" && previous?.status !== "closed") throw conflict();
      if (input.action === "close" && await Voucher.exists({ ...scope, status: "pending", occurredOn: { $lte: financeRange({ period: month }).to } }).session(session)) throw invalid("Còn phiếu chờ duyệt trong kỳ.");
      const accounts = await Account.find(scope).session(session).lean();
      const posted = await Voucher.find({ ...scope, status: "posted", occurredOn: { $lte: financeRange({ period: month }).to } }).session(session).lean();
      const snapshot = input.action === "close" ? accounts.filter(a => a.openingOn <= financeRange({ period: month }).to).map(a => ({ accountId: String(a._id), name: a.name, balance: a.openingBalance + posted.reduce((s, v) => s + (v.accountId === String(a._id) ? (v.kind === "receipt" ? v.amount : -v.amount) : v.destinationAccountId === String(a._id) ? v.amount : 0), 0) })) : previous?.snapshot;
      return Period.findOneAndUpdate({ ...scope, month }, { $set: { status: input.action === "close" ? "closed" : "open", snapshot, closedAt: input.action === "close" ? new Date() : previous?.closedAt, closedBy: input.action === "close" ? actor : previous?.closedBy }, $inc: { version: 1 }, $push: { history: { action: input.action, reason, by: actor, at: new Date(), snapshot } } }, { session, upsert: true, returnDocument: "after" });
    });
  },
};
