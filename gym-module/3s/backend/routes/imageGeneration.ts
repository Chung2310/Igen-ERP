import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { getEnv } from '../config/env.js';
import * as controller from '../controllers/imageController.js';

const router = express.Router();
const env = getEnv();

// POST /api/images/generate — Sinh ảnh AI (Gemini)
// Rate limited: AI_RATE_LIMIT_PER_MINUTE (default 10) per minute
router.post(
  '/generate',
  createRateLimiter({ limit: env.AI_RATE_LIMIT_PER_MINUTE, windowMs: 60_000 }),
  authenticate,
  authorize('ADMIN', 'PT'),
  controller.generate,
);

export default router;
