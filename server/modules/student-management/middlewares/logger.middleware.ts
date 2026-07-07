import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";

function maskSensitiveData(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  
  const sensitiveKeys = ["password", "token", "accesstoken", "refreshtoken", "secret"];
  
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }
  
  const masked = { ...(data as Record<string, unknown>) };
  
  for (const key of Object.keys(masked)) {
    const val = masked[key];
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      masked[key] = "[MASKED]";
    } else if (typeof val === "object" && val !== null) {
      masked[key] = maskSensitiveData(val);
    }
  }
  return masked;
}

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;
  const userAgent = req.get("user-agent") || "unknown";

  logger.http(`[HTTP] START ${method} ${originalUrl} - IP: ${ip} - UA: ${userAgent}`);

  if (method !== "GET" && req.body && Object.keys(req.body).length > 0) {
    try {
      const maskedBody = maskSensitiveData(req.body);
      logger.debug(`[HTTP] Request Body: ${JSON.stringify(maskedBody)}`);
    } catch (err) {
      logger.error("Error masking request body: %o", err);
    }
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const contentLength = res.get("content-length") || "0";
    
    const logMsg = `[HTTP] END ${method} ${originalUrl} - ${statusCode} - ${contentLength} bytes - ${duration}ms`;
    if (statusCode >= 500) {
      logger.error(logMsg);
    } else if (statusCode >= 400) {
      logger.warn(logMsg);
    } else {
      logger.http(logMsg);
    }
  });

  next();
}
