import { CalendarDays, Camera, Ruler } from 'lucide-react';
import type { BodyMeasurementDto, DailyProgressGroup } from '../../types/progress';
import ProgressEmptyState from './ProgressEmptyState';
import ProgressSection from './ProgressSection';
import WorkoutSessionDetail from './WorkoutSessionDetail';

const attendance = {
  PRESENT: { label: 'Có mặt', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  LATE: { label: 'Đi muộn', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  ABSENT: { label: 'Vắng', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
} as const;

const measurementFields: Array<{
  label: string;
  unit: string;
  value: (item: BodyMeasurementDto) => number | undefined;
}> = [
  { label: 'Cân nặng', unit: 'kg', value: (item) => item.weight },
  { label: 'Tỷ lệ mỡ', unit: '%', value: (item) => item.bodyFatPercentage },
  { label: 'Khối lượng cơ', unit: 'kg', value: (item) => item.muscleMass },
  { label: 'Vòng ngực', unit: 'cm', value: (item) => item.measurements?.chest },
  { label: 'Vòng eo', unit: 'cm', value: (item) => item.measurements?.waist },
  { label: 'Vòng hông', unit: 'cm', value: (item) => item.measurements?.hips },
  { label: 'Vòng tay', unit: 'cm', value: (item) => item.measurements?.arm },
  { label: 'Vòng đùi', unit: 'cm', value: (item) => item.measurements?.thigh },
  { label: 'Vòng bắp chân', unit: 'cm', value: (item) => item.measurements?.calf },
];

const formatDate = (dateKey: string) => new Date(`${dateKey}T00:00:00`).toLocaleDateString('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export default function DailyProgressReports({ groups }: { groups: DailyProgressGroup[] }) {
  return (
    <ProgressSection
      title="Ghi nhận theo ngày"
      count={groups.length}
    >
      {groups.length === 0 ? (
        <ProgressEmptyState
          icon={CalendarDays}
          title="Chưa có ghi nhận theo ngày"
          description="Mỗi ngày PT hoàn tất một buổi tập sẽ xuất hiện tại đây."
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const displayDate = formatDate(group.dateKey);
            const measurements = group.measurements.flatMap((measurement) => measurementFields.flatMap((field) => {
              const value = field.value(measurement);
              return typeof value === 'number' && Number.isFinite(value)
                ? [{ key: `${measurement._id}-${field.label}`, label: field.label, value, unit: field.unit }]
                : [];
            }));
            return (
              <article
                className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"
                aria-label={`Ghi nhận ngày ${displayDate}`}
                key={group.dateKey}
              >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-secondary ring-1 ring-inset ring-sky-100">
                      <CalendarDays size={18} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Ngày ghi nhận</p>
                      <time className="font-oswald text-xl font-bold text-primary" dateTime={group.dateKey}>{displayDate}</time>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-primary ring-1 ring-inset ring-slate-200">
                    {group.sessions.length} buổi
                  </span>
                </header>

                <div className="space-y-4">
                  {group.sessions.map((session) => {
                    const state = attendance[session.attendance];
                    return (
                      <div className="space-y-2" key={session._id}>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${state.className}`}>
                          {state.label}
                        </span>
                        <WorkoutSessionDetail session={session} />
                      </div>
                    );
                  })}
                </div>

                {measurements.length > 0 && (
                  <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label={`Số đo ngày ${displayDate}`}>
                    <h3 className="flex items-center gap-2 font-bold text-primary">
                      <Ruler size={17} aria-hidden="true" />
                      Số đo cùng ngày
                    </h3>
                    <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {measurements.map((measurement) => (
                        <div className="rounded-lg bg-slate-50 px-3 py-2" key={measurement.key}>
                          <dt className="text-xs font-semibold text-slate-500">{measurement.label}</dt>
                          <dd className="mt-0.5 font-bold text-slate-900">
                            {measurement.value.toLocaleString('vi-VN')} {measurement.unit}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}

                {group.photos.some((photo) => Boolean(photo.photoUrl)) && (
                  <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label={`Ảnh ngày ${displayDate}`}>
                    <h3 className="flex items-center gap-2 font-bold text-primary">
                      <Camera size={17} aria-hidden="true" />
                      Ảnh cùng ngày
                    </h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.photos.map((photo, index) => photo.photoUrl ? (
                        <img
                          className="aspect-[3/4] w-full rounded-xl object-cover ring-1 ring-slate-200"
                          src={photo.photoUrl}
                          alt={`Ảnh tiến độ ngày ${displayDate} · ${String(photo.angle || 'OTHER')}`}
                          key={String(photo._id || `${group.dateKey}-${index}`)}
                        />
                      ) : null)}
                    </div>
                  </section>
                )}
              </article>
            );
          })}
        </div>
      )}
    </ProgressSection>
  );
}
