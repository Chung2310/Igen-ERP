import { FinanceDebtModel } from "../models/financial-reporting.model";
import { RetailInvoiceModel } from "../../retail/models/retail-invoice.model";
import { FinanceTaxModel } from "../models/management.model";
import { postDepreciationAtomic } from "./depreciation-posting";
import { FixedAssetModel } from "../models/fixed-asset.model";
import { AssetDepreciationModel } from "../models/asset-depreciation.model";
import { RetailOrderModel } from "../../retail/models/retail-order.model";
import { RetailAfterSaleModel } from "../../retail/models/retail-after-sale.model";
import { ReceivableModel } from "../models/receivable.model";
import { ReceivableEntryModel } from "../models/receivable-entry.model";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createVoucher, createPayable, saveFollowup, financeDebts, reportRange, financeReport, importInvoiceTax } from "./management.service";
import { FinancePayableModel, FinanceVoucherModel, FinanceFollowupModel } from "../models/management.model";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { validateManagement } from "../validations/management.validation";
import { agingBand, businessDay, breakEven, saleLines } from "./management-calculations";
const scope = { companyCode: "FINANCE_TEST", branchId: "A" };
let mongo: MongoMemoryReplSet;
beforeAll(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri()); await Promise.all([FinanceDebtModel.init(), FinancePayableModel.init(), FinanceVoucherModel.init(), FinanceFollowupModel.init(), FinanceTaxModel.init()]); }, 120000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async () => { await Promise.all([FinanceDebtModel.deleteMany({}), FinancePayableModel.deleteMany({}), FinanceVoucherModel.deleteMany({}), GoodsReceiptModel.deleteMany({}), FinanceFollowupModel.deleteMany({}), RetailOrderModel.deleteMany({}), RetailAfterSaleModel.deleteMany({}), ReceivableModel.deleteMany({}), ReceivableEntryModel.deleteMany({}), FixedAssetModel.deleteMany({}), AssetDepreciationModel.deleteMany({}), RetailInvoiceModel.deleteMany({}), FinanceTaxModel.deleteMany({})]); });
async function debt() { return FinancePayableModel.create({ ...scope, receiptId: new mongoose.Types.ObjectId().toString(), supplierId: "SUP", originalAmount: 1000, openingPaid: 0, paidAmount: 0, balance: 1000, dueDate: "2026-09-25" }); }
const voucher = (id: string, key: string, amount = 600) => ({ kind: "payment", category: "supplier", expenseClass: "none", amount, date: "2026-09-23", method: "cash", payableId: id, idempotencyKey: key });
describe("Finance management invariants", () => {
  it("updates payable and cash voucher together and replays an identical request once", async () => { const d = await debt(); const input = voucher(String(d._id), "retry-key-1"); await createVoucher(scope, input, { id: "U" }); await createVoucher(scope, input, { id: "U" }); expect(await FinanceVoucherModel.countDocuments()).toBe(1); expect((await FinancePayableModel.findById(d._id))?.balance).toBe(400); await expect(createVoucher(scope, { ...input, amount: 200 }, {})).rejects.toThrow(); });
  it("rejects overpayment without leaving a voucher", async () => { const d = await debt(); await expect(createVoucher(scope, voucher(String(d._id), "too-much", 1001), {})).rejects.toThrow(); expect(await FinanceVoucherModel.countDocuments()).toBe(0); expect((await FinancePayableModel.findById(d._id))?.balance).toBe(1000); });
  it("does not let simultaneous payments overspend the balance", async () => { const d = await debt(); const results = await Promise.allSettled([createVoucher(scope, voucher(String(d._id), "concurrent-A"), {}), createVoucher(scope, voucher(String(d._id), "concurrent-B"), {})]); expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1); expect((await FinancePayableModel.findById(d._id))?.balance).toBe(400); expect(await FinanceVoucherModel.countDocuments()).toBe(1); });
  it("rejects cross-branch payment and followup", async () => { const d = await debt(); const other = { ...scope, branchId: "B" }; await expect(createVoucher(other, voucher(String(d._id), "other-branch"), {})).rejects.toThrow(); await expect(saveFollowup(other, { targetType: "payable", targetId: String(d._id), status: "done" }, {})).rejects.toThrow(); expect((await financeDebts(other)).payables).toHaveLength(0); });
  it("only opens payables from confirmed receipts inside the scope and never edits the source", async () => { const r = await GoodsReceiptModel.create({ ...scope, warehouseId: "WH", receiptCode: "GR-1", supplierId: "SUP", supplierName: "Supplier", subtotal: 1200, status: "confirmed", createdBy: "U", items: [] }); await expect(createPayable({ ...scope, branchId: "B" }, { receiptId: String(r._id), openingPaid: 0, dueDate: "2026-09-25" }, {})).rejects.toThrow(); const before = JSON.stringify(await GoodsReceiptModel.findById(r._id).lean()); await createPayable(scope, { receiptId: String(r._id), openingPaid: 200, dueDate: "2026-09-25" }, {}); expect((await FinancePayableModel.findOne())?.balance).toBe(1000); expect((await FinancePayableModel.findOne())?.payableCode).toMatch(/^GN-\d{8}-[A-F0-9]{8}$/); expect((await FinancePayableModel.findOne())?.dueDate).toBe("2026-09-25"); await expect(createPayable(scope, { receiptId: String(r._id), openingPaid: 0, dueDate: "2026-10-01" }, {})).rejects.toThrow(); expect(JSON.stringify(await GoodsReceiptModel.findById(r._id).lean())).toBe(before); });
  it("validates integer VND, real calendar dates, and rejects additional scope fields", () => { expect(() => validateManagement("payable", { receiptId: "a".repeat(24), openingPaid: 0.5, dueDate: "2026-02-30" })).toThrow(); expect(() => validateManagement("payable", { receiptId: "a".repeat(24), openingPaid: 0, dueDate: "2026-09-23", companyCode: "OTHER" })).toThrow(); expect(() => reportRange({ from: "2026-09-24", to: "2026-09-23" })).toThrow(); });
  it("uses business dates and live aging boundaries", () => { expect(businessDay("2026-09-22T18:00:00Z")).toBe("2026-09-23"); for (const [day, expected] of [[23,"not_due"], [22,"1-7"], [16,"1-7"], [15,"8-15"], [8,"8-15"], [7,"16-30"]] as const) expect(agingBand(`2026-09-${String(day).padStart(2,"0")}`, "2026-09-23")).toBe(expected); });
  it("allocates order discounts without inventing revenue or hiding loss", () => { const lines = saleLines({ orderDiscount: 5, items: [{ lineTotal: 10, unitCost: 10, quantity: 1 }, { lineTotal: 20, unitCost: 15, quantity: 1 }] }); expect(lines.reduce((s,r) => s+r.revenue,0)).toBe(25); expect(lines[0].grossProfit).toBeLessThan(0); });
  it("does not pretend to reach break-even with no sales or negative contribution", () => { expect(breakEven(0, 0, 100, 0, 1, 7).requiredRevenue).toBeNull(); expect(breakEven(100, -10, 100, 0, 1, 7).requiredRevenue).toBeNull(); expect(breakEven(1000, 400, 1000, 100, 10, 10).requiredRevenue).toBe(3334); });
});

