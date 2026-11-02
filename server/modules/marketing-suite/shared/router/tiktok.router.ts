/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import Joi from "joi";
import { tiktokController } from "../controller/tiktok.controller.ts";
import { validateRequest } from "../../../../middleware/validation";
import { requireAuth, requirePermission } from "../middleware/auth";

export const tiktokRouter = Router();

tiktokRouter.get("/webhook", (req, res) => {
  const challenge = req.query?.challenge || req.query?.["hub.challenge"];
  if (challenge) return res.status(200).send(challenge);
  return res.status(200).json({ status: "ok", message: "TikTok webhook endpoint reachable" });
});
tiktokRouter.post("/webhook", tiktokController.receiveWebhook as any);
tiktokRouter.get("/oauth/callback", tiktokController.oauthCallback as any);

const validateTokenSchema = {
  body: Joi.object({
    username: Joi.string().optional().allow(""),
    accessToken: Joi.string().required(),
  }),
};

const creatorInfoSchema = {
  body: Joi.object({
    integrationId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(""),
  }),
};

tiktokRouter.get(
  "/oauth/start",
  requireAuth as any,
  requirePermission("social-integration:manage") as any,
  tiktokController.startOAuth as any
);

tiktokRouter.post(
  "/validate-token",
  requireAuth as any,
  requirePermission("social-integration:manage") as any,
  validateRequest(validateTokenSchema),
  tiktokController.validateToken as any
);

tiktokRouter.post(
  "/creator-info",
  requireAuth as any,
  requirePermission("marketing:post") as any,
  validateRequest(creatorInfoSchema),
  tiktokController.getCreatorInfo as any
);
