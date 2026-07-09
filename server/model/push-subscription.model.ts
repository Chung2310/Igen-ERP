import { Schema, model, Document } from "mongoose";

/**
 * PushSubscription — đăng ký Web Push của từng trình duyệt/thiết bị người dùng.
 * Một user có thể có nhiều subscription (nhiều máy/trình duyệt).
 */
export interface IPushSubscription extends Document {
  uid: string;
  companyCode?: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    uid: { type: String, required: true, index: true },
    companyCode: { type: String, default: "", index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

export const PushSubscriptionModel = model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
