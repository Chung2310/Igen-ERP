import { beforeEach, expect, test, vi } from "vitest";

const findOne = vi.fn();
vi.mock("../inventory/serials/serial-unit.model", () => ({ SerialUnitModel: { findOne } }));
const { requireSoldSerialForRepair } = await import("./repair-sold-serial.service");

beforeEach(() => findOne.mockReset());

test("rejects a serial that is not sold", async () => {
  findOne.mockReturnValue({ lean: async () => null });
  await expect(requireSoldSerialForRepair({ companyCode: "c1" }, { serialNumber: "imei-1" })).rejects.toMatchObject({ code: "REPAIR_SERIAL_NOT_SOLD" });
});

test("returns the sold serial unit", async () => {
  findOne.mockReturnValue({ lean: async () => ({ _id: "unit-1", status: "sold" }) });
  await expect(requireSoldSerialForRepair({ companyCode: "c1" }, { serialNumber: " imei-1 " })).resolves.toMatchObject({ _id: "unit-1" });
  expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "c1", normalizedSerialNumber: "IMEI-1", status: "sold" }));
});
