import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { financialReportingService as service } from "./financial-reporting.service";
import { FinanceDebtModel, FinanceVatInvoiceModel, FinanceVatPeriodModel, FinanceMonthlyPlanModel } from "../models/financial-reporting.model";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { RetailOrderModel } from "../../retail/models/retail-order.model";
import { RetailPartnerModel as PartnerModel } from "../../retail/models/retail-partner.model";
import { ReceivableModel } from "../models/receivable.model";
import { financeToday } from "./financial-calculations";
import { PayrollRunModel } from "../../../model/payroll-run.model";
import { OperatingExpenseModel } from "../../../model/operating-expense.model";
import { RetailCommissionLedgerModel, RetailCommissionPayoutModel } from "../../retail/models/retail-commission.model";
import { financeCashSources } from "./finance-cash-sources.service";
import { runTradeDebtAlerts } from "./trade-debt-alerts.service";
import { NotificationModel } from "../../../model/notification.model";
import { BranchModel } from "../../../model/branch.model";
import { UserModel } from "../../../model/user.model";
import { financialReportingRoutes } from "../routes/financial-reporting.routes";
import express from "express";
import { createServer } from "node:http";
vi.mock("../../../middleware/require-module", () => ({ getEnabledModulesForCompany: vi.fn(async () => ["finance"]) }));
const scope = { companyCode: "FIN_TEST", branchId: "B1" };
const debtInput = { direction: "payable", partyKind: "supplier", partyName: "NCC A", reference: "NCC-01", amount: 18000000, occurredOn: "2026-09-01", dueOn: "2026-09-25" };
const invoiceInput = { direction: "input", invoiceNumber: "001", series: "1C26", partyName: "NCC", taxId: "0123456789", issuedOn: "2026-09-01", taxableAmount: 18000000, vatAmount: 1800000, deductibleVat: 1500000 };
describe("financial reporting persistence", () => {
  let db: MongoMemoryServer;
  beforeAll(async () => { db = await MongoMemoryServer.create(); await mongoose.connect(db.getUri()); await Promise.all([FinanceDebtModel.init(), FinanceVatInvoiceModel.init(), FinanceVatPeriodModel.init(), FinanceMonthlyPlanModel.init(), NotificationModel.init(), OperatingExpenseModel.init()]); }, 120000);
  afterAll(async () => { await mongoose.disconnect(); await db?.stop(); });
  beforeEach(async () => { await Promise.all(Object.values(mongoose.models).map(model => model.deleteMany({}))); });
  it("isolates companies and branches; verifies and deduplicates supplier receipt references", async () => {
    const receiptId = new mongoose.Types.ObjectId();
    await GoodsReceiptModel.collection.insertOne({ _id: receiptId, ...scope, receiptCode: "PN1", supplierId: "s1", supplierName: "Supplier", status: "confirmed", subtotal: 18000000 } as any);
    await expect(service.createDebt({ ...scope, branchId: "B2" }, { ...debtInput, sourceReceiptId: String(receiptId) }, "actor")).rejects.toThrow();
    await expect(service.createDebt(scope, { ...debtInput, amount: 18000001, sourceReceiptId: String(receiptId) }, "actor")).rejects.toThrow();
    await service.createDebt(scope, { ...debtInput, amount: 0, sourceReceiptId: String(receiptId) }, "actor");
    expect((await service.debts(scope)).unrecordedReceipts).toHaveLength(0);
    expect((await service.debts(scope)).totals.payable).toBe(0);
    await expect(service.createDebt(scope, { ...debtInput, sourceReceiptId: String(receiptId) }, "actor")).rejects.toMatchObject({ code: 11000 });
    expect((await service.debts({ ...scope, companyCode: "OTHER" })).items).toHaveLength(0);
  });
  it("serializes competing payments and replays identical transaction keys without subtracting twice", async () => {
    const debt = await service.createDebt(scope, debtInput, "actor");
    const values = await Promise.allSettled([service.payDebt(scope, String(debt._id), { amount: 10000000, key: "a", version: 0 }, "actor"), service.payDebt(scope, String(debt._id), { amount: 10000000, key: "b", version: 0 }, "actor")]);
    expect(values.filter(v => v.status === "fulfilled")).toHaveLength(1);
    const saved = (await FinanceDebtModel.findById(debt._id))!;
    expect(saved.balance).toBe(8000000);
    await service.payDebt(scope, String(debt._id), { amount: 10000000, key: saved.payments[0].key, version: 0 }, "actor");
    expect((await FinanceDebtModel.findById(debt._id))?.balance).toBe(8000000);
    await expect(service.payDebt({ ...scope, branchId: "B2" }, String(debt._id), { amount: 1, key: "x", version: 1 }, "actor")).rejects.toThrow();
    await expect(service.payDebt(scope, String(debt._id), { amount: 8000001, key: "c", version: 1 }, "actor")).rejects.toThrow();
  });
  it("classifies linked dealer receivables without counting their retail order twice", async () => {
    const orderId = new mongoose.Types.ObjectId();
    await PartnerModel.create({ companyCode: scope.companyCode, code: "DL1", name: "Đại lý", roles: ["dealer"], customerId: "c1", createdBy: "actor", updatedBy: "actor" });
    await RetailOrderModel.collection.insertOne({ _id: orderId, ...scope, orderCode: "DH1", status: "confirmed", customerId: "c1", dueAmount: 100, dueDate: new Date("2026-09-01"), items: [] } as any);
    await ReceivableModel.collection.insertOne({ ...scope, customerId: "c1", customerName: "Đại lý", sourceType: "retail_order", sourceId: String(orderId), balance: 100, originalAmount: 100, status: "open", dueDate: new Date("2026-09-01") } as any);
    const report = await service.debts(scope);
    expect(report.items).toHaveLength(1); expect(report.items[0].partyKind).toBe("dealer"); expect(report.totals.receivable).toBe(100);
  });
  it("warns supplier debt on the exact 3/5 day boundaries and excludes settled debts", async () => {
    const date = financeToday(), due = new Date(+new Date(date) + 4 * 86400000).toISOString().slice(0, 10);
    await service.createDebt(scope, { ...debtInput, occurredOn: date, dueOn: due }, "actor");
    expect((await service.debts(scope, { warningDays: 3 })).items[0].alert).toBe(false);
    expect((await service.debts(scope, { warningDays: 5 })).items[0].alert).toBe(true);
  });
  it("uses month/quarter VAT registers, scoped opening credit and signed corrections", async () => {
    const original = await service.createInvoice(scope, invoiceInput, "actor");
    await service.createInvoice(scope, { ...invoiceInput, direction: "output", invoiceNumber: "002", vatAmount: 2000000 }, "actor");
    await service.createInvoice(scope, { ...invoiceInput, invoiceNumber: "003", issuedOn: "2026-10-01" }, "actor");
    await service.saveVatPeriod(scope, { period: "2026-09", openingCredit: 200000, version: 0 }, "actor");
    expect((await service.vat(scope, { period: "2026-09" })).totals.payable).toBe(300000);
    await service.createInvoice(scope, { ...invoiceInput, invoiceNumber: "004", adjustmentOf: String(original._id), taxableAmount: -1000000, vatAmount: -100000, deductibleVat: -100000 }, "actor");
    const report = await service.vat(scope, { period: "2026-09" });
    expect(report.items).toHaveLength(3); expect(report.totals.payable).toBe(400000);
    expect((await service.vat(scope, { period: "2026-Q3" })).totals.payable).toBe(600000);
    expect((await service.vat({ ...scope, branchId: "B2" }, { period: "2026-09" })).items).toHaveLength(0);
    await expect(service.createInvoice(scope, { ...invoiceInput, invoiceNumber: "005", deductibleVat: 2000000 }, "actor")).rejects.toThrow();
    await expect(service.createInvoice(scope, invoiceInput, "actor")).rejects.toMatchObject({ code: 11000 });
    await expect(service.saveVatPeriod(scope, { period: "2026-09", openingCredit: 0, version: 0 }, "actor")).rejects.toThrow();
  });
  it("preserves sold-loss accounting with expenses and does not apply break-even budgets to P&L", async () => {
    await RetailOrderModel.collection.insertOne({ ...scope, orderCode: "LOSS1", status: "completed", confirmedAt: new Date("2026-09-02T05:00:00Z"), grandTotal: 16500000, taxAmount: 0, totalCost: 18000000, items: [{ sku: "PHONE", quantity: 1, unitCost: 18000000, lineTotal: 16500000, trackingMode: "serial" }] } as any);
    await service.createExpense(scope, { key: "expense-1", category: "rent", amount: 10000000, description: "Tiền thuê", incurredOn: "2026-09-03" }, "actor");
    await service.savePlan(scope, { month: "2026-09", rent: 20000000, payroll: 30000000, otherFixed: 0, expectedUnitPrice: 20000000, expectedUnitCost: 18000000, variableCostPerUnit: 0, version: 0 }, "actor");
    const report = await service.profit(scope, { period: "2026-09" });
    expect(report.totals).toMatchObject({ grossProfit: -1500000, rent: 10000000, netProfit: -11500000 });
    expect(report.lossSales).toHaveLength(1);
    expect((await service.breakeven(scope, "2026-09")).result.units).toBe(25);
    expect(await OperatingExpenseModel.countDocuments()).toBe(1);
  });
  it("uses retail commission postings for profit and payouts only for cash flow", async () => {
    await RetailCommissionLedgerModel.create([
      { ...scope, partnerId: "CTV1", sourceKey: "order:1", sourceType: "order", sourceId: "order-1", sourceCode: "DH-1", businessDate: "2026-09-02", sku: "PHONE", amount: 300000, baseAmount: 10000000, ratePercent: 3 },
      { ...scope, partnerId: "CTV1", sourceKey: "return:1", sourceType: "return", sourceId: "return-1", sourceCode: "TH-1", businessDate: "2026-09-03", sku: "PHONE", amount: -100000, baseAmount: 10000000, ratePercent: 1 },
    ]);
    await RetailCommissionPayoutModel.create({ ...scope, partnerId: "CTV1", amount: 150000, account: "bank", idempotencyKey: "payout-1", reference: "CK-1", businessDate: "2026-09-04", createdBy: "actor" });
    const profit = await service.profit(scope, { period: "2026-09" });
    expect(profit.totals.commission).toBe(200000);
    const cash = await financeCashSources(scope);
    expect(cash.filter((row) => row.sourceType === "commission")).toMatchObject([{ amount: -150000, method: "bank" }]);
  });
  it("creates idempotent in-app alerts for the correct branch and tenant", async () => {
    const branchId = new mongoose.Types.ObjectId(), userId = new mongoose.Types.ObjectId();
    const alertScope = { ...scope, branchId: String(branchId) };
    await BranchModel.collection.insertOne({ _id: branchId, companyCode: scope.companyCode, isActive: true } as any);
    await UserModel.collection.insertMany([{ _id: userId, email: "finance@example.test", ...alertScope, isActive: true, role: "user", permissions: ["finance-wallet:read"] }, { _id: new mongoose.Types.ObjectId(), email: "other@example.test", companyCode: "OTHER", branchId: String(branchId), role: "admin" }] as any);
    const date = financeToday();
    await service.createDebt(alertScope, { ...debtInput, occurredOn: date, dueOn: date }, "actor");
    await runTradeDebtAlerts(); await runTradeDebtAlerts();
    const notifications = await NotificationModel.find({}).lean();
    expect(notifications).toHaveLength(1); expect(notifications[0].recipientUid).toBe(String(userId));
    expect(notifications[0].action?.subTab).toBe("bao-cao-tai-chinh");
  });
  it("rejects writes from read-only users and scope overrides through the HTTP route", async () => {
    const userId = new mongoose.Types.ObjectId();
    await UserModel.collection.insertOne({ _id: userId, ...scope, role: "user", permissions: ["finance-wallet:read"] } as any);
    const app = express(); app.use(express.json()); app.use((req: any, _res, next) => { req.user = { ...scope, id: String(userId), role: "user" }; next(); });
    app.use("/", financialReportingRoutes);
    app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 500).json({ message: error.message }));
    const server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const url = "http://127.0.0.1:" + (server.address() as any).port;
    try {
      expect((await fetch(url + "/debts")).status).toBe(200);
      expect((await fetch(url + "/debts?branchId=B2")).status).toBe(403);
      expect((await fetch(url + "/debts?companyCode=OTHER")).status).toBe(403);
      expect((await fetch(url + "/debts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(debtInput) })).status).toBe(403);
      expect(await FinanceDebtModel.countDocuments()).toBe(0);
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
  it("retries a recorded expense without creating another financial charge", async () => {
    const input = { key: "same-expense", category: "rent", amount: 100, description: "Rent", incurredOn: "2026-09-01" };
    await service.createExpense(scope, input, "actor"); await service.createExpense(scope, input, "actor");
    expect(await OperatingExpenseModel.countDocuments()).toBe(1);
    await expect(service.createExpense(scope, { ...input, amount: 101 }, "actor")).rejects.toThrow();
  });

  it("accrues closed payroll from authoritative lines and allocates a partial month", async () => {
    await PayrollRunModel.collection.insertOne({ ...scope, periodKey: "2026-09", status: "closed", totals: { grossPay: 10000000, netPay: 10000000, deductions: 0 }, lines: [{ employeeId: "e1", calculation: { adjustedBase: 10000000, gross: 10000000, net: 10000000, commission: 0, overtime: 0, deductions: 0 } }] } as any);
    const report = await service.profit(scope, { from: "2026-09-01", to: "2026-09-15" });
    expect(report.totals.payroll).toBe(5000000);
    expect(report.totals.netProfit).toBe(-5000000);
  });
  it("does not convert unknown original cost into zero-cost profit", async () => {
    await RetailOrderModel.collection.insertOne({ ...scope, orderCode: "MISSING-COST", confirmedAt: new Date("2026-09-01"), grandTotal: 100, taxAmount: 0, items: [{ sku: "SKU1", quantity: 1, lineTotal: 100 }] } as any);
    const report = await service.profit(scope, { period: "2026-09" });
    expect(report.totals.revenue).toBe(0);
    expect(report.warnings.some(w => w.includes("MISSING-COST"))).toBe(true);
  });

});
