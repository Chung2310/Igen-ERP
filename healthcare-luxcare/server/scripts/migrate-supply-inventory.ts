/** Safe one-time migration from legacy supply stock to Inventory V2. */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import mongoose, { Types, type ClientSession } from "mongoose";
import { SupplyModel } from "../model/supply.model";
import { SupplyTransactionModel } from "../model/supply-transaction.model";
import { SupplyVoucherModel } from "../model/supply-voucher.model";
import { WarehouseModel } from "../model/warehouse.model";
import {
  SupplyCostLayerModel as CostLayer,
  SupplyInventoryAuditModel as Audit,
  SupplyInventoryConfigModel as Config,
  SupplyInventoryOutboxModel as Outbox,
  SupplyInventoryPeriodModel as Period,
  SupplyInventoryProfileModel as Profile,
  SupplyLotModel as Lot,
  SupplyStockBalanceModel as Balance,
  SupplyStockDocumentLineModel as DocumentLine,
  SupplyStockDocumentModel as StockDocument,
  SupplyStockLedgerModel as Ledger,
  SupplyWarehouseAccessModel as Access,
  SupplyWarehouseGuardModel as Guard,
} from "../model/supply-inventory.model";
import { inspectInventoryIndexes } from "../service/supply/inventory-indexes";
import { reconcileInventory } from "../service/supply/inventory-read.service";
import { supplyBusinessDay, supplyExpiryDay } from "../../shared/supply-stock";

type Plain = Record<string, any>;
type PlannedDocument = {
  document: Plain;
  lines: Plain[];
  ledgers: Plain[];
  layers: Plain[];
  audit: Plain;
  outbox: Plain;
};

const args = process.argv.slice(2);
const valueAfter = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const companyCode = (valueAfter("--company") || "").trim().toUpperCase();
const apply = args.includes("--apply");
const verify = args.includes("--verify");
const rollbackRunId = valueAfter("--rollback");

function safeInteger(value: unknown, label: string, min = 0) {
  if (!Number.isSafeInteger(value) || Number(value) < min) throw new Error(`${label} must be a safe integer >= ${min}.`);
  return Number(value);
}

function lineValue(quantity: number, unitPrice: unknown, label: string) {
  const price = Number(unitPrice);
  if (!Number.isSafeInteger(price) || price < 0) throw new Error(`${label}: unitPrice must be a non-negative integer VND amount.`);
  return safeInteger(quantity * price, `${label} total value`);
}

function json(value: unknown) {
  return JSON.stringify(value, (_key, item) => (item instanceof Types.ObjectId ? item.toHexString() : item), 2);
}

async function saveArtifact(runId: string, name: string, data: unknown) {
  const directory = resolve("tmp", "supply-migration", runId);
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, name);
  await writeFile(path, json(data), "utf8");
  return path;
}

const v2Models: any[] = [Config, Profile, Lot, Balance, StockDocument, DocumentLine, CostLayer, Ledger, Guard, Period, Access, Audit, Outbox];

async function ensureEmptyV2() {
  const counts = await Promise.all(v2Models.map(async (model) => [model.collection.name, await model.countDocuments({ companyCode })] as const));
  const populated = counts.filter(([, count]) => count > 0);
  if (populated.length) throw new Error(`V2 is not empty for ${companyCode}: ${populated.map(([name, count]) => `${name}=${count}`).join(", ")}.`);
}

function stockKey(input: Plain) {
  return {
    companyCode,
    branchId: input.branchId,
    warehouseId: input.warehouseId,
    locationId: "",
    supplyId: String(input.supply._id),
    lotId: input.lotId,
    containerId: "",
    quality: input.quality,
  };
}

