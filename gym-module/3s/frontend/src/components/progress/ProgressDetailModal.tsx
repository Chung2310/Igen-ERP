import { CircleAlert } from 'lucide-react';
import type { CustomerJourneyDto, CustomerProgressOverview, DailyProgressGroup } from '../../types/progress';
import CustomerJourney from '../customer-portal/CustomerJourney';
import DailyProgressReports from './DailyProgressReports';
import ProgressEmptyState from './ProgressEmptyState';
import ProgressModal from './ProgressModal';
import ProgressReportGenerator from './ProgressReportGenerator';

export default function ProgressDetailModal({
  item,
  journey,
  dailyReportGroups,
  loading,
  onClose,
  onRefresh,
}: {
  item: CustomerProgressOverview | null;
  journey: CustomerJourneyDto | null;
  dailyReportGroups: DailyProgressGroup[];
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <ProgressModal
      open={Boolean(item)}
      title={`Tiến độ ${item?.customer.fullName || ''}`}
      loading={loading}
      onClose={onClose}
    >
      {journey ? (
        <CustomerJourney
          journey={journey}
          reportComposer={(
            <ProgressReportGenerator
              customerId={journey.customer._id}
              onSaved={onRefresh}
            />
          )}
          dailyReportContent={<DailyProgressReports groups={dailyReportGroups} />}
        />
      ) : (
        <ProgressEmptyState
          icon={CircleAlert}
          title="Không có dữ liệu tiến độ"
          description="Không thể tải hành trình của học viên ở thời điểm hiện tại."
        />
      )}
    </ProgressModal>
  );
}
