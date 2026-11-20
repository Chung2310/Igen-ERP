import { Types, type ClientSession } from 'mongoose';
import Exercise from '../models/Exercise.js';
import { TRACKING_METRICS, TRACKING_TYPES, type SessionTrackingType, type TrackingResult, type TrackingType } from '../types/exerciseTracking.js';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);

export function isTrackingType(value: unknown): value is TrackingType {
  return typeof value === 'string' && TRACKING_TYPES.includes(value as TrackingType);
}

export function normalizePlanExercise<T extends UnknownRecord>(value: T): T & { trackingType: TrackingType; prescription: UnknownRecord } {
  const trackingType = isTrackingType(value.trackingType) ? value.trackingType : 'UNCLASSIFIED';
  return { ...value, trackingType, prescription: isRecord(value.prescription) ? { ...value.prescription } : {} };
}

export async function resolvePlanExercisesTracking<T extends UnknownRecord>(
  values: T[],
  session?: ClientSession,
): Promise<Array<T & { trackingType: TrackingType; prescription: UnknownRecord }>> {
  const normalized = values.map((value) => normalizePlanExercise(value));
  const unresolvedExerciseIds = [...new Set(normalized
    .filter((value) => value.trackingType === 'UNCLASSIFIED' && Types.ObjectId.isValid(String(value.exerciseId || '')))
    .map((value) => String(value.exerciseId)))];
  if (!unresolvedExerciseIds.length) return normalized;

  const currentExercises = await Exercise.find({ _id: { $in: unresolvedExerciseIds } }, '_id defaultTrackingType')
    .session(session || null)
    .lean();
  const trackingTypeByExerciseId = new Map<string, TrackingType>(currentExercises
    .filter((exercise) => exercise.defaultTrackingType !== 'UNCLASSIFIED')
    .map((exercise) => [String(exercise._id), exercise.defaultTrackingType]));

  return normalized.map((value) => {
    if (value.trackingType !== 'UNCLASSIFIED') return value;
    const currentTrackingType = trackingTypeByExerciseId.get(String(value.exerciseId || ''));
    return currentTrackingType ? { ...value, trackingType: currentTrackingType } : value;
  });
}

export async function resolveWorkoutPlanTracking<T extends UnknownRecord>(plan: T): Promise<T> {
  const sessions = Array.isArray(plan.sessions) ? plan.sessions.filter(isRecord) : [];
  const exercisesBySession = sessions.map((session) => Array.isArray(session.exercises) ? session.exercises.filter(isRecord) : []);
  const resolvedExercises = await resolvePlanExercisesTracking(exercisesBySession.flat());
  let exerciseOffset = 0;
  const resolvedSessions = sessions.map((session, sessionIndex) => {
    const sessionExerciseCount = exercisesBySession[sessionIndex].length;
    const exercises = resolvedExercises.slice(exerciseOffset, exerciseOffset + sessionExerciseCount);
    exerciseOffset += sessionExerciseCount;
    return { ...session, exercises };
  });

  return { ...plan, sessions: resolvedSessions };
}

export function normalizeSessionExerciseLog<T extends UnknownRecord>(value: T): T & { trackingType: SessionTrackingType; result: UnknownRecord } {
  const explicitType = value.trackingType;
  const trackingType: SessionTrackingType = explicitType === 'LEGACY_STRENGTH' || isTrackingType(explicitType)
    ? explicitType
    : Array.isArray(value.sets) ? 'LEGACY_STRENGTH' : 'UNCLASSIFIED';
  const result = isRecord(value.result)
    ? { ...value.result }
    : trackingType === 'LEGACY_STRENGTH' ? { sets: structuredClone(value.sets) } : {};
  return { ...value, trackingType, result };
}

export function assertCompatibleResult(trackingType: Exclude<SessionTrackingType, 'LEGACY_STRENGTH'>, result: UnknownRecord): TrackingResult {
  if (trackingType === 'UNCLASSIFIED') throw new Error('Bài tập chưa được phân loại cách ghi nhận.');
  const allowed = TRACKING_METRICS[trackingType] as readonly string[];
  const cleaned: UnknownRecord = {};
  for (const [key, value] of Object.entries(result)) {
    if (!allowed.includes(key)) throw new Error(`${trackingType} không hỗ trợ chỉ số ${key}.`);
    if (value !== undefined && value !== null && value !== '') cleaned[key] = value;
  }
  return cleaned as unknown as TrackingResult;
}
