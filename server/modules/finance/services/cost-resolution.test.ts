import { describe, it, expect } from "vitest";
import { resolveSaleCost, resolveReturnCost } from "./cost-resolution";
import { saleLines, breakEven } from "./management-calculations";
const order = { _id: "order-1", companyCode: "ACME", branchId: "A", confirmedAt: "2026-09-20", orderDiscount: 0 };
const item = { sku: "PHONE", variantId: "variant-1", quantity: 1, unitCost: 0, lineTotal: 200, serialNumbers: ["IMEI-1"] };
const receipt = { ...order, _id: "receipt-1", receiptCode: "PN-1", status: "confirmed", confirmedAt: "2026-09-01", items: [{ ...item, unitCost: 100 }] };
const issue = { ...order, _id: "issue-1", sourceType: "retail-order", sourceId: order._id, sourceLine: 0, direction: "out", purpose: "sale", ...item, unitCost: 110 };
describe("Finance cost evidence", () => {
  it("preserves verified zero and fractional costs from linked sale postings", () => {
    for (const unitCost of [0, 100.25]) {
      const linkedItem = { ...item, unitCost, stockLedgerId: "issue-1", stockWarehouseId: "W" };
      const entry = { ...issue, warehouseId: "W", quantityDelta: -1, unitCost };
      expect(resolveSaleCost(order, linkedItem, 0, [entry], [receipt])).toMatchObject({ cost: unitCost, costBasis: "stock_issue" });
    }
  });
  it("does not guess another cost when an explicit sale posting link is broken", () => {
    const linkedItem = { ...item, unitCost: 110, stockLedgerId: "issue-1", stockWarehouseId: "W" };
    const entry = { ...issue, warehouseId: "W", quantityDelta: -1 };
    for (const patch of [{ _id: "different" }, { warehouseId: "OTHER" }, { unitCost: 109 }, { quantityDelta: 1 }, { branchId: "OTHER" }, { sourceLine: 1 }, { variantId: "OTHER" }]) {
      expect(resolveSaleCost(order, linkedItem, 0, [{ ...entry, ...patch }], [receipt]).cost).toBeNull();
    }
    expect(resolveSaleCost(order, linkedItem, 0, [], [receipt]).cost).toBeNull();
  });
  it("resolves zero-cost partial returns against their source sale posting", () => {
    const returnedItem = { ...item, orderLineIndex: 0, stockLedgerId: "issue-1", stockWarehouseId: "W" };
    const entry = { ...issue, unitCost: 0, quantity: 2, quantityDelta: -2, warehouseId: "W" };
    expect(resolveReturnCost({ ...order, orderId: order._id }, returnedItem, [entry])).toBe(0);
    for (const patch of [{ unitCost: 10 }, { quantity: 3 }, { stockWarehouseId: "OTHER" }, { orderLineIndex: 1 }]) {
      expect(resolveReturnCost({ ...order, orderId: order._id }, { ...returnedItem, ...patch }, [entry])).toBeNull();
    }
    expect(resolveReturnCost({ ...order, orderId: "OTHER" }, returnedItem, [entry])).toBeNull();
  });
  it("preserves positive order snapshot even if current sources differ", () => expect(resolveSaleCost(order, { ...item, unitCost: 90 }, 0, [issue], [receipt]).cost).toBe(90));
  it("resolves the exact stock issue document", () => expect(resolveSaleCost(order, item, 0, [issue], []).cost).toBe(110));
  it("resolves a uniquely matched receipt identifier before the sale", () => expect(resolveSaleCost(order, item, 0, [], [receipt])).toMatchObject({ cost: 100, costBasis: "receipt_identifier", costReference: "PN-1" }));
  it("does not use unrelated line, branch, tenant, quantity or SKU", () => { for (const patch of [{ sourceLine: 1 }, { branchId: "B" }, { companyCode: "OTHER" }, { quantity: 2 }, { sku: "OTHER" }, { sourceId: "other-order" }]) expect(resolveSaleCost(order, item, 0, [{ ...issue, ...patch }], []).cost).toBeNull(); });
  it("rejects ambiguous, future or different-branch receipts", () => { for (const list of [[receipt, { ...receipt, _id: "duplicate" }], [{ ...receipt, confirmedAt: "2026-09-21" }], [{ ...receipt, branchId: "B" }]]) expect(resolveSaleCost(order, item, 0, [], list).cost).toBeNull(); });
  it("does not match quantity-tracked stock by SKU alone", () => expect(resolveSaleCost(order, { ...item, serialNumbers: [] }, 0, [], [receipt]).cost).toBeNull());
  it("requires evidence for every unit and excludes invalid snapshot costs", () => { expect(resolveSaleCost(order, { ...item, quantity: 2 }, 0, [], [receipt]).cost).toBeNull(); for (const unitCost of [0, undefined, NaN, -1]) expect(saleLines({ ...order, items: [{ ...item, unitCost }] })[0]).toMatchObject({ cost: null, grossProfit: null }); });
  it("cannot compute break-even from unknown gross profit", () => expect(breakEven(1000, null, 100, 0, 10, 20).requiredRevenue).toBeNull());
});

