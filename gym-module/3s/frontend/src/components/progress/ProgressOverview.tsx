import { AlertTriangle } from 'lucide-react';
import type { JourneyAnalytics } from '../../types';
import ProgressSection from './ProgressSection';
import ProgressSnapshot from './ProgressSnapshot';
import TrackingAnalytics from './TrackingAnalytics';

export default function ProgressOverview({ analytics }: { analytics: JourneyAnalytics }) {
  return (
    <div className="flex flex-col gap-4">
      <ProgressSnapshot analytics={analytics} />
      <TrackingAnalytics analytics={analytics.tracking} />
      {analytics.dataQuality.reasons.length > 0 && (
        <ProgressSection
          title="Chất lượng dữ liệu"
          description="Các lưu ý cần xử lý để báo cáo tiến độ chính xác hơn."
          count={analytics.dataQuality.reasons.length}
        >
          <ul className="space-y-2">
            {analytics.dataQuality.reasons.map((reason) => (
              <li className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950" key={reason}>
                <AlertTriangle className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </ProgressSection>
      )}
    </div>
  );
}
