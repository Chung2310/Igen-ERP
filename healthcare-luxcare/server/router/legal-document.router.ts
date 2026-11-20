import { Router, type RequestHandler } from "express";
import multer from "multer";
import { Types } from "mongoose";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { requireCompanyAiSharing } from "../middleware/ai-sharing";
import { canApproveLegal, canManageLegal } from "../assistant/knowledge/legal-policy";
import { MAX_KNOWLEDGE_FILE_SIZE } from "../assistant/knowledge/knowledge-file-extractor";
import * as service from "../service/legal-document.service";
import * as structure from "../service/legal-structure.service";
import { editLegalAmendment } from "../service/legal-amendment-edit.service";
import { suggestLegalAmendment } from "../service/legal-amendment-suggestion.service";

export const legalDocumentRouter = Router();
legalDocumentRouter.use(requireAuth as RequestHandler);
const handle =
  (fn: (req: AuthenticatedRequest, res: import("express").Response) => Promise<unknown>): RequestHandler =>
  (req, res) => {
    void fn(req as AuthenticatedRequest, res).catch((error) =>
      res.status(error.statusCode === 402 || error.statusCode === 503 ? error.statusCode : 400).json({
        message:
          error.code === 11000 ? "Số hiệu hoặc văn bản thay thế đã được sử dụng. Vui lòng tải lại." : error.message,
      }),
    );
  };
const manage: RequestHandler = (req, res, next) =>
  canManageLegal((req as AuthenticatedRequest).user)
    ? next()
    : void res.status(403).json({ message: "Bạn không có quyền quản lý pháp lý." });
const approve: RequestHandler = (req, res, next) =>
  canApproveLegal((req as AuthenticatedRequest).user)
    ? next()
    : void res.status(403).json({ message: "Bạn không có quyền duyệt pháp lý." });
legalDocumentRouter.param("id", (_req, res, next, id) =>
  Types.ObjectId.isValid(id) ? next() : void res.status(400).json({ message: "Mã văn bản không hợp lệ." }),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_KNOWLEDGE_FILE_SIZE, fields: 2, fieldSize: 50_000 },
}).single("file");
legalDocumentRouter.get(
  "/",
  handle(async (req, res) => res.json(await service.listLegalDocuments(req.user!))),
);
legalDocumentRouter.post(
  "/",
  manage,
  (req, res, next) =>
    upload(req, res, (error) => (error ? void res.status(400).json({ message: error.message }) : next())),
  handle(async (req, res) => {
    if (!req.file || !Types.ObjectId.isValid(req.body.postId)) throw new Error("Chọn bài đăng và file pháp lý.");
    const metadata = JSON.parse(req.body.metadata || "{}");
    return res.status(202).json(await service.createLegalDocument(req.user!, req.body.postId, metadata, req.file));
  }),
);
legalDocumentRouter.get(
  "/:id",
  handle(async (req, res) => res.json(await service.legalDocumentPreview(req.user!, req.params.id))),
);
legalDocumentRouter.patch(
  "/:id",
  manage,
  handle(async (req, res) =>
    res.json(await service.updateLegalDocument(req.user!, req.params.id, req.body.metadata, req.body.updatedAt)),
  ),
);
legalDocumentRouter.get(
  "/:id/structure",
  handle(async (req, res) => res.json(await structure.getLegalStructure(req.user!, req.params.id))),
);
legalDocumentRouter.patch(
  "/:id/amendment",
  manage,
  handle(async (req, res) => res.json(await editLegalAmendment(req.user!, req.params.id, req.body))),
);
legalDocumentRouter.post(
  "/:id/suggest-amendment",
  manage,
  requireCompanyAiSharing as RequestHandler,
  handle(async (req, res) => {
    if (!Types.ObjectId.isValid(req.body.rootId)) throw new Error("Mã văn bản gốc không hợp lệ.");
    return res.json(await suggestLegalAmendment(req.user!, req.params.id, req.body.rootId));
  }),
);
legalDocumentRouter.put(
  "/:id/structure",
  manage,
  handle(async (req, res) => res.json(await structure.saveLegalStructure(req.user!, req.params.id, req.body))),
);
legalDocumentRouter.get(
  "/:id/effective",
  handle(async (req, res) => res.json(await structure.getEffectiveLegalText(req.user!, req.params.id, req.query.date))),
);
legalDocumentRouter.get(
  "/:id/source",
  handle(async (req, res) => {
    const source = await service.legalDocumentSource(req.user!, req.params.id);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(source.filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(source.buffer);
  }),
);
legalDocumentRouter.post(
  "/:id/approve",
  approve,
  handle(async (req, res) => {
    if (req.body.reviewed !== true) throw new Error("Xác nhận đã kiểm tra nội dung, hiệu lực và phạm vi thay thế.");
    return res.json(await service.approveLegalDocument(req.user!, req.params.id, req.body.reviewedUpdatedAt));
  }),
);
legalDocumentRouter.post(
  "/:id/withdraw",
  approve,
  handle(async (req, res) => res.json(await service.withdrawLegalDocument(req.user!, req.params.id, req.body.reason))),
);
legalDocumentRouter.post(
  "/:id/retry",
  manage,
  handle(async (req, res) => res.json(await service.retryLegalDocument(req.user!, req.params.id))),
);
