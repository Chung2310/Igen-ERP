import { randomUUID } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

export interface RequestContext {
  requestId: string;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const contextByRequest = new WeakMap<Request, RequestContext>();

function acceptedRequestId(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : undefined;
}

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const requestId = acceptedRequestId(req.get("x-request-id")) ?? randomUUID();
  contextByRequest.set(req, { requestId });
  res.setHeader("X-Request-Id", requestId);
  next();
};

export function getRequestContext(req: Request): RequestContext {
  const existing = contextByRequest.get(req);
  if (existing) return existing;
  const context = { requestId: randomUUID() };
  contextByRequest.set(req, context);
  return context;
}