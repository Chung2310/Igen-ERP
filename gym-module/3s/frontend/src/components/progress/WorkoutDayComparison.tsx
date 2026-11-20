import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ExerciseDayComparison } from '../../services/workoutDayComparison';

const number = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export default function WorkoutDayComparison({ comparisons, dateKey }: {
  comparisons: ExerciseDayComparison[];
  dateKey: string;
}) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() - 1);
  const previousLabel = date.toLocaleDateString('vi-VN');

  return (
    <section aria-label="So sánh bài tập với hôm qua" className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 sm:p-5">
      <h4 className="m-0 text-sm font-bold text-primary">So sánh với hôm qua · {previousLabel}</h4>
      <p className="mt-1 text-xs leading-5 text-slate-600">Chỉ đối chiếu bài tập giống nhau đã ghi trong ngày trước.</p>
      {comparisons.length === 0 ? (
        <p className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-600">
          Chưa có bài tập trùng với ngày trước để so sánh.
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          {comparisons.map((exercise, index) => (
            <article className="rounded-xl border border-slate-200 bg-white p-3" key={`${exercise.name}-${index}`}>
              <h5 className="m-0 text-sm font-bold text-primary">{exercise.name}</h5>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {exercise.metrics.map((metric) => (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs" key={metric.label}>
                    <div className="font-semibold text-slate-500">{metric.label}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 font-bold text-slate-800">
                      <span>Hôm qua {number(metric.previous)} {metric.unit}</span>
                      <span aria-hidden="true">→</span>
                      <span>Hôm nay {metric.current === null ? 'Chưa nhập' : `${number(metric.current)} ${metric.unit}`}</span>
                    </div>
                    {metric.delta !== null && (
                      <span className={`mt-1 inline-flex items-center gap-0.5 font-bold ${metric.improved === true ? 'text-emerald-700' : metric.improved === false ? 'text-rose-700' : 'text-slate-500'}`}>
                        {metric.delta > 0 ? <ArrowUpRight size={13} /> : metric.delta < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                        {metric.delta > 0 ? '+' : ''}{number(metric.delta)} {metric.unit}
                        {metric.improved === true ? ' · Tiến bộ' : metric.improved === false ? ' · Giảm so với hôm qua' : ' · Không đổi'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
