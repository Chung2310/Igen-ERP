import mongoose, { Schema } from 'mongoose';
const schema = new Schema({ name: { type: String, required: true }, version: { type: Number, required: true }, active: { type: Boolean, default: true }, fatLossFactor: { type: Number, default: 0.85 }, muscleGainFactor: { type: Number, default: 1.1 }, proteinPerKg: { type: Number, default: 2 }, fatPerKg: { type: Number, default: 0.8 } }, { timestamps: true });
schema.index({ name: 1, version: 1 }, { unique: true });
export default mongoose.model('NutritionFormula', schema);
