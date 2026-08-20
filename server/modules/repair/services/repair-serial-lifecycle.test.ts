import { beforeEach, expect, test, vi } from "vitest";

const findOneAndUpdate = vi.fn();
const create = vi.fn();
vi.mock("../../inventory/serials/serial-unit.model", () => ({ SerialUnitModel: { findOneAndUpdate } }));
vi.mock("../../inventory/serials/serial-event.model", () => ({ SerialEventModel: { create } }));

const { recordRepairSerialLifecycle } = await import("./repair-serial-lifecycle");

beforeEach(() => {
  findOneAndUpdate.mockReset();
  create.mockReset();
  findOneAndUpdate.mockResolvedValue({ _id: "serial-1", serialNumber: "IMEI-1", status: "repairing" });
  create.mockResolvedValue(undefined);
});

test("records repair reception on the serial timeline", async () => {
  await recordRepairSerialLifecycle({ _id: "repair-1", companyCode: "c1", branchId: "b1", ticketCode: "SC-1", device: { serialNumber: "IMEI-1" } }, "received", { id: "u1", name: "User" });
  expect(findOneAndUpdate.mock.calls[0][0]).toMatchObject({ companyCode: "c1", normalizedSerialNumber: "IMEI-1", status: "sold" });
  expect(findOneAndUpdate.mock.calls[0][1]).toMatchObject({ $set: { status: "repairing" } });
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ eventType: "repair_received", documentId: "repair-1", toStatus: "repairing" }));
});
