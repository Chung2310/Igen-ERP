import { Types, type ClientSession } from 'mongoose';
import WorkoutTemplate from '../models/WorkoutTemplate.js';
import WorkoutPlan from '../models/WorkoutPlan.js';
import WorkoutSession from '../models/WorkoutSession.js';
import BodyMeasurement from '../models/BodyMeasurement.js';
import ProgressPhoto, { type PhotoAngle } from '../models/ProgressPhoto.js';
import CustomerProfile from '../models/CustomerProfile.js';
import PtPackage from '../models/PtPackage.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AuthenticatedUser } from '../types/express.js';
import { withTransaction } from './transactionService.js';
import { assertCompatibleResult, normalizePlanExercise, resolvePlanExercisesTracking } from './exerciseTrackingService.js';
import { mergedStudioScheduleError } from '../validators/workoutPlanFields.js';

interface TemplatePayload { title: string; goal: string; level: string; durationDays?: number; muscleGroups?: string[]; defaultSets?: number; defaultReps?: string; defaultWeight?: string; defaultTempo?: string; technicalNotes?: string; scheduledExercises?: Array<Record<string, unknown>>; unscheduledExercises?: Array<Record<string, unknown>>; sessions?: Array<Record<string, unknown>> }
interface SessionPayload {
  customerId: string; workoutPlanId: string; workoutPlanVersion: number; sessionIndex: number; performedAt: string; attendance: 'PRESENT' | 'ABSENT' | 'LATE';
  idempotencyKey: string; exerciseResults?: Array<{ exerciseId?: string; exerciseIndex: number; result: Record<string, unknown>; notes?: string }>; absenceReason?: string; feeling?: string; notes?: string;
  bodyMeasurement?: Omit<MeasurementPayload, 'customerId' | 'measuredAt'>;
  progressPhotos?: Array<{ photoUrl: string; angle: PhotoAngle }>;
  customerSignature?: { signatureUrl: string; signedAt?: string | Date; signerName?: string };
}
interface MeasurementPayload { customerId: string; measuredAt: string; weight?: number; bodyFatPercentage?: number; muscleMass?: number; measurements?: Record<string, number> }

const circumferenceKeys = ['chest', 'waist', 'hips', 'arm', 'thigh', 'calf'] as const;
function normalizeMeasurementPayload<T extends Partial<MeasurementPayload>>(payload: T, current: Record<string, number | undefined> = {}) {
  const measurements = { ...current, ...payload.measurements };
  const raw = payload as T & Record<string, unknown>;
  for (const key of circumferenceKeys) if (typeof raw[key] === 'number') measurements[key] = raw[key] as number;
  const normalized = { ...payload, measurements } as T & { measurements: Record<string, number> };
  for (const key of circumferenceKeys) delete (normalized as Record<string, unknown>)[key];
  delete (normalized as Record<string, unknown>).notes;
  return normalized;
}

