import { CalendarCheck2, Dumbbell, Flame, Gauge, TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import type { JourneyAnalytics } from '../../types/progress';
import ProgressMetricCard from './ProgressMetricCard';

export interface ProgressSnapshotProps {
  analytics: JourneyAnalytics;
  title?: string;
}

export default function ProgressSnapshot({
  analytics,
  title = 'Tổng quan tiến độ',
}: ProgressSnapshotProps) {
  const titleId = useId();
  const totalSessions = analytics.totalSessions
    ?? analytics.attendance.present + analytics.attendance.late + analytics.attendance.absent;
  const metrics = [
    {
      label: 'Tỷ lệ tham gia',
      value: analytics.attendance.rate === null ? '—' : `${analytics.attendance.rate}%`,
      hint: 'Số buổi có mặt và đi muộn',
      icon: CalendarCheck2,
      featured: true,
    },
    {
      label: 'Tổng buổi tập',
      value: `${totalSessions.toLocaleString('vi-VN')} buổi`,
      hint: 'Tổng số buổi trong giai đoạn đang xem',
      icon: Dumbbell,
    },
    {
      label: 'RPE trung bình',
      value: analytics.averageRpe === null
        ? '—'
        : `RPE ${analytics.averageRpe.toLocaleString('vi-VN')}`,
      hint: 'Cường độ cảm nhận khi tập',
      icon: Gauge,
    },
    {
      label: 'Chuỗi tập',
      value: `${analytics.streakWeeks.toLocaleString('vi-VN')} tuần`,
      hint: 'Số tuần duy trì tập liên tiếp',
      icon: Flame,
    },
  ];

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id={titleId} className="text-base font-bold text-[#003b70] m-0 tracking-tight">
          {title}
        </h3>
      </div>

      <div className="pt-metrics-banner">
        {metrics.map((metric) => (
          <ProgressMetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {analytics.dataQuality.reasons.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950" role="status">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 shrink-0 text-amber-600" size={17} aria-hidden="true" />
            <div>
              <p className="text-sm font-bold">Dữ liệu cần bổ sung</p>
              <ul className="mt-1 space-y-1 text-xs leading-5 text-amber-900">
                {analytics.dataQuality.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
