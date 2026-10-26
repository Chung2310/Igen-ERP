import type { ClientSession } from "mongoose";
import { RetailOrderModel } from "../models/retail-order.model";

/** The reward threshold uses the paid order total less refunds, including tax/shipping. */
export function isCouponRewardOrder(order: any, minimum: number) {
  return Boolean(order && order.status === "completed" && order.paymentStatus === "paid" && order.dueAmount === 0
    && Number.isSafeInteger(minimum) && minimum > 0
    && Number(order.grandTotal) - Number(order.refundedAmount || 0) >= minimum);
}
export async function assertCouponRewardSource(scope: { companyCode: string; branchId: string }, coupon: any, session?: ClientSession) {
  if (!coupon?.sourceOrderId) return;
  const order = await RetailOrderModel.findOne({ _id: coupon.sourceOrderId, ...scope, customerId: coupon.customerId }).session(session ?? null).lean();
  if (!isCouponRewardOrder(order, coupon.triggerThreshold)) throw Object.assign(new Error("Đơn hàng được tặng mã đã hủy, hoàn tiền hoặc không còn đủ điều kiện."), { code: "COUPON_SOURCE_INELIGIBLE" });
}
