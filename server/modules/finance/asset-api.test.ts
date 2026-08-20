import assert from "node:assert/strict";
import { test } from "vitest";
import { ERROR_CODES } from "../../errors/error-codes";
import { createAssetController } from "./controllers/asset.controller";
import { financeAssetRoutes, FINANCE_ASSET_ROUTE_PERMISSIONS } from "./routes/asset.routes";
import { createAssetService, depreciationLineFor } from "./services/asset.service";
import { validateAssetCreation, validateAssetDisposal, validateAssetTransfer, validateAssetUpdate, validatePeriod } from "./validations/asset.validation";

const ASSET = {
  _id: "a1", companyCode: "ACME", branchId: "B1", assetCode: "TS-001", barcode: "BC1", name: "Máy in", group: "Thiết bị",
  originalCost: 12_000, salvageValue: 0, inServiceDate: new Date("2026-01-10T00:00:00.000Z"), usefulLifeMonths: 12,
  status: "in_use", accumulatedDepreciation: 0, netBookValue: 12_000,
};

const rejectsWithCode = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: any) => error.code === code || assert.fail(`expected ${code}, got ${error.code}`));

function stubRepository(overrides: any = {}) {
  const calls: any[] = [];
  const repository: any = {
    list: async () => [ASSET],
    findById: async () => ASSET,
    findByCodeOrBarcode: async () => null,
    create: async (values: any) => { calls.push(["create", values]); return values; },
    update: async (_scope: any, id: string, update: any) => { calls.push(["update", id, update]); return { ...ASSET, applied: update }; },
    listDepreciable: async () => [ASSET],
    findDepreciation: async () => null,
    upsertDepreciation: async (assetId: string, period: string, values: any) => ({ _id: `d-${assetId}-${period}`, ...values }),
    listDepreciations: async () => [],
    markDepreciationPosted: async (id: string, postedBy: string) => { calls.push(["post", id, postedBy]); return { _id: id, status: "posted", postedBy }; },
    ...overrides,
  };
  return { repository, calls };
}

test("asset routes expose documented endpoints with exact permission classes", () => {
  assert.deepEqual(FINANCE_ASSET_ROUTE_PERMISSIONS, {
    "GET /": "asset:read", "GET /depreciations": "asset:read", "GET /:id": "asset:read", "GET /:id/schedule": "asset:read",
    "POST /": "asset:manage", "PATCH /:id": "asset:manage", "POST /:id/transfer": "asset:manage", "POST /:id/disposal": "asset:manage",
    "POST /depreciations/run": "asset:manage", "POST /depreciations/post": "asset:manage",
  });
  const layers = financeAssetRoutes.stack.filter((layer: any) => layer.route);
  const routes = layers.map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.deepEqual([...routes].sort(), Object.keys(FINANCE_ASSET_ROUTE_PERMISSIONS).sort());
  assert.equal(layers.every((layer: any) => layer.route.stack.length === 2), true);
});

test("collection routes are matched before the :id parameter route", () => {
  const paths = financeAssetRoutes.stack.filter((layer: any) => layer.route).map((layer: any) => layer.route.path);
  assert.ok(paths.indexOf("/depreciations") < paths.indexOf("/:id"));
});

test("controller derives scope from the actor, ignores body scope, and forwards errors", async () => {
  const calls: any[] = [];
  const dependencies: any = {};
  for (const name of ["list", "detail", "schedule", "create", "update", "transfer", "dispose", "listDepreciations", "runDepreciation", "postDepreciation"]) {
    dependencies[name] = async (...args: any[]) => { calls.push([name, ...args]); return { name }; };
  }
  const controller: any = createAssetController(dependencies);
  const response = { json: (value: any) => value } as any;
  const actor = { id: "u1", role: "user", companyCode: "ACME", branchId: "B1" };

  await controller.create({ user: actor, query: {}, params: {}, body: {
    assetCode: " TS-001 ", barcode: " BC1 ", name: " Máy in ", group: " Thiết bị ", originalCost: 12_000,
    inServiceDate: "2026-01-10T00:00:00.000Z", usefulLifeMonths: 12, companyCode: "EVIL", branchId: "B9",
  } }, response, assert.fail);
  assert.deepEqual(calls[0][1], { companyCode: "ACME", branchId: "B1" });
  assert.equal(calls[0][2].assetCode, "TS-001");
  assert.equal((calls[0][2] as any).companyCode, undefined);

  await controller.postDepreciation({ user: actor, query: {}, params: {}, body: { period: "2026-03" } }, response, assert.fail);
  assert.deepEqual(calls[1], ["postDepreciation", { companyCode: "ACME", branchId: "B1" }, "2026-03", actor]);

  const error = new Error("boom");
  const failing: any = createAssetController({ ...dependencies, detail: async () => { throw error; } });
  let forwarded: any;
  await failing.detail({ user: actor, query: {}, params: { id: "a1" }, body: {} }, response, (value: any) => { forwarded = value; });
  assert.equal(forwarded, error);
});

