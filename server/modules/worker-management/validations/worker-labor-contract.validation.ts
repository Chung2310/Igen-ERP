import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const objectIdSchema = Joi.string().pattern(objectIdPattern).messages({
  "string.pattern.base": "Định dạng ID không hợp lệ.",
});

export const idParamSchema = Joi.object({
  id: objectIdSchema.required(),
});

const dateSchema = (label: string) =>
  Joi.string().pattern(datePattern).custom((value, helpers) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return helpers.error("date.invalid");
    }
    return value;
  }).messages({
    "string.pattern.base": `${label} phải có định dạng YYYY-MM-DD.`,
    "string.empty": `${label} không được để trống.`,
    "any.required": `${label} là bắt buộc.`,
    "date.invalid": `${label} phải là ngày lịch hợp lệ.`,
  });

export const createWorkerLaborContractSchema = Joi.object({
  workerId: objectIdSchema.required().messages({
    "any.required": "Vui lòng chọn người lao động.",
  }),
  code: Joi.string().trim().required().messages({
    "any.required": "Mã hợp đồng là bắt buộc.",
    "string.empty": "Mã hợp đồng không được để trống.",
  }),
  clientName: Joi.string().trim().required().messages({
    "any.required": "Khách hàng / đơn vị sử dụng lao động là bắt buộc.",
    "string.empty": "Khách hàng / đơn vị sử dụng lao động không được để trống.",
  }),
  startDate: dateSchema("Ngày bắt đầu").required(),
  endDate: dateSchema("Ngày kết thúc").required(),
  status: Joi.string()
    .valid("draft", "active", "terminated")
    .optional()
    .messages({
      "any.only": "Trạng thái khi tạo chỉ nhận: draft, active, terminated.",
    }),
  note: Joi.string().allow("", null).optional(),
});

export const updateWorkerLaborContractSchema = Joi.object({
  code: Joi.string().trim().optional(),
  clientName: Joi.string().trim().optional(),
  startDate: dateSchema("Ngày bắt đầu").optional(),
  endDate: dateSchema("Ngày kết thúc").optional(),
  status: Joi.string().valid("draft", "active", "terminated").optional(),
  note: Joi.string().allow("", null).optional(),
});

export const renewWorkerLaborContractSchema = Joi.object({
  code: Joi.string().trim().required().messages({
    "any.required": "Mã hợp đồng kỳ mới là bắt buộc.",
    "string.empty": "Mã hợp đồng kỳ mới không được để trống.",
  }),
  clientName: Joi.string().trim().optional(),
  startDate: dateSchema("Ngày bắt đầu").required(),
  endDate: dateSchema("Ngày kết thúc").required(),
  note: Joi.string().allow("", null).optional(),
});
  // Form gia h?n gi? workerId ?? t?i s? d?ng bi?u m?u t?o m?i. Service lu?n l?y
  // ng??i lao ??ng t? h?p ??ng ngu?n, n?n tr??ng n?y ch? ???c x?c th?c ??u v?o.
  workerId: objectIdSchema.optional(),
