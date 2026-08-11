import { Schema, model } from "mongoose";
import { INotification } from "../interface/notification.interface";

const NotificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ["kho", "task", "training", "he-thong"],
      required: true,
      index: true,
    },
    companyCode: { type: String, required: true, index: true },
    recipientUid: { type: String, required: true, index: true },
    idempotencyKey: { type: String },
    read: { type: Boolean, default: false, index: true },
    action: {
      tab: { type: String },
      subTab: { type: String },
    },
    createdAt: { type: Date, default: Date.now, index: true },
  }
);

NotificationSchema.index(
  { companyCode: 1, recipientUid: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
);

// Tên "Notification" đã được module Quản lý Học viên đăng ký (collection "notifications"),
// nên thông báo web dùng tên và collection riêng để tránh OverwriteModelError khi boot.
export const NotificationModel = model<INotification>("WebNotification", NotificationSchema, "web_notifications");
