import { Router } from "express";
import { simulatePageChat } from "../service/page-chat-simulator";
import { runPersistentPageChatTurn } from "../service/page-chat-persistent-simulator";
import type { AuthenticatedRequest } from "../../shared/middleware/auth";
import Joi from "joi";
import { companyKnowledgeController } from "../controller/company-knowledge.controller.ts";
import { geminiController } from "../../shared/controller/gemini.controller.ts";
import { requireAuth, requirePermission } from "../../shared/middleware/auth";
import { validateRequest } from "../../../../middleware/validation";
import { withAiUsage } from "../../shared/service/ai-subscription.service";

export const companyKnowledgeRouter = Router();

const managerOnly = requirePermission("company-knowledge:manage");
const pageScope = Joi.string().valid("all", "selected");
const pageIds = Joi.array().items(Joi.string().trim().min(1)).max(100);
const documentType = Joi.string().valid(
  "company_profile", "product", "service", "policy", "pricing", "promotion", "faq", "brand_guideline", "scenario", "general"
);
const scopeSchema = {
  body: Joi.object({
    channelScope: Joi.array()
      .items(Joi.string().valid("facebook", "zalo", "tiktok", "all"))
      .min(1)
      .required(),
    pageScope: pageScope.optional(),
    pageIds: pageIds.when("pageScope", {
      is: "selected",
      then: Joi.array().items(Joi.string().trim().min(1)).min(1).max(100).required(),
      otherwise: Joi.array().items(Joi.string()).max(0).optional(),
    }),
    documentType: documentType.optional(),
    purposeScope: Joi.array()
      .items(
        Joi.string().valid(
          "sales",
          "support",
          "marketing",
          "caption",
          "all"
        )
      )
      .min(1)
      .required(),
  }),
  params: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required(),
  }),
};
const idSchema = {
  params: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required(),
  }),
};
const uploadSchema = {
  body: Joi.object({
    fileName: Joi.string().required(),
    fileBase64: Joi.string().required(),
    mimeType: Joi.string().required(),
    channelScope: scopeSchema.body.extract("channelScope").optional(),
    purposeScope: scopeSchema.body.extract("purposeScope").optional(),
    pageScope: pageScope.optional(),
    pageIds: pageIds.optional(),
    documentType: documentType.optional(),
  }),
};
const syncSchema = {
  body: Joi.object({
    docLink: Joi.string().required(),
    channelScope: scopeSchema.body.extract("channelScope").optional(),
    purposeScope: scopeSchema.body.extract("purposeScope").optional(),
    pageScope: pageScope.optional(),
    pageIds: pageIds.optional(),
    documentType: documentType.optional(),
  }),
};

const testSearchSchema = {
  body: Joi.object({
    query: Joi.string().required(),
    channel: Joi.string().valid("facebook", "zalo", "tiktok", "all").optional(),
    pageId: Joi.string().allow("").optional(),
    topK: Joi.number().min(1).max(20).optional(),
  }),
};

companyKnowledgeRouter.use(requireAuth as never);
companyKnowledgeRouter.get(
  "/health",
  geminiController.getKnowledgeHealth as never
);
companyKnowledgeRouter.get(
  "/conflicts",
  companyKnowledgeController.getConflicts as never
);
companyKnowledgeRouter.post(
  "/test-search",
  validateRequest(testSearchSchema),
  companyKnowledgeController.testSearch as never
);
companyKnowledgeRouter.get(
  "/documents",
  companyKnowledgeController.listDocuments as never
);
companyKnowledgeRouter.post(
  "/documents/upload",
  managerOnly as never,
  validateRequest(uploadSchema),
  (req, _res, next) => { req.body.appendScenario = true; next(); },
  geminiController.uploadLocalDocument as never
);
companyKnowledgeRouter.post(
  "/sync-drive",
  managerOnly as never,
  validateRequest(syncSchema),
  (req, _res, next) => { req.body.clearExisting = false; next(); },
  geminiController.syncGoogleDrive as never
);
companyKnowledgeRouter.patch(
  "/documents/:id/scopes",
  managerOnly as never,
  validateRequest(scopeSchema),
  companyKnowledgeController.updateScopes as never
);
companyKnowledgeRouter.delete(
  "/documents/:id",
  managerOnly as never,
  validateRequest(idSchema),
  companyKnowledgeController.deleteDocument as never
);

