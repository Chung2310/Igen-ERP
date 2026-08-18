import { Schema, model } from "mongoose";

const SerialEventSchema = new Schema({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  serialUnitId: { type: String, required: true, index: true },
  serialNumber: { type: String, required: true },
  eventType: { type: String, required: true, index: true },
  fromStatus: { type: String },
  toStatus: { type: String, required: true },
  documentType: { type: String },
  documentId: { type: String },
  reason: { type: String },
  actorId: { type: String, required: true },
  actorName: { type: String, required: true },
}, { timestamps: { createdAt: "occurredAt", updatedAt: false } });

export const SerialEventModel = model("InventorySerialEvent", SerialEventSchema);
