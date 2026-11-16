import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../models/user.model";
import { PartnerService } from "../services/partner.service";
import { PartnerController } from "./partner.controller";

test("admin creates a partner under the resolved owner of the active branch", async () => {
  const originalFind = User.find;
  const originalFindOne = User.findOne;
  const originalCreate = PartnerService.createPartner;
  let createArgs: unknown[] = [];
  (User as any).find = () => ({ select: async () => [{ _id: { toString: () => "branch-owner-a" } }] });
  (User as any).findOne = () => {
    const query = {
      sort: () => query,
      select: async () => ({ _id: { toString: () => "branch-owner-a" } }),
    };
    return query;
  };
  (PartnerService as any).createPartner = async (...args: unknown[]) => {
    createArgs = args;
    return { _id: "partner-1" };
  };
  const res = {
    statusCode: 0,
    status(code: number) { this.statusCode = code; return this; },
    json() { return this; },
  } as any;

  try {
    await PartnerController.create({
      user: { uid: "admin-id", id: "admin-id", email: "admin@example.com", role: "admin", centerId: "ACME", companyCode: "ACME", branchId: "branch-a" },
      body: { name: "Partner A", phone: "0900000000" },
      query: {},
    } as any, res, ((error: unknown) => { throw error; }) as any);

    assert.equal(createArgs[0], "branch-owner-a");
    assert.equal((createArgs[1] as any).branchId, "branch-a");
    assert.deepEqual(createArgs[3], ["branch-owner-a", "branch-a", "admin-id"]);
    assert.equal(res.statusCode, 201);
  } finally {
    (User as any).find = originalFind;
    (User as any).findOne = originalFindOne;
    (PartnerService as any).createPartner = originalCreate;
  }
});

test("admin imports partners under the resolved branch owner", async () => {
  const originalFind = User.find;
  const originalFindOne = User.findOne;
  const originalBulkCreate = PartnerService.bulkCreatePartners;
  let bulkArgs: unknown[] = [];
  (User as any).find = () => ({ select: async () => [{ _id: { toString: () => "admin-id" } }] });
  (User as any).findOne = () => {
    const query = { sort: () => query, select: async () => ({ _id: { toString: () => "branch-owner-a" } }) };
    return query;
  };
  (PartnerService as any).bulkCreatePartners = async (...args: unknown[]) => {
    bulkArgs = args;
    return { importedCount: 1, skippedCount: 0, errors: [] };
  };
  const res = {
    statusCode: 0,
    status(code: number) { this.statusCode = code; return this; },
    json() { return this; },
  } as any;

  try {
    await PartnerController.bulkCreate({
      user: { uid: "admin-id", id: "admin-id", email: "admin@example.com", role: "admin", centerId: "ACME", companyCode: "ACME", branchId: "branch-a" },
      body: { partners: [{ name: "Partner A", phone: "0900000000" }] },
      query: {},
    } as any, res, ((error: unknown) => { throw error; }) as any);

    assert.equal(bulkArgs[3], "branch-owner-a");
    assert.equal(bulkArgs[4], "branch-a");
    assert.equal(res.statusCode, 200);
  } finally {
    (User as any).find = originalFind;
    (User as any).findOne = originalFindOne;
    (PartnerService as any).bulkCreatePartners = originalBulkCreate;
  }
});
