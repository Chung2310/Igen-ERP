import Joi from "joi";
import { objectIdSchema } from "./worker-project.validation";
import { calendarDateSchema } from "./calendar-date.validation";


export const markAttendanceSchema = Joi.object({
  projectId: objectIdSchema.required().messages({
    "any.required": "Mã dự án là bắt buộc.",
    "string.empty": "Mã dự án không được để trống.",
  }),
  workerId: objectIdSchema.required().messages({
    "any.required": "Mã nhân công là bắt buộc.",
    "string.empty": "Mã nhân công không được để trống.",
  }),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  deviceInfo: Joi.string().allow("", null).optional(),
});

export const listAttendanceQuerySchema = Joi.object({
  projectId: objectIdSchema.required().messages({
    "any.required": "Mã dự án là bắt buộc.",
    "string.empty": "Mã dự án không được để trống.",
  }),
  from: calendarDateSchema("ngày bắt đầu").optional(),
  to: calendarDateSchema("ngày kết thúc").optional(),
  date: calendarDateSchema("ngày").optional(),
})
  .with("from", "to")
  .with("to", "from")
  .without("date", ["from", "to"]);

export const adjustAttendanceSchema = Joi.object({
  projectId: objectIdSchema.required().messages({ "any.required": "Mã dự án là bắt buộc." }),
  checkInAt: Joi.string().isoDate().allow(null).optional().messages({
    "string.isoDate": "Giờ vào phải là chuỗi định dạng ISO date hợp lệ.",
  }),
  checkOutAt: Joi.string().isoDate().allow(null).optional().messages({
    "string.isoDate": "Giờ về phải là chuỗi định dạng ISO date hợp lệ.",
  }),
  note: Joi.string().allow("", null).optional(),
});