it("does not reuse initial purchase cost after an earlier sale of the same device", () => { expect(resolveSaleCost(order, item, 0, [], [receipt], [{ ...order, _id: "earlier-sale", confirmedAt: "2026-09-10", items: [item] }]).cost).toBeNull(); });

describe("Finance historical acquisition links", () => {
 const stockItem = { ...item, serialNumbers: [], trackingMode: "none" };
 const purchase = { ...issue, _id: "in", warehouseId: "W", direction: "in", purpose: "purchase", sourceType: "goods-receipt", sourceId: receipt._id, sourceLine: 0, quantity: 10, quantityDelta: 10, unitCost: 100, createdAt: "2026-09-01" };
 const sale = { ...issue, warehouseId: "W", unitCost: 0, quantityDelta: -1, createdAt: "2026-09-20" };
 const source = { ...receipt, warehouseId: "W", items: [{ ...stockItem, quantity: 10, unitCost: 100 }] };
 it("links quantity stock to confirmed receipt via warehouse ledger", () => {
  expect(resolveSaleCost(order, stockItem, 0, [purchase, sale], [source])).toMatchObject({ cost: 100, costBasis: "historical_average" });
 });
 it("uses weighted average at sale time, excluding future receipts", () => {
  const opening = { ...purchase, _id: "open", sourceType: "opening", purpose: "opening", quantity: 10, quantityDelta: 10, unitCost: 200, createdAt: "2026-09-02" };
  const future = { ...opening, createdAt: "2026-09-21", unitCost: 900 };
  expect(resolveSaleCost(order, stockItem, 0, [purchase, opening, future, sale], [source]).cost).toBe(150);
 });
 it("rejects incomplete, unknown-cost, mismatched or ambiguous stock history", () => {
  for (const patch of [{ warehouseId: "OTHER" }, { unitCost: 0 }, { quantity: 20 }, { createdAt: sale.createdAt }, { quantityDelta: -10 }]) {
   expect(resolveSaleCost(order, stockItem, 0, [{ ...purchase, ...patch }, sale], [source]).cost).toBeNull();
  }
  const earlierOut = { ...sale, sourceId: "earlier", createdAt: "2026-08-30" };
  expect(resolveSaleCost(order, stockItem, 0, [earlierOut, purchase, sale], [source]).cost).toBeNull();
 });
 const previous = { ...order, _id: "previous", confirmedAt: "2026-09-05", items: [item] };
 const buyback = { ...order, _id: "buyback", code: "TM-1", type: "buyback", createdAt: "2026-09-10", items: [{ ...item, unitAmount: 150 }] };
 const inbound = { ...purchase, sourceType: "retail-after-sale", sourceId: "buyback", quantity: 1, quantityDelta: 1, unitCost: 150, createdAt: "2026-09-10" };
 it("uses the matched buyback cost instead of the original receipt after resale", () => {
  expect(resolveSaleCost(order, item, 0, [inbound], [receipt], [previous], [buyback])).toMatchObject({ cost: 150, costBasis: "buyback_identifier", costReference: "TM-1" });
 });
 it("rejects unrelated, unposted, future and ambiguous buybacks", () => {
  for (const patch of [{ branchId: "B" }, { createdAt: "2026-09-21" }, { type: "return" }, { items: [{ ...item, serialNumbers: ["OTHER"], unitAmount: 150 }] }])
   expect(resolveSaleCost(order, item, 0, [inbound], [receipt], [previous], [{ ...buyback, ...patch }]).cost).toBeNull();
  expect(resolveSaleCost(order, item, 0, [], [receipt], [previous], [buyback]).cost).toBeNull();
  expect(resolveSaleCost(order, item, 0, [inbound], [receipt], [previous], [buyback, { ...buyback, _id: "duplicate" }]).cost).toBeNull();
 });
});
