import type { RequestHandler } from 'express';

type AsyncRequestHandler = (...args: Parameters<RequestHandler>) => Promise<unknown> | unknown;

const asyncHandler = (handler: AsyncRequestHandler): RequestHandler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export { asyncHandler };