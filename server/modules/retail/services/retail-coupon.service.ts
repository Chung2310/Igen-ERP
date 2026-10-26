import { Types, type ClientSession } from "mongoose";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { getCustomerTiers } from "../../customer-management/contracts";
import type { RetailBranchScope } from "../contracts";
import { RetailCouponModel } from "../models/retail-coupon.model";
import { RetailOrderModel } from "../models/retail-order.model";

const invalid = (message: string, status = 400) => Object.assign(new Error(message), { status });
export function normalizeCouponCode(value: unknown) {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw invalid("Mã ưu đãi gồm 3–32 chữ cái, chữ số, dấu gạch ngang hoặc gạch dưới.");
  return code;
}
const money = (value: unknown, name: string, positive = false) => {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < (positive ? 1 : 0)) throw invalid(`${name} phải là số nguyên ${positive ? "dương" : "không âm"}.`);
  return amount;
};
export function validateCouponInput(input: any) {
  const code = normalizeCouponCode(input.code);
  const name = String(input.name || "").trim();
  if (!name || name.length > 120) throw invalid("Tên ưu đãi phải có từ 1 đến 120 ký tự.");
  if (!["amount", "percent"].includes(input.discountType)) throw invalid("Loại giảm giá không hợp lệ.");
  const value = input.discountType === "amount" ? money(input.value, "Số tiền giảm", true) : Number(input.value);
  if (input.discountType === "percent" && (!Number.isFinite(value) || value <= 0 || value > 100 || Math.round(value * 100) !== value * 100)) throw invalid("Phần trăm giảm phải từ 0 đến 100, tối đa 2 chữ số thập phân.");
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (!Number.isFinite(+startsAt) || !Number.isFinite(+endsAt) || endsAt <= startsAt) throw invalid("Thời gian kết thúc phải sau thời gian bắt đầu.");
  const customerId = input.customerId ? String(input.customerId) : undefined;
  if (customerId && !Types.ObjectId.isValid(customerId)) throw invalid("Khách hàng nhận mã không hợp lệ.");
  const customerTierCodes = input.customerTierCodes ?? [];
  if (!Array.isArray(customerTierCodes) || customerTierCodes.length > 10 || customerTierCodes.some((code) => typeof code !== "string" || !/^[a-z0-9-]{1,30}$/.test(code))) throw invalid("Danh sách hạng khách hàng không hợp lệ.");
  const usageLimit = input.usageLimit == null || input.usageLimit === "" ? undefined : money(input.usageLimit, "Giới hạn lượt dùng", true);
  if (customerId && usageLimit !== undefined && usageLimit !== 1) throw invalid("Mã dành riêng cho khách chỉ được dùng một lần.");
  return {
    code, name, discountType: input.discountType as "amount" | "percent", value,
    minSubtotal: money(input.minSubtotal ?? 0, "Đơn tối thiểu"),
    maxDiscount: input.maxDiscount == null || input.maxDiscount === "" ? undefined : money(input.maxDiscount, "Giảm tối đa", true),
    usageLimit: customerId ? 1 : usageLimit,
    startsAt, endsAt, active: input.active !== false, customerId,
    customerTierCodes: [...new Set<string>(customerTierCodes)],
  };
}
export function couponDiscount(coupon: any, subtotal: number, now = new Date()) {
  money(subtotal, "Giá trị đơn");
  if (!coupon.active) throw invalid("Mã ưu đãi đang tạm dừng.", 409);
  if (now < new Date(coupon.startsAt)) throw invalid("Mã ưu đãi chưa đến thời gian áp dụng.", 409);
  if (now >= new Date(coupon.endsAt)) throw invalid("Mã ưu đãi đã hết hạn.", 409);
  if (coupon.usageLimit !== undefined && coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) throw invalid("Mã ưu đãi đã hết lượt dùng.", 409);
  if (subtotal < coupon.minSubtotal) throw invalid(`Đơn tối thiểu để dùng mã là ${coupon.minSubtotal.toLocaleString("vi-VN")} ₫.`, 409);
  const calculated = coupon.discountType === "percent" ? Math.round(subtotal * coupon.value / 100) : coupon.value;
  return Math.min(subtotal, calculated, coupon.maxDiscount ?? subtotal);
}
export async function sourceEligible(scope: RetailBranchScope, coupon: any, session?: ClientSession) {
  if (!coupon.sourceOrderId) return;
  const order = await RetailOrderModel.findOne({ _id: coupon.sourceOrderId, ...scope, customerId: coupon.customerId }).session(session ?? null).lean();
  if (!order || order.status !== "completed" || order.paymentStatus !== "paid" || order.dueAmount !== 0 ||
    Number(order.grandTotal) - Number(order.refundedAmount || 0) < Number(coupon.triggerThreshold || 0)) {
    throw invalid("Đơn hàng được tặng mã đã hủy, hoàn tiền hoặc không còn đủ điều kiện.", 409);
  }
}
export async function resolveCoupon(scope: RetailBranchScope, code: string, subtotal: number, customerId?: string, session?: ClientSession) {
  const coupon = await RetailCouponModel.findOne({ ...scope, code: normalizeCouponCode(code) }).session(session ?? null).lean();
  if (!coupon) throw invalid("Không tìm thấy mã ưu đãi tại chi nhánh này.", 404);
  if (coupon.customerId && coupon.customerId !== customerId) throw invalid("Mã ưu đãi chỉ dành cho khách hàng được tặng mã.", 403);
  if (coupon.customerTierCodes.length || coupon.customerId) {
    if (!customerId) throw invalid("Vui lòng chọn khách hàng để sử dụng mã ưu đãi.");
    const customer = await CustomerModel.findOne({ _id: customerId, companyCode: scope.companyCode, status: "active" }).session(session ?? null).lean();
    if (!customer) throw invalid("Khách hàng không tồn tại hoặc đã ngừng hoạt động.");
    if (coupon.customerTierCodes.length && !coupon.customerTierCodes.includes(customer.tier?.code || "")) throw invalid("Hạng khách hàng không thuộc đối tượng áp dụng mã.", 403);
  }
  await sourceEligible(scope, coupon, session);
  return { id: String(coupon._id), code: coupon.code, name: coupon.name, amount: couponDiscount(coupon, subtotal), version: coupon.version };
}
export async function consumeCoupon(scope: RetailBranchScope, snapshot: { id: string; version: number }, customerId: string | undefined, session: ClientSession) {
  const coupon = await RetailCouponModel.findOne({ _id: snapshot.id, ...scope }).session(session).lean();
  if (!coupon) throw invalid("Mã ưu đãi không còn tồn tại.", 409);
  await sourceEligible(scope, coupon, session);
  const now = new Date();
  const result = await RetailCouponModel.updateOne({
    _id: snapshot.id, ...scope, version: snapshot.version, active: true,
    startsAt: { $lte: now }, endsAt: { $gt: now },
    customerId: coupon.customerId ? customerId : { $exists: false },
    $or: [{ usageLimit: { $exists: false } }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
  }, { $inc: { usedCount: 1 } }, { session });
  if (result.modifiedCount !== 1) throw invalid("Mã ưu đãi đã thay đổi hoặc hết lượt. Vui lòng kiểm tra lại đơn.", 409);
}
export async function releaseCoupon(scope: RetailBranchScope, id: string, session: ClientSession) {
  await RetailCouponModel.updateOne({ _id: id, ...scope, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
}
export const RetailCouponService = {
  async list(scope: RetailBranchScope) { return RetailCouponModel.find(scope).sort({ createdAt: -1 }).limit(200).lean(); },
  async available(scope: RetailBranchScope, customerId: string) {
    const now = new Date();
    const [customer, coupons] = await Promise.all([
      customerId && Types.ObjectId.isValid(customerId) ? CustomerModel.findOne({ _id: customerId, companyCode: scope.companyCode, status: "active" }).select("tier").lean() : null,
      RetailCouponModel.find({ ...scope, active: true, startsAt: { $lte: now }, endsAt: { $gt: now },
        $or: [{ customerId }, { customerId: { $exists: false } }] }).sort({ endsAt: 1 }).limit(100).lean(),
    ]);
    const eligible = await Promise.all(coupons.map(async (coupon) => {
      if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return false;
      if (coupon.customerId && !customer) return false;
      if (coupon.customerTierCodes.length && (!customer || !coupon.customerTierCodes.includes(customer.tier?.code || ""))) return false;
      try { await sourceEligible(scope, coupon); return true; } catch { return false; }
    }));
    return coupons.filter((_, index) => eligible[index]);
  },
  async create(scope: RetailBranchScope, input: any, actorId: string) {
    const values = validateCouponInput(input);
    if (values.customerId && !await CustomerModel.exists({ _id: values.customerId, companyCode: scope.companyCode, status: "active" })) throw invalid("Khách hàng nhận mã không tồn tại hoặc đã ngừng hoạt động.");
    const tiers = await getCustomerTiers(scope.companyCode);
    if (values.customerTierCodes.some((code) => !tiers.some((tier) => tier.code === code))) throw invalid("Hạng khách hàng đã chọn không tồn tại.");
    return RetailCouponModel.create({ ...scope, ...values, source: "manual", usedCount: 0, version: 0, createdBy: actorId, updatedBy: actorId });
  },
  async update(scope: RetailBranchScope, id: string, input: any, actorId: string) {
    if (!Types.ObjectId.isValid(id) || !Number.isSafeInteger(input.version)) throw invalid("Phiên bản mã ưu đãi không hợp lệ.");
    const values = validateCouponInput(input);
    const current = await RetailCouponModel.findOne({ _id: id, ...scope, version: input.version }).lean();
    if (!current) throw invalid("Mã ưu đãi đã thay đổi hoặc không tồn tại.", 409);
    if (current.source !== "manual" || current.code !== values.code || current.customerId !== values.customerId) throw invalid("Không đổi mã hoặc khách hàng nhận sau khi tạo.", 409);
    if (values.usageLimit !== undefined && values.usageLimit < current.usedCount) throw invalid("Giới hạn mới thấp hơn số lượt đã dùng.");
    return RetailCouponModel.findOneAndUpdate({ _id: id, ...scope, version: input.version }, { $set: { ...values, updatedBy: actorId }, $inc: { version: 1 } }, { returnDocument: "after" });
  },
};
