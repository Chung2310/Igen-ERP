import { requireCompanyAiSharing } from "../middleware/ai-sharing";
import { Router, type RequestHandler, type Response } from "express";
import multer from "multer";
import { assistantKnowledgeController as controller } from "../controller/assistant-knowledge.controller";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import {
  knowledgeMetadataSchema,
  updateKnowledgeMetadataSchema,
  assistantKnowledgeIdSchema,
  createKnowledgeDocumentSchema,
  syncKnowledgeResourceSchema,
  testKnowledgeSearchSchema,
  suggestReplacementSchema,
  verifySpotCheckSchema,
} from "../validation/assistant-knowledge.validation";
import { MAX_KNOWLEDGE_FILES, MAX_KNOWLEDGE_FILE_SIZE } from "../assistant/knowledge/knowledge-file-extractor";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_KNOWLEDGE_FILE_SIZE, files: MAX_KNOWLEDGE_FILES, fields: 5, fieldSize: 20_000 },
});
const read = requirePermission(["knowledge:read", "knowledge:manage"]) as RequestHandler;
const manage = requirePermission("knowledge:manage") as RequestHandler;
const handle =
  (fn: (req: AuthenticatedRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
const parseScope: RequestHandler = (req, res, next) => {
  try {
    for (const key of ["branchIds", "departmentIds"])
      if (typeof req.body?.[key] === "string") req.body[key] = JSON.parse(req.body[key]);
    next();
  } catch {
    res.status(400).json({ success: false, message: "Phạm vi tài liệu không hợp lệ." });
  }
};
export const assistantKnowledgeRouter = Router();
assistantKnowledgeRouter.use(requireAuth as RequestHandler);
assistantKnowledgeRouter.get("/scopes", manage, handle(controller.scopes));
assistantKnowledgeRouter.get("/documents", read, handle(controller.list));
assistantKnowledgeRouter.get(
  "/documents/:id",
  read,
  validateRequest(assistantKnowledgeIdSchema),
  handle(controller.detail),
);
assistantKnowledgeRouter.get(
  "/documents/:id/source",
  read,
  validateRequest(assistantKnowledgeIdSchema),
  handle(controller.source),
);
assistantKnowledgeRouter.post(
  "/test-search",
  read,
  requireCompanyAiSharing as RequestHandler,
  validateRequest(testKnowledgeSearchSchema),
  handle(controller.testSearch),
);
assistantKnowledgeRouter.post(
  "/documents",
  manage,
  requireCompanyAiSharing as RequestHandler,
  validateRequest(createKnowledgeDocumentSchema),
  handle(controller.create),
);
assistantKnowledgeRouter.post(
  "/files",
  manage,
  requireCompanyAiSharing as RequestHandler,
  upload.array("files", MAX_KNOWLEDGE_FILES),
  parseScope,
  validateRequest(knowledgeMetadataSchema),
  handle(controller.uploadFiles),
);
assistantKnowledgeRouter.post(
  "/resources/:resourceId/sync",
  manage,
  requireCompanyAiSharing as RequestHandler,
  validateRequest(syncKnowledgeResourceSchema),
  handle(controller.syncResource),
);
assistantKnowledgeRouter.delete(
  "/documents/:id",
  manage,
  validateRequest(assistantKnowledgeIdSchema),
  handle(controller.remove),
);
assistantKnowledgeRouter.patch(
  "/documents/:id",
  manage,
  validateRequest(updateKnowledgeMetadataSchema),
  handle(controller.updateMetadata),
);
assistantKnowledgeRouter.post(
  "/documents/:id/reindex",
  manage,
  requireCompanyAiSharing as RequestHandler,
  validateRequest(assistantKnowledgeIdSchema),
  handle(controller.retry),
);
assistantKnowledgeRouter.post(
  "/suggest-replacement",
  read,
  requireCompanyAiSharing as RequestHandler,
  validateRequest(suggestReplacementSchema),
  handle(controller.suggestReplacement),
);
assistantKnowledgeRouter.post(
  "/documents/:id/verify-spotcheck",
  manage,
  validateRequest(assistantKnowledgeIdSchema),
  validateRequest(verifySpotCheckSchema),
  handle(controller.verifySpotCheck),
);
