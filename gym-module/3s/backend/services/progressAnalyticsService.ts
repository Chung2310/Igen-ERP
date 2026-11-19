import type { SessionTrackingType } from '../types/exerciseTracking.js';

type Attendance = 'PRESENT' | 'LATE' | 'ABSENT';
interface SetInput { reps?: number; weight?: number; addedWeight?: number; rpe?: number; completed?: boolean }
interface ExerciseInput { name: string; trackingType?: SessionTrackingType; result?: Record<string, unknown>; sets?: SetInput[] }
interface SessionInput { _id?: unknown; performedAt: Date | string; attendance: Attendance | string; exerciseLogs?: ExerciseInput[] }
interface MeasurementInput { measuredAt: Date | string; weight?: number; bodyFatPercentage?: number; muscleMass?: number; measurements?: Record<string, number | undefined> }
interface AnalyticsInput { sessions: SessionInput[]; measurements: MeasurementInput[]; periodStart?: Date | string; periodEnd?: Date | string }
type AchievementKind = 'MAX_WEIGHT' | 'MAX_REPS' | 'MAX_SET_VOLUME' | 'ESTIMATED_1RM' | 'BODYWEIGHT_MAX_REPS' | 'BODYWEIGHT_MAX_ADDED_WEIGHT' | 'CARDIO_MAX_DISTANCE' | 'CARDIO_MAX_DURATION' | 'CARDIO_BEST_PACE' | 'INTERVAL_MAX_ROUNDS' | 'MOBILITY_MAX_DURATION';
interface Achievement { exerciseName: string; kind: AchievementKind; value: number; unit: string; trackingType: SessionTrackingType; achievedAt: string; sessionId: string; isNewInPeriod: boolean }

const round = (value: number) => Math.round(value * 10) / 10;
const time = (value: Date | string) => new Date(value).getTime();
const iso = (value: Date | string) => new Date(value).toISOString();
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const maximum = (current: number | null, value: unknown) => finite(value) && (current === null || value > current) ? value : current;

export function estimatedOneRepMax(weight: number, reps: number) { return round(weight * (1 + reps / 30)); }

function inPeriod(value: Date | string, start?: Date | string, end?: Date | string) {
  const current = time(value);
  return (!start || current >= time(start)) && (!end || current <= time(end));
}

function weekKey(value: Date | string) {
  const date = new Date(value); const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1); date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 604_800_000);
}

function normalizedExercise(exercise: ExerciseInput) {
  const trackingType: SessionTrackingType = exercise.trackingType || (Array.isArray(exercise.sets) ? 'LEGACY_STRENGTH' : 'UNCLASSIFIED');
  const result = exercise.result && typeof exercise.result === 'object' ? exercise.result : {};
  const sets = Array.isArray(result.sets) ? result.sets as SetInput[] : exercise.sets || [];
  return { ...exercise, trackingType, result, sets };
}

