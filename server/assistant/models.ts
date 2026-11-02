import { Schema, model } from "mongoose";
const scope = { userId: { type: String, required: true }, companyCode: { type: String, required: true } };
const workflowSchema = new Schema({ ...scope, actionId: { type: String, required: true }, config: { type: Schema.Types.Mixed, required: true }, version: { type: Number, default: 0 } }, { timestamps: true });
workflowSchema.index({ companyCode: 1, userId: 1, actionId: 1 }, { unique: true });
export const AssistantWorkflowModel = model("AssistantWorkflow", workflowSchema);
const sessionSchema = new Schema({ ...scope, branchId: { type: String, default: "" }, conversationId: { type: String, required: true }, busy: { type: Boolean, default: false }, pending: { type: Schema.Types.Mixed, default: null }, messages: { type: [Schema.Types.Mixed], default: [] }, lastReply: { type: Schema.Types.Mixed, default: null } }, { timestamps: true });
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
let indexReadiness: Promise<unknown> | undefined;
/** Do not accept deduplicated writes until their unique indexes exist. */
export function ensureAssistantIndexes() {
  return indexReadiness ||= Promise.all([AssistantWorkflowModel, AssistantSessionModel, AssistantTurnModel, AssistantSettingsModel].map(async model => { await model.init(); await model.createIndexes(); })).catch(error => { indexReadiness = undefined; throw error; });
}
