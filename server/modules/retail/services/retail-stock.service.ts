import type { ClientSession } from "mongoose";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";
import type { RetailBranchScope } from "../contracts";
import type { RetailOrderItem } from "../interfaces/retail-order.interface";
import { ProductVariantModel } from "../../../model/product-variant.model";

export async function applyOrderStockOut(scope: RetailBranchScope, orderId: string, orderCode: string, items: RetailOrderItem[], operatorName: string, allowNegativeStock: boolean, session: ClientSession) {
  const variantIds = items.map((item) => String(item.productId));
  const variants = await ProductVariantModel.find({ _id: { $in: variantIds } }).session(session).lean();
  const variantMap = new Map(variants.map((v: any) => [String(v._id), v]));

  const mappedItems = items.map((item) => {
    const variant: any = variantMap.get(String(item.productId));
    return {
      ...item,
      productId: variant ? String(variant.productId) : item.productId,
      variantId: variant ? String(variant._id) : item.productId,
      legacyProductId: item.productId,
    };
  });

  await writeStockMovement({
    ...scope,
    direction: "out",
    purpose: "sale",
    sourceType: "retail-order",
    sourceId: orderId,
    sourceCode: orderCode,
    idempotencyKey: `order:${orderId}:out`,
    operatorName,
    items: mappedItems,
    allowNegativeStock,
    reason: `Đơn bán lẻ ${orderCode}`,
    session,
  });
}

export async function revertOrderStock(scope: RetailBranchScope, orderId: string, orderCode: string, items: RetailOrderItem[], operatorName: string, session: ClientSession) {
  const variantIds = items.map((item) => String(item.productId));
  const variants = await ProductVariantModel.find({ _id: { $in: variantIds } }).session(session).lean();
  const variantMap = new Map(variants.map((v: any) => [String(v._id), v]));

  const mappedItems = items.map((item) => {
    const variant: any = variantMap.get(String(item.productId));
    return {
      ...item,
      productId: variant ? String(variant.productId) : item.productId,
      variantId: variant ? String(variant._id) : item.productId,
      legacyProductId: item.productId,
    };
  });

  await writeStockMovement({
    ...scope,
    direction: "in",
    purpose: "cancel",
    sourceType: "retail-order",
    sourceId: orderId,
    sourceCode: orderCode,
    idempotencyKey: `order:${orderId}:revert`,
    operatorName,
    items: mappedItems,
    reason: `Hủy đơn bán lẻ ${orderCode}`,
    session,
  });
}

