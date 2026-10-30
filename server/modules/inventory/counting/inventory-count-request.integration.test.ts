import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { InventoryCountModel } from "../../../model/inventory-count.model";
import { InventoryCountRequestModel } from "./inventory-count-request.model";
import { reconcileCountItem, updateCountItem } from "./inventory-count.service";
const scope = { companyCode: "TEST", branchId: "b" }, actor = { id: "counter" };
let repl: MongoMemoryReplSet;
beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  await Promise.all([InventoryCountModel.init(), InventoryCountRequestModel.init()]);
});
beforeEach(async () => { vi.restoreAllMocks(); await InventoryCountRequestModel.deleteMany({}); await InventoryCountModel.deleteMany({}); });
afterAll(async () => { await mongoose.disconnect(); await repl.stop(); });
async function seed() {
  const count = await InventoryCountModel.create({ ...scope, warehouseId: "w", countCode: randomUUID(), status: "counting", createdBy: "counter", items: [{ productId: "p", sku: "SKU", productName: "Phone", systemQuantity: 10, sourceBalanceVersion: 0, countedQuantity: 10, quantityDelta: 0 }] });
  return { countId: String(count._id), itemId: String(count.items[0]._id), input: { requestId: randomUUID(), expectedVersion: count.version, countedQuantity: 7 } };
}
it("records the original result atomically and reconciles without further writes", async () => {
  const { countId, itemId, input } = await seed();
  await updateCountItem(scope, countId, itemId, input, actor);
  const before = await InventoryCountModel.findById(countId).lean();
  expect(await reconcileCountItem(scope, countId, itemId, input, actor)).toEqual({ status: "completed", requestId: input.requestId, countId, itemId, committedVersion: input.expectedVersion + 1, currentVersion: input.expectedVersion + 1 });
  expect(await InventoryCountModel.findById(countId).lean()).toEqual(before);
  expect(await InventoryCountRequestModel.countDocuments()).toBe(1);
});
it("returns the progressed count on replay without overwriting later edits or status", async () => {
  const { countId, itemId, input } = await seed();
  const first = await updateCountItem(scope, countId, itemId, input, actor);
  await updateCountItem(scope, countId, itemId, { countedQuantity: 9, expectedVersion: first.version });
  const current = await InventoryCountModel.findById(countId); current!.status = "pending_approval"; await current!.save();
  const replay = await updateCountItem(scope, countId, itemId, input, actor);
  expect(replay.items[0].countedQuantity).toBe(9); expect(replay.status).toBe("pending_approval"); expect(replay.version).toBe(current!.version);
  expect((await reconcileCountItem(scope, countId, itemId, input, actor)).status).toBe("completed");
});
it("deduplicates concurrent identical requests", async () => {
  const { countId, itemId, input } = await seed();
  const results = await Promise.all([1, 2].map(() => updateCountItem(scope, countId, itemId, input, actor)));
  expect(results.map(result => result.version)).toEqual([input.expectedVersion + 1, input.expectedVersion + 1]);
  expect(await InventoryCountRequestModel.countDocuments()).toBe(1);
});
it.each(["quantity", "version", "note", "actor", "branch", "item", "count"])("rejects reused identity with changed %s", async field => {
  const { countId, itemId, input } = await seed();
  await updateCountItem(scope, countId, itemId, input, actor);
  const changed = { ...input, ...(field === "quantity" ? { countedQuantity: 8 } : field === "version" ? { expectedVersion: 9 } : field === "note" ? { note: "changed" } : {}) };
  const args = [field === "branch" ? { ...scope, branchId: "other" } : scope, field === "count" ? String(new mongoose.Types.ObjectId()) : countId, field === "item" ? "other" : itemId, changed, field === "actor" ? { id: "other" } : actor] as const;
  await expect(updateCountItem(...args)).rejects.toMatchObject({ statusCode: 409 });
  await expect(reconcileCountItem(...args)).rejects.toMatchObject({ statusCode: 409 });
  expect((await InventoryCountModel.findById(countId))!.items[0].countedQuantity).toBe(7);
});
it("rolls the count back if evidence cannot be persisted", async () => {
  const { countId, itemId, input } = await seed();
  vi.spyOn(InventoryCountRequestModel, "create").mockRejectedValueOnce(new Error("evidence write failed"));
  await expect(updateCountItem(scope, countId, itemId, input, actor)).rejects.toThrow("evidence write failed");
  const saved = await InventoryCountModel.findById(countId);
  expect(saved!.version).toBe(input.expectedVersion); expect(saved!.items[0].countedQuantity).toBe(10);
  expect(await InventoryCountRequestModel.countDocuments()).toBe(0);
});
it("does not infer completion from equal quantities or fabricate legacy evidence", async () => {
  const { countId, itemId, input } = await seed();
  await updateCountItem(scope, countId, itemId, { expectedVersion: input.expectedVersion, countedQuantity: 7 });
  expect((await reconcileCountItem(scope, countId, itemId, input, actor)).status).toBe("not_found");
  await expect(updateCountItem(scope, countId, itemId, input, actor)).rejects.toMatchObject({ statusCode: 409 });
  expect(await InventoryCountRequestModel.countDocuments()).toBe(0);
});
it.each(["missing", "regressed", "corrupt-gate"])("rejects incomplete evidence: %s", async failure => {
  const { countId, itemId, input } = await seed(); await updateCountItem(scope, countId, itemId, input, actor);
  if (failure === "missing") await InventoryCountModel.deleteOne({ _id: countId });
  if (failure === "regressed") await InventoryCountModel.updateOne({ _id: countId }, { $set: { version: input.expectedVersion } });
  if (failure === "corrupt-gate") await InventoryCountRequestModel.updateOne({ requestId: input.requestId }, { $set: { committedVersion: 99 } });
  await expect(reconcileCountItem(scope, countId, itemId, input, actor)).rejects.toMatchObject({ statusCode: 409 });
  await expect(updateCountItem(scope, countId, itemId, input, actor)).rejects.toMatchObject({ statusCode: 409 });
});
it("rejects invalid keys and unidentified actors without any writes", async () => {
  const { countId, itemId, input } = await seed();
  await expect(updateCountItem(scope, countId, itemId, { ...input, requestId: "" }, actor)).rejects.toMatchObject({ statusCode: 400 });
  await expect(updateCountItem(scope, countId, itemId, input)).rejects.toMatchObject({ statusCode: 401 });
  expect(await InventoryCountRequestModel.countDocuments()).toBe(0);
});

