import { mongo } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { collections, reconcileInventory, validateBaseline, type Finding } from "./reconciliation.service";
import { csvCell } from "./reconciliation-output";

let replica: MongoMemoryReplSet, client: mongo.MongoClient, db: mongo.Db;
const companyCode = "AUDIT", branch = new mongo.ObjectId(), warehouse = new mongo.ObjectId(), product = new mongo.ObjectId(), variant = new mongo.ObjectId();
const location = { companyCode, branchId: String(branch), warehouseId: String(warehouse), productId: String(product), variantId: String(variant), sku: "PHONE" };
const commands: string[] = [];
const col = (name: keyof typeof collections) => db.collection<any>(collections[name]);
async function run(options: any = {}, scope: any = { companyCode }, onFinding?: (finding: Finding) => Promise<void>) {
  const findings: Finding[] = [];
  const session = client.startSession({ snapshot: true });
  try { const summary = await reconcileInventory(db, session, scope, async (finding) => { findings.push(finding); await onFinding?.(finding); }, options); return { findings, summary }; }
  finally { await session.endSession(); }
}
beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = new mongo.MongoClient(replica.getUri(), { monitorCommands: true });
  client.on("commandStarted", (event) => commands.push(event.commandName));
  await client.connect(); db = client.db("reconciliation");
  for (const name of Object.values(collections)) await db.createCollection(name);
}, 60000);
beforeEach(async () => {
  for (const name of Object.keys(collections) as Array<keyof typeof collections>) await col(name).deleteMany({});
  await col("branches").insertOne({ _id: branch, companyCode });
  await col("warehouses").insertOne({ _id: warehouse, companyCode, branchId: String(branch), kind: "selling" });
  await col("products").insertOne({ _id: product, companyCode });
  await col("variants").insertOne({ _id: variant, companyCode, productId: String(product), sku: "PHONE", trackingMode: "quantity" });
  await col("balances").insertOne({ ...location, quantity: 2, reservedQuantity: 0, averageCost: 100 });
  await col("ledger").insertOne({ ...location, direction: "in", quantity: 2, quantityDelta: 2, unitCost: 100, purpose: "opening", sourceType: "opening", sourceId: "reviewed-opening", createdAt: new Date("2021-01-01") });
  commands.length = 0;
});
afterAll(async () => { await client?.close(); await replica?.stop(); });