function oneLineDocument(input: Plain): PlannedDocument {
  const documentId = new Types.ObjectId().toHexString();
  const lineId = new Types.ObjectId().toHexString();
  const layerId = new Types.ObjectId().toHexString();
  const totalValueMinor = lineValue(input.quantity, input.unitPrice, input.supply.code);
  const key = stockKey(input);
  const postedDay = supplyBusinessDay(input.when);
  return {
    document: {
      _id: documentId, companyCode, branchId: input.branchId, warehouseId: input.warehouseId,
      number: input.number, type: input.type, status: "posted", revision: 1,
      createdBy: input.actor, submittedBy: input.actor, approvedBy: input.actor,
      approvedRevision: 1, postedBy: input.actor, postedAt: input.when, postedDay,
      reason: input.reason, createdAt: input.when, updatedAt: input.when,
    },
    lines: [{
      _id: lineId, companyCode, documentId, lineNo: 1, supplyId: String(input.supply._id),
      supplyCode: input.supply.code, supplyName: input.supply.name, baseUnit: input.supply.unit,
      precision: 0, enteredUnit: input.supply.unit, enteredQuantity: String(input.quantity),
      conversionFactor: "1", profileVersion: 1, quantityScaled: input.quantity,
      lotNumber: input.lotNumber, manufacturerKey: "", expiryDay: input.expiryDay,
      requestedLotId: "", totalValueMinor, createdAt: input.when, updatedAt: input.when,
    }],
    layers: [{
      _id: layerId, ...key, receiptLineId: lineId, receiptDocumentId: documentId,
      receivedAt: input.when, remainingQty: input.quantity, remainingValue: totalValueMinor,
      version: 1, createdAt: input.when, updatedAt: input.when,
    }],
    ledgers: [{
      ...key, documentId, lineId, allocationNo: 1, layerId, deltaQty: input.quantity,
      deltaValue: totalValueMinor, balanceBefore: 0, balanceAfter: 0, valueBefore: 0,
      valueAfter: 0, actorId: input.actor, postedAt: input.when, postedDay,
      createdAt: input.when, updatedAt: input.when,
    }],
    audit: {
      companyCode, branchId: input.branchId, documentId, actorId: input.actor, action: "migrate",
      revision: 1, reason: `Legacy source ${input.sourceId}`, createdAt: input.when, updatedAt: input.when,
    },
    outbox: {
      companyCode, branchId: input.branchId, documentId, event: "supply.document.posted",
      status: "delivered", attempts: 0, availableAt: input.when, createdAt: input.when, updatedAt: input.when,
    },
  };
}

function groupedReceipt(input: Plain): PlannedDocument {
  const documentId = new Types.ObjectId().toHexString();
  const lines: Plain[] = [];
  const ledgers: Plain[] = [];
  const layers: Plain[] = [];
  const when = new Date(input.group.reduce((latest: number, tx: Plain) => Math.max(latest, +new Date(tx.createdAt)), 0));
  input.group.forEach((tx: Plain, index: number) => {
    const supply = input.supplyById.get(String(tx.supplyId))!;
    const state = input.balanceState.get(String(tx.supplyId))!;
    const lineId = new Types.ObjectId().toHexString();
    const layerId = new Types.ObjectId().toHexString();
    const totalValueMinor = lineValue(tx.quantity, tx.unitPrice ?? supply.unitPrice, `Transaction ${tx._id}`);
    const expiryDay = supplyExpiryDay(tx.expiryDate || supply.expiryDate) || "";
    const key = stockKey({ ...state, supply });
    lines.push({
      _id: lineId, companyCode, documentId, lineNo: index + 1, supplyId: String(supply._id),
      supplyCode: supply.code, supplyName: supply.name, baseUnit: supply.unit, precision: 0,
      enteredUnit: supply.unit, enteredQuantity: String(tx.quantity), conversionFactor: "1",
      profileVersion: 1, quantityScaled: tx.quantity, lotNumber: tx.batchNumber || supply.batchNumber || "NO-LOT",
      manufacturerKey: "", expiryDay, requestedLotId: "", totalValueMinor,
      createdAt: tx.createdAt, updatedAt: tx.updatedAt || tx.createdAt,
    });
    layers.push({
      _id: layerId, ...key, receiptLineId: lineId, receiptDocumentId: documentId,
      receivedAt: tx.createdAt, remainingQty: tx.quantity, remainingValue: totalValueMinor,
      version: 1, createdAt: tx.createdAt, updatedAt: tx.updatedAt || tx.createdAt,
    });
    ledgers.push({
      ...key, documentId, lineId, allocationNo: 1, layerId, deltaQty: tx.quantity,
      deltaValue: totalValueMinor, balanceBefore: 0, balanceAfter: 0, valueBefore: 0,
      valueAfter: 0, actorId: tx.performerId || input.actor, postedAt: tx.createdAt,
      postedDay: supplyBusinessDay(tx.createdAt), createdAt: tx.createdAt, updatedAt: tx.updatedAt || tx.createdAt,
    });
  });
  const first = input.group[0];
  const number = first.batchCode || `MIG-IN-${String(first._id).slice(-8)}-${input.shortRun}`;
  return {
    document: {
      _id: documentId, companyCode, branchId: input.branchId, warehouseId: input.warehouseId,
      number, type: "receipt", status: "posted", revision: 1,
      createdBy: first.performerId || input.actor, submittedBy: first.performerId || input.actor,
      approvedBy: first.performerId || input.actor, approvedRevision: 1,
      postedBy: first.performerId || input.actor, postedAt: when, postedDay: supplyBusinessDay(when),
      reason: first.reason || "Phiếu nhập chuyển từ hệ thống cũ", supplierId: "",
      createdAt: first.createdAt, updatedAt: when,
    },
    lines,
    ledgers,
    layers,
    audit: {
      companyCode, branchId: input.branchId, documentId, actorId: first.performerId || input.actor,
      action: "migrate", revision: 1, reason: `Legacy source ${input.groupKey}`,
      createdAt: when, updatedAt: when,
    },
    outbox: {
      companyCode, branchId: input.branchId, documentId, event: "supply.document.posted",
      status: "delivered", attempts: 0, availableAt: when, createdAt: when, updatedAt: when,
    },
  };
}

