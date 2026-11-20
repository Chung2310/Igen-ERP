import mongoose, { Schema } from 'mongoose';

export interface ICreditPricing {
  key: 'GLOBAL';
  vndPerCredit: number;
  usdToVnd: number;
  updatedById?: mongoose.Types.ObjectId;
}

const positiveInteger = { type: Number, min: 1, validate: Number.isInteger, required: true } as const;

const creditPricingSchema = new Schema<ICreditPricing>({
  key: { type: String, enum: ['GLOBAL'], required: true, unique: true, default: 'GLOBAL' },
  vndPerCredit: { ...positiveInteger, default: 100 },
  usdToVnd: { ...positiveInteger, default: 26_000 },
  updatedById: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model<ICreditPricing>('CreditPricing', creditPricingSchema);