function achievementsFrom(sessions: SessionInput[], periodStart?: Date | string, periodEnd?: Date | string) {
  const records = new Map<string, Achievement>();
  const consider = (exerciseName: string, kind: AchievementKind, value: unknown, unit: string, trackingType: SessionTrackingType, session: SessionInput, lowerIsBetter = false) => {
    if (!finite(value) || (lowerIsBetter && value <= 0)) return;
    const key = `${exerciseName.toLocaleLowerCase()}::${kind}`; const current = records.get(key);
    if (!current || (lowerIsBetter ? value < current.value : value > current.value)) records.set(key, { exerciseName, kind, value: round(value), unit, trackingType, achievedAt: iso(session.performedAt), sessionId: String(session._id || ''), isNewInPeriod: inPeriod(session.performedAt, periodStart, periodEnd) });
  };
  for (const session of sessions) {
    if (session.attendance === 'ABSENT') continue;
    for (const rawExercise of session.exerciseLogs || []) {
      const exercise = normalizedExercise(rawExercise); const result = exercise.result;
      if (exercise.trackingType === 'STRENGTH' || exercise.trackingType === 'LEGACY_STRENGTH') for (const set of exercise.sets) {
        if (set.completed === false) continue;
        consider(exercise.name, 'MAX_WEIGHT', set.weight, 'kg', exercise.trackingType, session);
        consider(exercise.name, 'MAX_REPS', set.reps, 'reps', exercise.trackingType, session);
        if (finite(set.weight) && finite(set.reps)) { consider(exercise.name, 'MAX_SET_VOLUME', set.weight * set.reps, 'kg', exercise.trackingType, session); consider(exercise.name, 'ESTIMATED_1RM', estimatedOneRepMax(set.weight, set.reps), 'kg', exercise.trackingType, session); }
      }
      if (exercise.trackingType === 'BODYWEIGHT') for (const set of exercise.sets) { if (set.completed !== false) { consider(exercise.name, 'BODYWEIGHT_MAX_REPS', set.reps, 'reps', 'BODYWEIGHT', session); consider(exercise.name, 'BODYWEIGHT_MAX_ADDED_WEIGHT', set.addedWeight, 'kg', 'BODYWEIGHT', session); } }
      if (exercise.trackingType === 'CARDIO') { consider(exercise.name, 'CARDIO_MAX_DISTANCE', result.distanceKm, 'km', 'CARDIO', session); consider(exercise.name, 'CARDIO_MAX_DURATION', result.durationMinutes, 'min', 'CARDIO', session); consider(exercise.name, 'CARDIO_BEST_PACE', result.paceSecondsPerKm, 'sec/km', 'CARDIO', session, true); }
      if (exercise.trackingType === 'INTERVAL') consider(exercise.name, 'INTERVAL_MAX_ROUNDS', result.rounds, 'rounds', 'INTERVAL', session);
      if (exercise.trackingType === 'MOBILITY') consider(exercise.name, 'MOBILITY_MAX_DURATION', result.durationMinutes, 'min', 'MOBILITY', session);
    }
  }
  return [...records.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.kind.localeCompare(b.kind));
}

function bodyDeltasFrom(measurements: MeasurementInput[]) {
  const sorted = [...measurements].sort((a, b) => time(a.measuredAt) - time(b.measuredAt));
  const keys = ['weight', 'bodyFatPercentage', 'bodyFatMass', 'muscleMass', 'visceralFatLevel', 'inbodyScore', 'waistHipRatio', 'chest', 'waist', 'hips', 'arm', 'thigh', 'calf'] as const;
  const result: Record<string, number> = {};
  for (const key of keys) {
    const values = sorted.map((item) => key in item ? item[key as 'weight'] : item.measurements?.[key]).filter((value): value is number => finite(value));
    if (values.length >= 2) result[key] = round(values.at(-1)! - values[0]);
  }
  return result;
}

