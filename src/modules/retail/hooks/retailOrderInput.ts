import type { RetailOrderInput } from "../types";
import type { RetailCartState } from "./retailCart";

export function buildRetailOrderInput(cart: RetailCartState): RetailOrderInput {
  return {
    items: cart.lines.map((line) => ({ productId: line.product._id, quantity: line.quantity, discount: line.discount, trackingMode: line.product.trackingMode, serialNumbers: line.serialNumbers, internalBarcodes: line.internalBarcodes })),
    ...(cart.customer ? { customerId: cart.customer._id } : {}),
    ...(cart.billingProfile ? { billingProfileId: cart.billingProfile._id } : {}),
    orderDiscount: cart.orderDiscount,
    couponCode: cart.couponCode || undefined,
    pointsToRedeem: cart.pointsToRedeem || undefined,
    ...(cart.note ? { note: cart.note } : {}),
    ...(cart.installment ? { installment: cart.installment } : {}),
    taxRate: cart.taxRate,
    shippingFee: cart.shippingFee,
  };
}
