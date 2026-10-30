import { Schema, model } from "mongoose";

const TransferLine = new Schema({
  productId: { type: String, required: true },
  variantId: { type: String, required: true },
  sku: { type: String, required: true },
  productName: { type: String, required: true },
  trackingMode: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0.000001 },
  unitCost: { type: Number, required: true, min: 0 },
  serialUnitIds: { type: [String], default: [] },
  unitIdentifiers: { type: [String], default: [] },
}, { _id: false });

const TransferSchema = new Schema({
  companyCode: { type: String, required: true, uppercase: true },
  transferCode: { type: String, required: true },
  // Preserve existing ERP unique indexes while new documents use Retail's fields.
  code: String,
  idempotencyKey: String,
  fromBranchId: { type: String, required: true },
  fromWarehouseId: { type: String, required: true },
  fromWarehouseName: { type: String, required: true },
  toBranchId: { type: String, required: true },
  toWarehouseId: { type: String, required: true },
  toWarehouseName: { type: String, required: true },
  transitWarehouseId: { type: String, required: true },
  status: { type: String, enum: ["in_transit", "received", "cancelled", "reversed"], required: true },
  items: { type: [TransferLine], required: true },
  reason: { type: String, required: true },
  requestKey: { type: String, required: true },
  requestFingerprint: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdByName: { type: String, required: true },
  receivedBy: String,
  receivedByName: String,
  receivedAt: Date,
  cancelledBy: String,
  cancelledByName: String,
  cancelledAt: Date,
  cancelReason: String,
}, { timestamps: true });

TransferSchema.index({ companyCode: 1, requestKey: 1 }, { unique: true, partialFilterExpression: { requestKey: { $type: "string" } } });
TransferSchema.index({ companyCode: 1, transferCode: 1 }, { unique: true, partialFilterExpression: { transferCode: { $type: "string" } } });
TransferSchema.index({ companyCode: 1, fromBranchId: 1, status: 1, createdAt: -1 });
TransferSchema.index({ companyCode: 1, toBranchId: 1, status: 1, createdAt: -1 });
TransferSchema.index({ companyCode: 1, "items.serialUnitIds": 1 });
export const InventoryTransferModel = model("InventoryTransfer", TransferSchema);