async function buildPlan(runId: string) {
  const [supplies, transactions, draftVouchers, warehouses] = await Promise.all([
    SupplyModel.find({ companyCode }).sort({ createdAt: 1, _id: 1 }).lean(),
    SupplyTransactionModel.find({ companyCode }).sort({ createdAt: 1, _id: 1 }).lean(),
    SupplyVoucherModel.find({ companyCode, status: { $ne: "completed" } }).lean(),
    WarehouseModel.find({ companyCode }).lean(),
  ]);
  if (!supplies.length) throw new Error(`No legacy supplies found for ${companyCode}.`);
  if (draftVouchers.length) throw new Error(`There are ${draftVouchers.length} unfinished legacy vouchers.`);
  if (transactions.some((tx) => tx.type !== "in")) throw new Error("Legacy issue transactions cannot be reconstructed safely by this migration.");

  const warehouseById = new Map(warehouses.map((item) => [String(item._id), item]));
  const supplyById = new Map(supplies.map((item) => [String(item._id), item]));
  const txBySupply = new Map<string, Plain[]>();
  for (const tx of transactions) {
    if (!supplyById.has(String(tx.supplyId))) throw new Error(`Transaction ${tx._id} references an unknown supply.`);
    safeInteger(tx.quantity, `Transaction ${tx._id} quantity`, 1);
    safeInteger(tx.balanceBefore, `Transaction ${tx._id} balanceBefore`);
    safeInteger(tx.balanceAfter, `Transaction ${tx._id} balanceAfter`);
    if (tx.balanceAfter !== tx.balanceBefore + tx.quantity) throw new Error(`Transaction ${tx._id} has an invalid balance delta.`);
    txBySupply.set(String(tx.supplyId), [...(txBySupply.get(String(tx.supplyId)) || []), tx]);
  }

  const profiles: Plain[] = [];
  const lots: Plain[] = [];
  const documents: PlannedDocument[] = [];
  const balanceState = new Map<string, Plain>();
  const actor = `migration:${runId}`;
  const shortRun = runId.replace(/[^0-9A-Za-z]/g, "").slice(-10);

  for (const supply of supplies) {
    const warehouse = warehouseById.get(String(supply.warehouseId || ""));
    if (!warehouse) throw new Error(`${supply.code}: warehouseId is missing or invalid.`);
    const branchId = String(supply.branchId || warehouse.branchId || "");
    if (!branchId) throw new Error(`${supply.code}: branchId is required.`);
    if (supply.branchId && warehouse.branchId && supply.branchId !== warehouse.branchId) throw new Error(`${supply.code}: supply and warehouse branch do not match.`);
    safeInteger(supply.quantity, `${supply.code} quantity`);

    const supplyId = String(supply._id);
    const history = txBySupply.get(supplyId) || [];
    let expected = history.length ? Number(history[0].balanceBefore) : Number(supply.quantity);
    for (const tx of history) {
      if (tx.balanceBefore !== expected) throw new Error(`${supply.code}: transaction chain is discontinuous at ${tx._id}.`);
      expected = tx.balanceAfter;
    }
    if (expected !== supply.quantity) throw new Error(`${supply.code}: ending balance ${expected} differs from supply.quantity ${supply.quantity}.`);

    const lotNumbers = new Set([supply.batchNumber, ...history.map((tx) => tx.batchNumber)].filter(Boolean).map(String));
    const expiryDays = new Set([supply.expiryDate, ...history.map((tx) => tx.expiryDate)].map(supplyExpiryDay).filter(Boolean));
    if (lotNumbers.size > 1 || expiryDays.size > 1) throw new Error(`${supply.code}: multiple historical lots/expiries cannot be inferred safely.`);
    const lotNumber = [...lotNumbers][0] || "NO-LOT";
    const expiryDay = [...expiryDays][0] || "";
    const trackingMode = lotNumber !== "NO-LOT" || supply.requiresExpiry !== false ? "lot" : "none";
    const lotId = new Types.ObjectId().toHexString();
    const warehouseId = String(warehouse._id);
    const quality = supply.requiresExpiry !== false && (!expiryDay || expiryDay < supplyBusinessDay()) ? "quarantine" : "available";
    profiles.push({ companyCode, supplyId, baseUnit: supply.unit, precision: 0, trackingMode, requiresExpiry: supply.requiresExpiry !== false, conversions: [], version: 1 });
    lots.push({ _id: lotId, companyCode, supplyId, manufacturerKey: "", lotNumber, expiryDay, recalled: false, version: 1 });
    balanceState.set(supplyId, { lotId, quality, branchId, warehouseId });

    const openingQty = history.length ? Number(history[0].balanceBefore) : Number(supply.quantity);
    if (openingQty > 0) {
      const when = history[0]?.createdAt ? new Date(new Date(history[0].createdAt).getTime() - 1) : new Date(supply.createdAt);
      documents.push(oneLineDocument({
        number: `MIG-OPEN-${supply.code}-${shortRun}`, type: "opening",
        reason: "Tồn đầu kỳ chuyển từ hệ thống cũ", when, actor, branchId, warehouseId,
        supply, quantity: openingQty, unitPrice: supply.unitPrice, lotId, lotNumber, expiryDay,
        quality, sourceId: `opening:${supplyId}`,
      }));
    }
  }

  const groups = new Map<string, Plain[]>();
  for (const tx of transactions) {
    const key = tx.batchCode ? `batch:${tx.batchCode}` : `transaction:${tx._id}`;
    groups.set(key, [...(groups.get(key) || []), tx]);
  }
  for (const [groupKey, group] of groups) {
    const firstState = balanceState.get(String(group[0].supplyId))!;
    if (group.some((tx) => {
      const state = balanceState.get(String(tx.supplyId))!;
      return state.branchId !== firstState.branchId || state.warehouseId !== firstState.warehouseId;
    })) throw new Error(`${groupKey}: one voucher spans multiple branches/warehouses.`);
    documents.push(groupedReceipt({ group, groupKey, actor, branchId: firstState.branchId, warehouseId: firstState.warehouseId, supplyById, balanceState, shortRun }));
  }

  documents.sort((a, b) => +new Date(a.document.postedAt) - +new Date(b.document.postedAt));
  const running = new Map<string, { quantity: number; value: number }>();
  for (const item of documents) for (const ledger of item.ledgers) {
    const key = `${ledger.supplyId}|${ledger.lotId}|${ledger.quality}`;
    const current = running.get(key) || { quantity: 0, value: 0 };
    ledger.balanceBefore = current.quantity;
    ledger.valueBefore = current.value;
    current.quantity += ledger.deltaQty;
    current.value += ledger.deltaValue;
    ledger.balanceAfter = current.quantity;
    ledger.valueAfter = current.value;
    running.set(key, current);
  }
  const balances = supplies.map((supply) => {
    const state = balanceState.get(String(supply._id))!;
    const final = running.get(`${supply._id}|${state.lotId}|${state.quality}`) || { quantity: 0, value: 0 };
    if (final.quantity !== supply.quantity) throw new Error(`${supply.code}: planned quantity does not reconcile.`);
    return { companyCode, branchId: state.branchId, warehouseId: state.warehouseId, locationId: "", supplyId: String(supply._id), lotId: state.lotId, containerId: "", quality: state.quality, quantityScaled: final.quantity, valueMinor: final.value, version: 1 };
  });
  return { companyCode, runId, profiles, lots, balances, documents };
}

