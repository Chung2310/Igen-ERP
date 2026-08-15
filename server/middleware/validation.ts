import { Request, Response, NextFunction } from "express";
import { Schema } from "joi";

interface ValidationSchema {
  body?: Schema;
  query?: Schema;
  params?: Schema;
}

/**
 * Dịch thông báo lỗi Joi sang Tiếng Việt
 */
function translateJoiError(message: string, label: string, type: string): string {
  const cleanLabel = label.replace(/['"]/g, "");
  let msg = message.replace(/['"]/g, '"');
  
  // Replace the label part
  msg = msg.replace(new RegExp(`^"${cleanLabel}" `, 'i'), `Trường "${cleanLabel}" `);

  // Common patterns translation
  msg = msg
    .replace(/\bis required\b/gi, "là bắt buộc")
    .replace(/\bmust be a valid email\b/gi, "phải là email hợp lệ")
    .replace(/\bmust be a valid uri\b/gi, "phải là đường dẫn (URI) hợp lệ")
    .replace(/\bmust be a number\b/gi, "phải là kiểu số")
    .replace(/\bmust be an integer\b/gi, "phải là số nguyên")
    .replace(/\bmust be a string\b/gi, "phải là kiểu chữ")
    .replace(/\bmust be a boolean\b/gi, "phải là kiểu đúng/sai (boolean)")
    .replace(/\bmust be one of\b/gi, "phải thuộc một trong các giá trị")
    .replace(/\blength must be at least (\d+) characters long\b/gi, "phải có ít nhất $1 ký tự")
    .replace(/\blength must be less than or equal to (\d+) characters long\b/gi, "không được vượt quá $1 ký tự")
    .replace(/\bmust be greater than or equal to (\d+)\b/gi, "phải lớn hơn hoặc bằng $1")
    .replace(/\bmust be less than or equal to (\d+)\b/gi, "phải nhỏ hơn hoặc bằng $1")
    .replace(/\bcontains an invalid value\b/gi, "chứa giá trị không hợp lệ")
    .replace(/\bis not allowed to be empty\b/gi, "không được để trống");

  switch (type) {
    case "any.required":
      return `Trường "${cleanLabel}" là bắt buộc và không thể thiếu.`;
    case "string.empty":
      return `Trường "${cleanLabel}" không được để trống.`;
    case "string.base":
      return `Trường "${cleanLabel}" phải là kiểu văn bản (string).`;
    case "array.base":
      return `Trường "${cleanLabel}" phải là một danh sách (array).`;
    case "number.base":
      return `Trường "${cleanLabel}" phải là kiểu số (number).`;
    case "number.integer":
      return `Trường "${cleanLabel}" phải là một số nguyên.`;
    case "object.base":
      return `Trường "${cleanLabel}" phải là một đối tượng (object).`;
    default:
      return msg;
  }
}

/**
 * Middleware xác thực dữ liệu đầu vào sử dụng Joi
 */
export function validateRequest(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errorDetails: Record<string, string[]> = {};

    for (const key of ["body", "query", "params"] as const) {
      const partSchema = schema[key];
      if (partSchema) {
        const { error, value } = partSchema.validate(req[key], {
          abortEarly: false,
          allowUnknown: true,
          stripUnknown: false,
        });

        if (error) {
          errorDetails[key] = error.details.map((detail) =>
            translateJoiError(detail.message, detail.context?.label || detail.path.join("."), detail.type)
          );
        } else {
          req[key] = value;
        }
      }
    }

    if (Object.keys(errorDetails).length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Dữ liệu yêu cầu không hợp lệ",
        errors: errorDetails,
      });
    }

    return next();
  };
}
