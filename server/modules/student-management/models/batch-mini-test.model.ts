import { Schema, model } from "mongoose";
import { IBatchMiniTest } from "../interfaces/batch-mini-test.interface";

const miniTestResultSchema = new Schema(
  {
    studentId: { type: String, required: true },
    score: { type: Number, min: 0 },
    note: { type: String, default: "", maxlength: 2000 },
    assessedBy: { type: String, default: "" },
    assessedAt: { type: Date },
  },
  { _id: false },
);

const batchMiniTestSchema = new Schema<IBatchMiniTest>(
  {
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    batchId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    date: { type: String, required: true },
    maxScore: { type: Number, required: true, min: 0.000001 },
    createdBy: { type: String, required: true },
    results: { type: [miniTestResultSchema], default: [] },
  },
  { timestamps: true },
);

batchMiniTestSchema.index({ ownerId: 1, branchId: 1, batchId: 1, date: -1 });

export const BatchMiniTest = model<IBatchMiniTest>("BatchMiniTest", batchMiniTestSchema);
