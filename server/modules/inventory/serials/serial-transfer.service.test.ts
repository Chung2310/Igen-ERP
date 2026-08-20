import { beforeEach, expect, test, vi } from "vitest";

const findOneAndUpdate = vi.fn();
const eventCreate = vi.fn();
vi.mock("./serial-unit.model", () => ({ SerialUnitModel: { findOneAndUpdate } }));
vi.mock("./serial-event.model", () => ({ SerialEventModel: { create: eventCreate } }));
const { acceptSerialTransfer, cancelSerialTransfer, requestSerialTransfer } = await import("./serial-transfer.service");

beforeEach(() => { findOneAndUpdate.mockReset(); eventCreate.mockReset(); findOneAndUpdate.mockResolvedValue({ _id: "s1", serialNumber: "IMEI-1" }); });

test("moves an in-stock serial into transit and records the request", async () => {
  await requestSerialTransfer({ companyCode: "c1", branchId: "from", warehouseId: "w1" }, "s1", { toBranchId: "to", toWarehouseId: "w2", reason: "Điều chuyển" }, { id: "u1", name: "User" });
  expect(findOneAndUpdate.mock.calls[0][0]).toMatchObject({ _id: "s1", companyCode: "c1", branchId: "from", warehouseId: "w1", status: "in_stock" });
  expect(findOneAndUpdate.mock.calls[0][1]).toMatchObject({ $set: { status: "in_transit" } });
  expect(eventCreate).toHaveBeenCalledWith(expect.objectContaining({ eventType: "transfer_requested", fromStatus: "in_stock", toStatus: "in_transit" }));
});

test("receiving branch accepts a transfer into its warehouse", async () => {
  await acceptSerialTransfer({ companyCode: "c1", branchId: "to" }, "s1", { warehouseId: "w2" }, { id: "u2", name: "Receiver" });
  expect(findOneAndUpdate.mock.calls[0][0]).toMatchObject({ _id: "s1", companyCode: "c1", status: "in_transit" });
  expect(findOneAndUpdate.mock.calls[0][1]).toMatchObject({ $set: { branchId: "to", warehouseId: "w2", status: "in_stock" } });
  expect(eventCreate).toHaveBeenCalledWith(expect.objectContaining({ eventType: "transfer_received", toStatus: "in_stock" }));
});

test("sending branch cancels a pending transfer and restores stock", async () => {
  await cancelSerialTransfer({ companyCode: "c1", branchId: "from", warehouseId: "w1" }, "s1", "Sai kho nhận", { id: "u1", name: "Sender" });
  expect(findOneAndUpdate.mock.calls[0][0]).toMatchObject({ _id: "s1", companyCode: "c1", branchId: "from", warehouseId: "w1", status: "in_transit" });
  expect(findOneAndUpdate.mock.calls[0][1]).toMatchObject({ $set: { status: "in_stock" } });
  expect(eventCreate).toHaveBeenCalledWith(expect.objectContaining({ eventType: "transfer_cancelled", toStatus: "in_stock" }));
});