it("reconciles discounts, return cost, cash sources and branch isolation in the report", async () => {
  const orderId = new mongoose.Types.ObjectId();
  await RetailOrderModel.collection.insertMany([
    { ...scope, _id: orderId, status: "completed", businessDate: "2026-09-23", orderCode: "ORDER-1", orderDiscount: 100, taxAmount: 0, items: [{ productName: "Phone", quantity: 1, unitCost: 600, lineTotal: 1000 }], payments: [{ businessDate: "2026-09-23", amount: 1000, method: "cash" }] },
    { ...scope, branchId: "B", status: "completed", businessDate: "2026-09-23", orderDiscount: 0, items: [{ productName: "Other branch", quantity: 1, unitCost: 0, lineTotal: 999999 }] }
  ]);
  await RetailAfterSaleModel.collection.insertOne({ ...scope, type: "return", orderId: String(orderId), businessDate: "2026-09-23", items: [{ productName: "Returned accessory", quantity: 1, unitCost: 60, lineAmount: 100 }] });
  const receivableId = new mongoose.Types.ObjectId();
  await ReceivableModel.collection.insertOne({ ...scope, _id: receivableId, sourceType: "retail_order", customerName: "Customer", status: "settled", balance: 0 });
  await ReceivableEntryModel.collection.insertMany([
    { ...scope, receivableId: String(receivableId), type: "payment", amount: -1000, paymentMethod: "retail", idempotencyKey: "event:retail", createdAt: new Date("2026-09-23T04:00:00Z") },
    { ...scope, receivableId: String(receivableId), type: "payment", amount: -200, paymentMethod: "cash", idempotencyKey: "manual-collection", createdAt: new Date("2026-09-23T04:00:00Z") }
  ]);
  await createVoucher(scope, { kind: "payment", category: "rent", expenseClass: "fixed", amount: 100, date: "2026-09-23", method: "cash", idempotencyKey: "expense-report" }, {});
  const report = await financeReport(scope, { from: "2026-09-01", to: "2026-09-30" });
  expect(report.summary.revenue).toBe(800);
  expect(report.summary.cost).toBe(540);
  expect(report.summary.netProfit).toBe(160);
  expect(report.summary.cashIn).toBe(1200);
  expect(report.summary.cashOut).toBe(100);
  expect(report.lines.some(l => l.productName === "Other branch")).toBe(false);
  expect(await RetailOrderModel.countDocuments()).toBe(2);
});

