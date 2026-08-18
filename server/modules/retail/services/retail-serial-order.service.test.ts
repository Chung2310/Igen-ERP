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
});
