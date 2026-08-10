import type { RetailOrderInput } from "../types";
import type { RetailCartState } from "./retailCart";

export function buildRetailOrderInput(cart: RetailCartState): RetailOrderInput {
  return {
    items: cart.lines.map((line) => ({ productId: line.product._id, quantity: line.quantity, discount: line.discount })),
    ...(cart.customer ? { customerId: cart.customer._id } : {}),
    orderDiscount: cart.orderDiscount,
    taxRate: cart.taxRate,
    shippingFee: cart.shippingFee,
  };
}
