import { expect, test, vi } from "vitest";

const getSerialHistory = vi.fn();
const getSerialUnit = vi.fn();
const listSerialUnits = vi.fn();
const registerSerialBatch = vi.fn();
const registerSerialUnit = vi.fn();
const transferSerialUnit = vi.fn();
const transitionSerialUnit = vi.fn();
const acceptSerialTransfer = vi.fn();
const cancelSerialTransfer = vi.fn();
const requestSerialTransfer = vi.fn();
const findBranch = vi.hoisted(() => vi.fn());

vi.mock("./serial-unit.service", () => ({
  getSerialHistory, getSerialUnit, listSerialUnits, registerSerialBatch, registerSerialUnit, transferSerialUnit, transitionSerialUnit,
}));
vi.mock("./serial-transfer.service", () => ({ acceptSerialTransfer, cancelSerialTransfer, requestSerialTransfer }));
vi.mock("../../../model/branch.model", () => ({ BranchModel: { findOne: findBranch } }));

const { serialUnitController } = await import("./serial-unit.controller");

function response() {
  const res: any = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

test("serial transfer controllers pass the authenticated display name to stock operations", async () => {
  requestSerialTransfer.mockResolvedValueOnce({ status: "in_transit" });
  transferSerialUnit.mockResolvedValueOnce({ status: "in_stock" });
  const req: any = {
    user: { id: "actor-1", displayName: "Nguyễn Văn An", companyCode: "test", branchId: "507f1f77bcf86cd799439101" },
    params: { id: "507f1f77bcf86cd799439102" }, query: {},
    body: { toBranchId: "507f1f77bcf86cd799439101", toWarehouseId: "507f1f77bcf86cd799439103", reason: "Sắp xếp lại kho" },
  };
  const requestRes = response();
  await serialUnitController.requestTransfer(req, requestRes);
  expect(requestSerialTransfer).toHaveBeenCalledWith(
    { companyCode: "TEST", branchId: "507f1f77bcf86cd799439101", warehouseId: undefined },
    "507f1f77bcf86cd799439102", req.body, { id: "actor-1", name: "Nguyễn Văn An" },
  );
  expect(requestRes.status).toHaveBeenCalledWith(201);

  const transferRes = response();
  await serialUnitController.transfer(req, transferRes);
  expect(transferSerialUnit).toHaveBeenCalledWith(
    { companyCode: "TEST", branchId: "507f1f77bcf86cd799439101", warehouseId: undefined },
    "507f1f77bcf86cd799439102", req.body, { id: "actor-1", name: "Nguyễn Văn An" },
  );
});

test("company admins must select an active branch before using serial workflows", async () => {
  const branchId = "507f1f77bcf86cd799439105";
  findBranch.mockReturnValueOnce({ select: () => ({ lean: async () => ({ _id: branchId }) }) });
  listSerialUnits.mockResolvedValueOnce({ items: [] });
  const req: any = {
    user: { id: "admin-1", role: "admin", companyCode: "test" },
    params: {}, query: { branchId }, body: {},
  };
  const res = response();
  await serialUnitController.list(req, res);
  expect(findBranch).toHaveBeenCalledWith({ _id: branchId, companyCode: "TEST", isActive: true });
  expect(listSerialUnits).toHaveBeenCalledWith(
    { companyCode: "TEST", branchId, warehouseId: undefined },
    expect.objectContaining({ status: undefined }),
  );
});
