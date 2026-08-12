import assert from "node:assert/strict";
import test from "node:test";
import { inventoryEventBus } from "./inventory-event-bus";

test("inventory event bus unsubscribes handlers cleanly", async () => {
  const received: string[] = [];
  const unsubscribe = inventoryEventBus.subscribe((event) => { received.push(event.sourceId); });
  await inventoryEventBus.publish({
    companyCode: "ACME",
    branchId: "branch-1",
    warehouseId: "warehouse-1",
    productId: "product-1",
    direction: "out",
    purpose: "sale",
    quantity: 1,
    quantityDelta: -1,
    sourceType: "retail-order",
    sourceId: "order-1",
    idempotencyKey: "order-1:out",
    createdAt: new Date(),
  });
  unsubscribe();
  await inventoryEventBus.publish({
    companyCode: "ACME",
    branchId: "branch-1",
    warehouseId: "warehouse-1",
    productId: "product-1",
    direction: "in",
    purpose: "cancel",
    quantity: 1,
    quantityDelta: 1,
    sourceType: "retail-order",
    sourceId: "order-1",
    idempotencyKey: "order-1:revert",
    createdAt: new Date(),
  });
  assert.deepEqual(received, ["order-1"]);
});
