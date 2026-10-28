import { Schema, model } from 'mongoose';

const schema = new Schema({
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  ticketId: { type: String, required: true },
  actorId: { type: String, required: true },
  idempotencyKey: { type: String, required: true },
  fingerprint: { type: String, required: true },
  status: { type: String, enum: ['completed', 'revoked'], required: true },
  financeVoucherId: String,
}, { timestamps: true });
// No expiry: a delayed retry must never become a new refund.
schema.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ financeVoucherId: 1 }, { unique: true, partialFilterExpression: { financeVoucherId: { $type: 'string' } } });
export const RepairRefundRequestModel = model('RepairRefundRequest', schema);
