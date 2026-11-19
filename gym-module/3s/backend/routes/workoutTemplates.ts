import express from 'express';
import mongoose from 'mongoose';
import WorkoutTemplate from '../models/WorkoutTemplate.js';
import Exercise from '../models/Exercise.js';
import { withTransaction } from '../services/transactionService.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import { validate } from '../middlewares/validate.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { createWorkoutTemplateSchema, listWorkoutTemplatesSchema, updateWorkoutTemplateSchema, workoutTemplateIdSchema } from '../validators/workoutValidator.js';
import { mergedStudioScheduleError } from '../validators/workoutPlanFields.js';

const router = express.Router();
router.use(authenticate, authorize('PT'));
const missing = () => new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy giáo án mẫu.' });

function sessionsFromSchedule(items: Array<Record<string, unknown>>) {
  const days = new Map<number, Array<Record<string, unknown>>>();
  for (const item of [...items].sort((a, b) => Number(a.dayNumber) - Number(b.dayNumber) || Number(a.startMinute) - Number(b.startMinute))) {
    const day = Number(item.dayNumber);
    const exercise = { ...item };
    delete exercise.dayNumber;
    delete exercise.startMinute;
    delete exercise.durationMinutes;
    days.set(day, [...(days.get(day) || []), exercise]);
  }
  return [...days.entries()].map(([day, exercises]) => ({ name: `Ngày ${day}`, exercises }));
}

async function materializeGeneratedExercises(payload: Record<string, any>, ownerPtId: string, dbSession?: mongoose.ClientSession) {
  const ids = new Map<string, unknown>();
  for (const generated of payload.generatedExercises || []) {
    const name = String(generated.name).trim();
    const key = name.toLocaleLowerCase('vi');
    let exercise = await Exercise.findOne({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }).session(dbSession || null);
    if (!exercise) [exercise] = await Exercise.create([{ ...generated, name, scope: 'GLOBAL', ownerPtId }], dbSession ? { session: dbSession } : undefined);
    ids.set(key, exercise._id);
  }
  for (const field of ['scheduledExercises', 'unscheduledExercises']) payload[field] = (payload[field] || []).map((item: Record<string, unknown>) => ({ ...item, exerciseId: item.exerciseId || ids.get(String(item.name || '').trim().toLocaleLowerCase('vi')) }));
  delete payload.generatedExercises;
}

router.get('/', validate(listWorkoutTemplatesSchema), asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1); const limit = Number(req.query.limit || 20);
  const filter: Record<string, unknown> = { ownerPtId: req.user!.id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.goal) filter.goal = req.query.goal;
  if (req.query.level) filter.level = req.query.level;
  const [items, total] = await Promise.all([WorkoutTemplate.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), WorkoutTemplate.countDocuments(filter)]);
  return success(res, { message: 'Lấy danh sách giáo án mẫu thành công.', data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}));
router.post('/', validate(createWorkoutTemplateSchema), asyncHandler(async (req, res) => {
  const created = await withTransaction(async (dbSession) => {
    await materializeGeneratedExercises(req.body, req.user!.id, dbSession);
    const sessions = req.body.scheduledExercises?.length ? sessionsFromSchedule(req.body.scheduledExercises) : req.body.sessions;
    const [template] = await WorkoutTemplate.create([{ ...req.body, sessions, ownerPtId: req.user!.id }], { session: dbSession });
    return template;
  });
  return success(res, { status: 201, message: 'Tạo giáo án mẫu thành công.', data: created });
}));
router.get('/:id', validate(workoutTemplateIdSchema), asyncHandler(async (req, res) => { const item = await WorkoutTemplate.findOne({ _id: req.params.id, ownerPtId: req.user!.id }); if (!item) throw missing(); return success(res, { message: 'Lấy giáo án mẫu thành công.', data: item }); }));
router.patch('/:id', validate(updateWorkoutTemplateSchema), asyncHandler(async (req, res) => {
  const item = await WorkoutTemplate.findOne({ _id: req.params.id, ownerPtId: req.user!.id });
  if (!item) throw missing();
  const scheduleError = mergedStudioScheduleError({
    durationDays: item.durationDays,
    scheduledExercises: item.scheduledExercises,
  }, req.body);
  if (scheduleError) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: scheduleError });
  for (const [key, value] of Object.entries(req.body)) item.set(key, value);
  if (Object.prototype.hasOwnProperty.call(req.body, 'scheduledExercises')) item.set('sessions', sessionsFromSchedule(req.body.scheduledExercises));
  item.version += 1;
  return success(res, { message: 'Cập nhật giáo án mẫu thành công.', data: await item.save() });
}));
router.patch('/:id/archive', validate(workoutTemplateIdSchema), asyncHandler(async (req, res) => { const item = await WorkoutTemplate.findOneAndUpdate({ _id: req.params.id, ownerPtId: req.user!.id }, { status: 'ARCHIVED' }, { returnDocument: 'after' }); if (!item) throw missing(); return success(res, { message: 'Lưu trữ giáo án mẫu thành công.', data: item }); }));
router.delete('/:id', validate(workoutTemplateIdSchema), asyncHandler(async (req, res) => { const item = await WorkoutTemplate.findOneAndDelete({ _id: req.params.id, ownerPtId: req.user!.id, status: 'ARCHIVED' }); if (!item) throw missing(); return success(res, { message: 'Xóa giáo án mẫu thành công.', data: null }); }));
export default router;
