import { Schema, model } from "mongoose";
const scope = { userId: { type: String, required: true }, companyCode: { type: String, required: true } };
const workflowSchema = new Schema({ ...scope, actionId: { type: String, required: true }, config: { type: Schema.Types.Mixed, required: true }, version: { type: Number, default: 0 } }, { timestamps: true });
workflowSchema.index({ companyCode: 1, userId: 1, actionId: 1 }, { unique: true });
export const AssistantWorkflowModel = model("AssistantWorkflow", workflowSchema);
const sessionSchema = new Schema({ ...scope, branchId: { type: String, default: "" }, conversationId: { type: String, required: true }, mode: { type: String, enum: ["work", "qa"], default: "work" }, busy: { type: Boolean, default: false }, pending: { type: Schema.Types.Mixed, default: null }, remainingRequests: { type: [String], default: [] }, pendingMemoryProposal: { type: String, default: "", maxlength: 300 }, pendingDocumentRequest: { type: String, default: "", maxlength: 12000 }, messages: { type: [Schema.Types.Mixed], default: [] }, messageCount: { type: Number, default: 0, min: 0 }, sessionMemory: { type: String, default: "", maxlength: 2400 }, sessionMemoryMessageCount: { type: Number, default: 0, min: 0 }, sessionMemoryVersion: { type: Number, default: 0, min: 0 }, lastReply: { type: Schema.Types.Mixed, default: null } }, { timestamps: true });
sessionSchema.add({ activeRequestId: { type: String, default: "" } });
sessionSchema.index({ companyCode: 1, userId: 1, branchId: 1, conversationId: 1 }, { unique: true });
sessionSchema.index({ companyCode: 1, userId: 1, branchId: 1, updatedAt: -1, _id: -1 });
export const AssistantSessionModel = model("AssistantSession", sessionSchema);
const projectCollectionSchema = new Schema({ ...scope, branchId: { type: String, default: "" }, projects: { type: [Schema.Types.Mixed], default: [] } }, { timestamps: true });
projectCollectionSchema.index({ companyCode: 1, userId: 1, branchId: 1 }, { unique: true });
export const AssistantProjectCollectionModel = model("AssistantProjectCollection", projectCollectionSchema);
const projectFileSchema = new Schema({
  ...scope,
  branchId: { type: String, default: "" },
  projectId: { type: String, required: true },
  fileId: { type: String, required: true },
  fileName: { type: String, required: true, maxlength: 180 },
  mimeType: { type: String, required: true, maxlength: 120 },
  size: { type: Number, required: true, min: 0, max: 15 * 1024 * 1024 },
  extractedText: { type: String, required: true, select: false },
  bytes: { type: Buffer, required: true, select: false },
}, { timestamps: true });
projectFileSchema.index({ companyCode: 1, userId: 1, branchId: 1, projectId: 1, fileId: 1 }, { unique: true });
projectFileSchema.index({ companyCode: 1, userId: 1, branchId: 1, projectId: 1, updatedAt: -1 });
export const AssistantProjectFileModel = model("AssistantProjectFile", projectFileSchema);
const turnSchema = new Schema({ ...scope, branchId: { type: String, default: "" }, requestId: { type: String, required: true }, conversationId: { type: String, required: true }, digest: { type: String, required: true }, status: { type: String, enum: ["processing", "executing", "completed", "uncertain"], default: "processing" }, actionId: String, workflowVersion: Number, payload: Schema.Types.Mixed, result: Schema.Types.Mixed }, { timestamps: true });
turnSchema.add({ steps: { type: [Schema.Types.Mixed], default: [] } });
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

const promptTemplateSchema = new Schema({
  companyCode: { type: String, required: true },
  userId: { type: String, required: true },
  templateId: { type: String, required: true },
  owner: { type: String, enum: ["igen", "user"], required: true },
  title: { type: String, required: true, maxlength: 100 },
  description: { type: String, required: true, maxlength: 180 },
  category: { type: String, required: true, maxlength: 60 },
  prompt: { type: String, required: true, maxlength: 5000 },
  favoriteBy: { type: [String], default: [] },
}, { timestamps: true });
promptTemplateSchema.index({ companyCode: 1, templateId: 1 }, { unique: true });
promptTemplateSchema.index({ companyCode: 1, owner: 1, userId: 1, updatedAt: -1 });
export const AssistantPromptTemplateModel = model("AssistantPromptTemplate", promptTemplateSchema);

const userAgentSchema = new Schema({
  ...scope,
  agentId: { type: String, required: true },
  name: { type: String, required: true, maxlength: 50 },
  description: { type: String, default: "", maxlength: 150 },
  instructions: { type: String, required: true, maxlength: 10000 },
  avoid: { type: String, default: "", maxlength: 2000 },
  tone: { type: String, required: true, maxlength: 60 },
  avatar: { type: Number, default: 0, min: 0, max: 5 },
  favorite: { type: Boolean, default: false },
  openingQuestions: { type: [String], default: [] },
  knowledge: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true });
userAgentSchema.index({ companyCode: 1, userId: 1, agentId: 1 }, { unique: true });
userAgentSchema.index({ companyCode: 1, userId: 1, updatedAt: -1 });
export const UserAssistantAgentModel = model("UserAssistantAgent", userAgentSchema);

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
  return indexReadiness ||= Promise.all([AssistantWorkflowModel, AssistantSessionModel, AssistantProjectCollectionModel, AssistantProjectFileModel, AssistantTurnModel, AssistantSettingsModel, AssistantMemoryModel, AssistantPromptTemplateModel, UserAssistantAgentModel, AssistantDocumentModel].map(async model => { await model.init(); await model.createIndexes(); })).catch(error => { indexReadiness = undefined; throw error; });
}