it("posts depreciation atomically in order and includes booked depreciation without cash outflow", async () => {
  const a = await FixedAssetModel.create({ ...scope, assetCode: "A1", barcode: "A1", name: "Printer", group: "Equipment", originalCost: 1200, salvageValue: 0, usefulLifeMonths: 12, inServiceDate: new Date("2026-08-01"), method: "straight_line", status: "in_use", accumulatedDepreciation: 0, netBookValue: 1200 });
  await AssetDepreciationModel.create([{ ...scope, assetId: String(a._id), period: "2026-08", amount: 100, accumulatedAfter: 100, netBookValueAfter: 1100 }, { ...scope, assetId: String(a._id), period: "2026-09", amount: 100, accumulatedAfter: 200, netBookValueAfter: 1000 }]);
  await expect(postDepreciationAtomic(scope, "2026-09", {})).rejects.toThrow();
  expect((await FixedAssetModel.findById(a._id))?.accumulatedDepreciation).toBe(0);
  expect(await AssetDepreciationModel.countDocuments({ status: "posted" })).toBe(0);
  await postDepreciationAtomic(scope, "2026-08", {});
  await postDepreciationAtomic(scope, "2026-09", {});
  await expect(postDepreciationAtomic(scope, "2026-08", {})).rejects.toThrow();
  expect((await FixedAssetModel.findById(a._id))?.accumulatedDepreciation).toBe(200);
  const report = await financeReport(scope, { from: "2026-09-01", to: "2026-09-30" });
  expect(report.summary.expense).toBe(100);
  expect(report.summary.cashOut).toBe(0);
});

it("imports VAT once from a scoped issued invoice without changing the source", async () => {
  const invoiceId = new mongoose.Types.ObjectId();
  await RetailInvoiceModel.collection.insertOne({ ...scope, _id: invoiceId, invoiceNo: "INV-1", orderId: new mongoose.Types.ObjectId().toString(), status: "issued", snapshot: { businessDate: "2026-09-23", store: { taxCode: "TEST-TAX" }, customerName: "Customer", subtotal: 1000, orderDiscount: 0, taxRate: 10, taxAmount: 100 } });
  await expect(importInvoiceTax({ ...scope, branchId: "B" }, String(invoiceId), {})).rejects.toThrow();
  const before = JSON.stringify(await RetailInvoiceModel.findById(invoiceId).lean());
  await importInvoiceTax(scope, String(invoiceId), {});
  await expect(importInvoiceTax(scope, String(invoiceId), {})).rejects.toThrow();
  expect(await FinanceTaxModel.countDocuments()).toBe(1);
  expect(JSON.stringify(await RetailInvoiceModel.findById(invoiceId).lean())).toBe(before);
});

