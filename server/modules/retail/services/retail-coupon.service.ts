import { assertCouponRewardSource } from "./retail-coupon-eligibility";
import type { ClientSession } from "mongoose";
import { Types } from "mongoose";
import type { RetailBranchScope } from "../contracts";
import { RetailCouponModel } from "../models/retail-coupon.model";

import { getPromotionCustomer, getCustomerTierForPromotion, getCustomerTiers } from "../../customer-management/contracts";

export function normalizeCouponCode(value: unknown) {
  if (typeof value !== "string") throw new Error("Mã ưu đãi không hợp lệ.");
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new Error("Mã gồm 3–32 chữ cái, chữ số, dấu gạch ngang hoặc gạch dưới.");
  return code;
}
function money(value: unknown, label: string, positive = false) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (positive ? 1 : 0)) throw new Error(`${label} phải là số nguyên ${positive ? "dương" : "không âm"}.`);
  return value;
}
export function validateCouponInput(input: any) {
  const customerId = input.customerId == null ? null : input.customerId;
  if (customerId !== null && (typeof customerId !== "string" || !Types.ObjectId.isValid(customerId))) throw new Error("Khách hàng nhận mã không hợp lệ.");
  if (customerId && input.usageLimit != null && input.usageLimit !== 1) throw new Error("Mã dành riêng cho khách chỉ được dùng một lần.");
  const tiers = input.customerTierCodes === undefined ? [] : input.customerTierCodes;
  if (!Array.isArray(tiers) || tiers.length > 10 || tiers.some((code) => typeof code !== "string" || !/^[a-z0-9-]{1,30}$/.test(code))) throw new Error("Danh sách hạng khách hàng không hợp lệ.");
  const customerTierCodes = [...new Set<string>(tiers)];
  const code = normalizeCouponCode(input.code);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120) throw new Error("Tên ưu đãi phải có từ 1 đến 120 ký tự.");
  if (!["amount", "percent"].includes(input.discountType)) throw new Error("Loại giảm giá không hợp lệ.");
  const value = input.discountType === "amount" ? money(input.value, "Số tiền giảm", true) : input.value;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || (input.discountType === "percent" && (value > 100 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-8))) throw new Error("Phần trăm giảm phải lớn hơn 0, không quá 100 và tối đa 2 chữ số thập phân.");
  const startsAt = typeof input.startsAt === "string" ? new Date(input.startsAt) : new Date(NaN);
  const endsAt = typeof input.endsAt === "string" ? new Date(input.endsAt) : new Date(NaN);
  if (!Number.isFinite(+startsAt) || !Number.isFinite(+endsAt) || endsAt <= startsAt) throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu.");
  if (typeof input.active !== "boolean") throw new Error("Trạng thái ưu đãi không hợp lệ.");
  return { code, name, customerId, customerTierCodes, discountType: input.discountType as "amount" | "percent", value, startsAt, endsAt, active: input.active,
    minSubtotal: money(input.minSubtotal ?? 0, "Đơn tối thiểu"),
    maxDiscount: input.maxDiscount == null ? null : money(input.maxDiscount, "Giảm tối đa", true),
    usageLimit: customerId ? 1 : input.usageLimit == null ? null : money(input.usageLimit, "Giới hạn lượt dùng", true) };
}
export function couponDiscount(coupon: any, subtotal: number, now = new Date()) {
  money(subtotal, "Giá trị đơn");
  if (!coupon.active) throw new Error("Mã ưu đãi đang tạm dừng.");
  if (now < new Date(coupon.startsAt)) throw new Error("Mã ưu đãi chưa đến thời gian áp dụng.");
  if (now >= new Date(coupon.endsAt)) throw new Error("Mã ưu đãi đã hết hạn.");
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) throw new Error("Mã ưu đãi đã hết lượt dùng.");
  if (subtotal < coupon.minSubtotal) throw new Error(`Đơn tối thiểu để dùng mã là ${coupon.minSubtotal.toLocaleString("vi-VN")} ₫.`);
  const amount = coupon.discountType === "percent" ? Math.round(subtotal * coupon.value / 100) : coupon.value;
  return Math.min(subtotal, amount, coupon.maxDiscount ?? subtotal);
}
async function validateConfiguredTiers(companyCode: string, codes: string[]) {
  if (!codes.length) return;
  const tiers = await getCustomerTiers(companyCode);
  if (codes.some((code) => !tiers.some((tier) => tier.code === code))) throw new Error("Hạng khách hàng đã chọn không còn tồn tại trong cài đặt khách hàng.");
}
export async function resolveCoupon(scope: RetailBranchScope, code: unknown, subtotal: number, session?: ClientSession, customerId?: unknown) {
  const coupon = await RetailCouponModel.findOne({ ...scope, code: normalizeCouponCode(code) }).session(session ?? null).lean();
  if (!coupon) throw new Error("Không tìm thấy mã ưu đãi tại chi nhánh này.");
  if (coupon.customerId) {
    if (String(customerId || "") !== coupon.customerId) throw new Error("Mã ưu đãi này chỉ dành cho khách hàng được tặng mã.");
    if (!await getPromotionCustomer(scope.companyCode, customerId, session)) throw new Error("Khách hàng nhận mã không tồn tại hoặc đã ngừng hoạt động.");
  }
  await assertCouponRewardSource(scope, coupon, session);
  const amount = couponDiscount(coupon, subtotal);
  if (coupon.customerTierCodes?.length) {
    if (!customerId) throw new Error("Vui lòng chọn khách hàng để sử dụng mã ưu đãi theo hạng.");
    await validateConfiguredTiers(scope.companyCode, coupon.customerTierCodes);
    const tierCode = await getCustomerTierForPromotion(scope.companyCode, customerId, session);
    if (!tierCode || !coupon.customerTierCodes.includes(tierCode)) throw new Error("Hạng khách hàng không thuộc đối tượng áp dụng mã ưu đãi này.");
  }
  return { id: String(coupon._id), code: coupon.code, name: coupon.name, amount, version: coupon.version };
}
export async function consumeCoupon(scope: RetailBranchScope, snapshot: { id: string; version: number }, session: ClientSession, customerId?: string) {
  const coupon = await RetailCouponModel.findOne({ _id: snapshot.id, ...scope }).session(session).lean();
  await assertCouponRewardSource(scope, coupon, session);
  const now = new Date();
  const result = await RetailCouponModel.updateOne({ _id: snapshot.id, ...scope, version: snapshot.version, active: true,
    startsAt: { $lte: now }, endsAt: { $gt: now },
    customerId: { $in: [null, ...(customerId ? [customerId] : [])] },
    $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
  }, { $inc: { usedCount: 1 } }, { session });
  if (result.modifiedCount !== 1) throw new Error("Mã ưu đãi đã thay đổi hoặc hết lượt. Vui lòng kiểm tra lại đơn.");
}
export async function releaseCoupon(scope: RetailBranchScope, id: string, session: ClientSession) {
  await RetailCouponModel.updateOne({ _id: id, ...scope, customerId: null, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
}
export const retailCouponService = {
  async selectable(scope: RetailBranchScope, customerId?: unknown) {
    const customer = customerId ? await getPromotionCustomer(scope.companyCode, customerId) : null;
    if (customerId && !customer) throw new Error("Khách hàng không tồn tại hoặc đã ngừng hoạt động.");
    const now = new Date();
    const coupons = await RetailCouponModel.find({
      ...scope,
      active: true,
      startsAt: { $lte: now },
      endsAt: { $gt: now },
      customerId: { $in: [null, ...(customer ? [String(customer._id)] : [])] },
    }).sort({ endsAt: 1 }).lean();
    const available = [];
    for (const coupon of coupons) {
      if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) continue;
      if (coupon.customerTierCodes?.length && (!customer?.tier?.code || !coupon.customerTierCodes.includes(customer.tier.code))) continue;
      try {
        await assertCouponRewardSource(scope, coupon);
        available.push({
          _id: coupon._id, code: coupon.code, name: coupon.name,
          discountType: coupon.discountType, value: coupon.value,
          minSubtotal: coupon.minSubtotal, maxDiscount: coupon.maxDiscount,
          customerId: coupon.customerId, customerTierCodes: coupon.customerTierCodes,
        });
      } catch (error) { if ((error as { code?: string }).code !== "COUPON_SOURCE_INELIGIBLE") throw error; }
    }
    return available;
  },
  async available(scope: RetailBranchScope, customerId: unknown) {
    const customer = await getPromotionCustomer(scope.companyCode, customerId);
    if (!customer) throw new Error("Khách hàng không tồn tại hoặc đã ngừng hoạt động.");
    const now = new Date();
    const coupons = await RetailCouponModel.find({ ...scope, customerId: String(customer._id), active: true,
      startsAt: { $lte: now }, endsAt: { $gt: now }, usedCount: 0,
      $or: [{ customerTierCodes: { $size: 0 } }, { customerTierCodes: customer.tier?.code }],
    }).sort({ endsAt: 1 }).limit(50).lean();
    const available = [];
    for (const coupon of coupons) {
      try { await assertCouponRewardSource(scope, coupon); available.push(coupon); }
      catch (error) { if ((error as { code?: string }).code !== "COUPON_SOURCE_INELIGIBLE") throw error; }
    }
    return available;
  },
  async tiers(scope: RetailBranchScope) {
    return (await getCustomerTiers(scope.companyCode)).map(({ code, name }) => ({ code, name }));
  },
  async list(scope: RetailBranchScope, pageInput: unknown = 1) {
    const page = Math.max(1, Math.floor(Number(pageInput) || 1));
    const [items, total] = await Promise.all([RetailCouponModel.find(scope).sort({ createdAt: -1 }).skip((page - 1) * 20).limit(20).lean(), RetailCouponModel.countDocuments(scope)]);
    return { items, total, page, limit: 20 };
  },
  async create(scope: RetailBranchScope, input: any, actor: string) {
    const values = validateCouponInput(input);
    await validateConfiguredTiers(scope.companyCode, values.customerTierCodes);
    const customer = values.customerId ? await getPromotionCustomer(scope.companyCode, values.customerId) : null;
    if (values.customerId && !customer) throw new Error("Khách hàng nhận mã không tồn tại hoặc đã ngừng hoạt động.");
    return RetailCouponModel.create({ ...values, ...scope, customerName: customer?.name, customerCode: customer?.customerCode, createdBy: actor, updatedBy: actor });
  },
  async update(scope: RetailBranchScope, id: string, input: any, actor: string) {
    if (!Types.ObjectId.isValid(id) || !Number.isSafeInteger(input.version) || input.version < 0) throw new Error("Phiên bản mã ưu đãi không hợp lệ.");
    const values = validateCouponInput(input);
    await validateConfiguredTiers(scope.companyCode, values.customerTierCodes);
    const result = await RetailCouponModel.findOneAndUpdate({ _id: id, ...scope, code: values.code, customerId: values.customerId, version: input.version,
      ...(values.usageLimit == null ? {} : { usedCount: { $lte: values.usageLimit } }),
    }, { $set: { ...values, updatedBy: actor }, $inc: { version: 1 } }, { returnDocument: "after" });
    if (!result) throw Object.assign(new Error("Mã đã thay đổi, không tồn tại hoặc giới hạn mới thấp hơn số lượt đã dùng. Không được đổi mã hoặc khách hàng nhận mã sau khi tạo."), { status: 409 });
    return result;
  },
};
