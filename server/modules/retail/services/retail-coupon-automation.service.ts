import { createHash } from "node:crypto";
import { Types } from "mongoose";
import type { RetailBranchScope } from "../contracts";
import { RetailCouponAutomationModel } from "../models/retail-coupon-automation.model";
import { RetailBirthdayProgramModel } from "../models/retail-birthday-program.model";
import { RetailCouponModel } from "../models/retail-coupon.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { BranchModel } from "../../../model/branch.model";
import { getModuleStateForCompany } from "../../../middleware/require-module";
import { birthdayPromotionCustomers, getPromotionCustomer } from "../../customer-management/contracts";
import { birthdayWindow, birthdayCandidateDays, issueBirthdayCoupons, retailBirthdayProgramService, runBirthdayCouponScan, validateBirthdayProgram } from "./retail-birthday-coupon.service";
import { isCouponRewardOrder } from "./retail-coupon-eligibility";

import { deliverPendingCouponEmails } from "./retail-coupon-email.service";

const DAY = 86400000;
const conflict = () => Object.assign(new Error("Chương trình đã thay đổi hoặc không tồn tại. Vui lòng tải lại."), { status: 409 });
const legacyView = (row: any) => ({ ...row, name: "Quà sinh nhật", trigger: "birthday" as const, orderMinTotal: null, legacy: true });
export function validateCouponAutomation(input: any) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) throw new Error("Tên chương trình phải có từ 1 đến 120 ký tự.");
  if (!["birthday", "order_total"].includes(input.trigger)) throw new Error("Hoạt động tặng mã không hợp lệ.");
  if (input.trigger === "order_total" && (!Number.isSafeInteger(input.orderMinTotal) || input.orderMinTotal <= 0)) throw new Error("Mức tiền mua hàng phải là số nguyên dương.");
  return { ...validateBirthdayProgram(input), name, trigger: input.trigger as "birthday" | "order_total", orderMinTotal: input.trigger === "order_total" ? input.orderMinTotal as number : null };
}
export const retailCouponAutomationService = {
  async list(scope: RetailBranchScope) {
    const [items, legacy] = await Promise.all([
      RetailCouponAutomationModel.find(scope).sort({ createdAt: -1 }).lean(),
      RetailBirthdayProgramModel.findOne(scope).lean(),
    ]);
    return [...items, ...(legacy ? [legacyView(legacy)] : [])];
  },
  async create(scope: RetailBranchScope, input: any, actor: string, now = new Date()) {
    const values = validateCouponAutomation(input);
    return RetailCouponAutomationModel.create({ ...scope, ...values, activatedAt: values.enabled ? now : undefined, createdBy: actor, updatedBy: actor });
  },
  async update(scope: RetailBranchScope, id: string, input: any, actor: string, now = new Date()) {
    if (!Types.ObjectId.isValid(id) || !Number.isSafeInteger(input.version) || input.version < 0) throw conflict();
    const values = validateCouponAutomation(input);
    const current = await RetailCouponAutomationModel.findOne({ _id: id, ...scope, version: input.version }).lean();
    if (!current) {
      const legacy = await RetailBirthdayProgramModel.findOne({ _id: id, ...scope, version: input.version }).lean();
      if (!legacy) throw conflict();
      if (values.trigger !== "birthday" || values.name !== "Quà sinh nhật") throw new Error("Chương trình sinh nhật cũ giữ nguyên tên và hoạt động. Hãy tạo chương trình mới cho hoạt động khác.");
      const saved = await retailBirthdayProgramService.save(scope, input, actor);
      return legacyView(saved.toObject());
    }
    if (current.trigger !== values.trigger) throw new Error("Không đổi hoạt động sau khi tạo. Hãy tạo chương trình mới.");
    const saved = await RetailCouponAutomationModel.findOneAndUpdate({ _id: id, ...scope, version: input.version },
      { $set: { ...values, ...(values.enabled && !current.enabled ? { activatedAt: now } : {}), updatedBy: actor }, $inc: { version: 1 } }, { returnDocument: "after" });
    if (!saved) throw conflict();
    return saved;
  },
};

