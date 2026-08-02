import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

interface JoiDetail {
  message: string;
}

interface JoiError extends Error {
  isJoi?: boolean;
  details?: JoiDetail[];
  status?: number;
}

export function errorMiddleware(
  err: JoiError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  logger.error("Global Error Handler: %s", err.stack || err.message || err);

  if (err.isJoi) {
    // Return Joi validation errors in Vietnamese
    const message = (err.details || [])
      .map((detail) => detail.message)
      .join(", ");
    return res.status(400).json({ success: false, error: message });
  }

  // Handle Mongo ID casting error
  if (
    err.name === "CastError" &&
    (err as unknown as Record<string, unknown>).kind === "ObjectId"
  ) {
    return res
      .status(400)
      .json({ success: false, error: "Định dạng ID không hợp lệ." });
  }

  const status = err.status || 500;
  const message = err.message || "Đã xảy ra lỗi hệ thống.";

  res.status(status).json({ success: false, error: message });
}
