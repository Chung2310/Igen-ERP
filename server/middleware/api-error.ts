import type { ErrorRequestHandler } from "express";

type ApiErrorLike = Error & {
  code?: number | string;
  isJoi?: boolean;
  status?: number;
  statusCode?: number;
};

export interface ClassifiedApiError {
  statusCode: number;
  message: string;
}

const DUPLICATE_MESSAGE = /đã tồn tại|already exists|duplicate key/i;

export function classifyApiError(error: unknown): ClassifiedApiError {
  const candidate = error as Partial<ApiErrorLike> | null;
  const message = candidate?.message || "Đã xảy ra lỗi hệ thống.";
  const explicitStatus = candidate?.statusCode || candidate?.status;

  if (typeof explicitStatus === "number" && explicitStatus >= 400 && explicitStatus < 600) {
    return { statusCode: explicitStatus, message };
  }
  if (candidate?.isJoi) {
    return { statusCode: 400, message };
  }
  if (candidate?.code === 11000 || candidate?.code === "11000") {
    return { statusCode: 409, message: "Dữ liệu đã tồn tại." };
  }
  if (DUPLICATE_MESSAGE.test(message)) {
    return { statusCode: 409, message };
  }
  return { statusCode: 500, message: "Đã xảy ra lỗi hệ thống." };
}

export const apiErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const classified = classifyApiError(error);
  if (classified.statusCode >= 500) {
    console.error("[apiErrorHandler] " + req.method + " " + req.originalUrl + ":", error);
  }
  return res.status(classified.statusCode).json({
    status: "error",
    success: false,
    message: classified.message,
    error: classified.message,
  });
};