async function insertPlan(plan: any, session: ClientSession) {
  const options = { session };
  await Profile.insertMany(plan.profiles, options);
  await Lot.insertMany(plan.lots, options);
  await Balance.insertMany(plan.balances, options);
  await StockDocument.insertMany(plan.documents.map((item: PlannedDocument) => item.document), options);
  await DocumentLine.insertMany(plan.documents.flatMap((item: PlannedDocument) => item.lines), options);
  await CostLayer.insertMany(plan.documents.flatMap((item: PlannedDocument) => item.layers), options);
  await Ledger.insertMany(plan.documents.flatMap((item: PlannedDocument) => item.ledgers), options);
  await Audit.insertMany(plan.documents.map((item: PlannedDocument) => item.audit), options);
  await Outbox.insertMany(plan.documents.map((item: PlannedDocument) => item.outbox), options);
  await Config.create([{ companyCode, mode: "v2", writeVersion: 0, timeZone: "Asia/Ho_Chi_Minh", currency: "VND", migrationRunId: plan.runId, activatedAt: new Date() }], options);
}

async function backup(runId: string) {
  const result: Plain = { companyCode, runId, createdAt: new Date().toISOString(), collections: {} };
  for (const model of [SupplyModel, SupplyTransactionModel, SupplyVoucherModel, WarehouseModel, ...v2Models] as any[])
    result.collections[model.collection.name] = await model.find({ companyCode }).lean();
  return saveArtifact(runId, "backup.json", result);
}

