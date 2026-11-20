import { Schema, model } from "mongoose";

const company = () => ({ type: String, required: true, trim: true });
const id = () => ({ type: String, required: true });
const optionalKey = () => ({ type: String, default: "" });
const integer = (initial = 0) => ({ type: Number, default: initial, min: 0, validate: Number.isSafeInteger });
const options = { timestamps: true, autoCreate: false, autoIndex: false } as const;
const keyFields = () => ({
  companyCode: company(),
  branchId: id(),
  warehouseId: id(),
  locationId: optionalKey(),
  supplyId: id(),
  lotId: id(),
  containerId: optionalKey(),
  quality: { type: String, enum: ["available", "quarantine", "damaged"], required: true },
});
const balanceIndex = {
  companyCode: 1,
  branchId: 1,
  warehouseId: 1,
  locationId: 1,
  supplyId: 1,
  lotId: 1,
  containerId: 1,
  quality: 1,
} as const;

const config = new Schema(
  {
    companyCode: company(),
    mode: { type: String, enum: ["legacy", "preparing", "v2"], default: "legacy" },
    writeVersion: integer(),
    timeZone: { type: String, default: "Asia/Ho_Chi_Minh" },
    currency: { type: String, enum: ["VND"], default: "VND" },
    migrationRunId: String,
    activatedAt: Date,
  },
  options,
);
config.index({ companyCode: 1 }, { unique: true });
export const SupplyInventoryConfigModel = model("SupplyInventoryConfig", config);

const profile = new Schema(
  {
    companyCode: company(),
    supplyId: id(),
    baseUnit: id(),
    precision: { ...integer(), max: 6 },
    trackingMode: { type: String, enum: ["none", "lot"], default: "lot" },
    requiresExpiry: { type: Boolean, default: true },
    conversions: { type: [{ _id: false, unit: id(), factor: id() }], default: [] },
    version: integer(1),
  },
  options,
);
profile.index({ companyCode: 1, supplyId: 1 }, { unique: true });
export const SupplyInventoryProfileModel = model("SupplyInventoryProfile", profile);

const lot = new Schema(
  {
    companyCode: company(),
    supplyId: id(),
    manufacturerKey: optionalKey(),
    lotNumber: optionalKey(),
    expiryDay: optionalKey(),
    recalled: { type: Boolean, default: false },
    version: integer(1),
  },
  options,
);
lot.index({ companyCode: 1, supplyId: 1, manufacturerKey: 1, lotNumber: 1 }, { unique: true });
export const SupplyLotModel = model("SupplyLot", lot);

const balance = new Schema(
  { ...keyFields(), quantityScaled: integer(), valueMinor: integer(), version: integer() },
  options,
);
balance.index(balanceIndex, { unique: true });
balance.index({ companyCode: 1, branchId: 1, warehouseId: 1, supplyId: 1 });
export const SupplyStockBalanceModel = model("SupplyStockBalance", balance);

const document = new Schema(
  {
    companyCode: company(),
    branchId: id(),
    warehouseId: id(),
    number: id(),
    type: { type: String, enum: ["opening", "receipt", "issue"], required: true },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected", "posted", "cancelled"],
      default: "draft",
    },
    revision: integer(1),
    createdBy: id(),
    submittedBy: String,
    approvedBy: String,
    approvedRevision: Number,
    postedBy: String,
    postedAt: Date,
    postedDay: String,
    cancelledBy: String,
    reason: id(),
    recipientDepartment: String,
    supplierId: String,
    decisionReason: String,
  },
  options,
);
document.index({ companyCode: 1, number: 1 }, { unique: true });
document.index({ companyCode: 1, branchId: 1, createdAt: -1, _id: -1 });
export const SupplyStockDocumentModel = model("SupplyStockDocument", document);

const line = new Schema(
  {
    companyCode: company(),
    documentId: id(),
    lineNo: integer(1),
    supplyId: id(),
    supplyCode: id(),
    supplyName: id(),
    baseUnit: id(),
    precision: integer(),
    enteredUnit: id(),
    enteredQuantity: id(),
    conversionFactor: id(),
    profileVersion: integer(1),
    quantityScaled: { ...integer(), min: 1 },
    lotNumber: optionalKey(),
    manufacturerKey: optionalKey(),
    expiryDay: optionalKey(),
    requestedLotId: optionalKey(),
    totalValueMinor: Number,
  },
  options,
);
line.index({ companyCode: 1, documentId: 1, lineNo: 1 }, { unique: true });
export const SupplyStockDocumentLineModel = model("SupplyStockDocumentLine", line);

