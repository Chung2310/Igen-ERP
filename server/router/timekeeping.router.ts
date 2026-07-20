import { Router } from "express";
import Joi from "joi";
import { timekeepingController } from "../controller/timekeeping.controller";
import { requireAuth } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";

export const timekeepingRouter = Router();

const checkInOutSchema = {
  body: Joi.object({
    latitude: Joi.number().min(-90).max(90).required().messages({
      "any.required": "VÄ© Ä‘á»™ (latitude) lÃ  báº¯t buá»™c.",
      "number.base": "VÄ© Ä‘á»™ pháº£i lÃ  má»™t sá»‘.",
      "number.min": "VÄ© Ä‘á»™ khÃ´ng há»£p lá»‡ (pháº£i tá»« -90 Ä‘áº¿n 90).",
      "number.max": "VÄ© Ä‘á»™ khÃ´ng há»£p lá»‡ (pháº£i tá»« -90 Ä‘áº¿n 90).",
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
      "any.required": "Kinh Ä‘á»™ (longitude) lÃ  báº¯t buá»™c.",
      "number.base": "Kinh Ä‘á»™ pháº£i lÃ  má»™t sá»‘.",
      "number.min": "Kinh Ä‘á»™ khÃ´ng há»£p lá»‡ (pháº£i tá»« -180 Ä‘áº¿n 180).",
      "number.max": "Kinh Ä‘á»™ khÃ´ng há»£p lá»‡ (pháº£i tá»« -180 Ä‘áº¿n 180).",
    }),
    deviceInfo: Joi.string().optional().allow(""),
  }),
};

const updateLocationSchema = {
  body: Joi.object({
    latitude: Joi.number().min(-90).max(90).required().messages({
      "any.required": "VÄ© Ä‘á»™ vÄƒn phÃ²ng lÃ  báº¯t buá»™c.",
      "number.base": "VÄ© Ä‘á»™ vÄƒn phÃ²ng pháº£i lÃ  sá»‘.",
      "number.min": "VÄ© Ä‘á»™ khÃ´ng há»£p lá»‡.",
      "number.max": "VÄ© Ä‘á»™ khÃ´ng há»£p lá»‡.",
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
      "any.required": "Kinh Ä‘á»™ vÄƒn phÃ²ng lÃ  báº¯t buá»™c.",
      "number.base": "Kinh Ä‘á»™ vÄƒn phÃ²ng pháº£i lÃ  sá»‘.",
      "number.min": "Kinh Ä‘á»™ khÃ´ng há»£p lá»‡.",
      "number.max": "Kinh Ä‘á»™ khÃ´ng há»£p lá»‡.",
    }),
    allowedRadius: Joi.number().min(1).required().messages({
      "any.required": "BÃ¡n kÃ­nh cháº¥m cÃ´ng lÃ  báº¯t buá»™c.",
      "number.base": "BÃ¡n kÃ­nh pháº£i lÃ  sá»‘.",
      "number.min": "BÃ¡n kÃ­nh tá»‘i thiá»ƒu pháº£i tá»« 1 mÃ©t trá»Ÿ lÃªn.",
    }),
    addressName: Joi.string().optional().allow(""),
    checkInLimit: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
      "string.pattern.base": "Giá» vÃ o pháº£i Ä‘Ãºng Ä‘á»‹nh dáº¡ng HH:MM (vÃ­ dá»¥: 08:30).",
    }),
    checkOutLimit: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
      "string.pattern.base": "Giá» ra pháº£i Ä‘Ãºng Ä‘á»‹nh dáº¡ng HH:MM (vÃ­ dá»¥: 17:30).",
    }),
    lunchBreakStart: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
      "string.pattern.base": "Giá» báº¯t Ä‘áº§u nghá»‰ trÆ°a pháº£i Ä‘Ãºng Ä‘á»‹nh dáº¡ng HH:MM (vÃ­ dá»¥: 12:00).",
    }),
    workingDays: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).unique().optional(),
    lunchBreakEnd: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
      "string.pattern.base": "Giá» káº¿t thÃºc nghá»‰ trÆ°a pháº£i Ä‘Ãºng Ä‘á»‹nh dáº¡ng HH:MM (vÃ­ dá»¥: 13:00).",
    }),
  }),
};

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const updateWorkHoursSchema = {
  params: Joi.object({
    uid: Joi.string().hex().length(24).required(),
  }),
  body: Joi.object({
    useCustom: Joi.boolean().required().messages({
      "any.required": "Thiếu trường useCustom.",
    }),
    checkInLimit: Joi.string().regex(timeRegex).when("useCustom", { is: true, then: Joi.required() }).messages({
      "string.pattern.base": "Giờ vào phải đúng định dạng HH:MM (ví dụ: 08:30).",
    }),
    checkOutLimit: Joi.string().regex(timeRegex).when("useCustom", { is: true, then: Joi.required() }).messages({
      "string.pattern.base": "Giờ ra phải đúng định dạng HH:MM (ví dụ: 17:30).",
    }),
    lunchBreakStart: Joi.string().regex(timeRegex).when("useCustom", { is: true, then: Joi.required() }).messages({
      "string.pattern.base": "Giờ bắt đầu nghỉ trưa phải đúng định dạng HH:MM (ví dụ: 12:00).",
    }),
    lunchBreakEnd: Joi.string().regex(timeRegex).when("useCustom", { is: true, then: Joi.required() }).messages({
      "string.pattern.base": "Giờ kết thúc nghỉ trưa phải đúng định dạng HH:MM (ví dụ: 13:00).",
    }),
    workingDays: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).unique().optional(),
  }),
};

// Get today's checkin/checkout log for the current user
timekeepingRouter.get("/today", requireAuth as any, timekeepingController.getTodayStatus as any);

// Check-in
timekeepingRouter.post(
  "/check-in",
  requireAuth as any,
  validateRequest(checkInOutSchema),
  timekeepingController.checkIn as any
);

// Check-out
timekeepingRouter.post(
  "/check-out",
  requireAuth as any,
  validateRequest(checkInOutSchema),
  timekeepingController.checkOut as any
);

// Get company location config
timekeepingRouter.get(
  "/company-location",
  requireAuth as any,
  timekeepingController.getCompanyLocation as any
);

// Update company location config (restricted to superadmin, admin inside controller)
timekeepingRouter.patch(
  "/company-location",
  requireAuth as any,
  validateRequest(updateLocationSchema),
  timekeepingController.updateCompanyLocation as any
);

// List per-employee work-hours config (admin/superadmin, checked in controller)
timekeepingRouter.get(
  "/work-hours",
  requireAuth as any,
  timekeepingController.listEmployeeWorkHours as any
);

// Update one employee's work-hours config (admin/superadmin, checked in controller)
timekeepingRouter.patch(
  "/work-hours/:uid",
  requireAuth as any,
  validateRequest(updateWorkHoursSchema),
  timekeepingController.updateEmployeeWorkHours as any
);
