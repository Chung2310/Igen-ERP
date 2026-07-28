import assert from "node:assert/strict";
import test from "node:test";
import { branchController } from "./branch.controller";
import { BranchModel } from "../model/branch.model";

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