it("reports a healthy complete-ledger fixture with no database mutations", async () => {
  const result = await run({ ledgerComplete: true, batchSize: 1 });
  expect(result.findings).toEqual([]);
  expect(result.summary).toMatchObject({ complete: true, status: "clean", examined: { balances: 1, ledger: 1 } });
  expect(commands.every((command) => ["find", "aggregate", "getMore", "killCursors"].includes(command))).toBe(true);
});
it("does not infer zero opening stock when the baseline is unknown", async () => {
  await col("balances").updateOne({}, { $set: { quantity: 99 } });
  const result = await run();
  expect(result.findings.map((f) => f.code)).toEqual(["BASELINE_UNVERIFIED"]);
  expect(result.summary.status).toBe("needs-review");
});
it("adds only post-baseline ledger and detects quantity/value drift", async () => {
  const baseline = { schemaVersion: 1, companyCode, asOf: "2022-01-01T00:00:00.000Z", balances: [{ ...location, quantity: 2, value: 200 }] };
  expect((await run({ baseline })).findings).toEqual([]);
  await col("ledger").insertOne({ ...location, direction: "in", quantity: 1, quantityDelta: 1, unitCost: 300, purpose: "opening", createdAt: new Date("2023-01-01") });
  await col("balances").updateOne({}, { $set: { quantity: 3, averageCost: 500 / 3 } });
  expect((await run({ baseline })).findings).toEqual([]);
  await col("balances").updateOne({}, { $set: { quantity: 4 } });
  const codes = (await run({ baseline })).findings.map((f) => f.code);
  expect(codes).toContain("BALANCE_LEDGER_MISMATCH");
  expect(codes).toContain("VALUE_LEDGER_MISMATCH");
});
it("validates scope and ignores another tenant's records", async () => {
  await col("balances").insertOne({ ...location, companyCode: "OTHER", quantity: -99 });
  expect((await run({ ledgerComplete: true })).findings).toEqual([]);
  await expect(run({}, { companyCode: "OTHER", branchId: String(branch) })).rejects.toThrow(/Chi nhánh/);
  await expect(run({}, { companyCode, branchId: String(new mongo.ObjectId()), warehouseId: String(warehouse) })).rejects.toThrow();
});
it("checks tracked stock counts without counting sold or internally allocated units as available", async () => {
  await col("variants").updateOne({}, { $set: { trackingMode: "serial" } });
  await col("units").insertMany([1, 2].map((n) => ({ ...location, status: "in_stock", serialNumber: `I${n}`, normalizedSerialNumber: `I${n}` })));
  await col("units").insertOne({ ...location, status: "sold", serialNumber: "SOLD" });
  expect((await run({ ledgerComplete: true })).findings).toEqual([]);
  await col("units").updateOne({ serialNumber: "I1" }, { $set: { status: "sold" } });
  expect((await run({ ledgerComplete: true })).findings.map((f) => f.code)).toContain("SERIAL_BALANCE_MISMATCH");
});
it("detects legacy in-flight machines, stale allocations and wrong locations", async () => {
  await col("variants").updateOne({}, { $set: { trackingMode: "serial" } });
  await col("units").insertMany([
    { ...location, status: "in_transit", serialNumber: "OLD" },
    { ...location, status: "internal_use", serialNumber: "USE", internalUse: { stockLogId: String(new mongo.ObjectId()) } },
    { ...location, status: "sold", warehouseId: String(new mongo.ObjectId()), internalUse: { recipientName: "Stale" } },
  ]);
  const codes = (await run({ ledgerComplete: true })).findings.map((f) => f.code);
  for (const code of ["TRANSIT_DOCUMENT_MISMATCH", "INTERNAL_USE_MISMATCH", "STALE_INTERNAL_USE", "LOCATION_INVALID"]) expect(codes).toContain(code);
});
it("distinguishes orphan ledger, unsupported source verification and a missing balance", async () => {
  await col("ledger").updateOne({}, { $set: { purpose: "sale", sourceType: "manual-stock-log", sourceId: String(new mongo.ObjectId()) } });
  expect((await run({ ledgerComplete: true })).findings.map((f) => f.code)).toContain("LEDGER_SOURCE_MISSING");
  await col("ledger").updateOne({}, { $set: { sourceType: "unknown-plugin" } });
  expect((await run({ ledgerComplete: true })).findings.map((f) => f.code)).toContain("SOURCE_TYPE_UNVERIFIED");
  await col("balances").deleteMany({});
  expect((await run()).findings.map((f) => f.code)).toContain("LEDGER_BALANCE_MISSING");
});
it("does not accuse a confirmed receipt of missing machines after they have been sold", async () => {
  const receiptId = new mongo.ObjectId(), unitId = new mongo.ObjectId();
  await col("variants").updateOne({}, { $set: { trackingMode: "serial" } });
  await col("balances").updateOne({}, { $set: { quantity: 0 } });
  await col("ledger").deleteMany({});
  await col("receipts").insertOne({ _id: receiptId, ...location, status: "confirmed", items: [{ ...location, quantity: 1, trackingMode: "serial", serialNumbers: ["IMEI"] }] });
  await col("ledger").insertOne({ ...location, direction: "in", quantity: 1, quantityDelta: 1, unitCost: 100, sourceType: "goods-receipt", sourceId: String(receiptId) });
  await col("units").insertOne({ _id: unitId, ...location, status: "sold", normalizedSerialNumber: "IMEI" });
  await col("events").insertOne({ companyCode, serialUnitId: String(unitId), documentType: "goods-receipt", documentId: String(receiptId), toStatus: "in_stock" });
  const result = await run();
  expect(result.findings.map((f) => f.code)).toEqual(["BASELINE_UNVERIFIED"]);
  await col("events").deleteMany({});
  expect((await run()).findings.map((f) => f.code)).toContain("RECEIPT_SERIAL_EVIDENCE_MISSING");
});
it("detects transit cost/quantity corruption and incorrect transfer legs", async () => {
  const transferId = new mongo.ObjectId(), transit = new mongo.ObjectId();
  await col("warehouses").insertOne({ _id: transit, companyCode, branchId: String(branch), kind: "transit" });
  await col("transfers").insertOne({ _id: transferId, companyCode, fromBranchId: String(branch), toBranchId: String(branch), fromWarehouseId: String(warehouse), toWarehouseId: String(warehouse), transitWarehouseId: String(transit), status: "in_transit", items: [{ ...location, quantity: 1, unitCost: 100, trackingMode: "quantity" }] });
  await col("balances").insertOne({ ...location, warehouseId: String(transit), quantity: 0, averageCost: 99, reservedQuantity: 0 });
  const codes = (await run()).findings.map((f) => f.code);
  expect(codes).toContain("TRANSFER_BALANCE_MISMATCH");
  expect(codes).toContain("TRANSFER_LEDGER_MISMATCH");
});
it("keeps a single snapshot even when the live database changes during output", async () => {
  let changed = false;
  const result = await run({}, { companyCode }, async () => {
    if (changed) return; changed = true;
    await col("balances").insertOne({ ...location, sku: "LATER", variantId: String(new mongo.ObjectId()), quantity: -999 });
  });
  expect(result.summary.examined.balances).toBe(1);
  expect(result.findings.map((f) => f.code)).toEqual(["BASELINE_UNVERIFIED"]);
  expect(await col("balances").countDocuments()).toBe(2);
});
it("refuses missing snapshots, contradictory baselines and incomplete scans", async () => {
  const session = client.startSession();
  try { await expect(reconcileInventory(db, session, { companyCode }, async () => {})).rejects.toThrow(/snapshot/); }
  finally { await session.endSession(); }
  await expect(run({ maxDocuments: 1 })).rejects.toThrow(/maxDocuments/);
  expect(() => validateBaseline({ schemaVersion: 1, companyCode: "OTHER", asOf: "2022-01-01T00:00:00Z", balances: [] }, companyCode)).toThrow();
  const row = { ...location, quantity: 1, value: 100 };
  expect(() => validateBaseline({ schemaVersion: 1, companyCode, asOf: "2022-01-01T00:00:00Z", balances: [row, row] }, companyCode)).toThrow(/trùng/);
});
it("flags broken reversal links and preserves CSV text without executing formulas", async () => {
  await col("logs").insertOne({ ...location, status: "Hoàn thành", items: [], reversalId: String(new mongo.ObjectId()) });
  expect((await run()).findings.map((f) => f.code)).toContain("REVERSAL_LINK_INVALID");
  expect(csvCell("=HYPERLINK(\"bad\")")).toBe('"\'=HYPERLINK(""bad"")"');
  expect(csvCell("Name, \"quoted\"\nnext")).toBe('"Name, ""quoted""\nnext"');
  expect(csvCell(-5)).toBe('"-5"');
});
it("writes complete CLI reports and leaves failed runs explicitly incomplete", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "inventory-audit-test-"));
  const cli = (out: string, extra: string[]) => spawnSync(process.execPath, ["--import", "tsx", "tools/reconcile-inventory.ts", "--company", companyCode, "--db", db.databaseName, "--out", path.join(root, out), ...extra], { cwd: process.cwd(), encoding: "utf8", timeout: 30000, env: { ...process.env, INVENTORY_AUDIT_MONGODB_URI: replica.getUri() } });
  const clean = cli("clean", ["--ledger-complete"]);
  expect(clean.stderr).toBe(""); expect(clean.status).toBe(0);
  expect(JSON.parse(await readFile(path.join(root, "clean/summary.json"), "utf8"))).toMatchObject({ complete: true, status: "clean" });
  expect(await readFile(path.join(root, "clean/findings.jsonl"), "utf8")).toBe("");
  expect(cli("review", []).status).toBe(2);
  const review = (await readFile(path.join(root, "review/findings.jsonl"), "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  expect(review[0].code).toBe("BASELINE_UNVERIFIED");
  expect(cli("partial", ["--max-documents", "1"]).status).toBe(1);
  await expect(access(path.join(root, "partial/summary.json"))).rejects.toThrow();
  await expect(access(path.join(root, "partial/findings.jsonl.partial"))).resolves.toBeUndefined();
  expect(cli("clean", []).status).toBe(1); // Never overwrite the first report.
}, 60000);

