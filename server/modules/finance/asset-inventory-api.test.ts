import assert from "node:assert/strict";
import { test } from "vitest";
import { ERROR_CODES } from "../../errors/error-codes";
import { createAssetInventoryController } from "./controllers/asset-inventory.controller";
import { assertAssetInventorySessionUpdateAllowed } from "./models/asset-inventory.model";
import { financeAssetInventoryRoutes, FINANCE_ASSET_INVENTORY_ROUTE_PERMISSIONS } from "./routes/asset-inventory.routes";
import { createAssetInventoryService, summarizeVariance } from "./services/asset-inventory.service";
import { validateInventoryCount, validateInventoryOpening } from "./validations/asset-inventory.validation";

const rejectsWithCode = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: any) => error.code === code || assert.fail(`expected ${code}, got ${error.code}`));

const ASSETS = [
  { _id: "a1", companyCode: "ACME", branchId: "B1", assetCode: "TS-001", barcode: "BC1", name: "Máy in", location: "Kho A", custodianId: "u9", custodianName: "Lan" },
  { _id: "a2", companyCode: "ACME", branchId: "B1", assetCode: "TS-002", barcode: "BC2", name: "Máy chiếu" },
];

const OPEN_SESSION = {
  _id: "s1", companyCode: "ACME", sessionCode: "KK-2026-01", status: "open", branchIds: ["B1"],
  items: [
    { assetId: "a1", assetCode: "TS-001", barcode: "BC1", name: "Máy in", expectedBranchId: "B1", result: "pending" },
    { assetId: "a2", assetCode: "TS-002", barcode: "BC2", name: "Máy chiếu", expectedBranchId: "B1", result: "pending" },
  ],
};

function stubRepository(overrides: any = {}) {
  const calls: any[] = [];
  const repository: any = {
    listSessions: async () => [OPEN_SESSION],
    findSession: async () => OPEN_SESSION,
    findSessionByCode: async () => null,
    createSession: async (values: any) => { calls.push(["createSession", values]); return values; },
    recordCount: async (id: string, barcode: string, update: any) => { calls.push(["recordCount", id, barcode, update]); return OPEN_SESSION; },
    appendItem: async (id: string, item: any) => { calls.push(["appendItem", id, item]); return OPEN_SESSION; },
    finalizeSession: async (id: string, finalizedBy: string) => {
      calls.push(["finalizeSession", id, finalizedBy]);
      return { ...OPEN_SESSION, status: "finalized", items: [{ ...OPEN_SESSION.items[0], result: "present" }, { ...OPEN_SESSION.items[1], result: "missing" }] };
    },
    listAssetsForScope: async () => ASSETS,
    ...overrides,
  };
  return { repository, calls };
}

test("inventory routes expose documented endpoints with exact permission classes", () => {
  assert.deepEqual(FINANCE_ASSET_INVENTORY_ROUTE_PERMISSIONS, {
    "GET /": "asset:read", "GET /:id": "asset:read", "GET /:id/variance": "asset:read",
    "POST /": "asset:manage", "POST /:id/counts": "asset:manage", "POST /:id/finalize": "asset:manage",
  });
  const layers = financeAssetInventoryRoutes.stack.filter((layer: any) => layer.route);
  const routes = layers.map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.deepEqual([...routes].sort(), Object.keys(FINANCE_ASSET_INVENTORY_ROUTE_PERMISSIONS).sort());
  assert.equal(layers.every((layer: any) => layer.route.stack.length === 2), true);
});

