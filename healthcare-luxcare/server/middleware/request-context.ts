import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, RequestHandler } from "express";

export interface RequestContext {
  requestId: string;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const contextByRequest = new WeakMap<Request, RequestContext>();
const activeRequest = new AsyncLocalStorage<Request>();

/** Authentication runs after context starts, so read the actor at log time. */
export function getRequestLogFields(req: Request) {
  const actor = (req as Request & { user?: Record<string, unknown> }).user;
  const id = (value: unknown) => (value == null ? undefined : String(value));
  return {
    requestId: getRequestContext(req).requestId,
    actorId: id(actor?._id ?? actor?.id ?? actor?.uid),
    companyCode: id(actor?.companyCode),
    tenantId: id(actor?.companyCode ?? actor?.ownerId),
    branchId: id(actor?.branchId),
  };
}

export function getActiveRequestLogFields() {
  const req = activeRequest.getStore();
  return req ? getRequestLogFields(req) : {};
}

function acceptedRequestId(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : undefined;
}

export const requestContextMiddleware: RequestHandler = (req, res, next) => {
  const requestId = acceptedRequestId(req.get("x-request-id")) ?? randomUUID();
  contextByRequest.set(req, { requestId });
  res.setHeader("X-Request-Id", requestId);
  activeRequest.run(req, next);
};

export function getRequestContext(req: Request): RequestContext {
  const existing = contextByRequest.get(req);
  if (existing) return existing;
  const context = { requestId: randomUUID() };
  contextByRequest.set(req, context);
  return context;
}
