import { Schema, model } from "mongoose";

export const MobilePushDevice = model(
  "MobilePushDevice",
  new Schema(
    {
      token: { type: String, required: true, unique: true },
      uid: { type: String, required: true, index: true },
      companyCode: { type: String, required: true },
      sessionId: { type: String, required: true },
      platform: { type: String, enum: ["android", "ios"], required: true },
      provider: { type: String, enum: ["expo", "fcm"], default: "expo" },
      registeredAt: { type: Date, required: true },
    },
    { timestamps: true },
  ),
);

const jobSchema = new Schema({
  notificationId: { type: String, required: true },
  token: { type: String, required: true },
  uid: { type: String, required: true },
  companyCode: { type: String, required: true },
  sessionId: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  state: { type: String, default: "send" },
  receiptId: String,
  attempts: { type: Number, default: 0 },
  availableAt: { type: Date, default: Date.now },
  lease: String,
  expiresAt: { type: Date, required: true },
  lastError: String,
});
jobSchema.index({ notificationId: 1, token: 1, sessionId: 1 }, { unique: true });
jobSchema.index({ state: 1, availableAt: 1 });
jobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const MobilePushJob = model("MobilePushJob", jobSchema);
