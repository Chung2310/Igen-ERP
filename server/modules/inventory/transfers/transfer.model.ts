import { model, Schema } from "mongoose";

export interface InventoryTransferItem {
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitCost: number;
  serialUnitIds: string[];
  trackingMode?: string;
  unitCode?: string;
}
export interface InventoryTransfer {
  companyCode: string;
  fromBranchId: string;
  fromWarehouseId: string;
  toBranchId: string;
  toWarehouseId: string;
  transitWarehouseId?: string;
  code: string;
  idempotencyKey: string;
  requestFingerprint: string;
  status: "in_transit" | "received" | "cancelled" | "reversed";
  items: InventoryTransferItem[];
  reason: string;
  cancelReason?: string;
  reversalReason?: string;
  createdBy: string;
  receivedBy?: string;
  cancelledBy?: string;
  reversedBy?: string;
  receivedAt?: Date;
  cancelledAt?: Date;
  reversedAt?: Date;
  version: number;
}

const itemSchema = new Schema<InventoryTransferItem>({
  productId: { type: String, required: true }, variantId: { type: String, required: true }, sku: { type: String, required: true },
  productName: { type: String, required: true }, quantity: { type: Number, required: true, min: 0.000001 },
  trackingMode: String, unitCode: String,
  unitCost: { type: Number, required: true, min: 0 }, serialUnitIds: { type: [String], default: [] },
}, { _id: false });
const schema = new Schema<InventoryTransfer>({
  companyCode: { type: String, required: true, index: true }, fromBranchId: { type: String, required: true, index: true },
  fromWarehouseId: { type: String, required: true }, toBranchId: { type: String, required: true, index: true },
  toWarehouseId: { type: String, required: true }, code: { type: String, required: true },
  transitWarehouseId: String,
  idempotencyKey: { type: String, required: true }, requestFingerprint: { type: String, required: true },
  status: { type: String, enum: ["in_transit", "received", "cancelled", "reversed"], required: true, index: true },
  items: { type: [itemSchema], required: true }, reason: { type: String, required: true }, cancelReason: String, reversalReason: String,
  createdBy: { type: String, required: true }, receivedBy: String, cancelledBy: String, reversedBy: String,
  receivedAt: Date, cancelledAt: Date, reversedAt: Date, version: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ companyCode: 1, code: 1 }, { unique: true });
schema.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
export const InventoryTransferModel = model<InventoryTransfer>("InventoryTransfer", schema);
