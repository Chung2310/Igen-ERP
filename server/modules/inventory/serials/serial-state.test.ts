import assert from "node:assert/strict";
import test from "node:test";
import { assertSerialTransition, normalizeSerialNumber } from "./serial-state";

test("normalizes serial values", () => assert.equal(normalizeSerialNumber("  imei-001  "), "IMEI-001"));
test("rejects empty serial values", () => assert.throws(() => normalizeSerialNumber("   "), /serial/i));
test("allows sale and cancellation transitions", () => {
  assert.doesNotThrow(() => assertSerialTransition("in_stock", "sold"));
  assert.doesNotThrow(() => assertSerialTransition("sold", "in_stock"));
});
test("allows a two-step warehouse transfer", () => {
  assert.doesNotThrow(() => assertSerialTransition("in_stock", "in_transit"));
  assert.doesNotThrow(() => assertSerialTransition("in_transit", "in_stock"));
});
test("rejects selling an already sold serial", () => assert.throws(() => assertSerialTransition("sold", "sold"), /transition/i));
