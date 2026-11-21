import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import ProgressDashboard from '../../components/progress/ProgressDashboard';
import ProgressDetailModal from '../../components/progress/ProgressDetailModal';
import ProgressEmptyState from '../../components/progress/ProgressEmptyState';
import ProgressSkeleton from '../../components/progress/ProgressSkeleton';
import WorkoutSessionModal from '../../components/progress/WorkoutSessionModal';
import { useToast } from '../../components/ui/ToastProvider';
import { api } from '../../services/api';
import { buildDailyProgressGroups } from '../../services/dailyProgressReports';
import { errorMessage, type CustomerJourneyDto, type CustomerProgressOverview } from '../../types';

export default function ProgressPage() {
  const toast = useToast();
  const [items, setItems] = useState<CustomerProgressOverview[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [detailItem, setDetailItem] = useState<CustomerProgressOverview | null>(null);
  const [workoutItem, setWorkoutItem] = useState<CustomerProgressOverview | null>(null);
  const [journey, setJourney] = useState<CustomerJourneyDto | null>(null);
  const dailyReportGroups = useMemo(
    () => journey ? buildDailyProgressGroups(journey) : [],
    [journey],
  );

  const loadOverview = useCallback(async () => {
    setOverviewError(null);
    setOverviewLoading(true);
    try {
      const result = await api.get<CustomerProgressOverview[]>('/api/customers/progress-overview');
      setItems(result.data);
    } catch (caught) {
      const message = errorMessage(caught);
      setOverviewError(message);
      toast.error(message);
    } finally {
      setOverviewLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const close = useCallback(() => {
    setDetailItem(null);
    setWorkoutItem(null);
    setJourney(null);
    setJourneyLoading(false);
  }, []);

  const open = async (item: CustomerProgressOverview, mode: 'detail' | 'workout') => {
    setJourney(null);
    if (mode === 'detail') setDetailItem(item);
    else setWorkoutItem(item);
    setJourneyLoading(true);
    try {
      const result = await api.get<CustomerJourneyDto>(`/api/customers/${item.customer._id}/journey`);
      setJourney(result.data);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setJourneyLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detailItem) return;
    try {
      const result = await api.get<CustomerJourneyDto>(`/api/customers/${detailItem.customer._id}/journey`);
      setJourney(result.data);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const saved = () => {
    close();
    void loadOverview();
  };

  return (
    <div className="pt-view-container">
      {overviewLoading && items.length === 0 && <ProgressSkeleton />}
      {overviewError && items.length === 0 && !overviewLoading && (
        <ProgressEmptyState
          icon={CircleAlert}
          title="Không thể tải tổng quan tiến độ"
          description={overviewError}
          action={
            <button
              type="button"
              className="button button-primary"
              onClick={() => void loadOverview()}
            >
              Thử lại
            </button>
          }
        />
      )}
      {(!overviewLoading || items.length > 0) && !overviewError && (
        <ProgressDashboard
          items={items}
          onView={(item) => void open(item, 'detail')}
          onLogWorkout={(item) => void open(item, 'workout')}
        />
      )}

      <ProgressDetailModal
        item={detailItem}
        journey={detailItem ? journey : null}
        dailyReportGroups={detailItem ? dailyReportGroups : []}
        loading={journeyLoading}
        onClose={close}
        onRefresh={() => void refreshDetail()}
      />
      <WorkoutSessionModal
        item={workoutItem}
        journey={workoutItem ? journey : null}
        loading={journeyLoading}
        onClose={close}
        onSaved={saved}
      />
    </div>
  );
}
