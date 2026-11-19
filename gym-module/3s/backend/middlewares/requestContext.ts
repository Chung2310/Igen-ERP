import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { sanitizeLogValue } from '../config/logFormatter.js';

interface RequestState { startedAt: bigint; responseBody?: unknown; logged: boolean }

const states = new WeakMap<Request, RequestState>();
const isSafeRequestId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._-]{8,100}$/.test(value);


function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = isSafeRequestId(req.headers['x-request-id']) ? req.headers['x-request-id'] : randomUUID();
  req.requestId = requestId;
  req.log = logger;
  res.setHeader('x-request-id', requestId);
  const state: RequestState = { startedAt: process.hrtime.bigint(), logged: false };
  states.set(req, state);
  const logResponse = () => {
    if (state.logged) return;
    state.logged = true;
    const aborted = !res.writableFinished;
    const statusCode = aborted ? 499 : res.statusCode;
    const durationMs = Math.round((Number(process.hrtime.bigint() - state.startedAt) / 1_000_000) * 100) / 100;
    const metadata = {
      context: 'RESPONSE', method: req.method, url: req.originalUrl, statusCode,
      durationMs, aborted, responseCompleted: !aborted,
      requestId, userId: req.user?.id, role: req.user?.role,
      contentLength: res.getHeader('content-length'), responseBody: sanitizeLogValue(state.responseBody),
    };
    const method = statusCode >= 500 ? logger.error : statusCode >= 400 ? logger.warn : logger.info;
    method(metadata, `${req.method} ${req.originalUrl} - ${statusCode} - Duration: ${durationMs} ms - Request ID: ${requestId}`);
  };
  res.once('finish', logResponse);
  res.once('close', logResponse);
  next();
}

function requestLogging(req: Request, res: Response, next: NextFunction) {
  const state = states.get(req);
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (state) state.responseBody = body;
    return originalJson(body);
  }) as Response['json'];
  logger.info({
    context: 'REQUEST', method: req.method, url: req.originalUrl, ip: req.ip,
    requestId: req.requestId, userId: req.user?.id, role: req.user?.role,
    query: sanitizeLogValue(req.query), params: sanitizeLogValue(req.params), body: sanitizeLogValue(req.body),
    userAgent: req.get('user-agent'), contentType: req.get('content-type'),
  }, `${req.method} ${req.originalUrl} - IP: ${req.ip} - Request ID: ${req.requestId}`);
  next();
}

export { isSafeRequestId, requestContext, requestLogging };
