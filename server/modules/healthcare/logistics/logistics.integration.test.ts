import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { Db } from "mongodb";
import express, { type ErrorRequestHandler } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { saveEquipment, requestEquipment, decideEquipment } from "./equipment";
import { saveSupply } from "./supplies";
import { saveDocument, transitionDocument, type Draft } from "./supply-documents";
import { postDocument } from "./supply-posting";
import { collection, ensureIndexes, find, type Actor } from "./store";
import { equipmentInput, supplyInput, stockInput, input } from "./validation";
import { logisticsRouter } from "./router";
import { batchStock } from "./supply-batch";
import { saveProfile, convertedQuantity } from "./supply-units";
import { listSupplies, supplyStats } from "./supply-read";
import { saveDirectory } from "./directories";
import { BranchModel } from "../../../model/branch.model";
import { RolePermissionModel } from "../../../model/role-permission.model";

let mongo: MongoMemoryReplSet;
let db: Db;
let server: Server;
let origin: string;
const branchId = new mongoose.Types.ObjectId().toString();
const actor: Actor = { companyCode: "MED_LOGISTICS_TEST", branchId, actorId: new mongoose.Types.ObjectId().toString() };
const other = { ...actor, actorId: new mongoose.Types.ObjectId().toString() };
const warehouseId = new mongoose.Types.ObjectId();
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  db = mongoose.connection.db as unknown as Db;
  await ensureIndexes(db);
  await BranchModel.collection.insertOne({
    _id: new mongoose.Types.ObjectId(branchId),
    companyCode: actor.companyCode,
    code: "A",
    name: "Test",
    isActive: true,
  });
  await RolePermissionModel.collection.insertOne({
    companyCode: actor.companyCode,
    role: "logistics-reader",
    permissions: ["healthcare:read"],
  });
  await db
    .collection("warehouses")
    .insertOne({ _id: warehouseId, companyCode: actor.companyCode, branchId, name: "Kho QA", isActive: true });
  const app = express();
  app.use(express.json(), (req, _res, next) => {
    Object.assign(req, {
      user: { id: actor.actorId, companyCode: actor.companyCode, branchId, role: "logistics-reader" },
    });
    next();
  });
  app.use(logisticsRouter);
  app.use(((err, _req, res, _next) =>
    res.status(err.status || 500).json({ message: err.message })) as ErrorRequestHandler);
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 90000);
beforeEach(async () => {
  for (const name of [
    "equipment",
    "equipment_requests",
    "equipment_inspections",
    "supplies",
    "supply_documents",
    "supply_balances",
    "supply_ledger",
    "logistics_operations",
  ] as const)
    await collection(db, name).deleteMany({});
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  await mongoose.disconnect();
  await mongo?.stop();
});
const equipment = () => saveEquipment(db, actor, input(equipmentInput, { code: "TB01", name: "Máy siêu âm", category: "Chẩn đoán" }));
async function supply() {
  return saveSupply(
    db,
    actor,
    input(supplyInput, { code: "VT01", name: "Găng tay", unit: "Hộp", requiresExpiry: false }),
  );
}
async function draft(supplyId: string, type: Draft["type"], quantity: number) {
  return saveDocument(
    db,
    actor,
    input(stockInput, {
      type,
      warehouseId: String(warehouseId),
      reason: "Test",
      lines: [{ supplyId, quantity, value: quantity * 1000 }],
    }),
  );
}
async function approve(row: Awaited<ReturnType<typeof draft>>) {
  const submitted = await transitionDocument(db, actor, row._id, row.revision, "submit", "");
  return transitionDocument(db, actor, row._id, submitted.revision, "approve", "");
}
it("isolates records by company and branch", async () => {
  const row = await equipment();
  await expect(find(db, "equipment", { ...actor, companyCode: "OTHER" }, row._id)).rejects.toMatchObject({
    status: 404,
  });
  await expect(find(db, "equipment", { ...actor, branchId: "other" }, row._id)).rejects.toMatchObject({ status: 404 });
});
it("allows only one concurrent borrow, protects return ownership and preserves history", async () => {
  const row = await equipment();
  const results = await Promise.allSettled(
    [actor, other].map((a) =>
      requestEquipment(db, a, row._id, { type: "borrow", reason: "Khám", expectedReturnDay: "" }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const request = (
    results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<
      Awaited<ReturnType<typeof requestEquipment>>
    >
  ).value;
  await decideEquipment(db, actor, request._id, request.revision, "approve", "");
  const borrower = request.employeeId === actor.actorId ? actor : other;
  const stranger = request.employeeId === actor.actorId ? other : actor;
  await expect(
    requestEquipment(db, stranger, row._id, { type: "return", reason: "Trả", expectedReturnDay: "" }),
  ).rejects.toMatchObject({ status: 403 });
  const back = await requestEquipment(db, borrower, row._id, { type: "return", reason: "Trả", expectedReturnDay: "" });
  await decideEquipment(db, actor, back._id, back.revision, "approve", "");
  expect((await find(db, "equipment", actor, row._id)).status).toBe("available");
  expect(await collection(db, "equipment_requests").countDocuments()).toBe(2);
});
it("allows a manager to request return on behalf of the borrower", async () => {
  const row = await equipment();
  const request = await requestEquipment(db, other, row._id, { type: "borrow", reason: "Khám", expectedReturnDay: "" });
  await decideEquipment(db, actor, request._id, request.revision, "approve", "");
  const back = await requestEquipment(db, actor, row._id, { type: "return", reason: "Thu hồi", expectedReturnDay: "" }, true);
  expect(back.employeeId).toBe(other.actorId);
  expect(back.createdBy).toBe(actor.actorId);
  await decideEquipment(db, actor, back._id, back.revision, "approve", "");
  expect((await find(db, "equipment", actor, row._id)).status).toBe("available");
});
it("rejects stale edits and modifications to borrowed equipment", async () => {
  const row = await equipment();
  await expect(
    saveEquipment(db, actor, input(equipmentInput, { code: "TB01", name: "Sửa", category: "Chẩn đoán" }), row._id, 99),
  ).rejects.toMatchObject({ status: 409 });
  await requestEquipment(db, actor, row._id, { type: "borrow", reason: "Mượn", expectedReturnDay: "" });
  await expect(
    saveEquipment(db, actor, input(equipmentInput, { code: "TB01", name: "Sửa", category: "Chẩn đoán" }), row._id, 2),
  ).rejects.toMatchObject({ status: 409 });
});
it("posts a receipt once, retries idempotently, and never permits overdraw", async () => {
  const item = await supply();
  const receipt = await approve(await draft(item._id, "receipt", 5));
  const key = randomUUID();
  await postDocument(db, actor, receipt._id, receipt.revision, key);
  await postDocument(db, actor, receipt._id, receipt.revision, key);
  expect(await collection(db, "supply_ledger").countDocuments()).toBe(1);
  const issue = await approve(await draft(item._id, "issue", 6));
  await expect(postDocument(db, actor, issue._id, issue.revision, randomUUID())).rejects.toMatchObject({ status: 409 });
  expect((await collection(db, "supply_balances").findOne({ supplyId: item._id }))?.quantity).toBe(5);
  expect((await find(db, "supply_documents", actor, issue._id)).status).toBe("approved");
});
it("serializes concurrent issues and keeps quantity and valuation consistent", async () => {
  const item = await supply();
  const receipt = await approve(await draft(item._id, "receipt", 5));
  await postDocument(db, actor, receipt._id, receipt.revision, randomUUID());
  const a = await approve(await draft(item._id, "issue", 4));
  const b = await approve(await draft(item._id, "issue", 4));
  const result = await Promise.allSettled(
    [a, b].map((doc) => postDocument(db, actor, doc._id, doc.revision, randomUUID())),
  );
  expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const balance = await collection(db, "supply_balances").findOne({ supplyId: item._id });
  expect(balance).toMatchObject({ quantity: 1, value: 1000 });
});
it("blocks posting draft documents and rejects invalid calendar dates", async () => {
  const item = await supply();
  const row = await draft(item._id, "receipt", 1);
  await expect(postDocument(db, actor, row._id, row.revision, randomUUID())).rejects.toMatchObject({ status: 409 });
  expect(() => input(equipmentInput, { code: "TB", name: "Test", purchaseDay: "2026-02-30" })).toThrow();
});
it("enforces read-only permissions on API mutations", async () => {
  expect((await fetch(`${origin}/equipment`)).status).toBe(200);
  const denied = await fetch(`${origin}/equipment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "TB", name: "Test" }),
  });
  expect(denied.status).toBe(403);
  expect(await collection(db, "equipment").countDocuments()).toBe(0);
});
it("converts batch quantities, replays safely and locks profiles after a draft", async () => {
  const row = await supply();
  await saveProfile(db, actor, row._id, row.revision, {
    precision: 0,
    trackingMode: "lot",
    requiresExpiry: false,
    conversions: [{ unit: "Thùng", factor: "10" }],
  });
  const data = input<Draft>(stockInput, {
    type: "receipt",
    warehouseId: String(warehouseId),
    reason: "Nhập theo lô",
    lines: [{ supplyId: row._id, quantity: 2, unit: "Thùng", lot: "LOT-1", value: 20000 }],
  });
  const key = randomUUID();
  await batchStock(db, actor, data, key);
  await batchStock(db, actor, data, key);
  expect(await collection(db, "supply_documents").countDocuments()).toBe(1);
  expect(await collection(db, "supply_ledger").findOne({ supplyId: row._id })).toMatchObject({
    quantity: 20,
    value: 20000,
  });
  const latest = await find(db, "supplies", actor, row._id);
  await expect(
    saveProfile(db, actor, row._id, latest.revision, {
      precision: 0,
      trackingMode: "lot",
      requiresExpiry: false,
      conversions: [],
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(batchStock(db, actor, { ...data, reason: "Khác" }, key)).rejects.toMatchObject({ status: 409 });
  await batchStock(db, actor, { ...data, type: "issue", lines: [{ ...data.lines[0], quantity: 1 }] }, randomUUID());
  expect(await collection(db, "supply_balances").findOne({ supplyId: row._id })).toMatchObject({
    quantity: 10,
    value: 10000,
  });
});
it("rolls back every line of an invalid batch and rejects imprecise conversion", async () => {
  const row = await supply();
  const data = input<Draft>(stockInput, {
    type: "receipt",
    warehouseId: String(warehouseId),
    reason: "Nhập",
    lines: [{ supplyId: row._id, quantity: 2, value: 2000 }],
  });
  await batchStock(db, actor, data, randomUUID());
  await expect(
    batchStock(
      db,
      actor,
      {
        ...data,
        type: "issue",
        lines: [
          { ...data.lines[0], quantity: 1 },
          { ...data.lines[0], quantity: 2 },
        ],
      },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect(await collection(db, "supply_documents").countDocuments()).toBe(1);
  expect(await collection(db, "supply_balances").findOne({ supplyId: row._id })).toMatchObject({
    quantity: 2,
    value: 2000,
  });
  expect(() => convertedQuantity(0.1, "0.1", 1)).toThrow();
  expect(convertedQuantity(0.1, "0.1", 2)).toBe(0.01);
  expect(() => convertedQuantity(1, "0", 3)).toThrow();
});
it("returns scoped stock totals, active filtering and archive protections", async () => {
  const row = await supply();
  await batchStock(
    db,
    actor,
    input(stockInput, {
      type: "receipt",
      warehouseId: String(warehouseId),
      reason: "Nhập",
      lines: [{ supplyId: row._id, quantity: 3, value: 3000 }],
    }),
    randomUUID(),
  );
  const list = await listSupplies(db, actor, { page: 1, pageSize: 25, q: "Găng" });
  expect(list.items[0]).toMatchObject({ quantity: 3, stockValue: 3000, stockStatus: "in-stock" });
  expect(await supplyStats(db, actor)).toMatchObject({ totalItems: 1, totalQuantity: 3, totalValue: 3000 });
  expect((await listSupplies(db, { ...actor, companyCode: "OTHER" }, { page: 1, pageSize: 25, q: "" })).total).toBe(0);
  const latest = await find(db, "supplies", actor, row._id);
  await expect(saveSupply(db, actor, { ...latest, active: false }, row._id, latest.revision)).rejects.toMatchObject({
    status: 409,
  });
  expect((await listSupplies(db, actor, { page: 1, pageSize: 25, q: "", active: "false" })).total).toBe(0);
});
it("reuses directory collections and protects shared ERP records", async () => {
  const data = {
    code: "MED-SUP",
    name: "Nhà cung cấp y tế",
    active: true,
    phone: "0901234567",
    email: "",
    address: "",
    taxCode: "",
    contactPerson: "Lan",
    location: "",
    managerName: "",
    managerPhone: "",
    notes: "",
  };
  const created = await saveDirectory(db, actor, "suppliers", data);
  expect(created).toMatchObject({ editable: true, contactPerson: "Lan" });
  const updated = await saveDirectory(
    db,
    actor,
    "suppliers",
    { ...data, phone: "0907654321" },
    created._id,
    created.revision,
  );
  expect(updated.phone).toBe("0907654321");
  await expect(
    saveDirectory(db, { ...actor, companyCode: "OTHER" }, "suppliers", data, created._id, updated.revision),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    saveDirectory(db, actor, "warehouses", { ...data, code: "QA" }, String(warehouseId), 1),
  ).rejects.toMatchObject({ status: 403 });
});
