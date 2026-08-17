import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSerialNumber } from "../../inventory/serials/serial-state";

test("serial order helper uses normalized serial identifiers", () => assert.equal(normalizeSerialNumber(" imei-42 "), "IMEI-42"));
