import type { ClientSession } from "mongoose";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";
import type { RetailBranchScope } from "../contracts";
import type { RetailOrderItem } from "../interfaces/retail-order.interface";

export async function applyOrderStockOut(scope: RetailBranchScope, orderId: string, orderCode: string, items: RetailOrderItem[], operatorName: string, allowNegativeStock: boolean, session: ClientSession) {
  await writeStockMovement({
    ...scope,
    direction: "out",
    purpose: "sale",
    sourceType: "retail-order",
    sourceId: orderId,
    sourceCode: orderCode,
    idempotencyKey: `order:${orderId}:out`,
    operatorName,
    items: items.map((item) => ({ ...item, legacyProductId: item.productId })),
    allowNegativeStock,
    reason: `Đơn bán lẻ ${orderCode}`,
    session,
  });
}

export async function revertOrderStock(scope: RetailBranchScope, orderId: string, orderCode: string, items: RetailOrderItem[], operatorName: string, session: ClientSession) {
  await writeStockMovement({
    ...scope,
    direction: "in",
    purpose: "cancel",
    sourceType: "retail-order",
    sourceId: orderId,
    sourceCode: orderCode,
    idempotencyKey: `order:${orderId}:revert`,
    operatorName,
    items: items.map((item) => ({ ...item, legacyProductId: item.productId })),
    reason: `Hủy đơn bán lẻ ${orderCode}`,
    session,
  });
}
