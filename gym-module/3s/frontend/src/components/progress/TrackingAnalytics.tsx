import { Activity, Dumbbell, HeartPulse, Repeat2, TimerReset, type LucideIcon } from 'lucide-react';
import { useId } from 'react';
import type { TrackingAnalyticsDto } from '../../types/progress';

interface Metric {
  label: string;
  value: string;
}

interface TrackingSection {
  key: keyof TrackingAnalyticsDto;
  title: string;
  description: string;
  icon: LucideIcon;
  visible: boolean;
  metrics: Metric[];
}

const number = (value: number) => value.toLocaleString('vi-VN');
const nullable = (value: number | null, unit: string) => value === null ? '—' : `${number(value)} ${unit}`;
const pace = (seconds: number | null) => {
  if (seconds === null) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')} /km`;
};

export default function TrackingAnalytics({ analytics }: { analytics?: TrackingAnalyticsDto }) {
  const titleId = useId();
  if (!analytics) return null;
  const sections: TrackingSection[] = [
    {
      key: 'strength',
      title: 'Sức mạnh',
      description: 'Tạ và hiệu suất theo set',
      icon: Dumbbell,
      visible: analytics.strength.totalVolumeKg > 0 || analytics.strength.maxWeightKg !== null || analytics.strength.maxReps !== null || analytics.strength.estimated1RmKg !== null,
      metrics: [
        { label: 'Tổng volume', value: `${number(analytics.strength.totalVolumeKg)} kg` },
        { label: 'Tạ cao nhất', value: nullable(analytics.strength.maxWeightKg, 'kg') },
        { label: 'Reps cao nhất', value: nullable(analytics.strength.maxReps, 'reps') },
        { label: 'Estimated 1RM', value: nullable(analytics.strength.estimated1RmKg, 'kg') },
      ],
    },
    {
      key: 'bodyweight',
      title: 'Trọng lượng cơ thể',
      description: 'Reps và mức tạ bổ sung',
      icon: Activity,
      visible: analytics.bodyweight.totalReps > 0 || analytics.bodyweight.maxReps !== null || analytics.bodyweight.maxAddedWeightKg !== null,
      metrics: [
        { label: 'Tổng reps', value: `${number(analytics.bodyweight.totalReps)} reps` },
        { label: 'Reps cao nhất', value: nullable(analytics.bodyweight.maxReps, 'reps') },
        { label: 'Tạ thêm cao nhất', value: nullable(analytics.bodyweight.maxAddedWeightKg, 'kg') },
      ],
    },
    {
      key: 'cardio',
      title: 'Cardio',
      description: 'Thời lượng, quãng đường và nhịp tim',
      icon: HeartPulse,
      visible: analytics.cardio.durationMinutes > 0 || analytics.cardio.distanceKm > 0 || analytics.cardio.bestPaceSecondsPerKm !== null || analytics.cardio.averageHeartRate !== null,
      metrics: [
        { label: 'Tổng thời lượng', value: `${number(analytics.cardio.durationMinutes)} phút` },
        { label: 'Tổng quãng đường', value: `${number(analytics.cardio.distanceKm)} km` },
        { label: 'Pace tốt nhất', value: pace(analytics.cardio.bestPaceSecondsPerKm) },
        { label: 'Nhịp tim trung bình', value: nullable(analytics.cardio.averageHeartRate, 'bpm') },
      ],
    },
    {
      key: 'interval',
      title: 'Interval',
      description: 'Vòng tập và thời gian làm/nghỉ',
      icon: TimerReset,
      visible: analytics.interval.totalRounds > 0 || analytics.interval.workSeconds > 0 || analytics.interval.restSeconds > 0,
      metrics: [
        { label: 'Tổng số vòng', value: `${number(analytics.interval.totalRounds)} vòng` },
        { label: 'Tổng thời gian làm', value: `${number(analytics.interval.workSeconds)} giây` },
        { label: 'Tổng thời gian nghỉ', value: `${number(analytics.interval.restSeconds)} giây` },
      ],
    },
    {
      key: 'mobility',
      title: 'Mobility',
      description: 'Thời lượng, số lần và mức khó chịu',
      icon: Repeat2,
      visible: analytics.mobility.durationMinutes > 0 || analytics.mobility.completedReps > 0 || analytics.mobility.averageDiscomfort !== null,
      metrics: [
        { label: 'Tổng thời lượng', value: `${number(analytics.mobility.durationMinutes)} phút` },
        { label: 'Tổng số lần', value: `${number(analytics.mobility.completedReps)} reps` },
        { label: 'Khó chịu trung bình', value: analytics.mobility.averageDiscomfort === null ? '—' : `${number(analytics.mobility.averageDiscomfort)}/10` },
      ],
    },
  ];
  const visibleSections = sections.filter((section) => section.visible);

  if (visibleSections.length === 0) return null;

  return (
    <section aria-labelledby={titleId} className="space-y-4 font-montserrat">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary">Không trộn lẫn đơn vị</p>
        <h2 id={titleId} className="mt-1 font-oswald text-2xl font-bold uppercase tracking-tight text-primary sm:text-3xl">
          Phân tích theo loại bài
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
          Mỗi nhóm bài chỉ hiển thị các chỉ số phù hợp với cách ghi nhận của nhóm đó.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {visibleSections.map(({ key, title, description, icon: Icon, metrics }) => (
          <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-secondary ring-1 ring-inset ring-sky-100" aria-hidden="true">
                <Icon size={19} />
              </span>
              <div>
                <h3 className="font-oswald text-xl font-bold uppercase text-primary">{title}</h3>
                <p className="text-xs text-slate-500">{description}</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-inset ring-slate-100">
                  <dt className="text-xs font-semibold text-slate-500">{metric.label}</dt>
                  <dd className="mt-1 font-oswald text-xl font-bold tabular-nums text-slate-900">{metric.value}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
