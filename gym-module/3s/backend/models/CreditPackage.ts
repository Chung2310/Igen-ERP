import mongoose, { Schema } from 'mongoose';

export interface ICreditPackage {
  name: string;
  description: string;
  amountVnd: number;
  baseCredits: number;
  bonusCredits: number;
  active: boolean;
  sortOrder: number;
  updatedById?: mongoose.Types.ObjectId;
}

const nonNegativeInteger = { type: Number, min: 0, validate: Number.isInteger, required: true } as const;

const creditPackageSchema = new Schema<ICreditPackage>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  amountVnd: { type: Number, min: 10_000, max: 50_000_000, validate: Number.isInteger, required: true },
  baseCredits: nonNegativeInteger,
  bonusCredits: { ...nonNegativeInteger, default: 0 },
  active: { type: Boolean, default: true, required: true, index: true },
  sortOrder: { ...nonNegativeInteger, default: 0 },
  updatedById: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

creditPackageSchema.index({ active: 1, sortOrder: 1, amountVnd: 1 });

export default mongoose.model<ICreditPackage>('CreditPackage', creditPackageSchema);

