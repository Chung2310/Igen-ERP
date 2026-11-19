import { Schema, model } from "mongoose";
import { AiAutoReplyConfigSchema } from "../../../../model/user.model";

const sessionSchema = new Schema({
  companyCode: { type: String, required: true },
  userId: { type: String, required: true },
  sandboxCompanyCode: { type: String, required: true },
  label: { type: String, required: true },
  channel: { type: String, enum: ["facebook", "zalo"], required: true },
  documentDomain: { type: String, enum: ["general", "telecom"], default: "general" },
  sourceAccountId: String,
  aiConfig: { type: AiAutoReplyConfigSchema, required: true },
  directLeadWrites: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  fields: { type: Schema.Types.Mixed, default: [] },
  ocrEnabled: { type: Boolean, default: false },
  provider: String,
  contractFieldKey: String,
  pendingMessageId: String,
}, { timestamps: true });
sessionSchema.index({ companyCode: 1, userId: 1, createdAt: -1 });
sessionSchema.index({ sandboxCompanyCode: 1 }, { unique: true });
export const ChatTestSessionModel = model("ChatTestSession", sessionSchema);

const messageSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, required: true },
  clientMessageId: { type: String, required: true },
  text: { type: String, default: "", maxlength: 5000 },
  imageData: { type: String, select: false },
  imageFiles: { type: [new Schema({ data: { type: String, required: true }, hash: String, fileName: String }, { _id: false })], select: false, default: undefined },
  imageCount: Number,
  imageHash: String,
  leadImageValues: Schema.Types.Mixed,
  leadImageProfileHash: String,
  leadImageIssue: String,
  leadImageReadings: Schema.Types.Mixed,
  leadSubscriberCode: String,
  leadSubscriberCodes: { type: [String], default: undefined },
  leadDocumentMode: Boolean,
  fileName: String,
  hasImage: { type: Boolean, default: false },
  status: { type: String, enum: ["pending", "processing", "completed", "failed"], required: true },
  reply: { type: String, default: "" },
  error: String,
  errorCode: String,
  errorStatus: Number,
  latencyMs: Number,
  phase: String,
}, { timestamps: true });
messageSchema.index({ sessionId: 1, clientMessageId: 1 }, { unique: true });
messageSchema.index({ sessionId: 1, createdAt: 1 });
export const ChatTestMessageModel = model("ChatTestMessage", messageSchema);
