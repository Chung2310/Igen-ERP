import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RetailPartnerModel } from "../models/retail-partner.model";
import { RetailCommissionAccountModel, RetailCommissionBasePolicyModel, RetailCommissionLedgerModel, RetailCommissionPayoutModel, RetailCommissionPolicyModel, RetailProductCommissionModel } from "../models/retail-commission.model";
import { accrueOrderCommission, payPartnerCommission, reverseOrderCommission } from "./retail-commission.service";
import { resolveCollaborator, snapshotRetail, reconcileCommission } from "./retail-collaborator-adapter";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { RetailSePayTransactionModel } from "../models/retail-sepay-transaction.model";
import { CompanyModel } from "../../../model/company.model";
import { buildRetailPaymentQr, processRetailSePayTransaction } from "./retail-sepay.service";

let replSet: MongoMemoryReplSet;
const scope = { companyCode: "COMMISSIONTEST", branchId: "b1" };
const partnerId = new mongoose.Types.ObjectId().toString();
const order = { _id: new mongoose.Types.ObjectId(), retailPartnerId: partnerId, status: "completed", businessDate: "2026-10-21", orderCode: "DH1", subtotal: 100_000, orderDiscount: 0, items: [{ sku: "PHONE", lineTotal: 100_000, quantity: 2 }] };

