import type { CompletedSetResult, SessionTrackingType, TrackingResult, WorkoutExerciseLog } from '../types';

export interface NormalizedWorkoutExerciseLog extends WorkoutExerciseLog { trackingType: SessionTrackingType; result: TrackingResult }

export function normalizeWorkoutExerciseLog(exercise: WorkoutExerciseLog): NormalizedWorkoutExerciseLog {
  const trackingType: SessionTrackingType = exercise.trackingType || (Array.isArray(exercise.sets) ? 'LEGACY_STRENGTH' : 'UNCLASSIFIED');
  const result = exercise.result || ((trackingType === 'LEGACY_STRENGTH' || trackingType === 'STRENGTH') && Array.isArray(exercise.sets) ? { sets: exercise.sets } : {});
  return { ...exercise, trackingType, result } as NormalizedWorkoutExerciseLog;
}

export function completedSets(exercise: WorkoutExerciseLog): CompletedSetResult[] {
  const normalized = normalizeWorkoutExerciseLog(exercise);
  return 'sets' in normalized.result && Array.isArray(normalized.result.sets) ? normalized.result.sets.filter((set) => set.completed !== false) : [];
}

export function exerciseVolume(exercise: WorkoutExerciseLog): number {
  return completedSets(exercise).reduce((sum, set) => sum + (set.weight || 0) * (set.reps || 0), 0);
}

export function exerciseRpes(exercise: WorkoutExerciseLog): number[] {
  const normalized = normalizeWorkoutExerciseLog(exercise);
  const resultRpe = 'rpe' in normalized.result && typeof normalized.result.rpe === 'number' ? [normalized.result.rpe] : [];
  return [...completedSets(exercise).map((set) => set.rpe).filter((value): value is number => typeof value === 'number'), ...resultRpe];
}
