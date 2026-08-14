import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEffectivePermissions: vi.fn(),
  leaveFindOne: vi.fn(),
  crudUpdate: vi.fn(),
  finalize: vi.fn(),
}));

vi.mock("../middleware/auth", () => ({
  DEFAULT_ROLE_LEVELS: {},
  getEffectivePermissions: mocks.getEffectivePermissions,
}));
vi.mock("../model/hr-leave-application.model", () => ({
  HRLeaveApplicationModel: { findOne: mocks.leaveFindOne },
}));
vi.mock("../service/crud.service", () => ({
  crudService: { update: mocks.crudUpdate },
}));
vi.mock("../service/crud-resource-finalization.service", () => ({
  crudResourceFinalizationService: { finalize: mocks.finalize },
}));

import { crudController } from "./crud.controller";

const response = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe("leave application permission scope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getEffectivePermissions.mockResolvedValue(new Set());
    mocks.leaveFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ employeeId: "employee-b", status: "pending" }) });
    mocks.crudUpdate.mockResolvedValue({ _id: "leave-1", status: "pending" });
    mocks.finalize.mockResolvedValue(undefined);
  });

  it("requires timekeeping:manage before an admin with no effective permission can edit another employee's leave", async () => {
    const res = response();
    await crudController.update({
      params: { modelName: "hr-leave-applications", id: "leave-1" },
      body: { reason: "Change requested" },
      user: { id: "employee-a", role: "admin", companyCode: "ACME" },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.crudUpdate).not.toHaveBeenCalled();
  });
});
