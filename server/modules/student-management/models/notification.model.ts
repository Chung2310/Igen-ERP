import { Schema, model } from "mongoose";
import { INotification } from "../interfaces/notification.interface";

const notificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    recipients: { type: String, required: true },
    recipientCount: { type: Number, default: 0 },
    channels: [{ type: String }],
    status: {
      type: String,
      enum: ["Đã gửi", "Đang gửi", "Thất bại"],
      required: true,
    },
    ownerId: { type: String, required: true, index: true },
    // Thông tin đợt thu học phí (optional — chỉ có khi gửi theo đợt)
    installmentPlan: {
      installmentNo: { type: Number },
      percent: { type: Number },
      label: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  }
);

export const Notification = model<INotification>("Notification", notificationSchema);