it("accepts a healthy internal allocation without treating it as available stock", async () => {
  const source = new mongo.ObjectId();
  await col("variants").updateOne({}, { $set: { trackingMode: "serial" } });
  await col("units").insertMany([1, 2].map((n) => ({ ...location, status: "in_stock", serialNumber: `I${n}` })));
  await col("ledger").updateOne({}, { $set: { quantity: 3, quantityDelta: 3 } });
  await col("ledger").insertOne({ ...location, quantity: 1, quantityDelta: -1, direction: "out", unitCost: 100, sourceType: "manual-stock-log", sourceId: String(source), sourceLine: 0 });
  await col("logs").insertOne({ _id: source, ...location, type: "xuất", purpose: "nội bộ", status: "Hoàn thành", customerName: "Lab", items: [{ ...location, quantity: 1, unitCost: 100, unitIdentifiers: ["INTERNAL"] }] });
  await col("units").insertOne({ ...location, status: "internal_use", normalizedSerialNumber: "INTERNAL", currentDocumentType: "manual-stock-log", currentDocumentId: String(source), internalUse: { stockLogId: String(source), recipientName: "Lab", unitCost: 100 } });
  expect((await run({ ledgerComplete: true })).findings).toEqual([]);
  await col("units").updateOne({ status: "internal_use" }, { $set: { "internalUse.unitCost": 500 } });
  expect((await run({ ledgerComplete: true })).findings.map((f) => f.code)).toContain("INTERNAL_USE_VALUE_MISMATCH");
});

it("checks retail and repair source existence inside the same branch", async () => {
  const source = new mongo.ObjectId();
  await col("ledger").updateOne({}, { $set: { purpose: "sale", sourceType: "retail-order", sourceId: String(source) } });
  await col("orders").insertOne({ _id: source, companyCode, branchId: String(branch) });
  expect((await run({ ledgerComplete: true })).findings).toEqual([]);
  await col("orders").updateOne({}, { $set: { branchId: String(new mongo.ObjectId()) } });
  expect((await run({ ledgerComplete: true })).findings.map((f) => f.code)).toContain("LEDGER_SOURCE_MISSING");
  await col("ledger").updateOne({}, { $set: { sourceType: "repair-ticket" } });
  await col("repairs").insertOne({ _id: source, companyCode, branchId: String(branch) });
  expect((await run({ ledgerComplete: true })).findings).toEqual([]);
});
