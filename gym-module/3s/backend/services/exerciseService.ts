import mongoose, { type QueryFilter } from 'mongoose';
import Exercise, { type IExercise } from '../models/Exercise.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AuthenticatedUser } from '../types/express.js';
import { recordAudit } from './auditService.js';
import { isAdminRole } from './roles.js';

type ExerciseResponse = Record<string, unknown> & { id?: string; ownerPtId?: unknown; videoUrl?: string; videos?: IExercise['videos'] };
function canManageExercise(user: AuthenticatedUser, exercise: { ownerPtId?: unknown; centerId?: unknown }): boolean {
  if (exercise.centerId && String(exercise.centerId) === user.centerId) {
    return isAdminRole(user.role) || Boolean(exercise.ownerPtId && String(exercise.ownerPtId) === user.id);
  }
  return false;
}
function normalizeExerciseVideos(user: AuthenticatedUser, value: unknown): ExerciseResponse & { canManage: boolean } {
  const documentLike = value as { toObject?: () => unknown; id?: unknown };
  const raw = typeof documentLike.toObject === 'function' ? documentLike.toObject() : value;
  const exercise = { ...(raw as Record<string, unknown>) } as ExerciseResponse;
  const id = documentLike.id ?? exercise._id;
  if (id != null) exercise.id = String(id);
  if ((!exercise.videos || exercise.videos.length === 0) && exercise.videoUrl) {
    exercise.videos = [{ title: 'Video hướng dẫn', url: exercise.videoUrl, source: 'LINK' }];
  }
  return { ...exercise, canManage: canManageExercise(user, exercise) };
}

function creationPayload(user: AuthenticatedUser, payload: Partial<IExercise>) {
  const norm = { ...payload };
  if (Array.isArray(norm.muscleGroups) && norm.muscleGroups.length > 0) {
    norm.muscleGroups = norm.muscleGroups.map((s) => String(s).trim()).filter(Boolean);
    norm.muscleGroup = norm.muscleGroups.join(', ');
  } else if (typeof norm.muscleGroup === 'string' && norm.muscleGroup.trim()) {
    norm.muscleGroups = norm.muscleGroup.split(',').map((s) => s.trim()).filter(Boolean);
    norm.muscleGroup = norm.muscleGroups.join(', ');
  }
  return { ...norm, scope: 'PRIVATE' as const, ownerPtId: user.role === 'PT' ? user.id : undefined };
}


function normalizedName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

function duplicateNameError(names: string[]) {
  return new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: `Tên bài tập bị trùng: ${names.join(', ')}.` });
}

async function create(user: AuthenticatedUser, payload: Partial<IExercise>) {
  const exercise = await Exercise.create(creationPayload(user, payload));
  await recordAudit({ actor: user, action: 'EXERCISE_CREATED', resourceType: 'exercise', resourceId: exercise.id });
  return normalizeExerciseVideos(user, exercise);
}
async function createBulk(user: AuthenticatedUser, payloads: Partial<IExercise>[]) {
  const names = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const payload of payloads) {
    const displayName = String(payload.name || '').trim().replace(/\s+/g, ' ');
    const key = normalizedName(displayName);
    if (names.has(key)) duplicates.add(names.get(key)!);
    else names.set(key, displayName);
  }
  if (duplicates.size) throw duplicateNameError([...duplicates]);

  const existing = await findDuplicateNames([...names.values()]);
  if (existing.length) throw duplicateNameError(existing);

  const session = await mongoose.startSession();
  let created: Array<mongoose.HydratedDocument<IExercise>> = [];
  try {
    await session.withTransaction(async () => {
      created = await Exercise.insertMany(payloads.map((payload) => creationPayload(user, payload)), { session });
      for (const exercise of created) {
        await recordAudit({ actor: user, action: 'EXERCISE_CREATED', resourceType: 'exercise', resourceId: exercise.id }, session);
      }
    });
  } finally {
    await session.endSession();
  }
  return created.map((exercise) => normalizeExerciseVideos(user, exercise));
}

