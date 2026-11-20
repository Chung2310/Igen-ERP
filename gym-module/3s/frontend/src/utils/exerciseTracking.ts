import type { Exercise, TrackingPrescription, TrackingType } from '../types';

export function defaultPrescriptionFor(type: TrackingType): TrackingPrescription {
  switch (type) {
    case 'STRENGTH': return { sets: 3, reps: '8-12', targetWeight: 0, targetRpe: 7, targetRir: 3, restSeconds: 90 };
    case 'BODYWEIGHT': return { sets: 3, reps: '10-15', addedWeight: 0, targetRpe: 7, targetRir: 3, restSeconds: 60 };
    case 'CARDIO': return { durationMinutes: 20, targetRpe: 6 };
    case 'INTERVAL': return { rounds: 6, workSeconds: 30, restSeconds: 30, targetRpe: 8 };
    case 'MOBILITY': return { durationMinutes: 5, reps: 10, side: 'BOTH', targetDiscomfort: 2 };
    default: return {};
  }
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function legacyPrescription(source: Record<string, unknown>, trackingType: TrackingType): Record<string, unknown> {
  if (trackingType !== 'STRENGTH' && trackingType !== 'BODYWEIGHT') return {};
  const weight = numericValue(source.weight);
  return {
    ...(numericValue(source.sets) !== undefined ? { sets: numericValue(source.sets) } : {}),
    ...(typeof source.reps === 'string' && source.reps.trim() ? { reps: source.reps.trim() } : {}),
    ...(weight !== undefined ? { [trackingType === 'STRENGTH' ? 'targetWeight' : 'addedWeight']: weight } : {}),
    ...(numericValue(source.rpe) !== undefined ? { targetRpe: numericValue(source.rpe) } : {}),
    ...(numericValue(source.rir) !== undefined ? { targetRir: numericValue(source.rir) } : {}),
    ...(numericValue(source.restSeconds) !== undefined ? { restSeconds: numericValue(source.restSeconds) } : {}),
  };
}

export function planExerciseFromLibrary(exercise: Exercise) {
  const trackingType = exercise.defaultTrackingType ?? 'UNCLASSIFIED';
  return { exerciseId: exercise._id, name: exercise.name, trackingType, prescription: { ...defaultPrescriptionFor(trackingType) } };
}

export function normalizePlanExercise<T extends object>(exercise: T): T & { trackingType: TrackingType; prescription: TrackingPrescription } {
  const source = exercise as Record<string, unknown>;
  const trackingType = typeof source.trackingType === 'string' && ['UNCLASSIFIED', 'STRENGTH', 'BODYWEIGHT', 'CARDIO', 'INTERVAL', 'MOBILITY'].includes(source.trackingType)
    ? source.trackingType as TrackingType
    : 'UNCLASSIFIED';
  const storedPrescription = typeof source.prescription === 'object' && source.prescription !== null && !Array.isArray(source.prescription)
    ? Object.fromEntries(Object.entries(source.prescription).filter(([, value]) => value !== undefined && value !== ''))
    : {};
  const prescription = {
    ...defaultPrescriptionFor(trackingType),
    ...legacyPrescription(source, trackingType),
    ...storedPrescription,
  } as TrackingPrescription;
  return { ...exercise, trackingType, prescription };
}

export function changeTrackingType<T extends object>(exercise: T, trackingType: TrackingType): T & { trackingType: TrackingType; prescription: TrackingPrescription } {
  return { ...exercise, trackingType, prescription: { ...defaultPrescriptionFor(trackingType) } };
}