it("withholds combined profits and break-even if any sold line lacks cost", async () => {
  await RetailOrderModel.collection.insertOne({ ...scope, status: "completed", businessDate: "2026-09-23", orderDiscount: 0, items: [{ productName: "Known", quantity: 1, unitCost: 100, lineTotal: 200 }, { productName: "Missing", quantity: 1, unitCost: 0, lineTotal: 300 }] });
  const report = await financeReport(scope, { from: "2026-09-01", to: "2026-09-30" });
  expect(report.summary).toMatchObject({ revenue: 500, cost: null, grossProfit: null, netProfit: null, missingCostCount: 1 });
  expect(report.trends[0].cost).toBeNull();
  expect(report.breakeven.requiredRevenue).toBeNull();
  expect(report.lines.find(l => l.productName === "Known")?.grossProfit).toBe(100);
});

it("validates tax arithmetic including integer rounding",()=>{
 const tax={direction:"output",invoiceNumber:"T",taxId:"T",date:"2026-09-23",base:1000000,rate:10,vat:100000,deductible:false};
 expect(validateManagement("tax",tax).vat).toBe(100000);
 expect(()=>validateManagement("tax",{...tax,vat:900000})).toThrow();
});
it("reverses supplier payment atomically and rejects duplicate or cross-branch undo",async()=>{
 const {reverseVoucher}=await import("./management.service");
 const d=await debt(); const payment=await createVoucher(scope,voucher(String(d._id),"original-pay",600),{});
 const input={date:"2026-09-23",reason:"Wrong payment",idempotencyKey:"reverse-pay"};
 const reversed=await reverseVoucher(scope,String(payment._id),input,{});
 expect((await FinancePayableModel.findById(d._id))?.balance).toBe(1000);
 expect(String((await reverseVoucher(scope,String(payment._id),input,{}))._id)).toBe(String(reversed._id));
 await expect(reverseVoucher({...scope,branchId:"B"},String(payment._id),input,{})).rejects.toThrow();
 await expect(reverseVoucher(scope,String(payment._id),{...input,idempotencyKey:"second-undo"},{})).rejects.toThrow();
 expect(await FinanceVoucherModel.countDocuments()).toBe(2);
});
it("reverses expenses in the correction period while preserving original period",async()=>{
 const {reverseVoucher}=await import("./management.service");
 const p=await createVoucher(scope,{kind:"payment",category:"rent",expenseClass:"fixed",amount:100,date:"2026-08-31",method:"cash",idempotencyKey:"rent-original"},{});
 await reverseVoucher(scope,String(p._id),{date:"2026-09-01",reason:"Wrong",idempotencyKey:"rent-reversal"},{});
 expect((await financeReport(scope,{from:"2026-08-01",to:"2026-08-31"})).summary.expense).toBe(100);
 const report=await financeReport(scope,{from:"2026-09-01",to:"2026-09-30"});
 expect(report.summary.expense).toBe(-100); expect(report.summary.cashIn).toBe(100);
});

it("concurrent voucher reversals restore payable only once",async()=>{
 const {reverseVoucher}=await import("./management.service");const d=await debt();
 const p=await createVoucher(scope,voucher(String(d._id),"concurrent-original",500),{});
 const attempts=await Promise.allSettled(["undo-one","undo-two"].map(idempotencyKey=>reverseVoucher(scope,String(p._id),{date:"2026-09-23",reason:"Mistake",idempotencyKey},{})));
 expect(attempts.filter(r=>r.status==="fulfilled")).toHaveLength(1);
 expect((await FinancePayableModel.findById(d._id))?.balance).toBe(1000);
 expect(await FinanceVoucherModel.countDocuments()).toBe(2);
});

