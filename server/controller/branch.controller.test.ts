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
