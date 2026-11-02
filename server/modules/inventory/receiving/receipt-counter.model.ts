import { model, Schema } from "mongoose";

// The deterministic _id is the unique company/branch/business-day key even
// when automatic secondary-index creation is disabled in production.
const schema = new Schema({
  _id: { type: String, required: true },
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  businessDay: { type: String, required: true },
  sequence: { type: Number, required: true, min: 1, max: Number.MAX_SAFE_INTEGER },
}, { timestamps: true });

export const ReceiptCounterModel = model("InventoryReceiptCounter", schema);
