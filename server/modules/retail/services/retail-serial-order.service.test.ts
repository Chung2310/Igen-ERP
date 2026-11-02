import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSerialNumber } from "../../inventory/serials/serial-state";
import { applyClaimedSerialToOrderItem } from "./retail-serial-order.service";

test("serial order helper uses normalized serial identifiers", () => assert.equal(normalizeSerialNumber(" imei-42 "), "IMEI-42"));

test("claimed IMEI adds its internal barcode and warranty period to the order line", () => {
  const soldAt = new Date("2026-08-18T00:00:00.000Z");
  const item: any = { trackingMode: "serial", serialNumbers: ["IMEI-42"] };

  applyClaimedSerialToOrderItem(item, { internalBarcode: "UNIT-00042" }, soldAt, 12);

  assert.deepEqual(item.internalBarcodes, ["UNIT-00042"]);
  assert.equal(item.customerWarrantyStartAt, soldAt);
  assert.deepEqual(item.customerWarrantyEndAt, new Date("2027-08-18T00:00:00.000Z"));
  assert.equal(item.customerWarrantyMonths, 12);
});

test("quantity goods get a warranty snapshot with calendar month boundaries", () => {
  const item: any = { trackingMode: "quantity" };
  applyClaimedSerialToOrderItem(item, {}, new Date("2026-01-31T00:00:00Z"), 1);
  assert.equal(item.customerWarrantyMonths, 1);
  assert.deepEqual(item.customerWarrantyEndAt, new Date("2026-02-28T00:00:00Z"));
  assert.equal(item.internalBarcodes, undefined);
});

test("zero warranty is recorded explicitly and clears stale draft dates", () => {
  const item: any = { customerWarrantyStartAt: new Date(), customerWarrantyEndAt: new Date() };
  applyClaimedSerialToOrderItem(item, {}, new Date("2026-01-31T00:00:00Z"), 0);
  assert.equal(item.customerWarrantyMonths, 0);
  assert.equal(item.customerWarrantyStartAt, undefined);
  assert.equal(item.customerWarrantyEndAt, undefined);
});
