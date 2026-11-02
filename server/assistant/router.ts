import { Router } from "express";
import Joi from "joi";
import type { AuthenticatedRequest } from "../middleware/auth";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { AssistantError } from "./policy";
import { listWorkflows, saveWorkflow } from "./workflows";
import { conversationState, listConversations, processTurn } from "./service";

import { interpretWorkflowText } from "./workflow-text";
import { getSettings, saveSettings } from "./settings";
import { synthesizeVietnameseSpeech } from "./speech";
import { expensiveApiRateLimiter } from "../middleware/rate-limit";
import { deleteAssistantMemory, listAssistantMemories, saveAssistantMemory, updateAssistantMemory } from "./memory";

export const assistantRouter = Router();
assistantRouter.use(requireAuth as any, requirePermission("chat:read") as any);
const id = Joi.string().guid({ version: ["uuidv4"] }).required();
const wrap = (handler: (req: AuthenticatedRequest) => Promise<unknown>) => async (req: any, res: any) => {
  try { return res.json({ success: true, data: await handler(req) }); }
  catch (error) { if (!(error instanceof AssistantError)) console.error("[assistant]", error); return res.status(error instanceof AssistantError ? error.status : 500).json({ success: false, message: error instanceof AssistantError ? error.message : "Không thể xử lý trợ lý AI lúc này." }); }
};
assistantRouter.get("/settings", wrap(getSettings));
assistantRouter.patch("/settings", validateRequest({ body: Joi.object({ version: Joi.number().integer().min(0).required(), windowMode: Joi.string().valid("window", "fullscreen").required(), enterToSend: Joi.boolean().required(), showSuggestions: Joi.boolean().required(), instructions: Joi.string().max(2000).allow("").required(), responseRules: Joi.string().max(2000).allow(""), alwaysConfirm: Joi.boolean().required(), speakReplies: Joi.boolean().required(), memoryEnabled: Joi.boolean(), autoMemoryEnabled: Joi.boolean() }) }), wrap(req => saveSettings(req, req.body)));
assistantRouter.get("/memory", wrap(listAssistantMemories));
assistantRouter.post("/memory", validateRequest({ body: Joi.object({ content: Joi.string().trim().min(1).max(300).required() }) }), wrap(req => saveAssistantMemory(req, req.body.content, "manual")));
assistantRouter.patch("/memory/:memoryId", validateRequest({ params: Joi.object({ memoryId: Joi.string().hex().length(24).required() }), body: Joi.object({ content: Joi.string().trim().min(1).max(300).required() }) }), wrap(req => updateAssistantMemory(req, req.params.memoryId, req.body.content)));
assistantRouter.delete("/memory/:memoryId", validateRequest({ params: Joi.object({ memoryId: Joi.string().hex().length(24).required() }) }), wrap(req => deleteAssistantMemory(req, req.params.memoryId)));
assistantRouter.get("/workflows", wrap(listWorkflows));
assistantRouter.post("/workflows/:actionId/interpret", validateRequest({ params: Joi.object({ actionId: Joi.string().max(80).required() }), body: Joi.object({ version: Joi.number().integer().min(0).required(), text: Joi.string().trim().min(1).max(12000).required() }) }), wrap(req => interpretWorkflowText(req, req.params.actionId, req.body)));
assistantRouter.patch("/workflows/:actionId", validateRequest({ params: Joi.object({ actionId: Joi.string().max(80).required() }), body: Joi.object({ version: Joi.number().integer().min(0).required(), enabled: Joi.boolean().required(), sourceText: Joi.string().trim().min(1).max(12000), instructions: Joi.string().max(2000).allow("").required(), requireConfirmation: Joi.boolean().required(), fields: Joi.array().max(100).items(Joi.object({ key: Joi.string().max(80).required(), required: Joi.boolean().required(), defaultValue: Joi.alternatives(Joi.string().max(4000), Joi.number(), Joi.boolean()) })).required() }) }), wrap(req => saveWorkflow(req, req.params.actionId, req.body)));
assistantRouter.post("/workflows/:actionId/reset", validateRequest({ params: Joi.object({ actionId: Joi.string().max(80).required() }), body: Joi.object({ version: Joi.number().integer().min(0).required() }) }), wrap(req => saveWorkflow(req, req.params.actionId, req.body, true)));
assistantRouter.get("/conversations", validateRequest({ query: Joi.object({ limit: Joi.number().integer().min(1).max(50).default(30), before: Joi.string().isoDate(), beforeId: Joi.string().hex().length(24) }).and("before", "beforeId") }), wrap(req => listConversations(req, { limit: Number(req.query.limit || 30), before: req.query.before ? new Date(String(req.query.before)) : undefined, beforeId: req.query.beforeId ? String(req.query.beforeId) : undefined })));
assistantRouter.get("/conversations/:conversationId", validateRequest({ params: Joi.object({ conversationId: id }) }), wrap(req => conversationState(req, req.params.conversationId)));
const tableAttachment = Joi.object({
  fileName: Joi.string().trim().min(1).max(200).required(),
  headers: Joi.array().items(Joi.string().trim().min(1).max(120)).min(1).max(40).required(),
  rows: Joi.array().items(Joi.object().pattern(Joi.string().max(120), Joi.string().max(2000)).max(40)).min(1).max(100).required(),
}).max(3);
assistantRouter.post("/turns", validateRequest({ body: Joi.object({ conversationId: id, requestId: id, text: Joi.string().trim().min(1).max(6000), attachment: tableAttachment, decision: Joi.object({ id, confirmed: Joi.boolean().required(), password: Joi.string().min(6).max(128) }) }).xor("text", "decision").with("attachment", "text") }), wrap(req => processTurn(req, req.body)));
assistantRouter.post("/speech", expensiveApiRateLimiter, validateRequest({ body: Joi.object({ text: Joi.string().trim().min(1).max(12000).required() }) }), wrap(req => synthesizeVietnameseSpeech(req.body.text)));
