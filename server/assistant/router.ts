import { Router } from "express";
import Joi from "joi";
import multer from "multer";
import type { AuthenticatedRequest } from "../middleware/auth";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { AssistantError } from "./policy";
import { listWorkflows, saveWorkflow } from "./workflows";
import { clearConversationMemory, conversationMemory, conversationState, deleteConversation, listConversations, processTurn, saveConversationMemory } from "./service";

import { interpretWorkflowText } from "./workflow-text";
import { getSettings, saveSettings } from "./settings";
import { synthesizeVietnameseSpeech } from "./speech";
import { assistantSpeechVoices } from "../../src/shared/assistant-speech-voices";
import { expensiveApiRateLimiter } from "../middleware/rate-limit";
import { deleteAssistantMemory, listAssistantMemories, saveAssistantMemory, updateAssistantMemory } from "./memory";
import { enhanceStudioImagePrompt, generateStudioImages, studioImageRatios } from "./studio-images";
import { editStudioImage, studioEditModes } from "./studio-image-edit";
import { listStudioTranscripts, transcribeStudioAudio } from "./studio-transcription";
import { downloadAssistantFile } from "./documents";

export const assistantRouter = Router();
assistantRouter.use(requireAuth as any, requirePermission("chat:read") as any);
const id = Joi.string().guid({ version: ["uuidv4"] }).required();
const wrap = (handler: (req: AuthenticatedRequest) => Promise<unknown>) => async (req: any, res: any) => {
  try { return res.json({ success: true, data: await handler(req) }); }
  catch (error) { if (!(error instanceof AssistantError)) console.error("[assistant]", error); return res.status(error instanceof AssistantError ? error.status : 500).json({ success: false, message: error instanceof AssistantError ? error.message : "Không thể xử lý trợ lý AI lúc này." }); }
};
assistantRouter.get("/conversations/:id/files/:fileId", validateRequest({ params: Joi.object({ id, fileId: id }) }), async (req: any, res: any) => {
  try {
    const file = await downloadAssistantFile(req, req.params.id, req.params.fileId);
    res.setHeader("Content-Type", file.mimeType);
    const encodedName = encodeURIComponent(file.fileName).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    res.setHeader("Content-Disposition", `attachment; filename="document"; filename*=UTF-8''${encodedName}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(file.bytes);
  } catch (error) {
    if (!(error instanceof AssistantError)) console.error("[assistant file]", error);
    return res.status(error instanceof AssistantError ? error.status : 500).json({ success: false, message: error instanceof AssistantError ? error.message : "Không thể tải tệp lúc này." });
  }
});
assistantRouter.get("/settings", wrap(getSettings));
const studioAudioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => callback(null, /\.(mp3|wav|m4a|ogg|flac)$/i.test(file.originalname)) });
assistantRouter.post("/studio/transcriptions", expensiveApiRateLimiter, (req, res, next) => studioAudioUpload.single("audio")(req, res, (error) => error ? res.status(413).json({ success: false, message: "Tệp âm thanh vượt giới hạn 50 MB hoặc không hợp lệ." }) : next()), wrap(req => {
  if (!req.user?.companyCode || !req.user.id) throw new AssistantError("Cần chọn doanh nghiệp để lưu bản chép lời.", 403);
  if (!req.file) throw new AssistantError("Chọn tệp MP3, WAV, M4A, OGG hoặc FLAC.", 400);
  return transcribeStudioAudio({ buffer: req.file.buffer, fileName: req.file.originalname.slice(0, 255), companyCode: req.user.companyCode, userId: req.user.id });
}));
assistantRouter.get("/studio/transcriptions", wrap(req => {
  if (!req.user?.companyCode || !req.user.id) throw new AssistantError("Cần chọn doanh nghiệp để xem bản chép lời.", 403);
  return listStudioTranscripts(req.user.companyCode, req.user.id);
}));
assistantRouter.post("/studio/images/optimize-prompt", expensiveApiRateLimiter, validateRequest({ body: Joi.object({ prompt: Joi.string().trim().min(3).max(2000).required() }) }), wrap(req => enhanceStudioImagePrompt(req.body.prompt)));
assistantRouter.post("/studio/images/edit", expensiveApiRateLimiter, validateRequest({ body: Joi.object({
  sourceImage: Joi.string().max(21_000_000).pattern(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/).required(),
  prompt: Joi.string().trim().min(3).max(2000).required(),
  mode: Joi.string().valid(...studioEditModes).required(),
  region: Joi.object({
    x: Joi.number().min(0).max(1).required(), y: Joi.number().min(0).max(1).required(),
    width: Joi.number().greater(0).max(1).required(), height: Joi.number().greater(0).max(1).required(),
  }).custom((value, helpers) => value.x + value.width <= 1.001 && value.y + value.height <= 1.001 ? value : helpers.error("any.invalid")),
}) }), wrap(req => editStudioImage(req.body)));
assistantRouter.post("/studio/images", expensiveApiRateLimiter, validateRequest({ body: Joi.object({
  prompt: Joi.string().trim().min(3).max(2000).required(),
  aspectRatio: Joi.string().valid(...studioImageRatios).required(),
  count: Joi.number().integer().min(1).max(4).required(),
  referenceImage: Joi.string().max(5_600_000).pattern(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
}) }), wrap(req => generateStudioImages(req.body)));
assistantRouter.patch("/settings", validateRequest({ body: Joi.object({ version: Joi.number().integer().min(0).required(), windowMode: Joi.string().valid("window", "fullscreen").required(), enterToSend: Joi.boolean().required(), showSuggestions: Joi.boolean().required(), instructions: Joi.string().max(2000).allow("").required(), responseRules: Joi.string().max(2000).allow(""), alwaysConfirm: Joi.boolean().required(), speakReplies: Joi.boolean().required(), speechVoice: Joi.string().valid(...assistantSpeechVoices), wakeWordEnabled: Joi.boolean().required(), memoryEnabled: Joi.boolean(), autoMemoryEnabled: Joi.boolean() }) }), wrap(req => saveSettings(req, req.body)));
assistantRouter.get("/memory", wrap(listAssistantMemories));
assistantRouter.post("/memory", validateRequest({ body: Joi.object({ content: Joi.string().trim().min(1).max(300).required() }) }), wrap(req => saveAssistantMemory(req, req.body.content, "manual")));
assistantRouter.patch("/memory/:memoryId", validateRequest({ params: Joi.object({ memoryId: Joi.string().hex().length(24).required() }), body: Joi.object({ content: Joi.string().trim().min(1).max(300).required() }) }), wrap(req => updateAssistantMemory(req, req.params.memoryId, req.body.content)));
assistantRouter.delete("/memory/:memoryId", validateRequest({ params: Joi.object({ memoryId: Joi.string().hex().length(24).required() }) }), wrap(req => deleteAssistantMemory(req, req.params.memoryId)));
assistantRouter.get("/workflows", wrap(listWorkflows));
assistantRouter.post("/workflows/:actionId/interpret", validateRequest({ params: Joi.object({ actionId: Joi.string().max(80).required() }), body: Joi.object({ version: Joi.number().integer().min(0).required(), text: Joi.string().trim().min(1).max(12000).required() }) }), wrap(req => interpretWorkflowText(req, req.params.actionId, req.body)));
assistantRouter.patch("/workflows/:actionId", validateRequest({ params: Joi.object({ actionId: Joi.string().max(80).required() }), body: Joi.object({ version: Joi.number().integer().min(0).required(), enabled: Joi.boolean().required(), sourceText: Joi.string().trim().min(1).max(12000), instructions: Joi.string().max(2000).allow("").required(), requireConfirmation: Joi.boolean().required(), fields: Joi.array().max(100).items(Joi.object({ key: Joi.string().max(80).required(), required: Joi.boolean().required(), defaultValue: Joi.alternatives(Joi.string().max(4000), Joi.number(), Joi.boolean()) })).required() }) }), wrap(req => saveWorkflow(req, req.params.actionId, req.body)));
assistantRouter.post("/workflows/:actionId/reset", validateRequest({ params: Joi.object({ actionId: Joi.string().max(80).required() }), body: Joi.object({ version: Joi.number().integer().min(0).required() }) }), wrap(req => saveWorkflow(req, req.params.actionId, req.body, true)));
assistantRouter.get("/conversations", validateRequest({ query: Joi.object({ limit: Joi.number().integer().min(1).max(50).default(30), before: Joi.string().isoDate(), beforeId: Joi.string().hex().length(24) }).and("before", "beforeId") }), wrap(req => listConversations(req, { limit: Number(req.query.limit || 30), before: req.query.before ? new Date(String(req.query.before)) : undefined, beforeId: req.query.beforeId ? String(req.query.beforeId) : undefined })));
assistantRouter.get("/conversations/:conversationId/memory", validateRequest({ params: Joi.object({ conversationId: id }) }), wrap(req => conversationMemory(req, req.params.conversationId)));
assistantRouter.patch("/conversations/:conversationId/memory", validateRequest({ params: Joi.object({ conversationId: id }), body: Joi.object({ summary: Joi.string().max(2000).allow("").required(), version: Joi.number().integer().min(0).required() }) }), wrap(req => saveConversationMemory(req, req.params.conversationId, req.body.summary, req.body.version)));
assistantRouter.delete("/conversations/:conversationId/memory", validateRequest({ params: Joi.object({ conversationId: id }) }), wrap(req => clearConversationMemory(req, req.params.conversationId)));
assistantRouter.delete("/conversations/:conversationId", validateRequest({ params: Joi.object({ conversationId: id }) }), wrap(req => deleteConversation(req, req.params.conversationId)));
assistantRouter.get("/conversations/:conversationId", validateRequest({ params: Joi.object({ conversationId: id }) }), wrap(req => conversationState(req, req.params.conversationId)));
const tableAttachment = Joi.object({
  fileName: Joi.string().trim().min(1).max(200).required(),
  headers: Joi.array().items(Joi.string().trim().min(1).max(120)).min(1).max(40).required(),
  rows: Joi.array().items(Joi.object().pattern(Joi.string().max(120), Joi.string().max(2000).allow("")).max(40)).min(1).max(100).required(),
}).max(3);
const trainingContent = Joi.object({
  lessons: Joi.array().max(50).items(Joi.object({
    title: Joi.string().trim().min(1).max(300).required(),
    type: Joi.string().valid("youtube", "document", "other", "text", "video").required(),
    url: Joi.string().max(2048).allow(""),
    content: Joi.string().max(10000).allow(""),
    fileName: Joi.string().max(255).allow(""),
    uploadToken: Joi.string().max(4000).allow(""),
  }).max(6)).required(),
  quizzes: Joi.array().max(50).items(Joi.object({
    question: Joi.string().trim().min(1).max(1000).required(),
    options: Joi.array().items(Joi.string().trim().min(1).max(500)).min(2).max(6).required(),
    correctOptionIndex: Joi.number().integer().min(0).max(5).required(),
  }).custom((quiz, helpers) => quiz.correctOptionIndex >= quiz.options.length
    ? helpers.error("any.invalid")
    : quiz)).required(),
});
assistantRouter.post("/turns", validateRequest({ body: Joi.object({ conversationId: id, requestId: id, mode: Joi.string().valid("work", "qa"), research: Joi.boolean(), text: Joi.string().trim().min(1).max(6000), attachment: tableAttachment, referenceSelections: Joi.object().pattern(Joi.string().pattern(/^[A-Za-z0-9_.\[\]-]+$/).max(160), Joi.array().items(Joi.string().trim().min(1).max(300)).min(1).max(100)).max(100), skipReferenceKeys: Joi.array().items(Joi.string().pattern(/^[A-Za-z0-9_.\[\]-]+$/).max(160)).max(100), trainingContent, decision: Joi.object({ id, confirmed: Joi.boolean().required(), password: Joi.string().min(6).max(128) }) }).xor("text", "decision", "referenceSelections", "trainingContent").with("skipReferenceKeys", "referenceSelections").with("attachment", "text") }), wrap(req => processTurn(req, req.body)));
assistantRouter.post("/speech", expensiveApiRateLimiter, validateRequest({ body: Joi.object({ text: Joi.string().trim().min(1).max(12000).required(), voice: Joi.string().valid(...assistantSpeechVoices) }) }), async (req: any, res: any) => {
  const controller = new AbortController();
  const abortOnClose = () => { if (!res.writableEnded) controller.abort(); };
  res.once("close", abortOnClose);
  try {
    const audio = await synthesizeVietnameseSpeech(req.body.text, controller.signal, req.body.voice);
    if (controller.signal.aborted) return;
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.send(audio);
  } catch (error) {
    if (controller.signal.aborted) return;
    if (!(error instanceof AssistantError)) console.error("[assistant speech]", error);
    return res.status(error instanceof AssistantError ? error.status : 500).json({ success: false, message: error instanceof AssistantError ? error.message : "Không thể tạo giọng nói lúc này." });
  } finally {
    res.off("close", abortOnClose);
  }
});
