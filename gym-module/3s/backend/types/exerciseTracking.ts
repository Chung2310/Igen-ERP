export const TRACKING_TYPES = ['UNCLASSIFIED', 'STRENGTH', 'BODYWEIGHT', 'CARDIO', 'INTERVAL', 'MOBILITY'] as const;
export const CLASSIFIED_TRACKING_TYPES = TRACKING_TYPES.filter((type) => type !== 'UNCLASSIFIED');

export type TrackingType = typeof TRACKING_TYPES[number];
export type ClassifiedTrackingType = Exclude<TrackingType, 'UNCLASSIFIED'>;
export type SessionTrackingType = TrackingType | 'LEGACY_STRENGTH';
export type ExerciseSide = 'LEFT' | 'RIGHT' | 'BOTH';

export interface StrengthPrescription { sets: number; reps?: string; targetWeight?: number; targetRpe?: number; targetRir?: number; restSeconds?: number }
export interface BodyweightPrescription { sets: number; reps?: string; addedWeight?: number; targetRpe?: number; targetRir?: number; restSeconds?: number }
export interface CardioPrescription { durationMinutes?: number; distanceKm?: number; targetPaceSecondsPerKm?: number; targetHeartRate?: number; inclinePercent?: number; targetRpe?: number }
export interface IntervalPrescription { rounds: number; workSeconds?: number; restSeconds?: number; distanceMetersPerRound?: number; repsPerRound?: number; targetRpe?: number }
export interface MobilityPrescription { durationMinutes?: number; reps?: number; side?: ExerciseSide; targetDiscomfort?: number }
export type TrackingPrescription = StrengthPrescription | BodyweightPrescription | CardioPrescription | IntervalPrescription | MobilityPrescription | Record<string, never>;

export interface CompletedSetResult { reps?: number; weight?: number; addedWeight?: number; rpe?: number; rir?: number; completed: boolean }
export interface StrengthResult { sets: CompletedSetResult[] }
export interface BodyweightResult { sets: CompletedSetResult[] }
export interface CardioResult { durationMinutes?: number; distanceKm?: number; paceSecondsPerKm?: number; averageHeartRate?: number; inclinePercent?: number; calories?: number; rpe?: number }
export interface IntervalResult { rounds?: number; workSeconds?: number; restSeconds?: number; distanceMetersPerRound?: number; repsPerRound?: number; rpe?: number }
export interface MobilityResult { durationMinutes?: number; reps?: number; side?: ExerciseSide; discomfort?: number }
export type TrackingResult = StrengthResult | BodyweightResult | CardioResult | IntervalResult | MobilityResult;

export const TRACKING_METRICS = {
  UNCLASSIFIED: [],
  STRENGTH: ['sets'],
  BODYWEIGHT: ['sets'],
  CARDIO: ['durationMinutes', 'distanceKm', 'paceSecondsPerKm', 'averageHeartRate', 'inclinePercent', 'calories', 'rpe'],
  INTERVAL: ['rounds', 'workSeconds', 'restSeconds', 'distanceMetersPerRound', 'repsPerRound', 'rpe'],
  MOBILITY: ['durationMinutes', 'reps', 'side', 'discomfort'],
} as const satisfies Record<TrackingType, readonly string[]>;
