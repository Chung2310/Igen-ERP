import type { WorkoutExerciseLog, WorkoutSessionDto } from '../types';
import { normalizeWorkoutExerciseLog } from '../utils/sessionTracking';

export interface ExerciseMetricComparison {
  label: string;
  unit: string;
  previous: number;
  current: number | null;
  delta: number | null;
  improved: boolean | null;
}

export interface ExerciseDayComparison {
  name: string;
  metrics: ExerciseMetricComparison[];
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const exerciseKey = (exercise: Pick<WorkoutExerciseLog, 'exerciseId' | 'name'>) =>
  exercise.exerciseId?.trim() || exercise.name.trim().toLocaleLowerCase('vi-VN');

function previousDay(dateKey: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localDateKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function metrics(exercise: WorkoutExerciseLog): Array<{ label: string; unit: string; value: number; lowerIsBetter?: boolean }> {
  const { trackingType, result } = normalizeWorkoutExerciseLog(exercise);
  const values: Array<{ label: string; unit: string; value: number; lowerIsBetter?: boolean }> = [];
  const add = (label: string, unit: string, value: unknown, lowerIsBetter = false) => {
    if (finite(value)) values.push({ label, unit, value, lowerIsBetter });
  };

  if (trackingType === 'STRENGTH' || trackingType === 'LEGACY_STRENGTH' || trackingType === 'BODYWEIGHT') {
    const sets = 'sets' in result && Array.isArray(result.sets)
      ? result.sets.filter((set) => set.completed !== false)
      : [];
    const completed = sets.filter((set) => finite(set.reps));
    if (completed.length) add('Tổng reps', 'reps', completed.reduce((sum, set) => sum + (set.reps || 0), 0));
    const weights = sets.map((set) => trackingType === 'BODYWEIGHT' ? set.addedWeight : set.weight).filter(finite);
    if (weights.length) add(trackingType === 'BODYWEIGHT' ? 'Tạ thêm cao nhất' : 'Mức tạ cao nhất', 'kg', Math.max(...weights));
    if (trackingType !== 'BODYWEIGHT') {
      const loaded = sets.filter((set) => finite(set.weight) && finite(set.reps));
      if (loaded.length) add('Tổng tải', 'kg', loaded.reduce((sum, set) => sum + (set.weight || 0) * (set.reps || 0), 0));
    }
  } else if (trackingType === 'CARDIO') {
    if ('distanceKm' in result) add('Quãng đường', 'km', result.distanceKm);
    if ('durationMinutes' in result) add('Thời gian', 'phút', result.durationMinutes);
    if ('paceSecondsPerKm' in result) add('Pace', 'giây/km', result.paceSecondsPerKm, true);
  } else if (trackingType === 'INTERVAL') {
    if ('rounds' in result) add('Số vòng', 'vòng', result.rounds);
    if ('repsPerRound' in result) add('Reps mỗi vòng', 'reps', result.repsPerRound);
    if ('distanceMetersPerRound' in result) add('Quãng đường mỗi vòng', 'm', result.distanceMetersPerRound);
  } else if (trackingType === 'MOBILITY') {
    if ('durationMinutes' in result) add('Thời gian', 'phút', result.durationMinutes);
    if ('reps' in result) add('Số reps', 'reps', result.reps);
    if ('discomfort' in result) add('Mức khó chịu', '/10', result.discomfort, true);
  }
  return values;
}

export function compareWorkoutWithPreviousDay(
  dateKey: string,
  exercises: WorkoutExerciseLog[],
  sessions: WorkoutSessionDto[],
): ExerciseDayComparison[] {
  const yesterday = previousDay(dateKey);
  if (!yesterday) return [];
  const previous = new Map<string, WorkoutExerciseLog>();
  [...sessions]
    .filter((session) => session.attendance !== 'ABSENT' && localDateKey(session.performedAt) === yesterday)
    .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime())
    .forEach((session) => session.exerciseLogs.forEach((exercise) => {
      const id = exerciseKey(exercise);
      if (!previous.has(id)) previous.set(id, exercise);
    }));

  return exercises.flatMap((exercise) => {
    const prior = previous.get(exerciseKey(exercise));
    if (!prior) return [];
    const currentMetrics = new Map(metrics(exercise).map((metric) => [metric.label, metric]));
    const comparable = metrics(prior).map((old) => {
      const current = currentMetrics.get(old.label)?.value ?? null;
      const delta = current === null ? null : current - old.value;
      return {
        label: old.label,
        unit: old.unit,
        previous: old.value,
        current,
        delta,
        improved: delta === null || delta === 0 ? null : old.lowerIsBetter ? delta < 0 : delta > 0,
      };
    });
    return comparable.length ? [{ name: exercise.name, metrics: comparable }] : [];
  });
}
