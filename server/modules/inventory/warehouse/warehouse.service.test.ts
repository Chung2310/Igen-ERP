import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BranchModel } from "../../../model/branch.model";
import { WarehouseModel } from "../../../model/warehouse.model";
import { ensureDefaultWarehouse } from "./warehouse.service";

const companyCode = "TEST";
const branchId = new mongoose.Types.ObjectId().toString();
let replSet: MongoMemoryReplSet;

describe("default warehouse resolution", () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
  });
  beforeEach(async () => {
    await Promise.all([WarehouseModel.deleteMany({}), BranchModel.deleteMany({})]);
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  it("returns an active default warehouse", async () => {
    await BranchModel.create({ _id: branchId, companyCode, code: "MAIN", name: "Main", isActive: true });
    const warehouse = await WarehouseModel.create({ companyCode, branchId, code: "MAIN", name: "Main warehouse", kind: "selling", isDefault: true, isActive: true });

    await expect(ensureDefaultWarehouse(companyCode, branchId)).resolves.toMatchObject({ _id: warehouse._id, isActive: true });
  });

  it("does not return an inactive default warehouse or reactivate it implicitly", async () => {
    await BranchModel.create({ _id: branchId, companyCode, code: "MAIN", name: "Main", isActive: true });
    const warehouse = await WarehouseModel.create({ companyCode, branchId, code: "MAIN", name: "Main warehouse", kind: "selling", isDefault: true, isActive: false });

    await expect(ensureDefaultWarehouse(companyCode, branchId)).rejects.toMatchObject({ statusCode: 409, code: "DEFAULT_WAREHOUSE_INACTIVE" });
    expect((await WarehouseModel.findById(warehouse._id).lean())?.isActive).toBe(false);
  });

  it("creates a default warehouse for an active branch that has none", async () => {
    await BranchModel.create({ _id: branchId, companyCode, code: "MAIN", name: "Main", isActive: true });

    const warehouse = await ensureDefaultWarehouse(companyCode, branchId);
    expect(warehouse).toMatchObject({ companyCode, branchId, isDefault: true, isActive: true });
  });
});
