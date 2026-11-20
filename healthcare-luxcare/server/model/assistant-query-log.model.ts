import { model, Schema } from "mongoose";

const AssistantQueryLogSchema = new Schema(
  {
    companyCode: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, required: true },
    branchIds: { type: [String], default: [] },
    sourceTypes: { type: [String], default: [] },
    evidenceCount: { type: Number, default: 0 },
    status: { type: String, enum: ["answered", "partial", "insufficient_evidence", "not_found", "failed"], required: true },
    latencyMs: { type: Number, required: true },
    retrievedIds: { type: [String], default: [] },
    usedIds: { type: [String], default: [] },
    scores: { type: [Number], default: [] },
    retrievalMs: Number,
    composeMs: Number,
    promptTokens: Number,
    completionTokens: Number,
    costUSD: Number,
    model: String,
  },
  { timestamps: true },
);
AssistantQueryLogSchema.index({ companyCode: 1, createdAt: -1 });
export const AssistantQueryLogModel = model("AssistantQueryLog", AssistantQueryLogSchema);
