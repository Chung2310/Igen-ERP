import { FileText } from 'lucide-react';
import type { JourneyProgressReport } from '../../types';
import ProgressEmptyState from '../progress/ProgressEmptyState';
import ProgressSection from '../progress/ProgressSection';

export default function CustomerProgress({ reports }: { reports: JourneyProgressReport[] }) {
  return (
    <ProgressSection
      title="Báo cáo tiến độ"
      count={reports.length}
    >
      {reports.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {reports.map((report) => (
            <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-4" key={report._id}>
              <h3 className="text-base font-bold leading-6 text-slate-900">{report.summary}</h3>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {new Date(report.periodStart).toLocaleDateString('vi-VN')} – {new Date(report.periodEnd).toLocaleDateString('vi-VN')}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <ProgressEmptyState
          icon={FileText}
          title="Chưa có báo cáo tiến độ"
          description="Báo cáo đã công bố sẽ xuất hiện tại đây."
        />
      )}
    </ProgressSection>
  );
}
