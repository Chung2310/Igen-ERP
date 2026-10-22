import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BranchModel } from "../../../model/branch.model";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailCouponModel } from "../models/retail-coupon.model";
import { RetailCouponAutomationModel } from "../models/retail-coupon-automation.model";
import { issueCouponAutomations } from "./retail-coupon-automation.service";
import { resolveCoupon } from "./retail-coupon.service";

let replSet: MongoMemoryReplSet;
const companyCode = "AUTOTEST";
const branchId = new mongoose.Types.ObjectId().toString();
const customerId = new mongoose.Types.ObjectId().toString();
const scope = { companyCode, branchId };
const now = new Date("2026-10-21T03:00:00.000Z");

describe("tự động tặng mã", () => {
  beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replSet.getUri()); });
  beforeEach(async () => {
    await Promise.all([BranchModel.deleteMany({}), CustomerModel.deleteMany({}), RetailOrderModel.deleteMany({}),
      RetailCouponModel.deleteMany({}), RetailCouponAutomationModel.deleteMany({})]);
    await BranchModel.create({ _id: branchId, companyCode, code: "CN1", name: "Chi nhánh thử nghiệm", isActive: true });
    await CustomerModel.create({ _id: customerId, companyCode, customerCode: "KH1", type: "regular", name: "Khách thử nghiệm", phone: "0900000001", normalizedPhone: "0900000001", dateOfBirth: new Date("2000-10-21T05:00:00Z"), status: "active", source: "manual", createdBy: "test", createdByName: "test", version: 0 });
  }, 30_000);
  afterAll(async () => { await mongoose.disconnect(); await replSet.stop(); });

  it("phát một mã sinh nhật mỗi khách mỗi năm", async () => {
    await RetailCouponAutomationModel.create({ ...scope, name: "Sinh nhật", trigger: "birthday", enabled: true, activatedAt: new Date("2026-01-01"), discountType: "amount", value: 10_000, minSubtotal: 0, validityDays: 30, sendEmail: true, version: 0, createdBy: "test", updatedBy: "test" });
    expect(await issueCouponAutomations(scope, now, customerId)).toBe(1);
    expect(await issueCouponAutomations(scope, now, customerId)).toBe(0);
    const coupons = await RetailCouponModel.find({ ...scope, customerId }).lean();
    expect(coupons).toHaveLength(1);
    expect(coupons[0].deliveryStatus).toBe("pending");
  });

  it("phát theo đơn đạt ngưỡng và chặn mã khi đơn gốc đã hoàn", async () => {
    await RetailCouponAutomationModel.create({ ...scope, name: "Sau mua", trigger: "purchase", orderMinTotal: 100_000, enabled: true,
      activatedAt: new Date("2026-10-01"), discountType: "amount", value: 20_000, minSubtotal: 0, validityDays: 30, sendEmail: false,
      version: 0, createdBy: "test", updatedBy: "test" });
    const orderId = new mongoose.Types.ObjectId();
    await RetailOrderModel.collection.insertOne({ _id: orderId, ...scope, customerId, status: "completed", paymentStatus: "paid",
      dueAmount: 0, grandTotal: 150_000, refundedAmount: 0, completedAt: new Date("2026-10-20T03:00:00Z") });
    expect(await issueCouponAutomations(scope, now, customerId)).toBe(1);
    expect(await issueCouponAutomations(scope, now, customerId)).toBe(0);
    const coupon = await RetailCouponModel.findOne({ ...scope, sourceOrderId: String(orderId) }).lean();
    expect(coupon?.source).toBe("purchase");
    expect((await resolveCoupon(scope, coupon!.code, 100_000, customerId)).amount).toBe(20_000);
    await RetailOrderModel.updateOne({ _id: orderId }, { $set: { refundedAmount: 100_000 } });
    await expect(resolveCoupon(scope, coupon!.code, 100_000, customerId)).rejects.toThrow();
  });
});
