import type { ErrorRequestHandler, Request } from "express";
import { serializeError } from "../errors/error-response";
import { normalizeError } from "../errors/normalize-error";
import { logger } from "../modules/student-management/config/logger";
import { getRequestContext } from "./request-context";

interface ErrorLogger {
  warn(event: unknown): void;
  error(event: unknown): void;
}

type RequestActor = {
  _id?: unknown;
  id?: unknown;
  uid?: unknown;
  companyCode?: unknown;
  ownerId?: unknown;
  branchId?: unknown;
};

function errorLogEvent(req: Request, error: ReturnType<typeof normalizeError>, requestId: string) {
  const actor = (req as Request & { user?: RequestActor }).user;
  return {
    event: "api_request_failed",
    requestId,
    method: req.method,
    route: req.originalUrl || req.url,
    actorId: String(actor?._id ?? actor?.id ?? actor?.uid ?? "") || undefined,
    tenantId: String(actor?.companyCode ?? actor?.ownerId ?? "") || undefined,
    branchId: String(actor?.branchId ?? "") || undefined,
    status: error.status,
    code: error.code,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    },
  };
}

export function createApiErrorHandler(errorLogger: ErrorLogger): ErrorRequestHandler {
  return (sourceError, req, res, next) => {
    if (res.headersSent) return next(sourceError);

    const error = normalizeError(sourceError);
    const { requestId } = getRequestContext(req);
    const event = errorLogEvent(req, error, requestId);
    if (error.status >= 500) errorLogger.error(event);
    else errorLogger.warn(event);

    return res.status(error.status).json(serializeError(error, requestId));
  };
}

export const apiErrorHandler = createApiErrorHandler(logger);