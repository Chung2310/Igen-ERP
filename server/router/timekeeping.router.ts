import { Router } from "express";
import Joi from "joi";
import multer from "multer";
import { timekeepingController } from "../controller/timekeeping.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { attendanceFaceGate } from "../middleware/attendance-face-gate";
import { companyWorkCalendarController } from "../controller/company-work-calendar.controller";
import { workShiftController } from "../controller/work-shift.controller";

export const timekeepingRouter = Router();
const attendanceImage = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)),
});

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
    lunchBreakStart: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
      "string.pattern.base": "Giờ bắt đầu nghỉ trưa phải đúng định dạng HH:MM (ví dụ: 12:00).",
    }),
    workingDays: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).unique().optional(),
    lunchBreakEnd: Joi.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().messages({
      "string.pattern.base": "Giờ kết thúc nghỉ trưa phải đúng định dạng HH:MM (ví dụ: 13:00).",
    }),
  }),
};

const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const shiftBreakSchema = Joi.object({ name: Joi.string().trim().max(80).required(), startTime: Joi.string().regex(timeRegex).required(), endTime: Joi.string().regex(timeRegex).required(), paid: Joi.boolean() });
const shiftSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).max(30).required(), name: Joi.string().trim().max(100).required(),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/), startTime: Joi.string().regex(timeRegex).required(), endTime: Joi.string().regex(timeRegex).required(),
  crossesMidnight: Joi.boolean(), checkInFrom: Joi.string().regex(timeRegex).allow("", null), checkInUntil: Joi.string().regex(timeRegex).allow("", null),
  checkOutFrom: Joi.string().regex(timeRegex).allow("", null), checkOutUntil: Joi.string().regex(timeRegex).allow("", null), breakPeriods: Joi.array().items(shiftBreakSchema),
  allowedLateMinutes: Joi.number().integer().min(0).max(240), allowedEarlyLeaveMinutes: Joi.number().integer().min(0).max(240),
  standardMinutes: Joi.number().integer().min(1).max(1440), workingDays: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).unique().required(), isDefault: Joi.boolean(), isActive: Joi.boolean(),
});
const updateShiftSchema = { params: Joi.object({ id: Joi.string().hex().length(24).required() }), body: shiftSchema.fork(["code", "name", "startTime", "endTime", "workingDays"], (field) => field.optional()) };
const assignmentSchema = { body: Joi.object({ employeeIds: Joi.array().items(Joi.string().hex().length(24)).min(1).unique().required(), shiftId: Joi.string().hex().length(24).required(), effectiveFrom: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(), effectiveTo: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow("", null), daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).unique() }) };

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
    annualLeaveDays: Joi.number().integer().min(0).optional(),
    employmentStatus: Joi.string().valid("official", "probation", "internship").optional(),
    officialDate: Joi.date().iso().optional(),
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

timekeepingRouter.get("/shifts", requireAuth as any, requirePermission("timekeeping:manage") as any, workShiftController.list as any);
timekeepingRouter.post("/shifts", requireAuth as any, requirePermission("timekeeping:manage") as any, validateRequest({ body: shiftSchema }), workShiftController.create as any);
timekeepingRouter.patch("/shifts/:id", requireAuth as any, requirePermission("timekeeping:manage") as any, validateRequest(updateShiftSchema), workShiftController.update as any);
timekeepingRouter.delete("/shifts/:id", requireAuth as any, requirePermission("timekeeping:manage") as any, workShiftController.remove as any);
timekeepingRouter.get("/shift-assignments", requireAuth as any, requirePermission("timekeeping:manage") as any, workShiftController.listAssignments as any);
timekeepingRouter.post("/shift-assignments", requireAuth as any, requirePermission("timekeeping:manage") as any, validateRequest(assignmentSchema), workShiftController.assign as any);

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
timekeepingRouter.post("/work-calendar/sync", requireAuth as any, requirePermission("timekeeping:manage") as any, validateRequest(calendarYearSchema), companyWorkCalendarController.sync as any);
timekeepingRouter.post("/work-calendar", requireAuth as any, requirePermission("timekeeping:manage") as any, validateRequest(createCalendarDaySchema), companyWorkCalendarController.create as any);
timekeepingRouter.patch("/work-calendar/:id", requireAuth as any, requirePermission("timekeeping:manage") as any, validateRequest(updateCalendarDaySchema), companyWorkCalendarController.update as any);
timekeepingRouter.get("/work-calendar/:id/audit", requireAuth as any, companyWorkCalendarController.audit as any);
