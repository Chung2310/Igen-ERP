import { Router, type RequestHandler } from "express";
import { Types } from "mongoose";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../middleware/auth";
import { resolveKnowledgeContext } from "../assistant/knowledge/knowledge-access";
import * as service from "../service/knowledge-legal-review.service";
export const knowledgeLegalReviewRouter = Router();
knowledgeLegalReviewRouter.use(requireAuth as RequestHandler);
const read = requirePermission(["knowledge:read", "knowledge:manage"]) as RequestHandler;
const manage = requirePermission("knowledge:manage") as RequestHandler;
const handle =
  (fn: (req: AuthenticatedRequest) => Promise<unknown>): RequestHandler =>
  (req, res) => {
    void fn(req as AuthenticatedRequest)
      .then((data) => res.json(data))
      .catch((error) => res.status(400).json({ message: error.message }));
  };
knowledgeLegalReviewRouter.param("id", (_req, res, next, id) =>
  Types.ObjectId.isValid(id) ? next() : void res.status(400).json({ message: "Mã đối chiếu không hợp lệ." }),
);
knowledgeLegalReviewRouter.get(
  "/",
  read,
  handle(async (req) => service.listKnowledgeLegalReviews(await resolveKnowledgeContext(req.user!))),
);
knowledgeLegalReviewRouter.post(
  "/scan",
  manage,
  handle(async (req) => service.scanVisibleKnowledgeLegalReviews(await resolveKnowledgeContext(req.user!))),
);
knowledgeLegalReviewRouter.post(
  "/manual",
  manage,
  handle(async (req) =>
    service.proposeManualLegalReview(
      await resolveKnowledgeContext(req.user!),
      req.body.documentId,
      req.body.legalDocumentId,
    ),
  ),
);
knowledgeLegalReviewRouter.get(
  "/documents/:id",
  read,
  handle(async (req) => service.knowledgeLegalReviewDetail(await resolveKnowledgeContext(req.user!), req.params.id)),
);
knowledgeLegalReviewRouter.post(
  "/:id/decision",
  manage,
  handle(async (req) =>
    service.decideKnowledgeLegalReview(await resolveKnowledgeContext(req.user!), req.params.id, req.body),
  ),
);
