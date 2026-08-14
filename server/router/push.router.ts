import { Router } from "express";
import Joi from "joi";
import { pushController } from "../controller/push.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";

export const pushRouter = Router();

const subscribeSchema = {
  body: Joi.object({
    subscription: Joi.object({
      endpoint: Joi.string().uri().required().messages({
        "any.required": "Thiếu endpoint của subscription.",
        "string.uri": "Endpoint subscription không hợp lệ.",
      }),
      expirationTime: Joi.any().optional(),
      keys: Joi.object({
        p256dh: Joi.string().required(),
        auth: Joi.string().required(),
      })
        .required()
        .unknown(true),
    })
      .required()
      .unknown(true),
    userAgent: Joi.string().optional().allow(""),
  }),
};

const unsubscribeSchema = {
  body: Joi.object({
    endpoint: Joi.string().uri().required().messages({
      "any.required": "Thiếu endpoint cần hủy đăng ký.",
      "string.uri": "Endpoint không hợp lệ.",
    }),
  }),
};

// Lấy VAPID public key để frontend đăng ký push
pushRouter.get("/public-key", requireAuth as any, pushController.getPublicKey as any);

// Đăng ký nhận thông báo đẩy cho thiết bị hiện tại
pushRouter.post(
  "/subscribe",
  requireAuth as any,
  requirePermission("people:manage") as any,
  validateRequest(subscribeSchema),
  pushController.subscribe as any
);

// Hủy đăng ký thông báo đẩy
pushRouter.post(
  "/unsubscribe",
  requireAuth as any,
  requirePermission("people:manage") as any,
  validateRequest(unsubscribeSchema),
  pushController.unsubscribe as any
);
