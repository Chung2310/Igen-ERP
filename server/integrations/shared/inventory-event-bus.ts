import type { InventoryMovementDirection, InventoryMovementPurpose } from "../../interface/inventory.interface";

export interface InventoryMovementEvent {
  companyCode: string;
  branchId: string;
  warehouseId: string;
  productId: string;
  variantId?: string;
  direction: InventoryMovementDirection;
  purpose: InventoryMovementPurpose;
  quantity: number;
  quantityDelta: number;
  sourceType: string;
  sourceId: string;
  sourceCode?: string;
  idempotencyKey: string;
  createdAt: Date;
}

export type InventoryEventHandler = (event: InventoryMovementEvent) => void | Promise<void>;

/**
 * Bus nội bộ cho các module cần phản ứng sau biến động tồn.
 * Không dùng bus này để thay thế giao dịch Mongo; caller chỉ phát sự kiện sau khi transaction đã commit.
 */
class InventoryEventBus {
  private readonly handlers = new Set<InventoryEventHandler>();

  subscribe(handler: InventoryEventHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  async publish(event: InventoryMovementEvent) {
    await Promise.all(Array.from(this.handlers, (handler) => handler(event)));
  }
}

export const inventoryEventBus = new InventoryEventBus();
