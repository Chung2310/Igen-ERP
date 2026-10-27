import { RetailCouponModel } from "../models/retail-coupon.model";
import { BranchModel } from "../../../model/branch.model";
import { companyEmailService } from "../../../service/company-email.service";
import { getModuleStateForCompany } from "../../../middleware/require-module";
import { getPromotionCustomer } from "../../customer-management/contracts";
import { assertCouponRewardSource } from "./retail-coupon-eligibility";

export function couponEmailText(coupon: any) {
  const money = (value: number) => value.toLocaleString("vi-VN") + " ₫";
  return [
    `Xin chào ${coupon.customerName || "quý khách"},`,
    `Bạn được tặng ưu đãi: ${coupon.name}.`,
    `Mã giảm giá: ${coupon.code}`,
    `Mức giảm: ${coupon.discountType === "percent" ? coupon.value + "%" : money(coupon.value)}.`,
    `Đơn tối thiểu: ${money(coupon.minSubtotal || 0)}.`,
    ...(coupon.maxDiscount != null ? [`Giảm tối đa: ${money(coupon.maxDiscount)}.`] : []),
    `Sử dụng trước ${new Date(coupon.endsAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (giờ Việt Nam).`,
    "Mã chỉ dùng một lần, dành riêng cho bạn tại chi nhánh đã tặng mã. Vui lòng cung cấp mã khi mua hàng.",
    ...(coupon.sourceOrderId ? ["Mã không còn áp dụng nếu đơn được tặng quà bị hủy hoặc hoàn tiền xuống dưới mức yêu cầu."] : []),
  ].join("\n\n");
}

/** Claim before SMTP: ambiguous failures are not automatically resent, avoiding duplicate customer mail. */
export async function deliverPendingCouponEmails(now = new Date()) {
  let sent = 0;
  const candidates = RetailCouponModel.find({ "emailDelivery.status": "pending" }).sort({ createdAt: 1 }).lean().cursor();
  try {
    for await (const candidate of candidates) {
      const scope = { companyCode: candidate.companyCode, branchId: candidate.branchId };
      try {
        const state = await getModuleStateForCompany(scope.companyCode);
        if (!state.exists || !state.modules?.includes("retail")) continue;
        if (!await BranchModel.exists({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true })) continue;
        const coupon = await RetailCouponModel.findOneAndUpdate({ _id: candidate._id, ...scope, "emailDelivery.status": "pending" },
          { $set: { "emailDelivery.status": "sending", "emailDelivery.startedAt": now } }, { returnDocument: "after" }).lean();
        if (!coupon) continue;
        const finish = (status: "skipped" | "failed", reason: string) => RetailCouponModel.updateOne({ _id: coupon._id, "emailDelivery.status": "sending" }, { $set: { "emailDelivery.status": status, "emailDelivery.reason": reason } });
        if (!coupon.active || coupon.usedCount > 0 || coupon.endsAt <= now || coupon.startsAt > now) {
          await finish("skipped", "Mã không còn đủ điều kiện sử dụng."); continue;
        }
        try { await assertCouponRewardSource(scope, coupon); }
        catch (error: any) {
          if (error.code !== "COUPON_SOURCE_INELIGIBLE") throw error;
          await finish("skipped", "Đơn gốc không còn đủ điều kiện tặng mã."); continue;
        }
        const customer = await getPromotionCustomer(scope.companyCode, coupon.customerId);
        const email = customer?.email?.trim();
        if (!email || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) {
          await finish("skipped", "Khách chưa có email hợp lệ hoặc đã ngừng hoạt động."); continue;
        }
        const smtp = await companyEmailService.getSmtp(scope.companyCode);
        if (!smtp?.hasPassword) { await finish("failed", "Công ty chưa cấu hình SMTP."); continue; }
        let result: { messageId: string };
        try {
          result = await companyEmailService.send(scope.companyCode, { to: email, subject: `Mã ưu đãi dành riêng cho bạn: ${coupon.code}`, text: couponEmailText(coupon) });
        } catch {
          await finish("failed", "Không xác nhận được kết quả gửi. Kiểm tra dịch vụ email trước khi gửi lại."); continue;
        }
        // A database failure after SMTP acceptance leaves 'sending'; never blindly retry it.
        await RetailCouponModel.updateOne({ _id: coupon._id, "emailDelivery.status": "sending" }, { $set: { "emailDelivery.status": "sent", "emailDelivery.sentAt": new Date(), "emailDelivery.messageId": result.messageId } });
        sent++;
      } catch (error) { console.error("[coupon-email]", String(candidate._id), error); }
    }
  } finally { await candidates.close(); }
  return sent;
}
