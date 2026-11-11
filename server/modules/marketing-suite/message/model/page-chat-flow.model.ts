import { Schema, model } from "mongoose";

const FieldSchema = new Schema({
  key: { type: String, required: true, match: /^[a-z][a-z0-9_]{0,39}$/ },
  label: { type: String, required: true, maxlength: 100 },
  question: { type: String, required: true, maxlength: 300 },
  type: { type: String, enum: ["text", "long_text", "number", "currency", "date", "phone", "email", "single_select", "multi_select", "checkbox"], default: "text" },
  required: { type: Boolean, default: true },
  options: { type: [String], default: [] },
}, { _id: false });
const FlowSchema = new Schema({
  companyCode: { type: String, required: true }, pageId: { type: String, required: true },
  platform: { type: String, enum: ["facebook", "zalo", "tiktok"], default: "facebook", index: true },
  flowKey: { type: String, enum: ["page-intake", "bakery-default"], default: "page-intake" },
  status: { type: String, enum: ["draft", "active", "archived"], default: "draft" }, version: { type: Number, required: true, min: 1 },
  goal: { type: String, required: true, maxlength: 300 }, fields: { type: [FieldSchema], validate: [(v: unknown[]) => v.length > 0 && v.length <= 30, "Cần 1–30 trường thông tin."] },
  completionMessage: { type: String, required: true, maxlength: 500 },
  sourceDocumentIds: { type: [String], default: [] },
}, { timestamps: true });
FlowSchema.index({ companyCode: 1, pageId: 1, version: 1 }, { unique: true });
FlowSchema.index({ companyCode: 1, platform: 1, pageId: 1, status: 1 });
export const PageChatFlowModel = model("PageChatFlow", FlowSchema);

const StateSchema = new Schema({
  companyCode: { type: String, required: true }, pageId: { type: String, required: true }, conversationId: { type: String, required: true },
  platform: { type: String, enum: ["facebook", "zalo", "tiktok"], default: "facebook" }, leadId: { type: String },
  version: { type: Number, required: true }, profileId: { type: String }, values: { type: Map, of: String, default: {} },
  lastMessageId: { type: String, default: "" }, lastReply: { type: String, default: "" }, customerId: { type: String }, completedAt: Date,
}, { timestamps: true });
StateSchema.index({ companyCode: 1, pageId: 1, conversationId: 1 }, { unique: true });
export const PageChatFlowStateModel = model("PageChatFlowState", StateSchema);
