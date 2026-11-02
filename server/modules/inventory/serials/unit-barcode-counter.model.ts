import { Schema, model } from "mongoose";

const UnitBarcodeCounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, required: true, min: 0, default: 0 },
  },
  { versionKey: false },
);

export const UnitBarcodeCounterModel = model("InventoryUnitBarcodeCounter", UnitBarcodeCounterSchema);
