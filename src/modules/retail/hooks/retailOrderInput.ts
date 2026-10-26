import type { RetailOrderInput } from "../types";
import type { RetailCartState } from "./retailCart";

export function buildRetailOrderInput(cart: RetailCartState): RetailOrderInput {
  return {
    note: cart.note || "", installment: cart.installment || null,
    ...(cart.couponCode ? { couponCode: cart.couponCode } : {}),
    ...(cart.collaboratorId !== undefined ? { collaboratorId: cart.collaboratorId } : {}),
    items: cart.lines.map((line) => ({ productId: line.product._id, quantity: line.quantity, discount: line.discount, trackingMode: line.product.trackingMode, serialNumbers: line.serialNumbers, internalBarcodes: line.internalBarcodes })),
    ...(cart.customer ? { customerId: cart.customer._id } : {}),
    ...(cart.billingProfile ? { billingProfileId: cart.billingProfile._id } : {}),
    orderDiscount: cart.orderDiscount,
    ...(cart.pointsToRedeem ? { pointsToRedeem: cart.pointsToRedeem } : {}),
    taxRate: cart.taxRate,
    shippingFee: cart.shippingFee,
  };
}
