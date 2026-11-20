import Joi from "joi";

const objectId = Joi.string().hex().length(24).required().messages({
  "any.required": "Mã định danh là bắt buộc.",
  "string.hex": "Mã định danh không hợp lệ.",
  "string.length": "Mã định danh không hợp lệ.",
});

const idParams = Joi.object({ id: objectId }).unknown(false);
const requestIdParams = Joi.object({ requestId: objectId }).unknown(false);

export const createBorrowRequestSchema = {
  params: idParams,
  body: Joi.object({
    reason: Joi.string().trim().min(1).max(1000).required().messages({
      "any.required": "Lý do mượn là bắt buộc.",
      "string.empty": "Lý do mượn không được để trống.",
    }),
    expectedReturnAt: Joi.date()
      .iso()
      .custom((value, helpers) => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        // Cho phép ngày dự kiến trả là ngày hiện tại (mượn và trả trong ngày) hoặc tương lai
        const minAllowed = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        if (value < minAllowed) {
          return helpers.error("date.min");
        }
        return value;
      })
      .optional()
      .messages({
        "date.min": "Ngày dự kiến trả không được ở trong quá khứ.",
      }),
  }).unknown(false),
};

export const createReturnRequestSchema = {
  params: idParams,
  body: Joi.object({ note: Joi.string().trim().max(1000).allow("").optional() }).unknown(false),
};

export const cancelBorrowRequestSchema = { params: requestIdParams };

export const decideBorrowRequestSchema = {
  params: requestIdParams,
  body: Joi.object({
    decision: Joi.string().valid("approved", "rejected").required(),
    rejectionReason: Joi.when("decision", {
      is: "rejected",
      then: Joi.string().trim().min(1).max(1000).required().messages({
        "any.required": "Lý do từ chối là bắt buộc.",
        "string.empty": "Lý do từ chối không được để trống.",
      }),
      otherwise: Joi.forbidden(),
    }),
  }).unknown(false),
};

export const listBorrowRequestsSchema = {
  query: Joi.object({
    status: Joi.string().valid("pending", "approved", "rejected", "cancelled").allow("").optional(),
    requestType: Joi.string().valid("borrow", "return").allow("").optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }).unknown(false),
};

export const borrowHistorySchema = { params: idParams };