test("validation normalizes asset payloads and rejects malformed input", () => {
  assert.deepEqual(validateAssetCreation({
    assetCode: " TS-001 ", barcode: " BC1 ", name: " Máy in ", group: " Thiết bị ", originalCost: 12_000, salvageValue: 1_000,
    inServiceDate: "2026-01-10T00:00:00.000Z", usefulLifeMonths: 12, location: " Kho A ",
  }), {
    assetCode: "TS-001", barcode: "BC1", name: "Máy in", group: "Thiết bị", originalCost: 12_000, salvageValue: 1_000,
    inServiceDate: new Date("2026-01-10T00:00:00.000Z"), usefulLifeMonths: 12, location: "Kho A",
  });
  const base = { assetCode: "T", barcode: "B", name: "N", group: "G", originalCost: 100, inServiceDate: "2026-01-10T00:00:00.000Z", usefulLifeMonths: 12 };
  assert.throws(() => validateAssetCreation({ ...base, originalCost: 0 }), /INVALID_VND_AMOUNT/);
  assert.throws(() => validateAssetCreation({ ...base, salvageValue: 200 }), /SALVAGE_EXCEEDS_COST/);
  assert.throws(() => validateAssetCreation({ ...base, usefulLifeMonths: 0 }), /INVALID_USEFUL_LIFE/);
  assert.throws(() => validateAssetCreation({ ...base, inServiceDate: "10-01-2026" }), /INVALID_DATE/);
  assert.throws(() => validateAssetCreation({ ...base, inServiceDate: "2026-02-30T00:00:00.000Z" }), /INVALID_DATE/);

  assert.deepEqual(validateAssetUpdate({ name: " Máy in màu ", note: " Đổi tên " }), { patch: { name: "Máy in màu" }, note: "Đổi tên" });
  assert.throws(() => validateAssetUpdate({}), /EMPTY_UPDATE/);
  assert.throws(() => validateAssetUpdate({ status: "disposed" }), /INVALID_ASSET_STATUS/);
  assert.deepEqual(validateAssetTransfer({ branchId: " B2 ", reason: " Điều chuyển " }), { branchId: "B2", reason: "Điều chuyển" });
  assert.throws(() => validateAssetTransfer({ branchId: "B2" }), /REASON_REQUIRED/);
  assert.deepEqual(validateAssetDisposal({ disposedAt: "2026-06-30T00:00:00.000Z", disposalAmount: 500, reason: " Hỏng " }), {
    disposedAt: new Date("2026-06-30T00:00:00.000Z"), disposalAmount: 500, reason: "Hỏng",
  });
  assert.equal(validatePeriod(" 2026-03 "), "2026-03");
  for (const period of ["2026-13", "2026-3", "03-2026"]) assert.throws(() => validatePeriod(period), /INVALID_PERIOD/);
});

test("service records append-only lifecycle events for updates, transfers, and disposal", async () => {
  const { repository, calls } = stubRepository();
  const service = createAssetService(repository);
  const scope = { companyCode: "ACME", branchId: "B1" };
  const actor = { id: "u1" };

  await service.update(scope, "a1", { patch: { name: "Máy in màu" }, note: "Đổi tên" }, actor);
  const [, , updateDocument] = calls.find(([kind]) => kind === "update");
  assert.deepEqual(updateDocument.$set, { name: "Máy in màu" });
  assert.equal(updateDocument.$push.lifecycleEvents.type, "updated");
  assert.deepEqual(updateDocument.$push.lifecycleEvents.before, { name: "Máy in" });
  assert.equal(updateDocument.$push.lifecycleEvents.by, "u1");

  await service.transfer(scope, "a1", { branchId: "B2", reason: "Điều chuyển" }, actor);
  const transfer = calls.filter(([kind]) => kind === "update").at(-1)![2];
  assert.deepEqual(transfer.$set, { branchId: "B2" });
  assert.equal(transfer.$push.lifecycleEvents.type, "transferred");
  assert.deepEqual(transfer.$push.lifecycleEvents.before.branchId, "B1");

  await service.dispose(scope, "a1", { disposedAt: new Date("2026-06-30T00:00:00.000Z"), disposalAmount: 500, reason: "Hỏng" }, actor);
  const disposal = calls.filter(([kind]) => kind === "update").at(-1)![2];
  assert.equal(disposal.$set.status, "disposed");
  assert.equal(disposal.$push.lifecycleEvents.type, "disposed");
});

