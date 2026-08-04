import Joi from "joi";

export const webhookPaymentSchema = Joi.object({
  // SePay flat fields
  transferAmount: Joi.number().optional(),
  amountIn: Joi.number().optional(),
  content: Joi.string().allow("", null).optional(),
  transactionContent: Joi.string().allow("", null).optional(),
  accountNumber: Joi.any().optional(), // Có thể là string hoặc number
  transactionDate: Joi.string().allow("", null).optional(),

  // Casso flat fields
  amount: Joi.number().optional(),
  description: Joi.string().allow("", null).optional(),
  subAccount: Joi.any().optional(), // Có thể là string hoặc number
  when: Joi.string().allow("", null).optional(),

  // Other metadata fields
  id: Joi.any().optional(),
  gateway: Joi.string().allow("", null).optional(),
  transferType: Joi.string().allow("", null).optional(),
  accumulatedBalance: Joi.number().optional(),
  code: Joi.string().allow("", null).optional(),
  referenceCode: Joi.string().allow("", null).optional(),
  cusName: Joi.string().allow("", null).optional(),
  bankName: Joi.string().allow("", null).optional(),

  // Casso wrapper format
  error: Joi.number().optional(),
  messages: Joi.string().optional(),
  data: Joi.array().items(Joi.object({
    id: Joi.any().optional(),
    tid: Joi.string().allow("", null).optional(),
    when: Joi.string().allow("", null).optional(),
    amount: Joi.number().required().messages({
      "any.required": "Trường amount là bắt buộc trong data.",
    }),
    description: Joi.string().allow("", null).required().messages({
      "any.required": "Trường description là bắt buộc trong data.",
    }),
    cusName: Joi.string().allow("", null).optional(),
    subAccount: Joi.any().required().messages({
      "any.required": "Trường subAccount là bắt buộc trong data.",
    }),
    bankName: Joi.string().allow("", null).optional(),
  })).optional(),
}).unknown(true); // Cho phép các fields không xác định từ API bên thứ ba
