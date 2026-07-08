import { Router } from "express";
import Joi from "joi";
import { timekeepingController } from "../controller/timekeeping.controller";
import { requireAuth } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";

export const timekeepingRouter = Router();

const checkInOutSchema = {
  body: Joi.object({
    latitude: Joi.number().min(-90).max(90).required().messages({
      "any.required": "Vĩ độ (latitude) là bắt buộc.",
      "number.base": "Vĩ độ phải là một số.",
      "number.min": "Vĩ độ không hợp lệ (phải từ -90 đến 90).",
      "number.max": "Vĩ độ không hợp lệ (phải từ -90 đến 90).",
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
      "any.required": "Kinh độ (longitude) là bắt buộc.",
      "number.base": "Kinh độ phải là một số.",
      "number.min": "Kinh độ không hợp lệ (phải từ -180 đến 180).",
      "number.max": "Kinh độ không hợp lệ (phải từ -180 đến 180).",
    }),
    deviceInfo: Joi.string().optional().allow(""),
  }),
};

const updateLocationSchema = {
  body: Joi.object({
    latitude: Joi.number().min(-90).max(90).required().messages({
      "any.required": "Vĩ độ văn phòng là bắt buộc.",
      "number.base": "Vĩ độ văn phòng phải là số.",
      "number.min": "Vĩ độ không hợp lệ.",
      "number.max": "Vĩ độ không hợp lệ.",
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
      "any.required": "Kinh độ văn phòng là bắt buộc.",
      "number.base": "Kinh độ văn phòng phải là số.",
      "number.min": "Kinh độ không hợp lệ.",
      "number.max": "Kinh độ không hợp lệ.",
    }),
    allowedRadius: Joi.number().min(1).required().messages({
      "any.required": "Bán kính chấm công là bắt buộc.",
      "number.base": "Bán kính phải là số.",
      "number.min": "Bán kính tối thiểu phải từ 1 mét trở lên.",
    }),
    addressName: Joi.string().optional().allow(""),
    checkInLimit: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
      "string.pattern.base": "Giờ vào phải đúng định dạng HH:MM (ví dụ: 08:30).",
    }),
    checkOutLimit: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
      "string.pattern.base": "Giờ ra phải đúng định dạng HH:MM (ví dụ: 17:30).",
    }),
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
