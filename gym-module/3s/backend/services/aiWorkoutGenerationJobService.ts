import AiWorkoutGenerationJob from '../models/AiWorkoutGenerationJob.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { normalizeError } from '../errors/normalizeError.js';
import { logger } from '../config/logger.js';
import CustomerProfile from '../models/CustomerProfile.js';
import { generateWorkoutDraft, type WorkoutGenerationInput } from './aiWorkoutService.js';
import type { AuthenticatedUser } from '../types/express.js';
import { runWithCenter, runWithSystemCenterAccess } from '../tenancy/centerContext.js';
import { runWithClientType } from '../tenancy/clientTypeContext.js';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/;
let workerScheduled = false;
let workerRunning = false;

function isDuplicateKey(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function validateIdempotencyKey(value: string) {
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      message: 'Idempotency-Key của tác vụ AI không hợp lệ.',
    });
  }
  return value;
}

function publicJob(job: any) {
  return {
    id: String(job._id),
    status: job.status,
    ...(job.status === 'SUCCEEDED' ? { result: job.result } : {}),
    ...(job.status === 'FAILED' ? { error: job.error } : {}),
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

async function processNextJob(): Promise<boolean> {
  const job = await runWithSystemCenterAccess(() => AiWorkoutGenerationJob.findOneAndUpdate(
    { status: 'PENDING' },
    {
      $set: { status: 'PROCESSING', startedAt: new Date() },
      $inc: { attempts: 1 },
      $unset: { error: 1 },
    },
    { sort: { createdAt: 1 }, returnDocument: 'after' },
  ).lean());

  if (!job) return false;
  const centerId = String((job as typeof job & { centerId?: unknown }).centerId || '');
  if (!centerId) throw new Error(`AI workout job ${String(job._id)} is missing centerId.`);

  return runWithClientType(job.clientType === 'MOBILE' ? 'MOBILE' : 'WEB', () => runWithCenter(centerId, async () => {
  try {
    const result = await generateWorkoutDraft(
      { id: String(job.ownerPtId), role: 'PT', centerId },
      job.input,
      `ai-workout-job:${job._id}`,
    );
    await AiWorkoutGenerationJob.updateOne(
      { _id: job._id, status: 'PROCESSING' },
      {
        $set: { status: 'SUCCEEDED', result, completedAt: new Date() },
        $unset: { error: 1 },
      },
    );
  } catch (cause) {
    const error = normalizeError(cause);
    logger.error({
      context: 'AI_WORKOUT_JOB',
      jobId: String(job._id),
      code: error.code,
      message: error.message,
      errorName: cause instanceof Error ? cause.name : 'Error',
      err: cause,
    }, 'Tạo giáo án AI nền thất bại');
    await AiWorkoutGenerationJob.updateOne(
      { _id: job._id, status: 'PROCESSING' },
      {
        $set: {
          status: 'FAILED',
          error: { code: error.code, message: error.message },
          completedAt: new Date(),
        },
        $unset: { result: 1 },
      },
    );
  }

  return true;
  }));
}

async function drainJobs() {
  if (workerRunning) return;
  workerRunning = true;
  workerScheduled = false;
  try {
    while (await processNextJob()) {
      // Claim and process one job at a time to avoid overloading the AI provider.
    }
  } catch (error) {
    logger.error({ context: 'AI_WORKOUT_JOB_WORKER', err: error }, 'Worker giáo án AI bị gián đoạn');
  } finally {
    workerRunning = false;
    if (workerScheduled) {
      workerScheduled = false;
      scheduleWorker();
    }
  }
}

function scheduleWorker() {
  if (workerRunning) {
    workerScheduled = true;
    return;
  }
  if (workerScheduled) return;
  workerScheduled = true;
  setImmediate(() => { void drainJobs(); });
}

export async function enqueueWorkoutGeneration(
  user: AuthenticatedUser,
  input: WorkoutGenerationInput,
  rawIdempotencyKey: string,
) {
  const idempotencyKey = validateIdempotencyKey(rawIdempotencyKey);
  const assignedCustomer = await CustomerProfile.exists({ _id: input.customerId, assignedPtId: user.id });
  if (!assignedCustomer) {
    throw new AppError({
      status: 403,
      code: ERROR_CODES.AUTHORIZATION,
      message: 'Bạn không có quyền tạo giáo án cho học viên này.',
    });
  }
  let job = await AiWorkoutGenerationJob.findOne({ ownerPtId: user.id, idempotencyKey });
  if (job) {
    scheduleWorker();
    return publicJob(job);
  }
  try {
    job = await AiWorkoutGenerationJob.create({
      ownerPtId: user.id,
      customerId: input.customerId,
      clientType: user.clientType === 'MOBILE' ? 'MOBILE' : 'WEB',
      idempotencyKey,
      status: 'PENDING',
      input,
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    job = await AiWorkoutGenerationJob.findOne({ ownerPtId: user.id, idempotencyKey }).orFail();
  }
  scheduleWorker();
  return publicJob(job);
}

export async function getWorkoutGeneration(user: AuthenticatedUser, id: string) {
  const job = await AiWorkoutGenerationJob.findOne({ _id: id, ownerPtId: user.id }).lean();
  if (!job) {
    throw new AppError({
      status: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Không tìm thấy tác vụ tạo giáo án AI.',
    });
  }
  return publicJob(job);
}

export async function startAiWorkoutGenerationWorker() {
  await AiWorkoutGenerationJob.createIndexes();
  scheduleWorker();
}