async function issueGift(scope: RetailBranchScope, program: any, customer: any, issuanceKey: string, startsAt: Date, endsAt: Date, sourceOrderId?: string) {
  try {
    const result = await RetailCouponModel.updateOne({ ...scope, issuanceKey }, { $setOnInsert: {
      ...scope, issuanceKey, code: `TD${createHash("sha256").update(issuanceKey).digest("hex").slice(0, 24)}`.toUpperCase(),
      ...(program.deliveryChannels?.includes("email") ? { emailDelivery: { status: "pending" } } : {}),
      name: program.name, customerId: String(customer._id), customerName: customer.name, customerCode: customer.customerCode,
      customerTierCodes: [], source: program.trigger === "birthday" ? "birthday" : "purchase", automationId: String(program._id),
      sourceOrderId, triggerThreshold: sourceOrderId ? program.orderMinTotal : undefined,
      discountType: program.discountType, value: program.value, minSubtotal: program.minSubtotal, maxDiscount: program.maxDiscount,
      usageLimit: 1, usedCount: 0, startsAt, endsAt, active: true, version: 0,
      createdBy: "coupon-automation", updatedBy: "coupon-automation",
    } }, { upsert: true });
    return result.upsertedCount;
  } catch (error: any) {
    if (error.code === 11000 && await RetailCouponModel.exists({ ...scope, issuanceKey })) return 0;
    throw error;
  }
}

export async function issueCouponAutomations(scope: RetailBranchScope, now = new Date(), customerId?: string, includeLegacy = true) {
  let issued = includeLegacy ? await issueBirthdayCoupons(scope, now, customerId) : 0;
  if (!await BranchModel.exists({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true })) return issued;
  for await (const program of RetailCouponAutomationModel.find({ ...scope, enabled: true }).lean().cursor()) {
    if (program.trigger === "birthday") {
      const customers = birthdayPromotionCustomers(scope.companyCode, birthdayCandidateDays(now, program.validityDays), customerId);
      try {
        for await (const customer of customers) {
          const window = birthdayWindow(new Date(customer.dateOfBirth!), now, program.validityDays);
          if (window) issued += await issueGift(scope, program, customer, `auto:${program._id}:birthday:${customer._id}:${window.year}`, window.startsAt, window.endsAt);
        }
      } finally { await customers.close(); }
      continue;
    }
    if (!program.activatedAt) continue;
    const after = new Date(Math.max(+program.activatedAt, +now - program.validityDays * DAY));
    const orders = RetailOrderModel.find({ ...scope, status: "completed", paymentStatus: "paid", dueAmount: 0,
      customerId: customerId || { $type: "string" }, completedAt: { $gte: after, $lte: now },
    }).select("_id customerId status paymentStatus dueAmount grandTotal refundedAmount completedAt").lean().cursor();
    try {
      for await (const order of orders) {
        if (!isCouponRewardOrder(order, program.orderMinTotal!)) continue;
        const startsAt = new Date(order.completedAt!);
        const endsAt = new Date(+startsAt + program.validityDays * DAY);
        if (endsAt <= now) continue;
        const customer = await getPromotionCustomer(scope.companyCode, order.customerId);
        if (!customer) continue;
        issued += await issueGift(scope, program, customer, `auto:${program._id}:order:${order._id}`, startsAt, endsAt, String(order._id));
      }
    } finally { await orders.close(); }
  }
  return issued;
}

export async function runCouponAutomationScan(now = new Date()) {
  let issued = await runBirthdayCouponScan(now);
  const scopes = await RetailCouponAutomationModel.aggregate<{ _id: RetailBranchScope }>([
    { $match: { enabled: true } }, { $group: { _id: { companyCode: "$companyCode", branchId: "$branchId" } } },
  ]);
  for (const { _id: scope } of scopes) {
    try {
      const state = await getModuleStateForCompany(scope.companyCode);
      if (state.exists && state.modules?.includes("retail")) issued += await issueCouponAutomations(scope, now, undefined, false);
    } catch (error) { console.error("[coupon-automation]", scope.companyCode, scope.branchId, error); }
  }
  return issued;
}
export function startRetailCouponAutomationScheduler() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runCouponAutomationScan(); await deliverPendingCouponEmails(); }
    catch (error) { console.error("[coupon-automation] scan failed", error); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), 5 * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
