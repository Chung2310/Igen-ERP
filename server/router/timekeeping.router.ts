import { Router } from "express";
import Joi from "joi";
import multer from "multer";
import { timekeepingController } from "../controller/timekeeping.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { attendanceFaceGate } from "../middleware/attendance-face-gate";
import { companyWorkCalendarController } from "../controller/company-work-calendar.controller";

export const timekeepingRouter = Router();
const attendanceImage = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});

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
  attendanceImage.single("file"),
  validateRequest(checkInOutSchema),
  attendanceFaceGate as any,
  timekeepingController.checkIn as any
);

// Check-out
timekeepingRouter.post(
  "/check-out",
  requireAuth as any,
  attendanceImage.single("file"),
  validateRequest(checkInOutSchema),
  attendanceFaceGate as any,
  timekeepingController.checkOut as any
);

// Get company location config
timekeepingRouter.get(
  "/company-location",
  requireAuth as any,
  timekeepingController.getCompanyLocation as any
);

// Update company location config (requires timekeeping:manage permission)
timekeepingRouter.patch(
  "/company-location",
  requireAuth as any,
  requirePermission("timekeeping:manage") as any,
  validateRequest(updateLocationSchema),
  timekeepingController.updateCompanyLocation as any
);

// List per-employee work-hours config (requires timekeeping:manage permission)
timekeepingRouter.get(
  "/work-hours",
  requireAuth as any,
  requirePermission("timekeeping:manage") as any,
  timekeepingController.listEmployeeWorkHours as any
);

// Update one employee's work-hours config (requires timekeeping:manage permission)
timekeepingRouter.patch(
  "/work-hours/:uid",
  requireAuth as any,
  requirePermission("timekeeping:manage") as any,
  validateRequest(updateWorkHoursSchema),
  timekeepingController.updateEmployeeWorkHours as any
);


const localDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const calendarDayType = Joi.string().valid("holiday", "substitute_holiday", "working_override");
const calendarYearSchema = { body: Joi.object({ year: Joi.number().integer().min(2000).max(2200).required() }).unknown(false) };
const createCalendarDaySchema = { body: Joi.object({
  date: localDate.required(), name: Joi.string().trim().min(1).max(200).required(),
  dayType: calendarDayType.required(), isApplied: Joi.boolean().optional(),
}).unknown(false) };
const updateCalendarDaySchema = {
  params: Joi.object({ id: Joi.string().hex().length(24).required() }),
  body: Joi.object({
    date: localDate.optional(), name: Joi.string().trim().min(1).max(200).optional(),
    dayType: calendarDayType.optional(), isApplied: Joi.boolean().optional(),
    adminReason: Joi.string().trim().max(500).optional(),
  }).min(1).unknown(false),
};

timekeepingRouter.get("/work-calendar", requireAuth as any, companyWorkCalendarController.list as any);
timekeepingRouter.post("/work-calendar/sync", requireAuth as any, validateRequest(calendarYearSchema), companyWorkCalendarController.sync as any);
timekeepingRouter.post("/work-calendar", requireAuth as any, validateRequest(createCalendarDaySchema), companyWorkCalendarController.create as any);
timekeepingRouter.patch("/work-calendar/:id", requireAuth as any, validateRequest(updateCalendarDaySchema), companyWorkCalendarController.update as any);
timekeepingRouter.get("/work-calendar/:id/audit", requireAuth as any, companyWorkCalendarController.audit as any);
