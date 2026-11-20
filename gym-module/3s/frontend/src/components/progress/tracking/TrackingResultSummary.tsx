import { TRACKING_TYPE_LABELS, type BodyweightResult, type CardioResult, type IntervalResult, type MobilityResult, type StrengthResult, type WorkoutExerciseLog } from '../../../types';
import { normalizeWorkoutExerciseLog } from '../../../utils/sessionTracking';

const number = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const metric = (value: string, key = value) => <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700" key={key}>{value}</span>;
const pace = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')} /km`;
const side = { LEFT: 'Bên trái', RIGHT: 'Bên phải', BOTH: 'Hai bên' } as const;

export default function TrackingResultSummary({ exercise }: { exercise: WorkoutExerciseLog }) {
  const normalized = normalizeWorkoutExerciseLog(exercise);
  const { trackingType, result } = normalized;
  let content;
  if (trackingType === 'STRENGTH' || trackingType === 'LEGACY_STRENGTH') {
    const sets = (result as StrengthResult).sets || [];
    content = <ul className="grid gap-2 sm:grid-cols-2">{sets.map((set, index) => <li className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700" key={set.id || index}><strong className="block text-xs uppercase tracking-wide text-primary">Set {index + 1}</strong><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1"><span>{set.weight ?? '—'} kg × {set.reps ?? '—'} reps</span>{typeof set.rpe === 'number' && <span>RPE {set.rpe}</span>}{typeof set.rir === 'number' && <span>RIR {set.rir}</span>}{typeof set.weight === 'number' && typeof set.reps === 'number' && <span>{number(set.weight * set.reps)} kg volume</span>}</div></li>)}</ul>;
  } else if (trackingType === 'BODYWEIGHT') {
    const sets = (result as BodyweightResult).sets || [];
    content = <ul className="grid gap-2 sm:grid-cols-2">{sets.map((set, index) => <li className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700" key={set.id || index}><strong className="block text-xs uppercase tracking-wide text-primary">Set {index + 1}</strong><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1"><span>{set.reps ?? '—'} reps</span>{typeof set.addedWeight === 'number' && <span>+{number(set.addedWeight)} kg</span>}{typeof set.rpe === 'number' && <span>RPE {set.rpe}</span>}{typeof set.rir === 'number' && <span>RIR {set.rir}</span>}</div></li>)}</ul>;
  } else if (trackingType === 'CARDIO') {
    const value = result as CardioResult; const metrics = [value.durationMinutes != null ? `${number(value.durationMinutes)} phút` : null, value.distanceKm != null ? `${number(value.distanceKm)} km` : null, value.paceSecondsPerKm != null ? pace(value.paceSecondsPerKm) : null, value.averageHeartRate != null ? `${number(value.averageHeartRate)} bpm` : null, value.inclinePercent != null ? `Độ dốc ${number(value.inclinePercent)}%` : null, value.calories != null ? `${number(value.calories)} kcal` : null, value.rpe != null ? `RPE ${number(value.rpe)}` : null].filter((item): item is string => item !== null);
    content = <div className="flex flex-wrap gap-2">{metrics.map((item) => metric(item))}</div>;
  } else if (trackingType === 'INTERVAL') {
    const value = result as IntervalResult; const metrics = [value.rounds != null ? `${number(value.rounds)} vòng` : null, value.workSeconds != null ? `${number(value.workSeconds)} giây làm` : null, value.restSeconds != null ? `${number(value.restSeconds)} giây nghỉ` : null, value.distanceMetersPerRound != null ? `${number(value.distanceMetersPerRound)} m/vòng` : null, value.repsPerRound != null ? `${number(value.repsPerRound)} reps/vòng` : null, value.rpe != null ? `RPE ${number(value.rpe)}` : null].filter((item): item is string => item !== null);
    content = <div className="flex flex-wrap gap-2">{metrics.map((item) => metric(item))}</div>;
  } else if (trackingType === 'MOBILITY') {
    const value = result as MobilityResult; const metrics = [value.durationMinutes != null ? `${number(value.durationMinutes)} phút` : null, value.reps != null ? `${number(value.reps)} reps` : null, value.side ? side[value.side] : null, value.discomfort != null ? `Khó chịu ${number(value.discomfort)}/10` : null].filter((item): item is string => item !== null);
    content = <div className="flex flex-wrap gap-2">{metrics.map((item) => metric(item))}</div>;
  } else content = <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Bài tập chưa có cách ghi nhận.</p>;

  return <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-slate-500">{TRACKING_TYPE_LABELS[trackingType]}</span>{trackingType === 'LEGACY_STRENGTH' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-amber-800">Dữ liệu cũ</span>}</div>{content}</div>;
}