export async function findDuplicateNames(names: string[]): Promise<string[]> {
  const patterns = [...new Set(names.map(normalizedName))].filter(Boolean).map((name) => {
    const pattern = name.split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
    return new RegExp(`^\\s*${pattern}\\s*$`, 'i');
  });
  const existing = patterns.length ? await Exercise.find({ name: { $in: patterns } }).select('name').lean() : [];
  return existing.map((exercise) => exercise.name);
}
async function list(user: AuthenticatedUser, query: Record<string, unknown>) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const andClauses: QueryFilter<IExercise>[] = [];
  if (typeof query.muscleGroup === 'string' && query.muscleGroup.trim()) {
    andClauses.push({ muscleGroup: { $regex: query.muscleGroup.trim(), $options: 'i' } as unknown as string });
  }
  if (typeof query.level === 'string' && query.level.trim()) {
    andClauses.push({ level: query.level as IExercise['level'] });
  }
  if (typeof query.defaultTrackingType === 'string' && query.defaultTrackingType.trim()) {
    andClauses.push({ defaultTrackingType: query.defaultTrackingType as IExercise['defaultTrackingType'] });
  }

  const rawSearch = (typeof query.keyword === 'string' ? query.keyword : typeof query.search === 'string' ? query.search : '').trim();
  if (rawSearch) {
    const escaped = rawSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = { $regex: escaped, $options: 'i' } as unknown as string;
    andClauses.push({ name: regex });
  }

  const filter: QueryFilter<IExercise> = andClauses.length > 0 ? { $and: andClauses } : {};
  const [items, total] = await Promise.all([
    Exercise.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Exercise.countDocuments(filter),
  ]);
  return { items: items.map((item) => normalizeExerciseVideos(user, item)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
async function update(user: AuthenticatedUser, id: string, payload: Partial<IExercise>) {
  const exercise = await Exercise.findById(id);
  if (!exercise) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Exercise not found.' });
  if (!canManageExercise(user, exercise)) {
    throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Bạn không có quyền quản lý bài tập này.' });
  }
  const protectedFields = new Set(['_id', 'ownerPtId', 'scope', 'createdAt', 'updatedAt']);
  const norm = { ...payload };
  if (Array.isArray(norm.muscleGroups) && norm.muscleGroups.length > 0) {
    norm.muscleGroups = norm.muscleGroups.map((s) => String(s).trim()).filter(Boolean);
    norm.muscleGroup = norm.muscleGroups.join(', ');
  } else if (typeof norm.muscleGroup === 'string' && norm.muscleGroup.trim()) {
    norm.muscleGroups = norm.muscleGroup.split(',').map((s) => s.trim()).filter(Boolean);
    norm.muscleGroup = norm.muscleGroups.join(', ');
  }
  for (const [field, value] of Object.entries(norm)) if (!protectedFields.has(field)) exercise.set(field, value);
  const saved = await exercise.save();
  await recordAudit({ actor: user, action: 'EXERCISE_UPDATED', resourceType: 'exercise', resourceId: exercise.id });
  return normalizeExerciseVideos(user, saved);
}
async function getOwned(user: AuthenticatedUser, id: string) {
  const exercise = await Exercise.findById(id);
  if (!exercise) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy bài tập.' });
  return exercise;
}
async function get(user: AuthenticatedUser, id: string) { return normalizeExerciseVideos(user, await getOwned(user, id)); }
async function remove(user: AuthenticatedUser, id: string) {
  const exercise = await getOwned(user, id);
  if (!canManageExercise(user, exercise)) throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Bạn không có quyền quản lý bài tập này.' });
  await exercise.deleteOne();
  await recordAudit({ actor: user, action: 'EXERCISE_DELETED', resourceType: 'exercise', resourceId: exercise.id });
}
export { create, createBulk, list, get, update, remove };
