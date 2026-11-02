import { model, Schema } from "mongoose";
interface Idempotency { companyCode: string; branchId?: string; cancellationOwnerId?: string; cancellationDigest?: string; collectionEvidence?: { paymentOffset: number; paidBefore: number; grandTotal: number }; requestFingerprint?: string; cancelledFromStatus?: string; cancelledDraft?: any; key: string; operation: string; orderId?: string; invoiceId?: string; status: "processing" | "completed" | "revoked"; createdAt?: Date; updatedAt?: Date }
const schema = new Schema<Idempotency>({ companyCode: { type: String, required: true }, key: { type: String, required: true }, operation: { type: String, required: true }, orderId: String, invoiceId: String, status: { type: String, enum: ["processing", "completed", "revoked"], default: "processing" } }, { timestamps: true });
schema.index({ companyCode: 1, key: 1 }, { unique: true });
schema.add({ cancellationOwnerId: String, cancellationDigest: String, collectionEvidence: Schema.Types.Mixed, branchId: String, requestFingerprint: String, cancelledFromStatus: String, cancelledDraft: Schema.Types.Mixed });
export const RetailIdempotencyModel = model<Idempotency>("RetailIdempotency", schema);
