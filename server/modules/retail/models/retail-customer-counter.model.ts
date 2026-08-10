import { model, Schema } from "mongoose";

interface RetailCustomerCounter { companyCode: string; seq: number }
const RetailCustomerCounterSchema = new Schema<RetailCustomerCounter>({
  companyCode: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});
export const RetailCustomerCounterModel = model<RetailCustomerCounter>("RetailCustomerCounter", RetailCustomerCounterSchema);
