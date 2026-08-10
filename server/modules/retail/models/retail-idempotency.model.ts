import { model, Schema } from "mongoose";
interface Idempotency { companyCode: string; key: string; operation: string; orderId?: string; invoiceId?: string; status: "processing" | "completed"; createdAt?: Date; updatedAt?: Date }
const schema = new Schema<Idempotency>({ companyCode: { type: String, required: true }, key: { type: String, required: true }, operation: { type: String, required: true }, orderId: String, invoiceId: String, status: { type: String, enum: ["processing", "completed"], default: "processing" } }, { timestamps: true });
schema.index({ companyCode: 1, key: 1 }, { unique: true });
export const RetailIdempotencyModel = model<Idempotency>("RetailIdempotency", schema);
