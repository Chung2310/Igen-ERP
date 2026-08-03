import assert from "node:assert/strict";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFind: vi.fn(),
  branchFind: vi.fn(),
}));

vi.mock("../model/user.model", () => ({ UserModel: { find: mocks.userFind } }));
vi.mock("../model/branch.model", () => ({ BranchModel: { find: mocks.branchFind } }));

import { authController } from "./auth.controller";

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

describe("auth colleagues directory branch scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { _id: "user-a", displayName: "User A", email: "a@acme.test", branchId: "branch-a", password: "secret" },
        { _id: "user-b", displayName: "User B", email: "b@acme.test", branchId: "branch-b", password: "secret" },
      ]),
    });
    mocks.branchFind.mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        { _id: "branch-a", name: "Branch A", companyCode: "ACME" },
        { _id: "branch-b", name: "Branch B", companyCode: "ACME" },
      ]),
    });
  });

  it("returns same-company colleagues across branches with safe branch identity", async () => {
    const res = response();

    await authController.getColleagues(
      { user: { companyCode: "ACME" } } as any,
      res,
    );

    expect(mocks.userFind).toHaveBeenCalledWith(
      { companyCode: "ACME", isDeleted: { $ne: true } },
      expect.objectContaining({ branchId: 1 }),
    );
    expect(mocks.branchFind).toHaveBeenCalledWith(
      { companyCode: "ACME", _id: { $in: ["branch-a", "branch-b"] } },
      { _id: 1, name: 1 },
    );
    assert.deepEqual(res.json.mock.calls[0][0].data, [
      { _id: "user-a", displayName: "User A", email: "a@acme.test", branchId: "branch-a", branchName: "Branch A" },
      { _id: "user-b", displayName: "User B", email: "b@acme.test", branchId: "branch-b", branchName: "Branch B" },
    ]);
    expect(res.json.mock.calls[0][0].data).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ password: expect.anything() }),
    ]));
  });
});
