import { Schema, model } from "mongoose";
const scope = { userId: { type: String, required: true }, companyCode: { type: String, required: true } };
const workflowSchema = new Schema({ ...scope, actionId: { type: String, required: true }, config: { type: Schema.Types.Mixed, required: true }, version: { type: Number, default: 0 } }, { timestamps: true });
workflowSchema.index({ companyCode: 1, userId: 1, actionId: 1 }, { unique: true });
export const AssistantWorkflowModel = model("AssistantWorkflow", workflowSchema);
const sessionSchema = new Schema({ ...scope, branchId: { type: String, default: "" }, conversationId: { type: String, required: true }, mode: { type: String, enum: ["work", "qa"], default: "work" }, busy: { type: Boolean, default: false }, pending: { type: Schema.Types.Mixed, default: null }, pendingDocumentRequest: { type: String, default: "", maxlength: 12000 }, messages: { type: [Schema.Types.Mixed], default: [] }, messageCount: { type: Number, default: 0, min: 0 }, sessionMemory: { type: String, default: "", maxlength: 2400 }, sessionMemoryMessageCount: { type: Number, default: 0, min: 0 }, sessionMemoryVersion: { type: Number, default: 0, min: 0 }, lastReply: { type: Schema.Types.Mixed, default: null } }, { timestamps: true });
sessionSchema.index({ companyCode: 1, userId: 1, branchId: 1, conversationId: 1 }, { unique: true });
sessionSchema.index({ companyCode: 1, userId: 1, branchId: 1, updatedAt: -1, _id: -1 });
export const AssistantSessionModel = model("AssistantSession", sessionSchema);
const turnSchema = new Schema({ ...scope, branchId: { type: String, default: "" }, requestId: { type: String, required: true }, conversationId: { type: String, required: true }, digest: { type: String, required: true }, status: { type: String, enum: ["processing", "executing", "completed", "uncertain"], default: "processing" }, actionId: String, workflowVersion: Number, payload: Schema.Types.Mixed, result: Schema.Types.Mixed }, { timestamps: true });
turnSchema.index({ companyCode: 1, userId: 1, branchId: 1, requestId: 1 }, { unique: true });
turnSchema.index({ companyCode: 1, userId: 1, conversationId: 1, createdAt: -1 });
export const AssistantTurnModel = model("AssistantTurn", turnSchema);

const settingsSchema = new Schema({ ...scope, config: { type: Schema.Types.Mixed, required: true }, version: { type: Number, default: 0 } }, { timestamps: true });
settingsSchema.index({ companyCode: 1, userId: 1 }, { unique: true });
export const AssistantSettingsModel = model("AssistantSettings", settingsSchema);

const memorySchema = new Schema({
  ...scope,
  content: { type: String, required: true, maxlength: 300 },
  normalizedContent: { type: String, required: true },
  source: { type: String, enum: ["explicit", "manual", "automatic"], default: "explicit" },
  lastUsedAt: { type: Date, default: null },
}, { timestamps: true });
memorySchema.index({ companyCode: 1, userId: 1, normalizedContent: 1 }, { unique: true });
memorySchema.index({ companyCode: 1, userId: 1, updatedAt: -1 });
export const AssistantMemoryModel = model("AssistantMemory", memorySchema);

const documentFileSchema = new Schema({
  id: { type: String, required: true }, fileName: { type: String, required: true },
  format: { type: String, required: true }, mimeType: { type: String, required: true },
  size: { type: Number, required: true }, bytes: { type: Buffer, required: true, select: false },
}, { _id: false });
const documentSchema = new Schema({
  ...scope, branchId: { type: String, default: "" }, conversationId: { type: String, required: true },
  documentId: { type: String, required: true }, version: { type: Number, required: true },
  requestId: { type: String, required: true }, title: { type: String, required: true },
  content: { type: Schema.Types.Mixed, required: true, select: false },
  generationRulesVersion: { type: String, default: "" },
  files: { type: [documentFileSchema], required: true },
}, { timestamps: true });
documentSchema.index({ companyCode: 1, userId: 1, branchId: 1, conversationId: 1, documentId: 1, version: 1 }, { unique: true });
documentSchema.index({ companyCode: 1, userId: 1, branchId: 1, requestId: 1 }, { unique: true });
documentSchema.index({ companyCode: 1, userId: 1, branchId: 1, conversationId: 1, createdAt: -1 });
export const AssistantDocumentModel = model("AssistantDocument", documentSchema);

let indexReadiness: Promise<unknown> | undefined;
/** Do not accept deduplicated writes until their unique indexes exist. */
export function ensureAssistantIndexes() {
  return indexReadiness ||= Promise.all([AssistantWorkflowModel, AssistantSessionModel, AssistantTurnModel, AssistantSettingsModel, AssistantMemoryModel, AssistantDocumentModel].map(async model => { await model.init(); await model.createIndexes(); })).catch(error => { indexReadiness = undefined; throw error; });
}
