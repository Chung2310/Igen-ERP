import express from 'express';
import mongoose from 'mongoose';
import { success } from './middlewares/response.js';
import { errorHandler } from './middlewares/errorHandler.js';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { registerFrontend } from './services/frontendService.js';
import { requestContext, requestLogging } from './middlewares/requestContext.js';
import { AppError } from './errors/AppError.js';
import { ERROR_CODES } from './errors/errorCodes.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import customersRouter from './routes/customers.js';
import transfersRouter from './routes/transfers.js';
import inbodyRouter from './routes/inbody.js';
import goalsRouter from './routes/goals.js';
import workoutPlansRouter from './routes/workoutPlans.js';
import nutritionPlansRouter from './routes/nutritionPlans.js';
import meRouter from './routes/me.js';
import nutritionRouter from './routes/nutrition.js';
import gymInvitationsRouter from './routes/gymInvitations.js';
import uploadRouter from './routes/upload.js';
import featuresRouter from './routes/features.js';
import inbodyOcrRouter from './routes/inbodyOcr.js';
import roadmapsRouter from './routes/roadmaps.js';
import exercisesRouter from './routes/exercises.js';
import workoutProgressRouter from './routes/workoutProgress.js';
import workoutSessionDraftsRouter from './routes/workoutSessionDrafts.js';
import careDashboardRouter from './routes/careDashboard.js';
import knowledgeAssistantRouter from './routes/knowledgeAssistant.js';
import operationsRouter from './routes/operations.js';
import nutritionMetricsRouter from './routes/nutritionMetrics.js';
import contentDraftsRouter from './routes/contentDrafts.js';
import customerJourneyRouter from './routes/customerJourney.js';
import packageTemplatesRouter from './routes/packageTemplates.js';
import workoutTemplatesRouter from './routes/workoutTemplates.js';
import imageGenerationRouter from './routes/imageGeneration.js';
import aiWorkoutRouter from './routes/aiWorkout.js';
import creditsRouter from './routes/credits.js';
import adminCreditsRouter from './routes/adminCredits.js';
import foodImagesRouter from './routes/foodImages.js';
import knowledgeRouter from './routes/knowledge.js';
import fs from 'node:fs';
import { configureSecurity } from './middlewares/security.js';
import { createRateLimiter } from './middlewares/rateLimit.js';
import { getEnv } from './config/env.js';
import { requireAiConsent } from './middlewares/aiConsent.js';
const app = express();

app.use(requestContext);
const env = getEnv();
configureSecurity(app, { corsOrigins: env.CORS_ORIGINS, trustProxy: env.TRUST_PROXY, jsonBodyLimit: env.JSON_BODY_LIMIT });
app.use(requestLogging);

// Phục vụ tĩnh thư mục kho ảnh món ăn vật lý
const foodImagesDir = path.resolve(process.cwd(), 'uploads/food-images');
if (!fs.existsSync(foodImagesDir)) {
  fs.mkdirSync(foodImagesDir, { recursive: true });
}
app.use('/uploads/food-images', express.static(foodImagesDir));

app.use('/api', createRateLimiter({ limit: 1_000, windowMs: 60_000 }));
app.use('/api', requireAiConsent);

app.get('/api/health', (req, res) => success(res, {
  message: 'Hệ thống hoạt động bình thường.',
  data: { status: 'ok' },
}));
app.get('/api/health/live', (req, res) => success(res, { message: 'Tiến trình đang hoạt động.', data: { status: 'live' } }));
app.get('/api/health/ready', (req, res, next) => {
  if (mongoose.connection.readyState === 1) return success(res, { message: 'Hệ thống sẵn sàng phục vụ.', data: { status: 'ready' } });
  return next(new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Hệ thống chưa sẵn sàng phục vụ.' }));
});

app.use('/api/auth', createRateLimiter({ limit: env.AUTH_RATE_LIMIT_PER_15M, windowMs: 15 * 60_000 }), authRouter);
app.use('/api', customerJourneyRouter);
app.use('/api/users', usersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/transfers', transfersRouter);
app.use('/api/inbody', inbodyRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/workout-plans', workoutPlansRouter);
app.use('/api/workoutPlans', workoutPlansRouter);
app.use('/api/nutrition-plans', nutritionPlansRouter);
app.use('/api/nutritionPlans', nutritionPlansRouter);
app.use('/api/me', meRouter);
app.use('/api/nutrition', nutritionRouter);
app.use('/api/gym-invitations', gymInvitationsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/features', featuresRouter);
app.use('/api/inbody/ocr', inbodyOcrRouter);
app.use('/api/roadmaps', roadmapsRouter);
app.use('/api/exercises', exercisesRouter);
app.use('/api/package-templates', packageTemplatesRouter);
app.use('/api/workout-templates', workoutTemplatesRouter);
app.use('/api/ai', aiWorkoutRouter);
app.use('/api/credits', creditsRouter);
app.use('/api/admin', adminCreditsRouter);
app.use('/api', workoutProgressRouter);
app.use('/api/workout-session-drafts', workoutSessionDraftsRouter);
app.use('/api', careDashboardRouter);
app.use('/api', knowledgeAssistantRouter);
app.use('/api', operationsRouter);
app.use('/api/images', imageGenerationRouter);
app.use('/api', foodImagesRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api', nutritionMetricsRouter);
app.use('/api/content-drafts', contentDraftsRouter);

app.use('/api', (req, res, next) => next(new AppError({ status: 404, code: ERROR_CODES.ROUTE_NOT_FOUND, message: 'Không tìm thấy đường dẫn API.' })));

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = process.env.NODE_ENV === 'production' ? path.resolve(currentDirectory, '..') : path.resolve(currentDirectory, '../frontend');
app.frontendReady = process.env.NODE_ENV === 'test' || process.env.GYM_EMBEDDED === '1' ? Promise.resolve(false) : registerFrontend(app, frontendPath);
app.use(errorHandler);

export default app;
