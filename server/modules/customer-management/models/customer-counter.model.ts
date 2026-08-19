import { model, Schema } from "mongoose";

interface ICustomerCounter {
  companyCode: string;
  sequence: number;
}

const CustomerCounterSchema = new Schema<ICustomerCounter>({
  companyCode: { type: String, required: true, unique: true, trim: true },
  sequence: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true });

export const CustomerCounterModel = model<ICustomerCounter>("CustomerCounter", CustomerCounterSchema);