const layer = new Schema(
  {
    ...keyFields(),
    receiptLineId: id(),
    receiptDocumentId: id(),
    receivedAt: { type: Date, required: true },
    remainingQty: integer(),
    remainingValue: integer(),
    version: integer(),
  },
  options,
);
layer.index(
  { companyCode: 1, receiptLineId: 1, warehouseId: 1, locationId: 1, containerId: 1, quality: 1 },
  { unique: true },
);
layer.index({ companyCode: 1, branchId: 1, warehouseId: 1, supplyId: 1, remainingQty: 1 });
export const SupplyCostLayerModel = model("SupplyCostLayer", layer);

const ledger = new Schema(
  {
    ...keyFields(),
    documentId: id(),
    lineId: id(),
    allocationNo: integer(),
    layerId: id(),
    deltaQty: { type: Number, required: true, validate: Number.isSafeInteger },
    deltaValue: { type: Number, required: true, validate: Number.isSafeInteger },
    balanceBefore: integer(),
    balanceAfter: integer(),
    valueBefore: integer(),
    valueAfter: integer(),
    actorId: id(),
    postedAt: { type: Date, required: true },
    postedDay: id(),
  },
  options,
);
ledger.index({ companyCode: 1, documentId: 1, lineId: 1, allocationNo: 1 }, { unique: true });
ledger.index({ companyCode: 1, branchId: 1, warehouseId: 1, supplyId: 1, postedAt: 1, _id: 1 });
export const SupplyStockLedgerModel = model("SupplyStockLedger", ledger);

const guard = new Schema({ companyCode: company(), warehouseId: id(), lockedByStocktakeId: optionalKey() }, options);
guard.index({ companyCode: 1, warehouseId: 1 }, { unique: true });
export const SupplyWarehouseGuardModel = model("SupplyWarehouseGuard", guard);
const period = new Schema({ companyCode: company(), branchId: id(), closedThroughDay: id() }, options);
period.index({ companyCode: 1, branchId: 1 }, { unique: true });
export const SupplyInventoryPeriodModel = model("SupplyInventoryPeriod", period);
const access = new Schema(
  { companyCode: company(), userId: id(), warehouseId: id(), canWrite: { type: Boolean, default: false } },
  options,
);
access.index({ companyCode: 1, userId: 1, warehouseId: 1 }, { unique: true });
export const SupplyWarehouseAccessModel = model("SupplyWarehouseAccess", access);
const audit = new Schema(
  {
    companyCode: company(),
    branchId: id(),
    documentId: id(),
    actorId: id(),
    action: id(),
    revision: integer(),
    reason: String,
  },
  options,
);
audit.index({ companyCode: 1, documentId: 1, createdAt: -1 });
export const SupplyInventoryAuditModel = model("SupplyInventoryAudit", audit);
const outbox = new Schema(
  {
    companyCode: company(),
    branchId: id(),
    documentId: id(),
    event: { type: String, enum: ["supply.document.posted"], required: true },
    status: { type: String, enum: ["pending", "processing", "delivered", "failed"], default: "pending" },
    attempts: integer(),
    availableAt: { type: Date, default: Date.now },
    leaseToken: String,
    leaseUntil: Date,
  },
  options,
);
outbox.index({ companyCode: 1, documentId: 1, event: 1 }, { unique: true });
outbox.index({ status: 1, availableAt: 1 });
export const SupplyInventoryOutboxModel = model("SupplyInventoryOutbox", outbox);

export const supplyInventoryModels = [
  SupplyInventoryConfigModel,
  SupplyInventoryProfileModel,
  SupplyLotModel,
  SupplyStockBalanceModel,
  SupplyStockDocumentModel,
  SupplyStockDocumentLineModel,
  SupplyCostLayerModel,
  SupplyStockLedgerModel,
  SupplyWarehouseGuardModel,
  SupplyInventoryPeriodModel,
  SupplyWarehouseAccessModel,
  SupplyInventoryAuditModel,
  SupplyInventoryOutboxModel,
];
