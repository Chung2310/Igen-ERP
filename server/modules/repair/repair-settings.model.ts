import { Schema, model } from "mongoose";
import { REPAIR_NOTIFICATION_EVENTS } from "./permissions";

const TemplateSchema = new Schema({ enabled: { type: Boolean, default: true }, subject: { type: String, default: "" }, html: { type: String, default: "" } }, { _id: false });
const RepairSettingsSchema = new Schema({
  companyCode: { type: String, required: true, unique: true, uppercase: true },
  /** Thứ tự ưu tiên kênh gửi; kênh chưa nối API tự bị bỏ qua khi gửi. */
  notifyChannels: { type: [String], default: ["email", "zalo", "sms"] },
  templates: { type: Map, of: TemplateSchema, default: {} },
  updatedBy: String,
}, { timestamps: true });
export const RepairSettingsModel = model("RepairSettings", RepairSettingsSchema);

export type RepairTemplate = { enabled: boolean; subject: string; html: string };

/** Mẫu mặc định để công ty chưa cấu hình gì vẫn gửi được tin. */
export const DEFAULT_REPAIR_TEMPLATES: Record<(typeof REPAIR_NOTIFICATION_EVENTS)[number], RepairTemplate> = {
  received: {
    enabled: true,
    subject: "{{companyName}} đã tiếp nhận thiết bị {{deviceName}} — phiếu {{ticketCode}}",
    html: "<p>Chào {{customerName}},</p><p>{{companyName}} ({{branchName}}) đã tiếp nhận <b>{{deviceName}}</b> lúc {{receivedAt}} theo phiếu <b>{{ticketCode}}</b>.</p><p>Tình trạng khách báo: {{symptom}}</p><p>Dự kiến trả máy: {{promisedAt}}. Chúng tôi sẽ báo lại ngay khi có kết quả kiểm tra.</p>",
  },
  done: {
    enabled: true,
    subject: "Thiết bị {{deviceName}} đã sửa xong — phiếu {{ticketCode}}",
    html: "<p>Chào {{customerName}},</p><p>{{deviceName}} theo phiếu <b>{{ticketCode}}</b> đã hoàn tất tại {{branchName}}. Tổng chi phí: <b>{{totalAmount}}</b>.</p><p>Quý khách vui lòng tới nhận máy trong giờ làm việc.</p><p>Đánh giá chất lượng phục vụ giúp chúng tôi tại: {{feedbackUrl}}</p>",
  },
};