it("allows only one winner when the same key targets two different counts concurrently", async () => {
  const first = await seed(), second = await seed(); second.input.requestId = first.input.requestId;
  const results = await Promise.allSettled([first, second].map(({ countId, itemId, input }) => updateCountItem(scope, countId, itemId, input, actor)));
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  const counts = await InventoryCountModel.find().lean();
  expect(counts.map(count => count.items[0].countedQuantity).sort()).toEqual([10, 7]);
  expect(await InventoryCountRequestModel.countDocuments()).toBe(1);
});
it("does not expose evidence through another company", async () => {
  const { countId, itemId, input } = await seed(); await updateCountItem(scope, countId, itemId, input, actor);
  await expect(reconcileCountItem({ ...scope, companyCode: "OTHER" }, countId, itemId, input, actor)).rejects.toMatchObject({ statusCode: 404 });
});
it("leaves no evidence for a rejected edit and refuses non-transactional fallback", async () => {
  const { countId, itemId, input } = await seed();
  await expect(updateCountItem(scope, countId, itemId, { ...input, expectedVersion: 99 }, actor)).rejects.toMatchObject({ statusCode: 409 });
  vi.stubEnv("DISABLE_TRANSACTIONS", "true");
  try { await expect(updateCountItem(scope, countId, itemId, input, actor)).rejects.toMatchObject({ statusCode: 503 }); }
  finally { vi.unstubAllEnvs(); }
  expect(await InventoryCountRequestModel.countDocuments()).toBe(0);
  expect((await InventoryCountModel.findById(countId))!.items[0].countedQuantity).toBe(10);
});

