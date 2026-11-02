import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RetailCouponModel } from "../models/retail-coupon.model";
import { consumeCoupon, releaseCoupon, resolveCoupon } from "./retail-coupon.service";

let replSet: MongoMemoryReplSet;
const scope = { companyCode: "COUPONTEST", branchId: "branch-1" };

describe("khóa lượt dùng mã ưu đãi", () => {
  beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replSet.getUri()); });
  beforeEach(async () => {
    await RetailCouponModel.deleteMany({});
    await RetailCouponModel.create({ ...scope, code: "SALE10", name: "Giảm 10%", discountType: "percent", value: 10,
      minSubtotal: 0, usageLimit: 1, usedCount: 0, startsAt: new Date("2020-01-01"), endsAt: new Date("2099-01-01"),
      active: true, customerTierCodes: [], source: "manual", version: 0, createdBy: "test", updatedBy: "test" });
  });
  afterAll(async () => { await mongoose.disconnect(); await replSet.stop(); });

  it("khóa một lượt trong giao dịch và trả lượt khi hủy", async () => {
    const snapshot = await resolveCoupon(scope, "SALE10", 100_000);
    expect(snapshot.amount).toBe(10_000);
    const session = await mongoose.startSession();
    try { await session.withTransaction(async () => { await consumeCoupon(scope, snapshot, session, undefined); }); }
    finally { await session.endSession(); }
    expect((await RetailCouponModel.findOne({ ...scope, code: "SALE10" }).lean())?.usedCount).toBe(1);
    await expect(resolveCoupon(scope, "SALE10", 100_000)).rejects.toThrow();
    const undo = await mongoose.startSession();
    try { await undo.withTransaction(async () => { await releaseCoupon(scope, snapshot.id, undo); }); }
    finally { await undo.endSession(); }
    expect((await resolveCoupon(scope, "SALE10", 100_000)).amount).toBe(10_000);
  });
});
