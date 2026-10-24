import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { financeTreasuryService as service } from "./finance-treasury.service";
import { FinanceCashAccountModel as Account, FinanceCashVoucherModel as Voucher } from "../models/finance-treasury.model";
import { FinanceDebtModel } from "../models/financial-reporting.model";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { confirmReceipt } from "../../inventory/receiving/receiving.service";
import { financialReportingService } from "./financial-reporting.service";
const scope = { companyCode: "TREASURY", branchId: "B1" }, day = "2026-01-10";
const account = (name = "Cash", balance = 1000, kind = "cash") => service.createAccount(scope, { name, kind, openingOn: "2026-01-01", openingBalance: balance }, "maker");
const voucher = (accountId: any, extra: any = {}) => service.createVoucher(scope, { key: crypto.randomUUID(), kind: "payment", amount: 300, occurredOn: day, description: "Test", accountId: String(accountId), ...extra }, "maker");
const approve = (v: any) => service.decide(scope, String(v._id), { action: "approve", version: 0 }, "approver");
describe("Treasury: atomic posting and reconciliation", () => {
  let db: MongoMemoryReplSet;
  beforeAll(async () => { db = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(db.getUri()); await Promise.all(Object.values(mongoose.models).map(m => m.init())); }, 120000);
  afterAll(async () => { await mongoose.disconnect(); await db?.stop(); });
  beforeEach(async () => { await Promise.all(Object.values(mongoose.models).map(m => m.deleteMany({}))); });
  it("posts once under concurrent approval and isolates branch/account access", async () => {
    const a = await account(), v = await voucher(a._id);
    expect((await Account.findById(a._id))!.balance).toBe(1000);
    await expect(service.decide({ ...scope, branchId: "OTHER" }, String(v._id), { action: "approve", version: 0 }, "actor")).rejects.toThrow();
    await Promise.all([approve(v), approve(v)]);
    expect((await Account.findById(a._id))!.balance).toBe(700);
    await expect(service.createVoucher({ ...scope, branchId: "OTHER" }, { key: "x", accountId: String(a._id), kind: "receipt", amount: 1, description: "x", occurredOn: day }, "actor")).rejects.toThrow();
  });
  it("transfers atomically and refuses overdraft without affecting either account", async () => {
    const a = await account(), b = await account("Bank", 0, "bank");
    const v = await voucher(a._id, { kind: "transfer", destinationAccountId: String(b._id), amount: 600 }); await approve(v);
    expect((await Account.findById(a._id))!.balance).toBe(400); expect((await Account.findById(b._id))!.balance).toBe(600);
    const excess = await voucher(a._id, { kind: "transfer", destinationAccountId: String(b._id), amount: 500 }); await expect(approve(excess)).rejects.toThrow();
    expect((await Account.findById(b._id))!.balance).toBe(600); expect((await Voucher.findById(excess._id))!.status).toBe("pending");
  });
  it("settles debt and cash once, with no duplicate unassigned source", async () => {
    const a = await account();
    const debt = await FinanceDebtModel.create({ ...scope, direction: "payable", partyKind: "supplier", partyName: "NCC", reference: "PN1", amount: 500, balance: 500, occurredOn: day, dueOn: day });
    const v = await voucher(a._id, { debtId: String(debt._id), amount: 400 }); await approve(v); await approve(v);
    expect((await FinanceDebtModel.findById(debt._id))!.balance).toBe(100);
    expect((await service.overview(scope)).unassigned).toHaveLength(0);
    const double = await voucher(a._id, { debtId: String(debt._id), amount: 100 });
    await financialReportingService.payDebt(scope, String(debt._id), { amount: 100, version: 1, key: "external" }, "actor");
    await expect(approve(double)).rejects.toThrow(); expect((await Account.findById(a._id))!.balance).toBe(600);
  });
  it("imports existing debt cash without paying the debt again; retry keys cannot change amounts", async () => {
    const a = await account(); const debt = await FinanceDebtModel.create({ ...scope, direction: "receivable", partyKind: "customer", partyName: "A", reference: "D1", amount: 100, balance: 0, occurredOn: day, dueOn: day, payments: [{ key: "paid", amount: 100, at: new Date(day) }] });
    const sourceKey = `debt:${debt._id}:paid`, v = await voucher(a._id, { sourceKey }); await approve(v);
    expect((await Account.findById(a._id))!.balance).toBe(1100); expect((await FinanceDebtModel.findById(debt._id))!.balance).toBe(0);
    await expect(voucher(a._id, { sourceKey })).rejects.toThrow();
    const pending = await voucher(a._id, { key: "retry", amount: 10 });
    await expect(voucher(a._id, { key: "retry", amount: 11 })).rejects.toThrow();
    expect(String((await voucher(a._id, { key: "retry", amount: 10 }))._id)).toBe(String(pending._id));
  });
  it("keeps reconciliation differences as evidence and refuses stale balances", async () => {
    const a = await account(); const input = { key: "count", accountId: String(a._id), version: 0, actual: 950, note: "Cash count" };
    await expect(service.reconcile(scope, { ...input, version: { $gte: 0 } }, "actor")).rejects.toThrow();
    const r = await service.reconcile(scope, input, "actor"); expect(r.difference).toBe(-50); expect((await Account.findById(a._id))!.balance).toBe(1000);
    await approve(await voucher(a._id));
    await expect(service.reconcile(scope, { ...input, key: "stale" }, "actor")).rejects.toThrow();
  });
  it("matches a bank line only to the same account and amount, once per account/voucher", async () => {
    const a = await account("Bank", 1000, "bank"), v = await voucher(a._id); await approve(v);
    const l = await service.bankLine(scope, { accountId: String(a._id), bankKey: "BANK-1", amount: -300, occurredOn: day, description: "Statement" }, "actor");
    await service.matchBankLine(scope, String(l._id), { voucherId: String(v._id) }, "actor");
    expect((await service.matchBankLine(scope, String(l._id), { voucherId: String(v._id) }, "another-actor")).matchedBy).toBe("actor");
    const duplicate = await service.bankLine(scope, { accountId: String(a._id), bankKey: "BANK-2", amount: -300, occurredOn: day, description: "Statement" }, "actor");
    await expect(service.matchBankLine(scope, String(duplicate._id), { voucherId: String(v._id) }, "actor")).rejects.toThrow();
  });
  it("locks historical cash balances, requires reopen reason, preserves snapshots", async () => {
    const a = await account(), v = await voucher(a._id);
    await expect(service.period(scope, { month: "2026-01", action: "close", version: 0, reason: "Reviewed" }, "actor")).rejects.toThrow();
    await approve(v);
    const closed = await service.period(scope, { month: "2026-01", action: "close", version: 0, reason: "Reviewed" }, "actor"); expect(closed!.snapshot[0].balance).toBe(700);
    await expect(voucher(a._id)).rejects.toThrow(); await expect(account("Backdated", 1)).rejects.toThrow();
    await expect(service.period(scope, { month: "2026-01", action: "reopen", version: 1, reason: "" }, "actor")).rejects.toThrow();
    const reopened = await service.period(scope, { month: "2026-01", action: "reopen", version: 1, reason: "Correction" }, "actor"); expect(reopened!.history).toHaveLength(2);
    await approve(await voucher(a._id));
    const reclosed = await service.period(scope, { month: "2026-01", action: "close", version: 2, reason: "Reviewed again" }, "actor"); expect(reclosed!.history[0].snapshot[0].balance).toBe(700); expect(reclosed!.snapshot[0].balance).toBe(400);
  });
  it("rejects with an audit reason and releases the source for corrected assignment", async () => {
    const a = await account(), v = await voucher(a._id);
    await expect(service.decide(scope, String(v._id), { action: "reject", version: 0, reason: "" }, "actor")).rejects.toThrow();
    const rejected = await service.decide(scope, String(v._id), { action: "reject", version: 0, reason: "Wrong amount" }, "actor"); expect(rejected.status).toBe("rejected");
    await expect(approve(v)).rejects.toThrow(); expect((await Account.findById(a._id))!.balance).toBe(1000);
  });
  it("records supplier debt once when recovering an already confirmed receipt", async () => {
    const receipt = await GoodsReceiptModel.collection.insertOne({ ...scope, receiptCode: "AUTO-PN", supplierId: "SUP1", supplierName: "Supplier", status: "confirmed", subtotal: 1000, confirmedAt: new Date(day), financeTerms: { dueOn: day, paidAmount: 300, paymentMethod: "cash" } } as any);
    await confirmReceipt(scope, String(receipt.insertedId), { id: "actor" }); await confirmReceipt(scope, String(receipt.insertedId), { id: "actor" });
    const rows = await FinanceDebtModel.find(scope); expect(rows).toHaveLength(1); expect(rows[0].balance).toBe(700);
    const overview = await service.overview(scope); expect(overview.unassigned[0].amount).toBe(-300); expect(overview.unrecordedReceipts).toHaveLength(0);
  });
  it("separates uncertain inflows in the forecast and scopes source document access", async () => {
    await account();
    await FinanceDebtModel.create({ ...scope, direction: "receivable", partyKind: "customer", partyName: "A", reference: "DUE", amount: 300, balance: 300, occurredOn: day, dueOn: day });
    const report = await service.overview(scope, { days: 7 }); expect(report.forecast).toHaveLength(7); expect(report.forecast[0]).toMatchObject({ incoming: 300, projected: 1300, conservative: 1000 });
    await expect(financialReportingService.document({ ...scope, branchId: "OTHER" }, "retail", String(new mongoose.Types.ObjectId()))).rejects.toThrow();
  });
});