test("controller derives scope from the actor and forwards errors", async () => {
  const calls: any[] = [];
  const dependencies: any = {};
  for (const name of ["list", "detail", "variance", "open", "count", "finalize"]) {
    dependencies[name] = async (...args: any[]) => { calls.push([name, ...args]); return { name }; };
  }
  const controller: any = createAssetInventoryController(dependencies);
  const response = { json: (value: any) => value } as any;
  const actor = { id: "u1", role: "user", companyCode: "ACME", branchId: "B1" };

  await controller.open({ user: actor, query: {}, params: {}, body: {
    sessionCode: " KK-2026-01 ", name: " Kiểm kê quý 1 ", scope: "branch", branchIds: ["B1", "B1"],
    inventoryDate: "2026-03-31T00:00:00.000Z", companyCode: "EVIL",
  } }, response, assert.fail);
  assert.deepEqual(calls[0][1], { companyCode: "ACME", branchId: "B1" });
  assert.deepEqual(calls[0][2].branchIds, ["B1"]);
  assert.equal(calls[0][2].sessionCode, "KK-2026-01");

  await controller.finalize({ user: actor, query: {}, params: { id: "s1" }, body: {} }, response, assert.fail);
  assert.deepEqual(calls[1], ["finalize", { companyCode: "ACME", branchId: "B1" }, "s1", actor]);

  const error = new Error("boom");
  const failing: any = createAssetInventoryController({ ...dependencies, detail: async () => { throw error; } });
  let forwarded: any;
  await failing.detail({ user: actor, query: {}, params: { id: "s1" }, body: {} }, response, (value: any) => { forwarded = value; });
  assert.equal(forwarded, error);
});

test("validation normalizes inventory payloads and rejects malformed input", () => {
  assert.deepEqual(validateInventoryOpening({
    sessionCode: " KK-1 ", name: " Kiểm kê ", scope: "branch", branchIds: [" B1 ", "B1", ""], inventoryDate: "2026-03-31T00:00:00.000Z",
  }), { sessionCode: "KK-1", name: "Kiểm kê", scope: "branch", branchIds: ["B1"], inventoryDate: new Date("2026-03-31T00:00:00.000Z") });
  assert.deepEqual(validateInventoryOpening({ sessionCode: "KK-1", name: "N", scope: "company", inventoryDate: "2026-03-31T00:00:00.000Z" }).branchIds, []);
  const base = { sessionCode: "KK-1", name: "N", scope: "branch", branchIds: ["B1"], inventoryDate: "2026-03-31T00:00:00.000Z" };
  assert.throws(() => validateInventoryOpening({ ...base, branchIds: [] }), /BRANCH_REQUIRED/);
  assert.throws(() => validateInventoryOpening({ ...base, scope: "region" }), /INVALID_INVENTORY_SCOPE/);
  assert.throws(() => validateInventoryOpening({ ...base, inventoryDate: "31-03-2026" }), /INVALID_DATE/);
  assert.throws(() => validateInventoryOpening({ ...base, sessionCode: " " }), /SESSION_CODE_REQUIRED/);

  assert.deepEqual(validateInventoryCount({ barcode: " BC1 ", result: "damaged", note: " Vỡ vỏ " }), { barcode: "BC1", result: "damaged", note: "Vỡ vỏ" });
  for (const result of ["pending", "missing", "broken"]) {
    assert.throws(() => validateInventoryCount({ barcode: "BC1", result }), /INVALID_INVENTORY_RESULT/);
  }
  assert.throws(() => validateInventoryCount({ barcode: "", result: "present" }), /BARCODE_REQUIRED/);
});

test("opening a session freezes the expected asset population", async () => {
  const { repository, calls } = stubRepository();
  const service = createAssetInventoryService(repository);
  await service.open({ companyCode: "ACME", branchId: "B1" }, {
    sessionCode: "KK-1", name: "Kiểm kê", scope: "branch", branchIds: ["B1"], inventoryDate: new Date("2026-03-31T00:00:00.000Z"),
  }, { id: "u1" });
  const [, session] = calls.find(([kind]) => kind === "createSession")!;
  assert.equal(session.status, "open");
  assert.equal(session.createdBy, "u1");
  assert.equal(session.items.length, 2);
  assert.deepEqual(session.items[0], {
    assetId: "a1", assetCode: "TS-001", barcode: "BC1", name: "Máy in", expectedBranchId: "B1",
    expectedLocation: "Kho A", expectedCustodianId: "u9", expectedCustodianName: "Lan", result: "pending",
  });
  assert.equal(session.items[1].expectedLocation, undefined);
});

test("opening rejects duplicate codes and empty scopes", async () => {
  const scope = { companyCode: "ACME", branchId: "B1" };
  const input = { sessionCode: "KK-1", name: "N", scope: "branch", branchIds: ["B1"], inventoryDate: new Date() };
  const duplicate = createAssetInventoryService(stubRepository({ findSessionByCode: async () => OPEN_SESSION }).repository);
  await rejectsWithCode(duplicate.open(scope, input, {}), "INVENTORY_SESSION_CODE_EXISTS");
  const empty = createAssetInventoryService(stubRepository({ listAssetsForScope: async () => [] }).repository);
  await rejectsWithCode(empty.open(scope, input, {}), "INVENTORY_SCOPE_EMPTY");
});

