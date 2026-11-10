import { expect, it, vi } from "vitest";

const { findBranch, listTransfers, getTransfer, createTransfer, acceptTransfer, cancelTransfer } = vi.hoisted(() => ({
  findBranch: vi.fn(), listTransfers: vi.fn(), getTransfer: vi.fn(), createTransfer: vi.fn(), acceptTransfer: vi.fn(), cancelTransfer: vi.fn(),
}));

vi.mock("../../../model/branch.model", () => ({ BranchModel: { findOne: findBranch } }));
vi.mock("./transfer.service", () => ({ transferDestinations: vi.fn(), listTransfers, getTransfer, createTransfer, acceptTransfer, cancelTransfer }));

const { inventoryTransferRouter } = await import("./router");

function response() {
  const res: any = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

function handler(method: string, path: string) {
  const layer = (inventoryTransferRouter as any).stack.find((entry: any) => entry.route?.path === path && entry.route?.methods?.[method]);
  return layer.route.stack.at(-1).handle as (req: any, res: any) => Promise<unknown>;
}

it("scopes an unassigned company admin to the branch selected by name before listing transfers", async () => {
  const branchId = "507f1f77bcf86cd799439101";
  findBranch.mockReturnValueOnce({ select: () => ({ lean: async () => ({ _id: branchId }) }) });
  listTransfers.mockResolvedValueOnce([]);
  const req = { user: { role: "admin", companyCode: "test" }, query: { branchId } } as any;
  const res = response();

  await handler("get", "/")(req, res);

  expect(findBranch).toHaveBeenCalledWith({ _id: branchId, companyCode: "TEST", isActive: true });
  expect(listTransfers).toHaveBeenCalledWith({ companyCode: "TEST", branchId }, req.query);
  expect(res.json).toHaveBeenCalledWith({ status: "success", data: [] });
});

it("rejects a company admin transfer request without a selected branch", async () => {
  listTransfers.mockClear();
  const req = { user: { role: "admin", companyCode: "test" }, query: {} } as any;
  const res = response();

  await handler("get", "/")(req, res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(listTransfers).not.toHaveBeenCalled();
});