async function receiptDebt(paidAmount = 200, overrides: any = {}) {
  const receipt = await GoodsReceiptModel.create({ ...scope, warehouseId: "WH", receiptCode: "GR-" + new mongoose.Types.ObjectId(), supplierId: "SUP", supplierName: "Supplier", subtotal: 1200, status: "confirmed", createdBy: "U", items: [], financeTerms: { dueOn: "2026-09-25", paidAmount, paymentMethod: "cash" }, ...overrides });
  const debt = await FinanceDebtModel.create({ companyCode: receipt.companyCode, branchId: receipt.branchId, sourceReceiptId: String(receipt._id), direction: "payable", partyKind: "supplier", partyId: receipt.supplierId, partyName: receipt.supplierName, reference: receipt.receiptCode, amount: 1200 - paidAmount, balance: 1200 - paidAmount, occurredOn: "2026-09-23", dueOn: "2026-09-25", createdBy: "U" });
  return { receipt, debt };
}
describe("Automatically recorded supplier debts", () => {
  it("shows existing receipt debt with gross value, opening payment and live remaining balance without copying it", async () => {
    const { receipt, debt } = await receiptDebt();
    const before = JSON.stringify(await GoodsReceiptModel.findById(receipt._id).lean());
    await FinanceDebtModel.updateOne({ _id: debt._id }, { $set: { balance: 700 }, $push: { payments: { key: "existing-payment", amount: 300, at: new Date() } } });
    for (let i = 0; i < 2; i++) {
      const data = await financeDebts(scope);
      expect(data.payables).toHaveLength(1);
      expect(data.payables[0]).toMatchObject({ _id: String(debt._id), receiptId: String(receipt._id), supplierName: "Supplier", originalAmount: 1200, openingPaid: 200, paidAmount: 500, balance: 700, dueDate: "2026-09-25" });
      expect(data.unregisteredReceipts).toHaveLength(0);
    }
    expect(await FinancePayableModel.countDocuments()).toBe(0);
    expect(await FinanceDebtModel.countDocuments()).toBe(1);
    expect(JSON.stringify(await GoodsReceiptModel.findById(receipt._id).lean())).toBe(before);
    expect((await financeReport(scope, { from: "2026-09-01", to: "2026-09-30" })).summary.payable).toBe(700);
  });
  it("keeps fully paid receipts and isolates company, branch and unconfirmed receipts", async () => {
    const { debt } = await receiptDebt(1200);
    await receiptDebt(0, { branchId: "B" });
    await receiptDebt(0, { companyCode: "OTHER" });
    await receiptDebt(0, { status: "draft" });
    await receiptDebt(0, { status: "cancelled" });
    const data = await financeDebts(scope);
    expect(data.payables).toHaveLength(1);
    expect(data.payables[0]).toMatchObject({ _id: String(debt._id), originalAmount: 1200, paidAmount: 1200, balance: 0 });
    expect(data.unregisteredReceipts).toHaveLength(0);
  });
  it("leaves opted-out receipts available for manual registration and prevents duplicating automatic debt", async () => {
    const { receipt } = await receiptDebt();
    await GoodsReceiptModel.create({ ...scope, warehouseId: "WH", receiptCode: "MANUAL", supplierId: "SUP", supplierName: "Supplier", subtotal: 500, status: "confirmed", createdBy: "U", items: [] });
    const data = await financeDebts(scope);
    expect(data.unregisteredReceipts.map(r => r.receiptCode)).toEqual(["MANUAL"]);
    await expect(createPayable(scope, { receiptId: String(receipt._id), openingPaid: 0, dueDate: "2026-09-25" }, {})).rejects.toMatchObject({ status: 409 });
    expect(await FinancePayableModel.countDocuments()).toBe(0);
  });
  it("does not count a receipt twice if it already has a manual payable", async () => {
    const { receipt } = await receiptDebt();
    const manual = await FinancePayableModel.create({ ...scope, receiptId: String(receipt._id), supplierId: "SUP", originalAmount: 1200, openingPaid: 200, paidAmount: 400, balance: 800, dueDate: "2026-09-25" });
    const data = await financeDebts(scope);
    expect(data.payables).toHaveLength(1);
    expect(data.payables[0]).toMatchObject({ _id: String(manual._id), balance: 800 });
    expect(data.unregisteredReceipts).toHaveLength(0);
  });
  it("pays, follows up and reverses the original debt atomically with idempotent retries", async () => {
    const { reverseVoucher } = await import("./management.service");
    const { financeCashSources } = await import("./finance-cash-sources.service");
    const { debt } = await receiptDebt();
    const id = String(debt._id), input = voucher(id, "auto-pay", 600);
    const payment = await createVoucher(scope, input, { id: "U" });
    await createVoucher(scope, input, { id: "U" });
    await expect(createVoucher(scope, { ...input, amount: 1 }, {})).rejects.toThrow();
    await saveFollowup(scope, { targetType: "payable", targetId: id, status: "contacted" }, { id: "U" });
    expect((await financeDebts(scope)).payables[0]).toMatchObject({ balance: 400, paidAmount: 800, followup: { status: "contacted" } });
    expect((await FinanceDebtModel.findById(id))?.payments).toHaveLength(1);
    expect(await FinanceVoucherModel.countDocuments()).toBe(1);
    const reversal = { date: "2026-09-23", reason: "Wrong payment", idempotencyKey: "auto-undo" };
    await reverseVoucher(scope, String(payment._id), reversal, { id: "U" });
    await reverseVoucher(scope, String(payment._id), reversal, { id: "U" });
    expect((await financeDebts(scope)).payables[0]).toMatchObject({ balance: 1000, paidAmount: 200 });
    const restored = await FinanceDebtModel.findById(id);
    expect(restored?.payments.map(p => p.amount)).toEqual([600, -600]);
    expect(restored?.version).toBe(2);
    const cash = (await financeCashSources(scope)).filter(row => row.sourceType === "debt");
    expect(cash.map(row => row.amount)).toEqual([-600, 600]);
    expect(cash.map(row => row.occurredOn)).toEqual(["2026-09-23", "2026-09-23"]);
    expect(await FinanceVoucherModel.countDocuments()).toBe(2);
  });
  it("rejects cross-scope operations and concurrent overpayment on receipt debts", async () => {
    const { debt } = await receiptDebt();
    const id = String(debt._id);
    for (const other of [{ ...scope, branchId: "B" }, { ...scope, companyCode: "OTHER" }]) {
      await expect(createVoucher(other, voucher(id, "wrong-scope"), {})).rejects.toThrow();
      await expect(saveFollowup(other, { targetType: "payable", targetId: id, status: "done" }, {})).rejects.toThrow();
    }
    await expect(createVoucher(scope, voucher(id, "too-large", 1001), {})).rejects.toThrow();
    expect(await FinanceVoucherModel.countDocuments()).toBe(0);
    const attempts = await Promise.allSettled([createVoucher(scope, voucher(id, "auto-A"), {}), createVoucher(scope, voucher(id, "auto-B"), {})]);
    expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await FinanceDebtModel.findById(id))?.balance).toBe(400);
    expect(await FinanceVoucherModel.countDocuments()).toBe(1);
  });
});