describe("hoa hồng CTV bán lẻ", () => {
  beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replSet.getUri()); });
  beforeEach(async () => {
    await Promise.all([RetailPartnerModel.deleteMany({}), RetailCommissionPolicyModel.deleteMany({}), RetailCommissionBasePolicyModel.deleteMany({}), RetailProductCommissionModel.deleteMany({}), RetailCommissionLedgerModel.deleteMany({}), RetailCommissionAccountModel.deleteMany({}), RetailCommissionPayoutModel.deleteMany({}), RetailOrderModel.deleteMany({}), RetailAfterSaleModel.deleteMany({}), RetailSePayTransactionModel.deleteMany({}), CompanyModel.deleteMany({})]);
    await RetailPartnerModel.create({ _id: partnerId, companyCode: scope.companyCode, code: "CTV1", name: "CTV", roles: ["collaborator"], status: "active", createdBy: "test", updatedBy: "test" });
    await RetailCommissionPolicyModel.create({ companyCode: scope.companyCode, partnerId, kind: "sale", sku: "PHONE", ratePercent: 10, active: true, updatedBy: "test" });
  });
  afterAll(async () => { await mongoose.disconnect(); await replSet.stop(); });

  const posOrder = (overrides: Record<string, unknown> = {}) => ({
    ...order, ...scope, _id: new mongoose.Types.ObjectId(), collaboratorId: partnerId,
    createdBy: "cashier-1", createdByName: "Cashier", salespersonId: "cashier-1", salespersonName: "Cashier",
    items: [{ productId: "p1", sku: "PHONE", productName: "Phone", unit: "unit", quantity: 2, unitPrice: 50_000, unitCost: 25_000, discountAmount: 0, lineTotal: 100_000 }],
    taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: 100_000, totalCost: 50_000,
    payments: [], refunds: [], paidAmount: 100_000, dueAmount: 0, refundedAmount: 0,
    paymentStatus: "paid", stockApplied: true, version: 1, ...overrides,
  });

  it("resolves ERP collaborators only inside their company and while active", async () => {
    expect(String((await resolveCollaborator(scope.companyCode, partnerId))?._id)).toBe(partnerId);
    await expect(resolveCollaborator("OTHER", partnerId)).rejects.toThrow();
    await RetailPartnerModel.updateOne({ _id: partnerId }, { $set: { status: "inactive" } });
    await expect(resolveCollaborator(scope.companyCode, partnerId)).rejects.toThrow();
    expect(await resolveCollaborator(scope.companyCode, undefined)).toBeUndefined();
  });

  it("the POS adapter accrues once and reverses returns and cancellation without losing ERP commissions", async () => {
    const row = posOrder();
    const snapshot = await snapshotRetail(row);
    expect(snapshot).toMatchObject({ partnerId });
    expect(row.retailPartnerId).toBe(partnerId);
    await RetailOrderModel.collection.insertOne({ ...row, commissionSnapshot: snapshot } as any);
    await reconcileCommission("retail", String(row._id), "OTHER");
    expect(await RetailCommissionLedgerModel.countDocuments({})).toBe(0);
    await reconcileCommission("retail", String(row._id), scope.companyCode);
    await reconcileCommission("retail", String(row._id), scope.companyCode);
    expect((await RetailCommissionAccountModel.findOne({ partnerId }).lean())?.balance).toBe(10_000);
    await RetailAfterSaleModel.collection.insertOne({ ...scope, orderId: String(row._id), type: "return", items: [{ orderLineIndex: 0, quantity: 1 }] });
    await reconcileCommission("retail", String(row._id), scope.companyCode);
    await reconcileCommission("retail", String(row._id), scope.companyCode);
    expect((await RetailCommissionAccountModel.findOne({ partnerId }).lean())?.balance).toBe(5_000);
    await RetailOrderModel.updateOne({ _id: row._id }, { $set: { status: "cancelled" } });
    await reconcileCommission("retail", String(row._id), scope.companyCode);
    await reconcileCommission("retail", String(row._id), scope.companyCode);
    expect((await RetailCommissionAccountModel.findOne({ partnerId }).lean())?.balance).toBe(0);
    expect(await RetailCommissionLedgerModel.countDocuments({})).toBe(3);
  });

  it("posts ERP commissions once when a SePay payment completes a POS order", async () => {
    await CompanyModel.collection.insertOne({ code: scope.companyCode, vietqrConfig: { accountNo: "123456789", bankId: "970422" } });
    const paymentCode = "AKMP1234567890ABCDEF1234567890";
    const row = posOrder({ status: "confirmed", paymentStatus: "unpaid", paidAmount: 0, dueAmount: 100_000, pendingTransferAmount: 100_000, paymentCode });
    await RetailOrderModel.collection.insertOne(row as any);
    await expect(buildRetailPaymentQr(scope.companyCode, scope.branchId, String(row._id), { actorId: "cashier-2", canManage: false })).rejects.toMatchObject({ status: 403 });
    expect((await buildRetailPaymentQr(scope.companyCode, scope.branchId, String(row._id), { actorId: "cashier-1", canManage: false })).amount).toBe(100_000);
    expect((await buildRetailPaymentQr(scope.companyCode, scope.branchId, String(row._id), { actorId: "manager", canManage: true })).amount).toBe(100_000);
    const payload = { id: "commission-payment-1", transferType: "in", transferAmount: 100_000, accountNumber: "123456789", code: paymentCode };
    expect(await processRetailSePayTransaction(payload)).toMatchObject({ paymentStatus: "paid" });
    expect(await processRetailSePayTransaction(payload)).toMatchObject({ duplicate: true });
    expect((await RetailCommissionAccountModel.findOne({ partnerId }).lean())?.balance).toBe(10_000);
    expect(await RetailCommissionLedgerModel.countDocuments({})).toBe(1);
  });

  it("accrues, reverses and pays once under retries", async () => {
    await accrueOrderCommission(scope, order);
    await accrueOrderCommission(scope, order);
    expect(await RetailCommissionLedgerModel.countDocuments({ companyCode: scope.companyCode })).toBe(1);
    expect((await RetailCommissionAccountModel.findOne({ companyCode: scope.companyCode, partnerId }).lean())?.balance).toBe(10_000);
    const ratios = new Map([[0, 0.5]]);
    await reverseOrderCommission(scope, order, "return:r1", ratios);
    await reverseOrderCommission(scope, order, "return:r1", ratios);
    expect((await RetailCommissionAccountModel.findOne({ companyCode: scope.companyCode, partnerId }).lean())?.balance).toBe(5_000);
    const payout = { amount: 4_000, account: "bank", reference: "BANK-1", businessDate: "2026-10-21", idempotencyKey: "pay-1" };
    await payPartnerCommission(scope, partnerId, payout, "manager");
    await payPartnerCommission(scope, partnerId, payout, "manager");
    expect(await RetailCommissionPayoutModel.countDocuments({ companyCode: scope.companyCode })).toBe(1);
    expect((await RetailCommissionAccountModel.findOne({ companyCode: scope.companyCode, partnerId }).lean())?.balance).toBe(1_000);
    await expect(payPartnerCommission(scope, partnerId, { ...payout, amount: 5_000 }, "manager")).rejects.toThrow(/Khóa yêu cầu/);
  });
  it("does not apply a future policy to an earlier sale", async () => {
    await RetailCommissionPolicyModel.updateOne({ companyCode: scope.companyCode, partnerId }, { $set: { effectiveFrom: new Date("2026-11-01T00:00:00Z") } });
    expect(await accrueOrderCommission(scope, order)).toEqual([]);
    expect(await RetailCommissionLedgerModel.countDocuments({ companyCode: scope.companyCode })).toBe(0);
  });
  it("ưu tiên mức SKU, rồi chính sách CTV, chính sách chung và cuối cùng là chính sách cũ", async () => {
    const effectiveAt = new Date("2026-10-20T00:00:00+07:00");
    await RetailCommissionBasePolicyModel.create({ companyCode: scope.companyCode, partnerId: "", effectiveAt, config: { phoneAmount: 200_000, accessoryBps: 1_000, repairBps: 1_000 } });
    await RetailCommissionBasePolicyModel.create({ companyCode: scope.companyCode, partnerId, effectiveAt, config: { phoneAmount: 250_000, accessoryBps: 1_200, repairBps: 1_200 } });
    const override = await RetailProductCommissionModel.create({ companyCode: scope.companyCode, sku: "PHONE", rule: { kind: "phone", amount: 300_000 } });
    const phoneOrder = () => ({ ...order, _id: new mongoose.Types.ObjectId(), subtotal: 1_000_000, items: [{ sku: "PHONE", trackingMode: "serial", lineTotal: 1_000_000, quantity: 2 }] });

    const [skuLine] = await accrueOrderCommission(scope, phoneOrder());
    expect(skuLine.amount).toBe(600_000);
    expect(skuLine.rateType).toBe("amount");
    expect(skuLine.policyId).toBe(String(override._id));

    await RetailProductCommissionModel.updateOne({ _id: override._id }, { $set: { rule: null } });
    const [partnerLine] = await accrueOrderCommission(scope, phoneOrder());
    expect(partnerLine.amount).toBe(500_000);

    const [accessoryLine] = await accrueOrderCommission(scope, { ...phoneOrder(), subtotal: 100_000, items: [{ sku: "ACCESSORY", trackingMode: "quantity", lineTotal: 100_000, quantity: 1 }] });
    expect(accessoryLine.amount).toBe(12_000);
    expect(accessoryLine.rateType).toBe("percent");

    await RetailCommissionBasePolicyModel.deleteOne({ companyCode: scope.companyCode, partnerId });
    const [globalLine] = await accrueOrderCommission(scope, phoneOrder());
    expect(globalLine.amount).toBe(400_000);

    await RetailCommissionBasePolicyModel.deleteMany({ companyCode: scope.companyCode });
    const [legacyLine] = await accrueOrderCommission(scope, phoneOrder());
    expect(legacyLine.amount).toBe(100_000);
  });
  it("chỉ áp dụng phiên bản mới sau đúng thời điểm hiệu lực", async () => {
    await RetailCommissionBasePolicyModel.create({
      companyCode: scope.companyCode, partnerId: "", effectiveAt: new Date("2026-10-21T18:00:00+07:00"),
      config: { phoneAmount: 200_000, accessoryBps: 1_000, repairBps: 1_000 },
    });
    const before = { ...order, _id: new mongoose.Types.ObjectId(), completedAt: new Date("2026-10-21T10:00:00+07:00"), items: [{ ...order.items[0], trackingMode: "serial" }] };
    const after = { ...before, _id: new mongoose.Types.ObjectId(), completedAt: new Date("2026-10-21T19:00:00+07:00") };
    expect((await accrueOrderCommission(scope, before))[0].amount).toBe(10_000);
    expect((await accrueOrderCommission(scope, after))[0].amount).toBe(400_000);
  });
});