// AI Learning & FAQ Discovery routes
companyKnowledgeRouter.get(
  "/faq-candidates",
  companyKnowledgeController.listFaqCandidates as never
);
companyKnowledgeRouter.post(
  "/faq-candidates/analyze",
  managerOnly as never,
  companyKnowledgeController.analyzeFaqs as never
);
companyKnowledgeRouter.post(
  "/faq-candidates/:id/approve",
  managerOnly as never,
  validateRequest(idSchema),
  companyKnowledgeController.approveFaqCandidate as never
);
companyKnowledgeRouter.post(
  "/faq-candidates/:id/reject",
  managerOnly as never,
  validateRequest(idSchema),
  companyKnowledgeController.rejectFaqCandidate as never
);
companyKnowledgeRouter.delete(
  "/faq-candidates/:id",
  managerOnly as never,
  validateRequest(idSchema),
  companyKnowledgeController.deleteFaqCandidate as never
);

companyKnowledgeRouter.post(
  "/clear-all",
  managerOnly as never,
  companyKnowledgeController.clearAllKnowledge as never
);


companyKnowledgeRouter.post("/simulate-page-chat", async (request, res) => {
  const req = request as AuthenticatedRequest;
  const { message, history, documentText, rule, pageId } = req.body || {};
  if (typeof message !== "string" || !message.trim() || message.length > 3000
    || !Array.isArray(history) || history.length > 40
    || history.some(turn => !turn || !["customer", "bot"].includes(turn.role) || typeof turn.text !== "string" || turn.text.length > 3000)
    || (documentText !== undefined && (typeof documentText !== "string" || documentText.length > 30000))
    || (rule !== undefined && (typeof rule !== "string" || rule.length > 5000))
    || (pageId !== undefined && (typeof pageId !== "string" || pageId.length > 100))) {
    return res.status(400).json({ status: "error", message: "Dữ liệu hội thoại mô phỏng không hợp lệ." });
  }
  try {
    const companyCode = req.user!.companyCode;
    const data = await withAiUsage({ companyCode, userId: req.user!.id }, () => simulatePageChat({ companyCode, pageId, message: message.trim(), history, documentText, rule }));
    return res.json({ status: "success", data });
  } catch (error) {
    console.error("[PageChatSimulator] Error:", error);
    return res.status(502).json({ status: "error", message: "Không thể tạo phản hồi mô phỏng lúc này." });
  }
});

companyKnowledgeRouter.post("/simulate-page-chat-real", managerOnly as never, async (request, res) => {
  const req = request as AuthenticatedRequest;
  const { message, pageId, conversationKey, turnId } = req.body || {};
  if (typeof message !== "string" || !message.trim() || message.length > 3000
    || typeof pageId !== "string" || !pageId.trim() || pageId.length > 100
    || typeof conversationKey !== "string" || !conversationKey.trim() || conversationKey.length > 100
    || typeof turnId !== "string" || !turnId.trim() || turnId.length > 100) {
    return res.status(400).json({ status: "error", message: "Dữ liệu lượt chat lưu thật không hợp lệ." });
  }
  try {
    const companyCode = req.user!.companyCode;
    const data = await withAiUsage({ companyCode, userId: req.user!.id }, () => runPersistentPageChatTurn({ companyCode, pageId, conversationKey, turnId, message }));
    return res.json({ status: "success", data });
  } catch (error) {
    const problem = error as Error & { statusCode?: number };
    console.error("[PageChatPersistentSimulator] Error:", error);
    const status = problem.statusCode && problem.statusCode >= 400 && problem.statusCode < 500 ? problem.statusCode : 502;
    return res.status(status).json({ status: "error", message: status === 502 ? "Không thể hoàn tất lượt chat lưu thật lúc này." : problem.message });
  }
});