it("writes a durable tombstone before a late writer and rejects that writer", async () => {
  const { countId, itemId, input } = await seed();
  await expect((await import("./inventory-count.service")).revokeCountItemRequest(scope, countId, itemId, input, actor)).resolves.toMatchObject({ status: "revoked", requestId: input.requestId });
  await expect(updateCountItem(scope, countId, itemId, input, actor)).rejects.toMatchObject({ statusCode: 409, message: /đã được thu hồi/ });
  expect((await InventoryCountModel.findById(countId))!.items[0].countedQuantity).toBe(10);
  expect((await InventoryCountRequestModel.findOne({ requestId: input.requestId }).lean())?.status).toBe("revoked");
  await expect(reconcileCountItem(scope, countId, itemId, input, actor)).resolves.toMatchObject({ status: "revoked" });
});
it("returns completion evidence instead of reversing an already committed count", async () => {
  const { countId, itemId, input } = await seed(); await updateCountItem(scope, countId, itemId, input, actor);
  const before = await InventoryCountModel.findById(countId).lean();
  const result = await (await import("./inventory-count.service")).revokeCountItemRequest(scope, countId, itemId, input, actor);
  expect(result).toMatchObject({ status: "completed", committedVersion: input.expectedVersion + 1 });
  expect(await InventoryCountModel.findById(countId).lean()).toEqual(before);
  expect((await InventoryCountRequestModel.findOne({ requestId: input.requestId }).lean())?.status).toBe("completed");
});
it("makes revoke idempotent and binds it to the original fingerprint and actor", async () => {
  const { countId, itemId, input } = await seed();
  const { revokeCountItemRequest } = await import("./inventory-count.service");
  await revokeCountItemRequest(scope, countId, itemId, input, actor);
  await expect(revokeCountItemRequest(scope, countId, itemId, input, actor)).resolves.toMatchObject({ status: "revoked" });
  await expect(revokeCountItemRequest(scope, countId, itemId, { ...input, countedQuantity: 8 }, actor)).rejects.toMatchObject({ statusCode: 409 });
  await expect(revokeCountItemRequest(scope, countId, itemId, input, { id: "other" })).rejects.toMatchObject({ statusCode: 409 });
  expect(await InventoryCountRequestModel.countDocuments()).toBe(1);
});
it("serializes a racing write and revocation on the same unique key", async () => {
  const { countId, itemId, input } = await seed();
  const { revokeCountItemRequest } = await import("./inventory-count.service");
  const outcomes = await Promise.allSettled([updateCountItem(scope, countId, itemId, input, actor), revokeCountItemRequest(scope, countId, itemId, input, actor)]);
  const gate = await InventoryCountRequestModel.findOne({ requestId: input.requestId }).lean();
  const saved: any = await InventoryCountModel.findById(countId).lean();
  expect(await InventoryCountRequestModel.countDocuments({ requestId: input.requestId })).toBe(1);
  if (gate?.status === "revoked") {
    expect(outcomes[0].status).toBe("rejected"); expect(saved.items[0].countedQuantity).toBe(10);
  } else {
    expect(gate?.status).toBe("completed"); expect(outcomes[0].status).toBe("fulfilled");
    expect(outcomes[1].status).toBe("fulfilled"); expect(saved.items[0].countedQuantity).toBe(7);
  }
});
it("does not create a revocation tombstone for a missing count", async () => {
  const { countId, itemId, input } = await seed(); await InventoryCountModel.deleteOne({ _id: countId });
  const { revokeCountItemRequest } = await import("./inventory-count.service");
  await expect(revokeCountItemRequest(scope, countId, itemId, input, actor)).rejects.toMatchObject({ statusCode: 404 });
  expect(await InventoryCountRequestModel.countDocuments()).toBe(0);
});

it("does not revoke when the count advanced without matching request evidence", async () => {
  const { countId, itemId, input } = await seed();
  await updateCountItem(scope, countId, itemId, { expectedVersion: input.expectedVersion, countedQuantity: 8 });
  const { revokeCountItemRequest } = await import("./inventory-count.service");
  await expect(revokeCountItemRequest(scope, countId, itemId, input, actor)).rejects.toMatchObject({ statusCode: 409, message: /chưa thu hồi/ });
  expect(await InventoryCountRequestModel.countDocuments()).toBe(0);
  expect((await InventoryCountModel.findById(countId))!.items[0].countedQuantity).toBe(8);
});