test("service blocks mutations and disposal dates that contradict the asset state", async () => {
  const disposed = createAssetService(stubRepository({ findById: async () => ({ ...ASSET, status: "disposed" }) }).repository);
  const scope = { companyCode: "ACME", branchId: "B1" };
  await rejectsWithCode(disposed.update(scope, "a1", { patch: { name: "x" } }, {}), "ASSET_ALREADY_DISPOSED");
  await rejectsWithCode(disposed.transfer(scope, "a1", { branchId: "B2", reason: "r" }, {}), "ASSET_ALREADY_DISPOSED");

  const missing = createAssetService(stubRepository({ findById: async () => null }).repository);
  await rejectsWithCode(missing.detail(scope, "a1"), "ASSET_NOT_FOUND");

  const active = createAssetService(stubRepository().repository);
  await assert.rejects(
    active.dispose(scope, "a1", { disposedAt: new Date("2025-12-01T00:00:00.000Z"), disposalAmount: 0, reason: "r" }, {}),
    /DISPOSAL_BEFORE_IN_SERVICE/,
  );
});

test("depreciation run plans the period line and skips periods outside the asset life", async () => {
  const { repository } = stubRepository();
  const service = createAssetService(repository);
  const scope = { companyCode: "ACME", branchId: "B1" };

  const result = await service.runDepreciation(scope, "2026-03");
  assert.equal(result.planned, 1);
  assert.deepEqual(
    { amount: result.lines[0].amount, accumulatedAfter: result.lines[0].accumulatedAfter, status: result.lines[0].status },
    { amount: 1_000, accumulatedAfter: 3_000, status: "planned" },
  );
  assert.equal((await service.runDepreciation(scope, "2027-06")).planned, 0);
  assert.equal(depreciationLineFor(ASSET, "2027-06"), null);
});

test("depreciation run leaves already posted periods untouched", async () => {
  const service = createAssetService(stubRepository({ findDepreciation: async () => ({ status: "posted" }) }).repository);
  assert.equal((await service.runDepreciation({ companyCode: "ACME", branchId: "B1" }, "2026-03")).planned, 0);
});

test("posting a period writes accumulated depreciation back onto the asset exactly once", async () => {
  const planned = [{ _id: "d1", assetId: "a1", period: "2026-03", amount: 1_000, accumulatedAfter: 3_000, netBookValueAfter: 9_000, status: "planned" }];
  const { repository, calls } = stubRepository({ listDepreciations: async () => planned });
  const service = createAssetService(repository);
  const scope = { companyCode: "ACME", branchId: "B1" };

  const result = await service.postDepreciation(scope, "2026-03", { id: "u1" });
  assert.equal(result.posted, 1);
  assert.deepEqual(calls.find(([kind]) => kind === "update")![2].$set, { accumulatedDepreciation: 3_000, netBookValue: 9_000 });
  assert.deepEqual(calls.find(([kind]) => kind === "post")!.slice(1), ["d1", "u1"]);

  const settled = createAssetService(stubRepository({ listDepreciations: async () => [{ ...planned[0], status: "posted" }] }).repository);
  await rejectsWithCode(settled.postDepreciation(scope, "2026-03", {}), "ASSET_PERIOD_ALREADY_POSTED");

  const empty = createAssetService(stubRepository({ listDepreciations: async () => [] }).repository);
  await rejectsWithCode(empty.postDepreciation(scope, "2026-03", {}), "ASSET_PERIOD_NOT_SCHEDULED");
});

test("documented fixed-asset error codes are registered", () => {
  for (const code of ["ASSET_NOT_FOUND", "ASSET_CODE_ALREADY_EXISTS", "ASSET_ALREADY_DISPOSED", "ASSET_PERIOD_ALREADY_POSTED", "ASSET_PERIOD_NOT_SCHEDULED"]) {
    assert.equal((ERROR_CODES as any)[code], code);
  }
});
