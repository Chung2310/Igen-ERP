import { model, Schema } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true }, branchId: { type: String, required: true }, runId: { type: Schema.Types.ObjectId, required: true },
  receivableId: { type: String, required: true }, cycleKey: { type: String, required: true }, channel: { type: String, enum: ["in_app", "marketing"], required: true },
  status: { type: String, enum: ["queued", "sending", "sent", "skipped", "failed"], required: true, default: "queued" },
  attempt: { type: Number, default: 0 }, maxAttempts: { type: Number, required: true }, nextAttemptAt: Date,
  payload: { type: Schema.Types.Mixed, required: true }, failureType: { type: String, enum: ["temporary", "permanent"] }, error: String, sentAt: Date,
}, { timestamps: true });
schema.index({ cycleKey: 1 }, { unique: true });
schema.index({ status: 1, nextAttemptAt: 1 });
export const ReminderDeliveryModel = model("FinanceReminderDelivery", schema);
