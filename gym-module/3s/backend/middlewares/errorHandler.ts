import { normalizeError } from '../errors/normalizeError.js';
import { captureError } from '../services/telemetryService.js';
import { logger } from '../config/logger.js';
import type { ErrorRequestHandler } from 'express';

interface ErrorBody {
  success: false;
  message: string;
  code: string;
  requestId: string;
  errors?: unknown;
}

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  const normalized = normalizeError(error);
  const log = req.log || logger;
  const level = normalized.status >= 500 ? 'error' : 'warn';
  const logData = normalized.isOperational
    ? { context: 'Error Handler', errorName: error.name, code: normalized.code, requestId: req.requestId }
    : { context: 'Error Handler', err: error, code: normalized.code, requestId: req.requestId };
  log[level]?.(logData, 'Xử lý request thất bại');
  captureError(normalized, req);
  const body: ErrorBody = { success: false, message: normalized.message, code: normalized.code, requestId: req.requestId || 'unknown' };
  if (normalized.errors?.length) body.errors = normalized.errors;
  return res.status(normalized.status).json(body);
};

export { errorHandler };
