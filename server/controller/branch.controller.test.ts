import assert from "node:assert/strict";
import test from "node:test";
import { branchController } from "./branch.controller";
import { BranchModel } from "../model/branch.model";
import { UserModel } from "../model/user.model";
import { authService } from "../service/auth.service";

function response() {
  const state: { statusCode: number; body?: any } = { statusCode: 200 };
  return {
    state,
    status(code: number) { state.statusCode = code; return this; },
    json(body: any) { state.body = body; return body; },
  } as any;
}

test("branch update cannot move a branch to another company", async () => {
  const original = BranchModel.findOneAndUpdate;
  let captured: any;
  (BranchModel as any).findOneAndUpdate = (_filter: any, update: any) => {
    captured = update;
    return { lean: async () => ({ _id: "b1", companyCode: "ACME", code: "HQ", name: "Head Office" }) };
  };

  try {
    const res = response();
    await branchController.update(
      { user: { role: "admin", companyCode: "ACME" }, params: { id: "b1" }, body: { name: "Updated", companyCode: "OTHER" } } as any,
      res,
    );
    assert.deepEqual(captured, { $set: { name: "Updated" } });
    assert.equal(res.state.statusCode, 200);
  } finally {
    (BranchModel as any).findOneAndUpdate = original;
  }
});

test("branch list creates the default branch for an admin company", async () => {
  const originalFind = BranchModel.find;
  const originalCreate = BranchModel.create;
  const originalFindOne = BranchModel.findOne;
  const created: any[] = [];
  (BranchModel as any).find = () => ({ sort: () => ({ lean: async () => created }) });
  (BranchModel as any).findOne = () => ({ lean: async () => null });
  (BranchModel as any).create = async (payload: any) => { created.push({ _id: "default", ...payload }); return created.at(-1); };
  try {
    const res = response();
    await branchController.list({ user: { role: "admin", companyCode: "ACME" }, query: {} } as any, res);
    assert.equal(created.length, 1);
    assert.deepEqual(created[0], { _id: "default", companyCode: "ACME", code: "MAIN", name: "Trụ sở chính", isActive: true });
  } finally {
    (BranchModel as any).find = originalFind;
    (BranchModel as any).findOne = originalFindOne;
    (BranchModel as any).create = originalCreate;
  }
});

test("branch owner completion forces the authenticated admin hierarchy and links the owner", async () => {
  const originalFindOne = BranchModel.findOne;
  const originalUpdate = BranchModel.findOneAndUpdate;
  const originalRegister = authService.registerUserForCompany;
  let registration: any;
  (BranchModel as any).findOne = () => ({ lean: async () => ({ _id: "b1", companyCode: "ACME", managerId: "" }) });
  (authService as any).registerUserForCompany = async (payload: any, companyCode: string, role: string) => {
    registration = { payload, companyCode, role };
    return { _id: "owner-1", toObject: () => ({ _id: "owner-1", ...payload, password: "hashed" }) };
  };
  (BranchModel as any).findOneAndUpdate = (_filter: any, update: any) => ({ lean: async () => ({ _id: "b1", companyCode: "ACME", managerId: update.$set.managerId }) });
  try {
    const res = response();
    await branchController.createOwner({
      user: { id: "admin-1", role: "admin", companyCode: "ACME" }, params: { id: "b1" },
      body: { displayName: "Owner", email: "owner@acme.test", password: "secret", role: "admin", companyCode: "OTHER", branchId: "foreign", parentId: "other" },
    } as any, res);
    assert.equal(res.state.statusCode, 201);
    assert.equal(registration.companyCode, "ACME");
    assert.equal(registration.role, "admin");
    assert.equal(registration.payload.role, "branch_owner");
    assert.equal(registration.payload.companyCode, "ACME");
    assert.equal(registration.payload.branchId, "b1");
    assert.equal(registration.payload.parentId, "admin-1");
    assert.equal(res.state.body.data.branch.managerId, "owner-1");
    assert.equal("password" in res.state.body.data.owner, false);
  } finally {
    (BranchModel as any).findOne = originalFindOne;
    (BranchModel as any).findOneAndUpdate = originalUpdate;
    (authService as any).registerUserForCompany = originalRegister;
  }
});

test("cancelling owner creation only removes an unmanaged branch in the admin company", async () => {
  const original = BranchModel.findOneAndDelete;
  let filter: any;
  (BranchModel as any).findOneAndDelete = (value: any) => { filter = value; return { lean: async () => ({ _id: "b1" }) }; };
  try {
    const res = response();
    await branchController.removePending({ user: { role: "admin", companyCode: "ACME" }, params: { id: "b1" } } as any, res);
    assert.equal(res.state.statusCode, 200);
    assert.deepEqual(filter, { _id: "b1", companyCode: "ACME", pendingOwnerSetup: true, managerId: { $in: ["", null] } });
  } finally { (BranchModel as any).findOneAndDelete = original; }
});
