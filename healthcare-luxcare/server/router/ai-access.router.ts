import { aiSharingDisclosure, updateAiSharingConsent, AiSharingError } from "../service/ai-sharing.service";
import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import Joi from "joi";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { expensiveApiRateLimiter } from "../middleware/rate-limit";
import { askFreeAi, freeAiHistory, freeAiStatus, FreeAiError } from "../service/free-ai.service";

export const aiAccessRouter = Router();
aiAccessRouter.use(requireAuth);
const handle =
  (work: (req: AuthenticatedRequest) => Promise<unknown>) => async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.json({ status: "success", data: await work(req) });
    } catch (error: unknown) {
      const status = error instanceof FreeAiError || error instanceof AiSharingError ? error.statusCode : 503;
      const code =
        error instanceof FreeAiError || error instanceof AiSharingError ? error.code : "AI_PERSONAL_UNAVAILABLE";
      const message =
        error instanceof FreeAiError || error instanceof AiSharingError
          ? error.message
          : "Trợ lý cá nhân đang tạm ngừng. Vui lòng thử lại sau.";
      const resetAt = error instanceof FreeAiError ? error.resetAt : undefined;
      if (resetAt)
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))));
      return res
        .status(status)
        .json({
          status: "error",
          code,
          message,
          resetAt: resetAt?.toISOString(),
          error: {
            code,
            message,
            resetAt: resetAt?.toISOString(),
            requestId: req.header("x-request-id") || randomUUID(),
          },
        });
    }
  };
aiAccessRouter.get("/status", handle((req) => freeAiStatus(req.user!.id)));
const scopeSchema = Joi.object({ scope: Joi.string().valid("personal", "company").required() });
aiAccessRouter.get(
  "/consent/:scope",
  validateRequest({ params: scopeSchema }),
  handle((req) => aiSharingDisclosure(req.user!.id, req.params.scope as "personal" | "company")),
);
aiAccessRouter.post(
  "/consent/:scope",
  validateRequest({
    params: scopeSchema,
    body: Joi.object({
      accepted: Joi.boolean().strict().required(),
      disclosureKey: Joi.string().hex().length(64).when("accepted", { is: true, then: Joi.required() }),
    }),
  }),
  handle((req) =>
    updateAiSharingConsent(
      req.user!.id,
      req.params.scope as "personal" | "company",
      req.body.accepted,
      req.body.disclosureKey,
    ),
  ),
);
aiAccessRouter.get(
  "/personal/status",
  handle((req) => freeAiStatus(req.user!.id)),
);
aiAccessRouter.get(
  "/personal/history",
  handle((req) => freeAiHistory(req.user!.id)),
);
aiAccessRouter.post(
  "/personal/chat",
  expensiveApiRateLimiter,
  validateRequest({
    body: Joi.object({
      question: Joi.string().trim().min(2).max(1200).required(),
    }),
  }),
  handle((req) => {
    const key = req.header("idempotency-key") || randomUUID();
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key))
      throw new FreeAiError("Khóa yêu cầu AI không hợp lệ.", 400, "AI_REQUEST_INVALID");
    return askFreeAi(req.user!.id, req.body.question, key);
  }),
);