async function rollback(runId: string) {
  const config = await Config.findOne({ companyCode }).lean();
  if (!config || config.mode !== "v2" || config.migrationRunId !== runId || config.writeVersion !== 0)
    throw new Error("Rollback refused: migration identity does not match or V2 has received writes after activation.");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const model of [...v2Models].reverse()) await model.deleteMany({ companyCode }).session(session);
    });
  } finally {
    await session.endSession();
  }
  console.log(json({ mode: "rollback", companyCode, runId, legacyDataPreserved: true }));
}

async function verifyMigration() {
  const branchIds = await Balance.distinct("branchId", { companyCode });
  if (!branchIds.length) throw new Error("No V2 balances found to verify.");
  const branches = await Promise.all(branchIds.map((branchId) => reconcileInventory({
    companyCode,
    branchId,
    uid: "migration-verifier",
    permissions: new Set(["*"]),
  })));
  return {
    consistent: branches.every((item) => item.consistent),
    checkedBalances: branches.reduce((sum, item) => sum + item.checkedBalances, 0),
    differences: branches.flatMap((item) => item.differences),
  };
}

async function main() {
  if (!companyCode) throw new Error("--company is required.");
  const uri = process.env.SUPPLY_MIGRATION_MONGODB_URI;
  if (!uri) throw new Error("SUPPLY_MIGRATION_MONGODB_URI is required; .env fallback is disabled.");
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("Transaction-capable MongoDB is required.");
  if (rollbackRunId) return rollback(rollbackRunId);
  if (verify) {
    const reconciliation = await verifyMigration();
    console.log(json({ mode: "verify", companyCode, reconciliation }));
    if (!reconciliation.consistent) process.exitCode = 1;
    return;
  }
  await ensureEmptyV2();
  const indexes = await inspectInventoryIndexes(false);
  if (apply && indexes.some((item) => item.status !== "ready")) throw new Error("V2 indexes are missing. Run provision:supply-inventory -- --apply first.");

  const runId = `supply-v2-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const plan = await buildPlan(runId);
  const summary = {
    mode: apply ? "apply" : "dry-run", companyCode, runId, profiles: plan.profiles.length,
    lots: plan.lots.length, balances: plan.balances.length, documents: plan.documents.length,
    lines: plan.documents.reduce((sum, item) => sum + item.lines.length, 0),
    ledgerEntries: plan.documents.reduce((sum, item) => sum + item.ledgers.length, 0),
    inferredOpeningDocuments: plan.documents.filter((item) => item.document.type === "opening").length,
    missingIndexes: indexes.filter((item) => item.status !== "ready").length,
  };
  const planPath = await saveArtifact(runId, "plan.json", { summary, plan });
  if (!apply) return console.log(json({ ...summary, planPath }));

  const backupPath = await backup(runId);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => insertPlan(plan, session));
  } finally {
    await session.endSession();
  }
  const reconciliation = await verifyMigration();
  if (!reconciliation.consistent) throw new Error(`Post-migration reconciliation failed. Roll back with --rollback ${runId}.`);
  console.log(json({
    ...summary, planPath, backupPath, reconciliation,
    rollbackCommand: `npm run migrate:supply-inventory -- --company ${companyCode} --rollback ${runId}`,
  }));
}

main()
  .catch((error) => {
    console.error("Supply inventory migration failed:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
