import { model, Schema } from "mongoose";
interface Counter { companyCode: string; branchId: string; scope: string; seq: number }
const schema = new Schema<Counter>({ companyCode: { type: String, required: true }, branchId: { type: String, required: true }, scope: { type: String, required: true }, seq: { type: Number, default: 0 } });
schema.index({ companyCode: 1, branchId: 1, scope: 1 }, { unique: true });
export const RetailInvoiceCounterModel = model<Counter>("RetailInvoiceCounter", schema);
