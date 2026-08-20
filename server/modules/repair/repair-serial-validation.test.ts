import { describe, expect, test } from "vitest";
import { assertSoldSerialForRepair } from "./repair-serial-validation";

describe("assertSoldSerialForRepair", () => {
  test("rejects a repair ticket without an IMEI or serial", () => {
    expect(() => assertSoldSerialForRepair({ serialNumber: "", imei: "" })).toThrow("IMEI/serial");
  });

  test("accepts a ticket that identifies its sold device", () => {
    expect(() => assertSoldSerialForRepair({ serialNumber: " SN-001 " })).not.toThrow();
  });
});
