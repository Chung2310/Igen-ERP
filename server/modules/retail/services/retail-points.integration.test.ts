import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { RetailPointLedgerModel } from "../models/retail-point-ledger.model";
import { RetailPointPolicyModel } from "../models/retail-point-policy.model";
import { adjustCustomerPoints, earnOrderPoints, postPoints, quotePointRedemption, reverseOrderPoints } from "./retail-points.service";

let replSet: MongoMemoryReplSet;
const scope = { companyCode: "POINTTEST", branchId: "branch-1" };
const customerId = new mongoose.Types.ObjectId().toString();
const order = { _id: "order-1", customerId, status: "completed", paymentStatus: "paid", grandTotal: 100_000, refundedAmount: 0, pointsRedeemed: 20 };

describe("sổ điểm bán lẻ", () => {
  beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replSet.getUri()); });
  beforeEach(async () => {
    await Promise.all([CustomerModel.deleteMany({}), RetailPointPolicyModel.deleteMany({}), RetailPointLedgerModel.deleteMany({})]);
    await CustomerModel.create({ _id: customerId, companyCode: scope.companyCode, customerCode: "KH1", type: "regular", name: "Khách thử nghiệm", phone: "0900000000", normalizedPhone: "0900000000", status: "active", source: "manual", pointsBalance: 100, createdBy: "test", createdByName: "test", version: 0 });
    await RetailPointPolicyModel.create({ companyCode: scope.companyCode, enabled: true, earnVndPerPoint: 10_000, redeemVndPerPoint: 1_000, maxRedeemPercent: 50, version: 1, updatedBy: "test" });
  }, 30_000);
  afterAll(async () => { await mongoose.disconnect(); await replSet.stop(); });

  it("trừ điểm khi dùng, tích khi thanh toán, trả một phần rồi hủy phần còn lại", async () => {
    expect(await quotePointRedemption(scope.companyCode, customerId, 20, 100_000)).toEqual({ points: 20, amount: 20_000 });
    await expect(quotePointRedemption(scope.companyCode, customerId, 60, 100_000)).rejects.toThrow();
    const session = await mongoose.startSession();
    try { await session.withTransaction(async () => {
      await postPoints({ ...scope, customerId, sourceKey: "order:order-1:redeem", sourceId: "order-1", type: "redeem", points: -20, reason: "Dùng điểm", actorId: "tester" }, session);
      await earnOrderPoints(scope, order, session);
    }); } finally { await session.endSession(); }
    expect((await CustomerModel.findById(customerId).lean())?.pointsBalance).toBe(90);
    const refundSession = await mongoose.startSession();
    try { await refundSession.withTransaction(async () => {
      await reverseOrderPoints(scope, order, "after-sale:return-1", 50_000, "tester", refundSession);
      await reverseOrderPoints(scope, { ...order, refundedAmount: 50_000 }, "order:order-1:cancel", 50_000, "tester", refundSession);
    }); } finally { await refundSession.endSession(); }
    expect((await CustomerModel.findById(customerId).lean())?.pointsBalance).toBe(100);
    expect(await RetailPointLedgerModel.countDocuments({ companyCode: scope.companyCode, sourceId: "order-1" })).toBe(6);
  });

  it("không ghi điểm hai lần với cùng khóa sự kiện", async () => {
    const session = await mongoose.startSession();
    try { await session.withTransaction(async () => {
      const input = { ...scope, customerId, sourceKey: "order:other:earn", sourceId: "other", type: "earn" as const, points: 5, reason: "Tích điểm", actorId: "system" };
      await postPoints(input, session);
      await postPoints(input, session);
    }); } finally { await session.endSession(); }
    expect((await CustomerModel.findById(customerId).lean())?.pointsBalance).toBe(105);
    expect(await RetailPointLedgerModel.countDocuments({ companyCode: scope.companyCode })).toBe(1);
  });
  it("gửi lại điều chỉnh thủ công không cộng điểm hai lần và không đổi nội dung khóa", async () => {
    await adjustCustomerPoints(scope.companyCode, customerId, 7, "Bù điểm", "manager", "adjustment-001");
    await adjustCustomerPoints(scope.companyCode, customerId, 7, "Bù điểm", "manager", "adjustment-001");
    expect((await CustomerModel.findById(customerId).lean())?.pointsBalance).toBe(107);
    await expect(adjustCustomerPoints(scope.companyCode, customerId, 8, "Bù điểm", "manager", "adjustment-001")).rejects.toThrow();
  });
});