export function analyzeProgress(input: AnalyticsInput) {
  const sessions = input.sessions.filter((item) => inPeriod(item.performedAt, input.periodStart, input.periodEnd)).sort((a, b) => time(a.performedAt) - time(b.performedAt));
  const measurements = input.measurements.filter((item) => inPeriod(item.measuredAt, input.periodStart, input.periodEnd)).sort((a, b) => time(a.measuredAt) - time(b.measuredAt));
  const strength = { totalVolumeKg: 0, maxWeightKg: null as number | null, maxReps: null as number | null, estimated1RmKg: null as number | null };
  const bodyweight = { totalReps: 0, maxReps: null as number | null, maxAddedWeightKg: null as number | null };
  const cardio = { durationMinutes: 0, distanceKm: 0, bestPaceSecondsPerKm: null as number | null, averageHeartRate: null as number | null };
  const interval = { totalRounds: 0, workSeconds: 0, restSeconds: 0 };
  const mobility = { durationMinutes: 0, completedReps: 0, averageDiscomfort: null as number | null };
  const heartRates: number[] = []; const discomforts: number[] = []; const rpes: number[] = [];
  for (const session of sessions) {
    if (session.attendance === 'ABSENT') continue;
    for (const rawExercise of session.exerciseLogs || []) {
      const exercise = normalizedExercise(rawExercise); const result = exercise.result;
      if (exercise.trackingType === 'STRENGTH' || exercise.trackingType === 'LEGACY_STRENGTH') for (const set of exercise.sets) {
        if (set.completed === false) continue;
        if (finite(set.weight)) strength.maxWeightKg = maximum(strength.maxWeightKg, set.weight);
        if (finite(set.reps)) strength.maxReps = maximum(strength.maxReps, set.reps);
        if (finite(set.weight) && finite(set.reps)) { strength.totalVolumeKg += set.weight * set.reps; strength.estimated1RmKg = maximum(strength.estimated1RmKg, estimatedOneRepMax(set.weight, set.reps)); }
        if (finite(set.rpe)) rpes.push(set.rpe);
      }
      if (exercise.trackingType === 'BODYWEIGHT') for (const set of exercise.sets) {
        if (set.completed === false) continue;
        if (finite(set.reps)) { bodyweight.totalReps += set.reps; bodyweight.maxReps = maximum(bodyweight.maxReps, set.reps); }
        if (finite(set.addedWeight)) bodyweight.maxAddedWeightKg = maximum(bodyweight.maxAddedWeightKg, set.addedWeight);
        if (finite(set.rpe)) rpes.push(set.rpe);
      }
      if (exercise.trackingType === 'CARDIO') {
        if (finite(result.durationMinutes)) cardio.durationMinutes += result.durationMinutes;
        if (finite(result.distanceKm)) cardio.distanceKm += result.distanceKm;
        if (finite(result.paceSecondsPerKm) && result.paceSecondsPerKm > 0 && (cardio.bestPaceSecondsPerKm === null || result.paceSecondsPerKm < cardio.bestPaceSecondsPerKm)) cardio.bestPaceSecondsPerKm = result.paceSecondsPerKm;
        if (finite(result.averageHeartRate)) heartRates.push(result.averageHeartRate);
        if (finite(result.rpe)) rpes.push(result.rpe);
      }
      if (exercise.trackingType === 'INTERVAL') { if (finite(result.rounds)) interval.totalRounds += result.rounds; if (finite(result.workSeconds)) interval.workSeconds += result.workSeconds; if (finite(result.restSeconds)) interval.restSeconds += result.restSeconds; if (finite(result.rpe)) rpes.push(result.rpe); }
      if (exercise.trackingType === 'MOBILITY') { if (finite(result.durationMinutes)) mobility.durationMinutes += result.durationMinutes; if (finite(result.reps)) mobility.completedReps += result.reps; if (finite(result.discomfort)) discomforts.push(result.discomfort); }
    }
  }
  strength.totalVolumeKg = round(strength.totalVolumeKg); bodyweight.totalReps = round(bodyweight.totalReps); cardio.durationMinutes = round(cardio.durationMinutes); cardio.distanceKm = round(cardio.distanceKm); interval.totalRounds = round(interval.totalRounds); interval.workSeconds = round(interval.workSeconds); interval.restSeconds = round(interval.restSeconds); mobility.durationMinutes = round(mobility.durationMinutes); mobility.completedReps = round(mobility.completedReps);
  cardio.averageHeartRate = heartRates.length ? round(heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length) : null;
  mobility.averageDiscomfort = discomforts.length ? round(discomforts.reduce((sum, value) => sum + value, 0) / discomforts.length) : null;
  const counts = { present: sessions.filter((item) => item.attendance === 'PRESENT').length, late: sessions.filter((item) => item.attendance === 'LATE').length, absent: sessions.filter((item) => item.attendance === 'ABSENT').length };
  const activeWeeks = [...new Set(sessions.filter((item) => item.attendance !== 'ABSENT').map((item) => weekKey(item.performedAt)))].sort((a, b) => a - b);
  let streakWeeks = activeWeeks.length ? 1 : 0; for (let index = activeWeeks.length - 1; index > 0 && activeWeeks[index] - activeWeeks[index - 1] === 1; index -= 1) streakWeeks += 1;
  const bodyDeltas = bodyDeltasFrom(measurements); const reasons: string[] = [];
  if (!sessions.length) reasons.push('Chưa có dữ liệu buổi tập.');
  if (measurements.length < 2) reasons.push('Cần ít nhất hai lần đo để so sánh.'); else if (!('weight' in bodyDeltas) || !('bodyFatPercentage' in bodyDeltas) || !('muscleMass' in bodyDeltas)) reasons.push('Một số chỉ số cơ thể chưa đủ dữ liệu đối chiếu.');
  const level = !sessions.length && !measurements.length ? 'INSUFFICIENT' : reasons.length ? 'PARTIAL' : 'COMPLETE';
  return { totalSessions: sessions.length, totalVolume: strength.totalVolumeKg, averageRpe: rpes.length ? round(rpes.reduce((sum, value) => sum + value, 0) / rpes.length) : null, attendance: { ...counts, rate: sessions.length ? round(((counts.present + counts.late) / sessions.length) * 100) : null }, streakWeeks, tracking: { strength, bodyweight, cardio, interval, mobility }, bodyDeltas, achievements: achievementsFrom(sessions, input.periodStart, input.periodEnd), dataQuality: { level, reasons } } as const;
}
