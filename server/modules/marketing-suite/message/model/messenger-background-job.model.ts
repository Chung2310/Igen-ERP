import mongoose, { Schema } from "mongoose";

export type MessengerBackgroundJobKind = "zalo-webhook" | "lead-intake";

const schema = new Schema({
  _id: { type: String, required: true },
  kind: { type: String, enum: ["zalo-webhook", "lead-intake"], required: true },
  payload: { type: Schema.Types.Mixed },
  status: { type: String, enum: ["pending", "processing", "completed", "failed"], required: true },
  attempts: { type: Number, required: true },
  dueAt: { type: Date, required: true },
  leaseToken: String,
  leaseUntil: Date,
  completedAt: Date,
}, { versionKey: false });

schema.index({ kind: 1, status: 1, dueAt: 1 });
schema.index({ kind: 1, status: 1, leaseUntil: 1 });
schema.index({ completedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const MessengerBackgroundJobModel = mongoose.model("MessengerBackgroundJob", schema);
