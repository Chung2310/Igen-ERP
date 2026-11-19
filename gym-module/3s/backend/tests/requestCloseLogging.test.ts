import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { expect, it, vi } from 'vitest';
const { logger } = vi.hoisted(() => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../config/logger.js', () => ({ logger }));
import { requestContext } from '../middlewares/requestContext.js';
it('logs an unfinished close as aborted instead of HTTP 200', () => {
  const req = { headers: {}, method: 'POST', originalUrl: '/api/content-drafts/nutrition' } as Request;
  const res = Object.assign(new EventEmitter(), { statusCode: 200, writableFinished: false, setHeader: vi.fn(), getHeader: vi.fn() });
  requestContext(req, res as unknown as Response, vi.fn());
  res.emit('close');
  expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 499, aborted: true, responseCompleted: false }), expect.any(String));
});
it('logs completed responses once, preserving the real status', () => {
  logger.info.mockClear();
  const req = { headers: {}, method: 'POST', originalUrl: '/test' } as Request;
  const res = Object.assign(new EventEmitter(), { statusCode: 201, writableFinished: true, setHeader: vi.fn(), getHeader: vi.fn() });
  requestContext(req, res as unknown as Response, vi.fn());
  res.emit('finish'); res.emit('close');
  expect(logger.info).toHaveBeenCalledTimes(1);
  expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 201, aborted: false }), expect.any(String));
});