describe("Overdue supplier payment", () => {
  for (const source of ["manual", "receipt"] as const) {
    it(source + ": accepts partial and full late payment without changing the original due date", async () => {
      const d = source === "manual" ? await debt() : (await receiptDebt()).debt;
      const id = String(d._id);
      const dueDate = "2020-09-24";
      if (source === "manual") await FinancePayableModel.updateOne({ _id: id }, { $set: { dueDate } });
      else await FinanceDebtModel.updateOne({ _id: id }, { $set: { dueOn: dueDate } });
      const input = validateManagement("voucher", { ...voucher(id, "late-partial", 600), date: businessDay() });
      await createVoucher(scope, input, {});
      const partial = (await financeDebts(scope)).payables[0];
      expect(partial).toMatchObject({ dueDate, balance: 400, aging: "over60" });
      expect(partial.daysUntil).toBeLessThan(0);
      await createVoucher(scope, { ...input, amount: 400, idempotencyKey: "late-settlement" }, {});
      const settled = (await financeDebts(scope)).payables[0];
      expect(settled).toMatchObject({ dueDate, balance: 0, aging: "over60" });
      expect(settled.daysUntil).toBeLessThan(0);
      expect(await FinanceVoucherModel.countDocuments()).toBe(2);
    });
  }
});
