import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose, { Schema } from 'mongoose';

export interface ICreditWallet {
  userId: mongoose.Types.ObjectId;
  availableCredits: number;
  reservedCredits: number;
  version: number;
}

const nonNegativeInteger = { type: Number, min: 0, validate: Number.isInteger, required: true } as const;

const creditWalletSchema = new Schema<ICreditWallet>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  availableCredits: { ...nonNegativeInteger, default: 0 },
  reservedCredits: { ...nonNegativeInteger, default: 0 },
  version: { ...nonNegativeInteger, default: 0 },
}, { timestamps: true });creditWalletSchema.plugin(centerTenantPlugin);



export default mongoose.model<ICreditWallet>('CreditWallet', creditWalletSchema);