const fail = (message: string, status: number) => new AppError({ message, status, code: status === 403 ? ERROR_CODES.AUTHORIZATION : ERROR_CODES.NOT_FOUND });
async function customerFor(user: AuthenticatedUser, id: string, session?: ClientSession) {
  const customer = await CustomerProfile.findById(id).session(session || null);
  if (!customer) throw fail('Không tìm thấy khách hàng.', 404);
  if (user.role === 'PT' && String(customer.assignedPtId) !== user.id) throw fail('Bạn không có quyền quản lý khách hàng này.', 403);
  return customer;
}
async function createTemplate(user: AuthenticatedUser, payload: TemplatePayload) {
  const sessions = payload.scheduledExercises?.length ? sessionsFromSchedule(payload.scheduledExercises) : payload.sessions;
  return WorkoutTemplate.create({ ...payload, sessions, ownerPtId: user.id, version: 1, status: 'ACTIVE' });
}
function sessionsFromSchedule(items: Array<Record<string, unknown>>) {
  const days = new Map<number, Array<Record<string, unknown>>>();
  for (const item of [...items].sort((a, b) => Number(a.dayNumber) - Number(b.dayNumber) || Number(a.startMinute) - Number(b.startMinute))) { const day = Number(item.dayNumber); const exercise = { ...item }; delete exercise.dayNumber; delete exercise.startMinute; delete exercise.durationMinutes; days.set(day, [...(days.get(day) || []), exercise]); }
  return [...days.entries()].map(([day, exercises]) => ({ name: `Ngày ${day}`, exercises }));
}
async function listTemplates(user: AuthenticatedUser, query: Record<string, unknown>) {
  const page = Number(query.page || 1); const limit = Number(query.limit || 20);
  const filter: Record<string, unknown> = user.role === 'PT' ? { ownerPtId: new Types.ObjectId(user.id) } : {};
  if (query.status === 'ACTIVE' || query.status === 'ARCHIVED') filter.status = query.status;
  if (typeof query.goal === 'string') filter.goal = query.goal;
  if (typeof query.level === 'string') filter.level = query.level;
  const [items, total] = await Promise.all([
    WorkoutTemplate.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    WorkoutTemplate.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
async function updateTemplate(user: AuthenticatedUser, id: string, payload: Partial<TemplatePayload>) {
  const filter = { _id: id, ...(user.role === 'PT' ? { ownerPtId: new Types.ObjectId(user.id) } : {}) };
  const template = await WorkoutTemplate.findOne(filter);
  if (!template) throw fail('Workout template not found.', 404);
  const scheduleError = mergedStudioScheduleError({
    durationDays: template.durationDays,
    scheduledExercises: template.scheduledExercises,
  }, payload as unknown as Record<string, unknown>);
  if (scheduleError) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: scheduleError });
  for (const field of ['title', 'goal', 'level', 'durationDays', 'muscleGroups', 'defaultSets', 'defaultReps', 'defaultWeight', 'defaultTempo', 'technicalNotes', 'scheduledExercises', 'unscheduledExercises', 'sessions'] as const) if (payload[field] !== undefined) template.set(field, payload[field]);
  if (payload.scheduledExercises) template.set('sessions', sessionsFromSchedule(payload.scheduledExercises));
  template.version += 1;
  return template.save();
}
async function getTemplate(user: AuthenticatedUser, id: string) { const template = await WorkoutTemplate.findOne({ _id: id, ...(user.role === 'PT' ? { ownerPtId: user.id } : {}) }); if (!template) throw fail('Không tìm thấy giáo án mẫu.', 404); return template; }
async function archiveTemplate(user: AuthenticatedUser, id: string) { const template = await getTemplate(user, id); template.status = 'ARCHIVED'; return template.save(); }
async function deleteTemplate(user: AuthenticatedUser, id: string) { const template = await getTemplate(user, id); if (template.status !== 'ARCHIVED') throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Hãy lưu trữ giáo án trước khi xóa.' }); if (await WorkoutSession.exists({ templateId: template._id })) throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Không thể xóa giáo án đã có lịch sử tập.' }); await template.deleteOne(); }
async function createSession(user: AuthenticatedUser, payload: SessionPayload) {
  const ptId = new Types.ObjectId(user.id);
  const customerId = new Types.ObjectId(payload.customerId);
  const existing = await WorkoutSession.findOne({ ptId, idempotencyKey: payload.idempotencyKey });
  if (existing) return { session: existing, created: false };
  try {
    return await withTransaction(async (mongoSession) => {
      const duplicate = await WorkoutSession.findOne({ ptId, idempotencyKey: payload.idempotencyKey }).session(mongoSession);
      if (duplicate) return { session: duplicate, created: false };
      await customerFor(user, String(payload.customerId), mongoSession);
      const plan = await WorkoutPlan.findOne({ _id: payload.workoutPlanId, customerId, ptId }).session(mongoSession).lean();
      if (!plan) throw fail('Không tìm thấy giáo án đang gán cho khách hàng.', 404);
      if (plan.lifecycleStatus !== 'ACTIVE') throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Giáo án này không còn được áp dụng. Vui lòng tải lại giáo án hiện tại.' });
      if (plan.version !== payload.workoutPlanVersion) throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Giáo án đã được cập nhật. Vui lòng tải lại trước khi ghi buổi tập.' });
      const selectedRawSession = (plan.sessions as unknown as Array<{ name: string; exercises: Array<Record<string, unknown>> }>)[Number(payload.sessionIndex)];
      if (!selectedRawSession) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Buổi tập trong giáo án không hợp lệ.' });
      const resolvedSessionExercises = await resolvePlanExercisesTracking(selectedRawSession.exercises, mongoSession);
      const selectedSession = { name: selectedRawSession.name, exercises: resolvedSessionExercises.map((normalized) => {
        return { ...(normalized.exerciseId ? { exerciseId: normalized.exerciseId } : {}), name: normalized.name, trackingType: normalized.trackingType, prescription: { ...normalized.prescription } };
      }) };
      const exerciseResults = payload.exerciseResults || [];
      if (payload.attendance === 'ABSENT' && exerciseResults.length) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Buổi vắng không được có kết quả bài tập.' });
      if (payload.attendance !== 'ABSENT' && exerciseResults.length !== selectedSession.exercises.length) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Vui lòng ghi kết quả cho đầy đủ bài tập trong buổi đã chọn.' });
      const resultByIndex = new Map<number, typeof exerciseResults[number]>();
      for (const input of exerciseResults) {
        if (!Number.isInteger(input.exerciseIndex) || input.exerciseIndex < 0 || input.exerciseIndex >= selectedSession.exercises.length || resultByIndex.has(input.exerciseIndex)) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Kết quả bài tập không khớp với giáo án.' });
        resultByIndex.set(input.exerciseIndex, input);
      }
      const exerciseLogs = payload.attendance === 'ABSENT' ? [] : selectedSession.exercises.map((rawExercise: Record<string, unknown>, exerciseIndex: number) => {
        const exercise = normalizePlanExercise(rawExercise);
        const input = resultByIndex.get(exerciseIndex)!;
        if (input.exerciseId && String(input.exerciseId) !== String(exercise.exerciseId || '')) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Bài tập gửi lên không khớp với giáo án.' });
        let result;
        try { result = assertCompatibleResult(exercise.trackingType, input.result || {}); }
        catch (error) { throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: error instanceof Error ? error.message : 'Kết quả bài tập không hợp lệ.' }); }
        return { ...(exercise.exerciseId ? { exerciseId: exercise.exerciseId } : {}), name: exercise.name, trackingType: exercise.trackingType, prescribedSnapshot: { ...exercise.prescription }, result, notes: input.notes || '' };
      });
      const [createdSession] = await WorkoutSession.create([{
        customerId, ptId, workoutPlanId: plan._id, workoutPlanVersion: plan.version, performedAt: payload.performedAt,
        attendance: payload.attendance, absenceReason: payload.absenceReason, feeling: payload.feeling, notes: payload.notes, idempotencyKey: payload.idempotencyKey,
        planSnapshot: { workoutPlanId: plan._id, title: plan.title, version: plan.version, sessionIndex: payload.sessionIndex, session: selectedSession }, exerciseLogs,
        customerSignature: payload.attendance === 'ABSENT' ? undefined : (payload.customerSignature ? {
          signatureUrl: payload.customerSignature.signatureUrl,
          signedAt: payload.customerSignature.signedAt ? new Date(payload.customerSignature.signedAt) : new Date(),
          signerName: payload.customerSignature.signerName || '',
        } : undefined),
      }], { session: mongoSession });
      if (payload.bodyMeasurement && payload.attendance !== 'ABSENT') {
        const measurement = normalizeMeasurementPayload({
          customerId: payload.customerId,
          measuredAt: payload.performedAt,
          ...payload.bodyMeasurement,
        });
        await BodyMeasurement.create([{ ...measurement, customerId, ptId }], { session: mongoSession });
      }
      if (payload.progressPhotos?.length && payload.attendance !== 'ABSENT') {
        await ProgressPhoto.insertMany(payload.progressPhotos.map((photo) => ({
          customerId,
          ptId,
          photoUrl: photo.photoUrl,
          takenDate: payload.performedAt,
          stage: 'PROGRESS',
          angle: photo.angle,
          weight: payload.bodyMeasurement?.weight,
          bodyFat: payload.bodyMeasurement?.bodyFatPercentage,
          notes: `Ảnh ghi nhận cùng buổi tập: ${selectedSession.name}`,
        })), { session: mongoSession });
      }
      if (payload.attendance === 'PRESENT' || payload.attendance === 'LATE') {
        const selectedPackage = await PtPackage.findOne({ customerId, status: 'ACTIVE', remainingSessions: { $gt: 0 } })
          .sort({ endDate: 1 }).session(mongoSession);
        if (selectedPackage) {
          const completing = selectedPackage.remainingSessions === 1;
          await PtPackage.updateOne(
            { _id: selectedPackage._id, remainingSessions: selectedPackage.remainingSessions },
            { $inc: { usedSessions: 1, remainingSessions: -1 }, ...(completing ? { $set: { status: 'COMPLETED' } } : {}) },
            { session: mongoSession },
          );
        }
      }
      return { session: createdSession, created: true };
    });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      const duplicate = await WorkoutSession.findOne({ ptId, idempotencyKey: payload.idempotencyKey });
      if (duplicate) return { session: duplicate, created: false };
    }
    throw error;
  }
}
async function createMeasurement(user: AuthenticatedUser, payload: MeasurementPayload) {
  await customerFor(user, String(payload.customerId));
  return BodyMeasurement.create({ ...normalizeMeasurementPayload(payload), ptId: user.id });
}
async function listSessions(user: AuthenticatedUser, query: Record<string, unknown>) { const customerId = String(query.customerId); await customerFor(user, customerId); const page = Number(query.page || 1); const limit = Number(query.limit || 20); const filter: Record<string, unknown> = { customerId: new Types.ObjectId(customerId) }; if (query.attendance && ['PRESENT', 'ABSENT', 'LATE'].includes(String(query.attendance))) filter.attendance = query.attendance; const [items, total] = await Promise.all([WorkoutSession.find(filter).sort({ performedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), WorkoutSession.countDocuments(filter)]); return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }; }
async function updateSession(user: AuthenticatedUser, id: string, payload: Record<string, unknown>) { const item = await WorkoutSession.findById(id); if (!item) throw fail('Không tìm thấy buổi tập.', 404); await customerFor(user, String(item.customerId)); for (const field of ['performedAt', 'attendance', 'absenceReason', 'exerciseLogs', 'feeling', 'notes'] as const) if (payload[field] !== undefined) item.set(field, payload[field]); return item.save(); }
async function updateMeasurement(user: AuthenticatedUser, id: string, payload: Partial<MeasurementPayload> & Record<string, unknown>) { const item = await BodyMeasurement.findById(id); if (!item) throw fail('Không tìm thấy số đo.', 404); await customerFor(user, String(item.customerId)); const normalized = normalizeMeasurementPayload(payload, item.measurements || {}); for (const field of ['measuredAt', 'weight', 'bodyFatPercentage', 'muscleMass', 'measurements'] as const) if (normalized[field] !== undefined) item.set(field, normalized[field]); return item.save(); }
async function deleteMeasurement(user: AuthenticatedUser, id: string) { const item = await BodyMeasurement.findById(id); if (!item) throw fail('Không tìm thấy số đo.', 404); await customerFor(user, String(item.customerId)); await item.deleteOne(); }
async function getProgress(user: AuthenticatedUser, customerId: string) {
  await customerFor(user, customerId);
  const [measurements, sessions] = await Promise.all([
    BodyMeasurement.find({ customerId }).sort({ measuredAt: 1 }).lean(),
    WorkoutSession.find({ customerId }).sort({ performedAt: 1 }).lean(),
  ]);
  return { customerId: new Types.ObjectId(customerId), measurements, sessions };
}
export { createTemplate, listTemplates, getTemplate, updateTemplate, archiveTemplate, deleteTemplate, createSession, updateSession, listSessions, createMeasurement, updateMeasurement, deleteMeasurement, getProgress };
