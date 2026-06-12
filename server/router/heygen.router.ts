import { Router } from "express";
import Joi from "joi";
import { heygenController } from "../controller/heygen.controller";
import { requireAuth } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";

export const heygenRouter = Router();

const createAvatarVideoSchema = {
  body: Joi.object({
    avatarId: Joi.string().required(),
    voiceId: Joi.string().allow("").optional(),
    script: Joi.string().allow("").optional(),
    audioUrl: Joi.string().uri().allow("").optional(),
    audioRecordId: Joi.string().allow("").optional(),
    motionText: Joi.string().allow("").optional(),
    aspectRatio: Joi.string().valid("16:9", "9:16", "1:1").optional(),
    resolution: Joi.string().valid("720p", "1080p", "4k").optional(),
    engineType: Joi.string().valid("avatar_v", "avatar_iv", "avatar_iii").optional(),
    title: Joi.string().allow("").optional(),
    description: Joi.string().allow("").optional(),
  }).custom((value, helpers) => {
    const hasScript = Boolean(String(value.script || "").trim());
    const hasAudio = Boolean(String(value.audioUrl || "").trim()) || Boolean(String(value.audioRecordId || "").trim());

    if (!hasScript && !hasAudio) {
      return helpers.error("any.invalid");
    }

    if (hasScript && hasAudio) {
      return helpers.error("any.invalid");
    }

    return value;
  }, "script/audio validation"),
};

const videoIdParamSchema = {
  params: Joi.object({
    videoId: Joi.string().required(),
  }),
};

const deleteHistorySchema = {
  params: Joi.object({
    id: Joi.string().required(),
  }),
};

heygenRouter.get("/library", requireAuth as any, heygenController.getLibrary);
heygenRouter.post("/webhook", heygenController.receiveWebhook);
heygenRouter.post("/videos", requireAuth as any, validateRequest(createAvatarVideoSchema), heygenController.createAvatarVideo);
heygenRouter.post("/videos/:videoId/status", requireAuth as any, validateRequest(videoIdParamSchema), heygenController.getVideoStatus);
heygenRouter.get("/history", requireAuth as any, heygenController.getVideoHistory);
heygenRouter.delete("/history/:id", requireAuth as any, validateRequest(deleteHistorySchema), heygenController.deleteVideoHistory);
