import { model, Schema } from "mongoose";

export interface InventoryStockReversal {
  companyCode: string;
  sourceType: "inventory-transfer";
  sourceId: string;
  reason: string;
  createdBy: string;
  createdAt?: Date;
}
const schema = new Schema<InventoryStockReversal>({
  companyCode: { type: String, required: true, index: true },
  sourceType: { type: String, enum: ["inventory-transfer"], required: true },
  sourceId: { type: String, required: true }, reason: { type: String, required: true },
  createdBy: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ companyCode: 1, sourceType: 1, sourceId: 1 }, { unique: true });
export const InventoryStockReversalModel = model<InventoryStockReversal>("InventoryStockReversal", schema);
