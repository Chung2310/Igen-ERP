import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { BranchModel } from "../../../model/branch.model";
import { getModuleStateForCompany } from "../../../middleware/require-module";
import { companyEmailService } from "../../../service/company-email.service";
import { CustomerModel } from "../../customer-management/models/customer.model";
import type { RetailBranchScope } from "../contracts";
import { RetailCouponAutomationModel } from "../models/retail-coupon-automation.model";
import { RetailCouponModel } from "../models/retail-coupon.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { sourceEligible, validateCouponInput } from "./retail-coupon.service";

const DAY = 86_400_000;
const invalid = (message: string, status = 400) => Object.assign(new Error(message), { status });
export function validateCouponAutomation(input: any) {
  const name = String(input.name || "").trim();
  if (!name || name.length > 120) throw invalid("Tên chương trình phải có từ 1 đến 120 ký tự.");
  if (!["birthday", "purchase"].includes(input.trigger)) throw invalid("Hoạt động tặng mã không hợp lệ.");
  const validityDays = Number(input.validityDays);
  if (!Number.isSafeInteger(validityDays) || validityDays < 1 || validityDays > 365) throw invalid("Thời hạn mã phải từ 1 đến 365 ngày.");
  const orderMinTotal = input.trigger === "purchase" ? Number(input.orderMinTotal) : undefined;
  if (input.trigger === "purchase" && (!Number.isSafeInteger(orderMinTotal) || orderMinTotal! <= 0)) throw invalid("Ngưỡng tặng mã phải là số nguyên dương.");
  const discount = validateCouponInput({ ...input, code: "AUTO", startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + DAY).toISOString(), customerId: undefined, usageLimit: 1 });
  return { name, trigger: input.trigger as "birthday" | "purchase", orderMinTotal, enabled: input.enabled === true,
    discountType: discount.discountType, value: discount.value, minSubtotal: discount.minSubtotal, maxDiscount: discount.maxDiscount,
    validityDays, sendEmail: input.sendEmail === true };
}
export const RetailCouponAutomationService = {
  list(scope: RetailBranchScope) { return RetailCouponAutomationModel.find(scope).sort({ createdAt: -1 }).lean(); },
  async create(scope: RetailBranchScope, input: any, actorId: string) {
    const values = validateCouponAutomation(input);
    return RetailCouponAutomationModel.create({ ...scope, ...values, activatedAt: values.enabled ? new Date() : undefined, version: 0, createdBy: actorId, updatedBy: actorId });
  },
  async update(scope: RetailBranchScope, id: string, input: any, actorId: string) {
    if (!Types.ObjectId.isValid(id) || !Number.isSafeInteger(input.version)) throw invalid("Phiên bản chương trình không hợp lệ.");
    const values = validateCouponAutomation(input);
    const current = await RetailCouponAutomationModel.findOne({ _id: id, ...scope, version: input.version }).lean();
    if (!current) throw invalid("Chương trình đã thay đổi hoặc không tồn tại.", 409);
    if (current.trigger !== values.trigger) throw invalid("Không đổi hoạt động sau khi tạo. Hãy tạo chương trình mới.", 409);
    return RetailCouponAutomationModel.findOneAndUpdate({ _id: id, ...scope, version: input.version },
      { $set: { ...values, updatedBy: actorId, ...(values.enabled && !current.enabled ? { activatedAt: new Date() } : {}) }, $inc: { version: 1 } },
      { returnDocument: "after" });
  },
};

function vietnamDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}
export function birthdayWindow(dateOfBirth: Date, year: number, validityDays: number) {
  const { month, day } = vietnamDateParts(dateOfBirth);
  const normalizedDay = month === 2 && day === 29 && new Date(Date.UTC(year, 1, 29)).getUTCMonth() !== 1 ? 28 : day;
  const startsAt = new Date(`${year}-${String(month).padStart(2, "0")}-${String(normalizedDay).padStart(2, "0")}T00:00:00+07:00`);
  return { startsAt, endsAt: new Date(+startsAt + validityDays * DAY) };
}
function purchaseEligible(order: any, threshold: number) {
  return order.status === "completed" && order.paymentStatus === "paid" && order.dueAmount === 0 &&
    Number(order.grandTotal) - Number(order.refundedAmount || 0) >= threshold;
}
async function issueGift(scope: RetailBranchScope, program: any, customer: any, key: string, startsAt: Date, endsAt: Date, sourceOrderId?: string) {
  const code = `TD${createHash("sha256").update(key).digest("hex").slice(0, 24)}`.toUpperCase();
  try {
    const result = await RetailCouponModel.updateOne({ companyCode: scope.companyCode, issuanceKey: key }, { $setOnInsert: {
      ...scope, code, issuanceKey: key, name: program.name, source: program.trigger === "birthday" ? "birthday" : "purchase",
      customerId: String(customer._id), sourceOrderId, triggerThreshold: sourceOrderId ? program.orderMinTotal : undefined,
      discountType: program.discountType, value: program.value, minSubtotal: program.minSubtotal, maxDiscount: program.maxDiscount,
      usageLimit: 1, usedCount: 0, startsAt, endsAt, active: true, customerTierCodes: [],
      deliveryStatus: program.sendEmail ? "pending" : "skipped", deliveryError: program.sendEmail ? undefined : "Chương trình không gửi email.",
      version: 0, createdBy: "coupon-automation", updatedBy: "coupon-automation",
    } }, { upsert: true });
    return result.upsertedCount;
  } catch (error: any) {
    if (error?.code === 11000 && await RetailCouponModel.exists({ companyCode: scope.companyCode, issuanceKey: key })) return 0;
    throw error;
  }
}
export async function issueCouponAutomations(scope: RetailBranchScope, now = new Date(), customerId?: string) {
  if (!await BranchModel.exists({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true })) return 0;
  let issued = 0;
  const programs = await RetailCouponAutomationModel.find({ ...scope, enabled: true }).lean();
  for (const program of programs) {
    if (program.trigger === "birthday") {
      const customers = CustomerModel.find({ companyCode: scope.companyCode, status: "active", dateOfBirth: { $exists: true }, ...(customerId ? { _id: customerId } : {}) })
        .select("_id dateOfBirth").lean().cursor();
      try {
        for await (const customer of customers) {
          if (!customer.dateOfBirth) continue;
          for (const year of [vietnamDateParts(now).year - 1, vietnamDateParts(now).year]) {
            const window = birthdayWindow(customer.dateOfBirth, year, program.validityDays);
            if (window.startsAt <= now && window.endsAt > now) issued += await issueGift(scope, program, customer, `auto:${program._id}:birthday:${customer._id}:${year}`, window.startsAt, window.endsAt);
          }
        }
      } finally { await customers.close(); }
      continue;
    }
    if (!program.activatedAt) continue;
    const from = new Date(Math.max(+program.activatedAt, +now - program.validityDays * DAY));
    const orders = RetailOrderModel.find({ ...scope, status: "completed", paymentStatus: "paid", dueAmount: 0,
      customerId: customerId || { $type: "string" }, completedAt: { $gte: from, $lte: now } })
      .select("_id customerId status paymentStatus dueAmount grandTotal refundedAmount completedAt").lean().cursor();
    try {
      for await (const order of orders) {
        if (!purchaseEligible(order, program.orderMinTotal || 0) || !order.completedAt) continue;
        const customer = await CustomerModel.findOne({ _id: order.customerId, companyCode: scope.companyCode, status: "active" }).select("_id").lean();
        if (!customer) continue;
        const startsAt = order.completedAt;
        const endsAt = new Date(+startsAt + program.validityDays * DAY);
        if (endsAt > now) issued += await issueGift(scope, program, customer, `auto:${program._id}:order:${order._id}`, startsAt, endsAt, String(order._id));
      }
    } finally { await orders.close(); }
  }
  return issued;
}
export async function deliverPendingCouponEmails(now = new Date()) {
  let sent = 0;
  await RetailCouponModel.updateMany({ deliveryStatus: "sending", deliveryStartedAt: { $lt: new Date(+now - 30 * 60_000) } },
    { $set: { deliveryStatus: "failed", deliveryError: "Không xác nhận được kết quả gửi. Cần kiểm tra trước khi gửi lại." } });
  const candidates = RetailCouponModel.find({ deliveryStatus: "pending" }).sort({ createdAt: 1 }).limit(100).lean().cursor();
  try {
    for await (const candidate of candidates) {
      const coupon = await RetailCouponModel.findOneAndUpdate({ _id: candidate._id, deliveryStatus: "pending" },
        { $set: { deliveryStatus: "sending", deliveryStartedAt: now } }, { returnDocument: "after" }).lean();
      if (!coupon) continue;
      const finish = (status: "failed" | "skipped", error: string) => RetailCouponModel.updateOne({ _id: coupon._id, deliveryStatus: "sending" }, { $set: { deliveryStatus: status, deliveryError: error } });
      try {
        if (!coupon.active || coupon.usedCount > 0 || coupon.endsAt <= now) { await finish("skipped", "Mã không còn đủ điều kiện sử dụng."); continue; }
        const moduleState = await getModuleStateForCompany(coupon.companyCode);
        if (!moduleState.exists || !moduleState.modules?.includes("retail") || !await BranchModel.exists({ _id: coupon.branchId, companyCode: coupon.companyCode, isActive: true })) {
          await finish("skipped", "Chi nhánh hoặc phân hệ bán lẻ đã ngừng hoạt động."); continue;
        }
        try { await sourceEligible({ companyCode: coupon.companyCode, branchId: coupon.branchId }, coupon); }
        catch { await finish("skipped", "Đơn gốc không còn đủ điều kiện tặng mã."); continue; }
        const customer = await CustomerModel.findOne({ _id: coupon.customerId, companyCode: coupon.companyCode, status: "active" }).select("name email").lean();
        const email = customer?.email?.trim();
        if (!email || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) { await finish("skipped", "Khách chưa có email hợp lệ."); continue; }
        const smtp = await companyEmailService.getSmtp(coupon.companyCode);
        if (!smtp?.hasPassword) { await finish("failed", "Công ty chưa cấu hình SMTP."); continue; }
        const result = await companyEmailService.send(coupon.companyCode, {
          to: email, subject: `Mã ưu đãi dành cho bạn: ${coupon.code}`,
          text: `Xin chào ${customer.name},\n\nBạn được tặng mã ưu đãi ${coupon.code} (${coupon.name}). Mã dùng một lần trước ${coupon.endsAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.\n\nTrân trọng.`,
        });
        await RetailCouponModel.updateOne({ _id: coupon._id, deliveryStatus: "sending" }, { $set: { deliveryStatus: "sent", deliverySentAt: new Date(), deliveryMessageId: result.messageId } });
        sent++;
      } catch { await finish("failed", "Không xác nhận được kết quả gửi. Cần kiểm tra trước khi gửi lại."); }
    }
  } finally { await candidates.close(); }
  return sent;
}
export async function runRetailCouponAutomationScan(now = new Date()) {
  const scopes = await RetailCouponAutomationModel.aggregate<{ _id: RetailBranchScope }>([
    { $match: { enabled: true } }, { $group: { _id: { companyCode: "$companyCode", branchId: "$branchId" } } },
  ]);
  for (const { _id: scope } of scopes) {
    try {
      const state = await getModuleStateForCompany(scope.companyCode);
      if (state.exists && state.modules?.includes("retail")) await issueCouponAutomations(scope, now);
    } catch (error) { console.error("[retail-coupon-automation]", scope, error); }
  }
  await deliverPendingCouponEmails(now);
}
export function startRetailCouponAutomationScheduler(intervalMs = 10 * 60_000) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runRetailCouponAutomationScan(); }
    catch (error) { console.error("[retail-coupon-automation]", error); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
