import mongoose, { Schema } from 'mongoose';

export interface IAiGlobalBudgetCounter {
  monthKey: string;
  spentVnd: number;
  reservedVnd: number;
  alertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IAiGlobalBudgetCounter>({
  monthKey: { type: String, required: true, trim: true, maxlength: 7 },
  spentVnd: { type: Number, required: true, min: 0, validate: Number.isSafeInteger, default: 0 },
  reservedVnd: { type: Number, required: true, min: 0, validate: Number.isSafeInteger, default: 0 },
  alertedAt: { type: Date },
}, { timestamps: true });

schema.index({ monthKey: 1 }, { unique: true, name: 'unique_ai_global_budget_month' });

// Deliberately global: this cap aggregates company-paid calls across all centers.
export default mongoose.model<IAiGlobalBudgetCounter>('AiGlobalBudgetCounter', schema);