test("counting a known barcode updates only the result fields of that item", async () => {
  const { repository, calls } = stubRepository();
  const service = createAssetInventoryService(repository);
  await service.count({ companyCode: "ACME" }, "s1", { barcode: "BC1", result: "damaged", note: "Vỡ vỏ" }, { id: "u1" });
  const [, id, barcode, update] = calls.find(([kind]) => kind === "recordCount")!;
  assert.deepEqual([id, barcode], ["s1", "BC1"]);
  assert.equal(update["items.$[item].result"], "damaged");
  assert.equal(update["items.$[item].scannedBy"], "u1");
  assert.equal(update["items.$[item].note"], "Vỡ vỏ");
  assert.doesNotThrow(() => assertAssetInventorySessionUpdateAllowed({ $set: update }));
});

test("counting an unknown barcode appends it as a surplus finding", async () => {
  const { repository, calls } = stubRepository();
  const service = createAssetInventoryService(repository);
  await service.count({ companyCode: "ACME" }, "s1", { barcode: "BC9", result: "present" }, { id: "u1" });
  assert.equal(calls.some(([kind]) => kind === "recordCount"), false);
  const [, , item] = calls.find(([kind]) => kind === "appendItem")!;
  assert.equal(item.result, "surplus");
  assert.equal(item.barcode, "BC9");
  assert.equal(item.expectedBranchId, "B1");
});

test("finalizing turns never-scanned items into missing findings and reports variance", async () => {
  const { repository, calls } = stubRepository();
  const service = createAssetInventoryService(repository);
  const result = await service.finalize({ companyCode: "ACME" }, "s1", { id: "u1" });
  assert.deepEqual(calls.find(([kind]) => kind === "finalizeSession")!.slice(1), ["s1", "u1"]);
  assert.equal(result.session.status, "finalized");
  assert.deepEqual(result.variance.counts, { present: 1, missing: 1 });
  assert.deepEqual(result.variance.variances.map((item: any) => item.barcode), ["BC2"]);
  assert.doesNotThrow(() => assertAssetInventorySessionUpdateAllowed({
    $set: { status: "finalized", finalizedBy: "u1", finalizedAt: new Date(), "items.$[pending].result": "missing" },
  }));
});

test("a finalized session accepts no further counts or finalization", async () => {
  const closed = createAssetInventoryService(stubRepository({ findSession: async () => ({ ...OPEN_SESSION, status: "finalized" }) }).repository);
  const scope = { companyCode: "ACME" };
  await rejectsWithCode(closed.count(scope, "s1", { barcode: "BC1", result: "present" }, {}), "INVENTORY_SESSION_CLOSED");
  await rejectsWithCode(closed.finalize(scope, "s1", {}), "INVENTORY_SESSION_CLOSED");

  const missing = createAssetInventoryService(stubRepository({ findSession: async () => null }).repository);
  await rejectsWithCode(missing.detail(scope, "s1"), "INVENTORY_SESSION_NOT_FOUND");
});

test("variance summary counts every result bucket and excludes pending from findings", () => {
  const summary = summarizeVariance({ items: [
    { barcode: "BC1", result: "present" }, { barcode: "BC2", result: "missing" },
    { barcode: "BC3", result: "damaged" }, { barcode: "BC4", result: "surplus" }, { barcode: "BC5", result: "pending" },
  ] });
  assert.equal(summary.total, 5);
  assert.deepEqual(summary.counts, { present: 1, missing: 1, damaged: 1, surplus: 1, pending: 1 });
  assert.deepEqual(summary.variances.map((item: any) => item.barcode), ["BC2", "BC3", "BC4"]);
});

test("documented inventory error codes are registered", () => {
  for (const code of ["INVENTORY_SESSION_NOT_FOUND", "INVENTORY_SESSION_CODE_EXISTS", "INVENTORY_SESSION_CLOSED", "INVENTORY_SCOPE_EMPTY"]) {
    assert.equal((ERROR_CODES as any)[code], code);
  }
});
