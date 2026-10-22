import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RetailPartnerModel } from "../models/retail-partner.model";
import { RetailCommissionAccountModel, RetailCommissionLedgerModel, RetailCommissionPayoutModel, RetailCommissionPolicyModel } from "../models/retail-commission.model";
import { accrueOrderCommission, payPartnerCommission, reverseOrderCommission } from "./retail-commission.service";

let replSet: MongoMemoryReplSet;
const scope = { companyCode: "COMMISSIONTEST", branchId: "b1" };
const partnerId = new mongoose.Types.ObjectId().toString();
const order = { _id: new mongoose.Types.ObjectId(), retailPartnerId: partnerId, status: "completed", businessDate: "2026-10-21", orderCode: "DH1", subtotal: 100_000, orderDiscount: 0, items: [{ sku: "PHONE", lineTotal: 100_000, quantity: 2 }] };

describe("hoa hồng CTV bán lẻ", () => {
  beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replSet.getUri()); });
  beforeEach(async () => {
    await Promise.all([RetailPartnerModel.deleteMany({}), RetailCommissionPolicyModel.deleteMany({}), RetailCommissionLedgerModel.deleteMany({}), RetailCommissionAccountModel.deleteMany({}), RetailCommissionPayoutModel.deleteMany({})]);
    await RetailPartnerModel.create({ _id: partnerId, companyCode: scope.companyCode, code: "CTV1", name: "CTV", roles: ["collaborator"], status: "active", createdBy: "test", updatedBy: "test" });
    await RetailCommissionPolicyModel.create({ companyCode: scope.companyCode, partnerId, kind: "sale", sku: "PHONE", ratePercent: 10, active: true, updatedBy: "test" });
  });
  afterAll(async () => { await mongoose.disconnect(); await replSet.stop(); });

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
});
