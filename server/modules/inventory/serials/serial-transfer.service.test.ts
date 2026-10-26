import { beforeEach, expect, test, vi } from "vitest";

const findOne = vi.fn();
const findById = vi.fn();
const findOneAndUpdate = vi.fn();
const requestInventoryTransfer = vi.fn();
const receiveInventoryTransfer = vi.fn();
const cancelInventoryTransfer = vi.fn();
const eventCreate = vi.fn();
vi.mock("./serial-unit.model", () => ({ SerialUnitModel: { findOne, findById, findOneAndUpdate } }));
vi.mock("./serial-event.model", () => ({ SerialEventModel: { create: eventCreate } }));
vi.mock("../transfers/transfer.service", () => ({ requestInventoryTransfer, receiveInventoryTransfer, cancelInventoryTransfer }));
vi.mock("../warehouse/warehouse.service", () => ({ ensureDefaultWarehouse: vi.fn().mockResolvedValue({ _id: "w2" }) }));
const { acceptSerialTransfer, cancelSerialTransfer, requestSerialTransfer } = await import("./serial-transfer.service");

beforeEach(() => {
  findOne.mockReset(); findById.mockReset(); findOneAndUpdate.mockReset(); requestInventoryTransfer.mockReset(); receiveInventoryTransfer.mockReset(); cancelInventoryTransfer.mockReset(); eventCreate.mockReset();
  findOne.mockReturnValue({ lean: async () => ({ _id: "s1", variantId: "v1", warehouseId: "w1", serialNumber: "IMEI-1", currentDocumentType: "inventory-transfer", currentDocumentId: "t1" }) });
  findById.mockReturnValue({ lean: async () => ({ _id: "s1", status: "in_transit" }) });
});

test("yêu cầu chuyển serial tạo phiếu và xuất tồn qua dịch vụ điều chuyển", async () => {
  await requestSerialTransfer({ companyCode: "c1", branchId: "from", warehouseId: "w1" }, "s1", { toBranchId: "to", toWarehouseId: "w2", reason: "Điều chuyển" }, { id: "u1", name: "User" });
  expect(requestInventoryTransfer).toHaveBeenCalledWith({ companyCode: "c1", branchId: "from" }, expect.objectContaining({
    fromWarehouseId: "w1", toWarehouseId: "w2", idempotencyKey: expect.any(String), items: [{ variantId: "v1", quantity: 1, serialNumbers: ["IMEI-1"] }],
  }), { id: "u1", name: "User" });
});

test("nhận serial theo phiếu nhận trọn vẹn", async () => {
  await acceptSerialTransfer({ companyCode: "c1", branchId: "to" }, "s1", { warehouseId: "w2" }, { id: "u2", name: "Receiver" });
  expect(receiveInventoryTransfer).toHaveBeenCalledWith({ companyCode: "c1", branchId: "to" }, "t1", { id: "u2", name: "Receiver" });
  expect(findOneAndUpdate).not.toHaveBeenCalled();
});

test("legacy serial-only transfers cannot receive into an arbitrary warehouse without a stock document", async () => {
  findOne.mockReturnValue({ lean: async () => ({ _id: "s1", status: "in_transit", currentDocumentType: "serial-transfer" }) });
  await expect(acceptSerialTransfer({ companyCode: "c1", branchId: "to" }, "s1", { warehouseId: "foreign-warehouse" }, { id: "u2", name: "Receiver" })).rejects.toMatchObject({ code: "LEGACY_SERIAL_TRANSFER_REQUIRES_REISSUE" });
  expect(findOneAndUpdate).not.toHaveBeenCalled();
});

test("hủy serial theo phiếu hoàn trọn tồn gửi", async () => {
  await cancelSerialTransfer({ companyCode: "c1", branchId: "from", warehouseId: "w1" }, "s1", "Sai kho nhận", { id: "u1", name: "Sender" });
  expect(cancelInventoryTransfer).toHaveBeenCalledWith({ companyCode: "c1", branchId: "from" }, "t1", "Sai kho nhận", { id: "u1", name: "Sender" });
  expect(findOneAndUpdate).not.toHaveBeenCalled();
});
